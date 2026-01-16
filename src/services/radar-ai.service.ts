import pool from "../config/mysql.config";
import categoryService, { CategoryService } from "./category.service";
import { NewsRadarAI, NewsRadarAIFilters } from "../models/news-radar-ai.model";
import { PaginatedResponse } from "../models/fb-account.model";
import { RowDataPacket } from "mysql2";
import ollamaService from "./ollama.service";
import {
  BILINGUAL_GENERATION_CONFIG,
  NEWS_UPDATE_CONFIG,
  SIMILARITY_CONFIG,
} from "../types/scrape.type";
import {
  OLLAMA_CLOUD_MODEL,
  OLLAMA_LOCAL_MODEL,
} from "../types/constants.type";

// ========== CONSTANTS ==========
const THRESHOLDS = {
  SIMILARITY: 80,
  UPDATE: 60,
  TRUNCATE_TEXT: 1500,
  CONTENT_PREVIEW: 3000,
} as const;

// ========== TYPES ==========
interface Article {
  radar_id: number;
  radar_story_number: number;
  radar_title: string;
  radar_content: string;
}

interface ExistingAI {
  radar_ai_id: number;
  radar_ai_category_id: number;
  radar_ai_story_number: number;
  radar_ai_title_en: string;
  radar_ai_content_en: string;
  radar_ai_title_kh: string | null;
  radar_ai_content_kh: string | null;
  radar_ai_generated_from: string;
  radar_ai_version: number;
}

interface ProcessStoryResult {
  success: boolean;
  action: "created" | "updated" | "skipped" | "created_new_version";
  storyNumber: number;
  aiId: number;
  version: number;
  difference?: number;
  reason?: string;
}

interface ContentDifference {
  difference: number;
  has_new_information: boolean;
  reasoning: string;
}

interface AIContent {
  title_en: string;
  content_en: string;
  title_kh: string | null;
  content_kh: string | null;
}

interface AIContentWithId extends AIContent {
  article_id: number;
}

// ========== RADAR AI SERVICE ==========
export class RadarAIService {
  constructor() {}

  /**
   * Fetch all news radar ai
   */
  async getAllNewsRadarAI(
    filters: NewsRadarAIFilters
  ): Promise<PaginatedResponse<NewsRadarAI>> {
    const {
      search = "",
      sort_by = "created_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = "WHERE nrai.is_deleted = 0";
    const queryParams: any[] = [];

    if (search) {
      whereClause += ` AND (
        nrai.radar_ai_title_en LIKE ? OR 
        nrai.radar_ai_title_kh LIKE ? OR 
        nrai.radar_ai_content_en LIKE ? OR 
        nrai.radar_ai_content_kh LIKE ? OR 
        nr.radar_title LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      queryParams.push(
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      );
    }

    // Valid sort columns
    const validSortColumns = [
      "created_at",
      "radar_ai_title_en",
      "radar_ai_published_at",
      "radar_ai_story_number",
      "radar_scraped_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortOrder = sort_order === "ASC" ? "ASC" : "DESC";

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM ltng_news_radar_ai nrai
      ${whereClause}
    `;

    const [countResult] = await pool.query<RowDataPacket[]>(
      countQuery,
      queryParams
    );
    const total = countResult[0].total;

    // Get paginated data with related information
    const dataQuery = `
      SELECT 
        nrai.radar_ai_id,
        nrai.radar_ai_category_id,
        nrai.radar_ai_story_number,
        nrai.radar_ai_title_en,
        nrai.radar_ai_content_en,
        nrai.radar_ai_title_kh,
        nrai.radar_ai_content_kh,
        nrai.radar_ai_generated_from,
        nrai.radar_ai_version,
        nrai.radar_ai_is_published,
        nrai.radar_ai_published_at,
        nrai.radar_ai_status,
        nrai.created_at,
        nrai.updated_at,
        nrai.created_by,
        nrai.updated_by,
        nc.category_name_en,
        nc.category_name_kh,
        nc.category_slug,
        GROUP_CONCAT(
          DISTINCT CONCAT(nt.tag_id, ':', nt.tag_name_en, '|', nt.tag_name_kh) 
          SEPARATOR '||'
        ) as tags
      FROM ltng_news_radar_ai nrai
      LEFT JOIN ltng_news_categories nc ON nrai.radar_ai_category_id = nc.category_id
      LEFT JOIN ltng_news_radar_ai_tags nrat ON nrai.radar_ai_id = nrat.radar_ai_id
      LEFT JOIN ltng_news_tags nt ON nrat.tag_id = nt.tag_id AND nt.is_deleted = 0
      ${whereClause}
      GROUP BY nrai.radar_ai_id
      ORDER BY nrai.${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    queryParams.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(dataQuery, queryParams);

    // Format the data
    const formattedData = rows.map((row) => {
      // Parse generated_from JSON
      let generatedFrom = null;
      if (row.radar_ai_generated_from) {
        try {
          generatedFrom =
            typeof row.radar_ai_generated_from === "string"
              ? JSON.parse(row.radar_ai_generated_from)
              : row.radar_ai_generated_from;
        } catch (e) {
          console.warn("Failed to parse radar_ai_generated_from:", e);
        }
      }

      return {
        radar_ai_id: row.radar_ai_id,
        radar_ai_story_number: row.radar_ai_story_number,
        radar_ai_title_en: row.radar_ai_title_en,
        radar_ai_title_kh: row.radar_ai_title_kh,
        radar_ai_content_en: row.radar_ai_content_en,
        radar_ai_content_kh: row.radar_ai_content_kh,
        radar_ai_category_id: row.category_name_en
          ? {
              id: row.radar_ai_category_id,
              name_en: row.category_name_en,
              name_kh: row.category_name_kh,
              slug: row.category_slug,
            }
          : null,
        tags: row.tags
          ? row.tags.split("||").map((tag: string) => {
              const [idAndEn, kh] = tag.split("|");
              const [id, en] = idAndEn.split(":");
              return {
                tag_id: parseInt(id),
                name_en: en,
                name_kh: kh,
              };
            })
          : [],
        radar_ai_generated_from: generatedFrom,
        radar_ai_version: row.radar_ai_version,
        radar_ai_is_published: Boolean(row.radar_ai_is_published),
        radar_ai_published_at: row.radar_ai_published_at,
        radar_ai_status: row.radar_ai_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,
      };
    });

    const total_pages = Math.ceil(total / limit);

    return {
      success: true,
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        total_pages,
      },
    };
  }

  /**
   *
   */
  async getNewsRadarAIbyId(id: number): Promise<NewsRadarAI | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
      nrai.radar_ai_id,
      nrai.radar_ai_category_id,
      nrai.radar_ai_story_number,
      nrai.radar_ai_title_en,
      nrai.radar_ai_content_en,
      nrai.radar_ai_title_kh,
      nrai.radar_ai_content_kh,
      nrai.radar_ai_generated_from,
      nrai.radar_ai_version,
      nrai.radar_ai_is_published,
      nrai.radar_ai_published_at,
      nrai.radar_ai_status,
      nrai.created_at,
      nrai.updated_at,
      nrai.created_by,
      nrai.updated_by,
      nc.category_name_en,
      nc.category_name_kh,
      nc.category_slug,
      GROUP_CONCAT(
        DISTINCT CONCAT(nt.tag_id, ':', nt.tag_name_en, '|', nt.tag_name_kh) 
        SEPARATOR '||'
      ) as tags
    FROM ltng_news_radar_ai nrai
    LEFT JOIN ltng_news_categories nc ON nrai.radar_ai_category_id = nc.category_id
    LEFT JOIN ltng_news_radar_ai_tags nrat ON nrai.radar_ai_id = nrat.radar_ai_id
    LEFT JOIN ltng_news_tags nt ON nrat.tag_id = nt.tag_id AND nt.is_deleted = 0
    WHERE nrai.radar_ai_id = ? AND nrai.is_deleted = 0
    GROUP BY nrai.radar_ai_id`,
      [id]
    );

    if (!rows.length) return null;

    const row = rows[0];

    let generatedFrom = null;
    if (row.radar_ai_generated_from) {
      try {
        generatedFrom =
          typeof row.radar_ai_generated_from === "string"
            ? JSON.parse(row.radar_ai_generated_from)
            : row.radar_ai_generated_from;
      } catch (e) {
        console.warn("Failed to parse radar_ai_generated_from:", e);
      }
    }

    const formatted: NewsRadarAI = {
      radar_ai_id: row.radar_ai_id,
      radar_ai_story_number: row.radar_ai_story_number,
      radar_ai_title_en: row.radar_ai_title_en,
      radar_ai_title_kh: row.radar_ai_title_kh,
      radar_ai_content_en: row.radar_ai_content_en,
      radar_ai_content_kh: row.radar_ai_content_kh,
      radar_ai_category_id: row.category_name_en
        ? {
            id: row.radar_ai_category_id,
            name_en: row.category_name_en,
            name_kh: row.category_name_kh,
            slug: row.category_slug,
          }
        : null,
      tags: row.tags
        ? row.tags
            .split("||")
            .map((tag: string) => {
              const [idAndEn, kh] = tag.split("|");
              if (!idAndEn) return null;
              const [id, en] = idAndEn.split(":");
              return id && en && kh
                ? { tag_id: parseInt(id), name_en: en, name_kh: kh }
                : null;
            })
            .filter(Boolean)
        : [],
      radar_ai_generated_from: generatedFrom,
      radar_ai_version: row.radar_ai_version,
      radar_ai_is_published: Boolean(row.radar_ai_is_published),
      radar_ai_published_at: row.radar_ai_published_at,
      radar_ai_status: row.radar_ai_status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
    };

    return formatted;
  }

  /**
   * Process a single article by its ID
   */
  async runByArticleId(articleId: number): Promise<ProcessStoryResult> {
    console.log(`🔍 Looking up article ID = ${articleId}...`);

    const articles = await this.fetchArticleById(articleId);
    if (articles.length === 0) {
      throw new Error(`Article #${articleId} not found`);
    }

    return this.processStory(articles[0], 1);
  }

  /**
   * Fetch article by ID
   */
  private async fetchArticleById(articleId: number): Promise<Article[]> {
    const [articles] = (await pool.query(
      `SELECT * FROM ltng_news_radar
       WHERE radar_id = ? AND is_deleted = FALSE
       LIMIT 1`,
      [articleId]
    )) as any;

    return articles as Article[];
  }

  /**
   * Core processing logic for a single story
   */
  private async processStory(
    article: Article,
    systemUserId: number
  ): Promise<ProcessStoryResult> {
    const { radar_story_number: storyNumber, radar_id: articleId } = article;

    if (!storyNumber) {
      throw new Error(`Article #${articleId} has no story number`);
    }

    console.log(`📰 Article #${articleId} belongs to story #${storyNumber}`);

    const existingAI = await this.fetchExistingAI(storyNumber);

    if (existingAI) {
      return this.handleExistingStory(
        article,
        existingAI,
        articleId,
        storyNumber,
        systemUserId
      );
    }

    return this.createNewStory(article, articleId, storyNumber, systemUserId);
  }

  /**
   * Fetch existing AI content for a story
   */
  private async fetchExistingAI(
    storyNumber: number
  ): Promise<ExistingAI | null> {
    const [results] = (await pool.query(
      `SELECT * FROM ltng_news_radar_ai
       WHERE radar_ai_story_number = ?
       ORDER BY radar_ai_version DESC
       LIMIT 1`,
      [storyNumber]
    )) as any;

    const aiResults = results as ExistingAI[];
    return aiResults.length > 0 ? aiResults[0] : null;
  }

  /**
   * Handle story with existing AI content
   */
  private async handleExistingStory(
    article: Article,
    existingAI: ExistingAI,
    articleId: number,
    storyNumber: number,
    systemUserId: number
  ): Promise<ProcessStoryResult> {
    console.log(
      `📋 Found existing AI content (ID: ${existingAI.radar_ai_id}, Version: ${existingAI.radar_ai_version})`
    );

    const differenceResult = await this.analyzeContentDifference(
      article,
      existingAI
    );

    this.logContentAnalysis(differenceResult);

    // Decision tree based on difference and new information
    if (this.shouldSkipUpdate(differenceResult)) {
      return this.createSkipResult(existingAI, storyNumber, differenceResult);
    }

    if (this.shouldUpdateExisting(differenceResult)) {
      return this.updateExistingStory(
        article,
        existingAI,
        articleId,
        storyNumber,
        systemUserId,
        differenceResult
      );
    }

    if (this.shouldCreateNewVersion(differenceResult)) {
      return this.createNewVersion(
        article,
        existingAI,
        articleId,
        storyNumber,
        systemUserId
      );
    }

    // Default: skip if no clear action
    return this.createSkipResult(existingAI, storyNumber, differenceResult);
  }

  /**
   * Analyze content difference between new article and existing AI
   */
  private async analyzeContentDifference(
    article: Article,
    existingAI: ExistingAI
  ): Promise<ContentDifference> {
    const newText = `${article.radar_title} ${article.radar_content}`;
    const existingText = `${existingAI.radar_ai_title_en} ${existingAI.radar_ai_content_en}`;

    return this.calculateContentDifference(newText, existingText);
  }

  /**
   * Log content analysis results
   */
  private logContentAnalysis(result: ContentDifference): void {
    console.log(`📊 Content Analysis:`);
    console.log(`   Difference: ${result.difference}%`);
    console.log(
      `   Has new info: ${result.has_new_information ? "YES" : "NO"}`
    );
    console.log(`   Reason: ${result.reasoning}`);
  }

  /**
   * Check if update should be skipped
   */
  private shouldSkipUpdate(result: ContentDifference): boolean {
    const similarity = 100 - result.difference;
    return similarity > THRESHOLDS.SIMILARITY || !result.has_new_information;
  }

  /**
   * Check if existing content should be updated
   */
  private shouldUpdateExisting(result: ContentDifference): boolean {
    return (
      result.difference < THRESHOLDS.SIMILARITY &&
      result.difference > THRESHOLDS.UPDATE &&
      result.has_new_information
    );
  }

  /**
   * Check if new version should be created
   */
  private shouldCreateNewVersion(result: ContentDifference): boolean {
    return result.difference >= THRESHOLDS.UPDATE;
  }

  /**
   * Create skip result
   */
  private createSkipResult(
    existingAI: ExistingAI,
    storyNumber: number,
    differenceResult: ContentDifference
  ): ProcessStoryResult {
    const reason = !differenceResult.has_new_information
      ? "No new important information"
      : `Content too similar (${100 - differenceResult.difference}% match)`;

    console.log(`⏭️  SKIPPED: ${reason}`);

    return {
      success: true,
      action: "skipped",
      storyNumber,
      aiId: existingAI.radar_ai_id,
      version: existingAI.radar_ai_version,
      difference: differenceResult.difference,
      reason,
    };
  }

  /**
   * Update existing story with new information
   */
  private async updateExistingStory(
    article: Article,
    existingAI: ExistingAI,
    articleId: number,
    storyNumber: number,
    systemUserId: number,
    differenceResult: ContentDifference
  ): Promise<ProcessStoryResult> {
    console.log(
      `🔄 UPDATE NEEDED: ${differenceResult.difference}% different with new info`
    );

    const updatedAI = await this.generateUpdatedAIInsight(
      [article],
      existingAI
    );
    const generatedFrom = this.updateGeneratedFrom(existingAI, articleId);
    const newVersion = existingAI.radar_ai_version + 1;

    await pool.query(
      `UPDATE ltng_news_radar_ai
       SET radar_ai_title_en = ?,
           radar_ai_content_en = ?,
           radar_ai_title_kh = ?,
           radar_ai_content_kh = ?,
           radar_ai_generated_from = ?,
           radar_ai_version = ?,
           updated_by = ?,
           updated_at = NOW()
       WHERE radar_ai_id = ?`,
      [
        updatedAI.title_en,
        updatedAI.content_en,
        updatedAI.title_kh || existingAI.radar_ai_title_kh,
        updatedAI.content_kh || existingAI.radar_ai_content_kh,
        JSON.stringify(generatedFrom),
        newVersion,
        systemUserId,
        existingAI.radar_ai_id,
      ]
    );

    console.log(
      `✅ UPDATED Story #${storyNumber} (Version ${existingAI.radar_ai_version} → ${newVersion})`
    );
    console.log(`   Generated from ${generatedFrom.length} articles`);

    return {
      success: true,
      action: "updated",
      storyNumber,
      aiId: existingAI.radar_ai_id,
      version: newVersion,
      difference: differenceResult.difference,
      reason: "Updated with new information",
    };
  }

  /**
   * Create new version of story
   */
  private async createNewVersion(
    article: Article,
    existingAI: ExistingAI,
    articleId: number,
    storyNumber: number,
    systemUserId: number
  ): Promise<ProcessStoryResult> {
    console.log(`🆕 CREATING NEW AI VERSION`);

    const newAI = await this.generateAIInsight([article]);
    const generatedFrom = this.updateGeneratedFrom(existingAI, articleId);

    const [insertResult] = (await pool.query(
      `INSERT INTO ltng_news_radar_ai (
        radar_ai_category_id, radar_ai_story_number, radar_ai_title_en,
        radar_ai_content_en, radar_ai_title_kh, radar_ai_content_kh,
        radar_ai_generated_from, radar_ai_version, radar_ai_is_published,
        radar_ai_published_at, radar_ai_status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        existingAI.radar_ai_category_id,
        storyNumber,
        newAI.title_en,
        newAI.content_en,
        newAI.title_kh || existingAI.radar_ai_title_kh,
        newAI.content_kh || existingAI.radar_ai_content_kh,
        JSON.stringify(generatedFrom),
        1,
        true,
        new Date(),
        true,
        systemUserId,
        systemUserId,
      ]
    )) as any;

    return {
      success: true,
      action: "created_new_version",
      storyNumber,
      aiId: insertResult.insertId,
      version: 1,
      reason: "Major content change",
    };
  }

  /**
   * Create new story
   */
  private async createNewStory(
    article: Article,
    articleId: number,
    storyNumber: number,
    systemUserId: number
  ): Promise<ProcessStoryResult> {
    console.log(`🆕 Creating new AI content for Story #${storyNumber}`);

    const aiResult = await this.generateAIInsight([article]);

    console.log(`✅ Generated AI content:`);
    console.log(`   Title: ${aiResult.title_en?.substring(0, 60)}...`);
    console.log(`   Content length: ${aiResult.content_en?.length || 0} chars`);

    const { categoryId, tagIds } = await categoryService.autoCategorizeAndTag(
      articleId,
      aiResult.title_en,
      aiResult.content_en,
      systemUserId
    );

    const [insertResult] = (await pool.query(
      `INSERT INTO ltng_news_radar_ai (
        radar_ai_category_id, radar_ai_story_number, radar_ai_title_en,
        radar_ai_content_en, radar_ai_title_kh, radar_ai_content_kh,
        radar_ai_generated_from, radar_ai_version, radar_ai_is_published,
        radar_ai_published_at, radar_ai_status, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        storyNumber,
        aiResult.title_en,
        aiResult.content_en,
        aiResult.title_kh || "",
        aiResult.content_kh || "",
        JSON.stringify([articleId]),
        1,
        true,
        new Date(),
        true,
        systemUserId,
        systemUserId,
      ]
    )) as any;

    const aiId = insertResult.insertId;

    if (tagIds.length > 0) {
      await categoryService.attachTagsToRadar(aiId, tagIds);
      console.log(`✅ Linked ${tagIds.length} tags to AI content #${aiId}`);
    }

    console.log(
      `✅ CREATED Story #${storyNumber} (AI ID: ${aiId}, Version: 1)`
    );

    return {
      success: true,
      action: "created",
      storyNumber,
      aiId,
      version: 1,
      reason: "New story created",
    };
  }

  /**
   * Update generated_from array with new article ID
   */
  private updateGeneratedFrom(
    existingAI: ExistingAI,
    articleId: number
  ): number[] {
    let generatedFrom: number[] = [];

    if (existingAI.radar_ai_generated_from) {
      try {
        generatedFrom = JSON.parse(existingAI.radar_ai_generated_from);
      } catch {
        console.warn("⚠️  Failed to parse generated_from, starting fresh");
      }
    }

    if (!generatedFrom.includes(articleId)) {
      generatedFrom.push(articleId);
    }

    return generatedFrom;
  }

  /**
   * Calculate content difference using AI
   */
  private async calculateContentDifference(
    newArticle: string,
    existingAI: string
  ): Promise<ContentDifference> {
    try {
      const prompt: string = this.buildDifferencePrompt(newArticle, existingAI);

      const response = await ollamaService.generate(
        prompt,
        OLLAMA_LOCAL_MODEL,
        35000,
        SIMILARITY_CONFIG
      );

      const result = ollamaService.parseJSON<ContentDifference>(response);

      return {
        difference: result.difference ?? 50,
        has_new_information: result.has_new_information ?? true,
        reasoning: result.reasoning || "No reasoning provided",
      };
    } catch (error: any) {
      console.error("❌ Content difference calculation failed:", error.message);
      return {
        difference: 50,
        has_new_information: true,
        reasoning: "Error in AI analysis, defaulting to update",
      };
    }
  }

  /**
   * Build prompt for content difference analysis
   */
  private buildDifferencePrompt(
    newArticle: string,
    existingAI: string
  ): string {
    const truncate = (text: string, maxLength = 2000) =>
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    return `
    You are a news content analyzer. Compare EXISTING vs NEW content.

    TASK: Determine difference percentage (0-100) and if new article has important updates.

    NEW INFORMATION = new facts, data, quotes, developments, corrections
    NOT NEW = reworded sentences, style changes, minor details

    EXISTING CONTENT: ${truncate(existingAI)}

    NEW ARTICLE: ${truncate(newArticle)}

    Respond with ONLY this JSON (no markdown):
    { "difference": 0-100, 
      "has_new_information": true/false, 
      "reasoning": "brief explanation"
    }`;
  }

  /**
   * Generate AI insight from articles
   */
  private async generateAIInsight(
    articles: Article[]
  ): Promise<AIContentWithId> {
    const combined = articles
      .map(
        (a, i) =>
          `Article ${i + 1}: ${a.radar_title}\n${a.radar_content.substring(
            0,
            THRESHOLDS.CONTENT_PREVIEW
          )}`
      )
      .join("\n\n");

    const prompt = this.buildGenerationPrompt(combined, articles.length);
    const response = await ollamaService.generate(
      prompt,
      OLLAMA_CLOUD_MODEL,
      90000,
      BILINGUAL_GENERATION_CONFIG
    );
    console.log("🧠 AI Generation Response:", response);

    const result = ollamaService.parseJSON<AIContent>(response);

    return {
      article_id: articles[0].radar_id,
      title_en: result.title_en ?? "",
      content_en: result.content_en ?? "",
      title_kh: result.title_kh,
      content_kh: result.content_kh,
    };
  }

  /**
   * Build prompt for AI content generation
   */
  private buildGenerationPrompt(
    combined: string,
    articleCount: number
  ): string {
    const truncate = (text: string, maxLength = 6000) =>
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    return `You are a professional bilingual news editor (English + Khmer).

TASK: Synthesize ${articleCount} articles about the SAME EVENT into ONE base article in BOTH languages.

CRITICAL REQUIREMENTS (MANDATORY):
- English content: REQUIRED - 200-300 words
- Khmer content: REQUIRED - must match English meaning exactly
- Both languages MUST tell the same story with identical facts
- If you cannot generate Khmer, return an error - DO NOT leave it empty

CONTENT RULES:
- Use ONLY facts from provided articles
- Neutral, factual tone (no opinions/speculation)
- Remove duplicates, hashtags, emojis, source mentions
- DO NOT say "according to reports" or reference article sources
- Structure: lead → details → context

INPUT ARTICLES:
${truncate(combined)}

Return ONLY valid JSON with NO null values (no markdown, no line breaks in strings):
{
  "title_en": "factual English title (max 100 chars)",
  "content_en": "English article 200-300 words",
  "title_kh": "ចំណងជើងជាភាសាខ្មែរ (max 100 chars) - REQUIRED",
  "content_kh": "អត្ថបទជាភាសាខ្មែរ 200-300 ពាក្យ - REQUIRED"
}`;
  }

  /**
   * Generate updated AI insight by merging old and new content
   */
  private async generateUpdatedAIInsight(
    newArticles: Article[],
    existingAI: ExistingAI
  ): Promise<AIContent> {
    try {
      const newArticlesText = newArticles
        .map((a, i) => `Article ${i + 1}: ${a.radar_title}\n${a.radar_content}`)
        .join("\n\n---\n\n");

      const prompt = this.buildUpdatePrompt(newArticlesText, existingAI);
      const response = await ollamaService.generate(
        prompt,
        OLLAMA_CLOUD_MODEL,
        120000,
        NEWS_UPDATE_CONFIG
      );

      const result = ollamaService.parseJSON<AIContent>(response);

      return {
        title_en: result.title_en || existingAI.radar_ai_title_en,
        content_en: result.content_en || existingAI.radar_ai_content_en,
        title_kh: result.title_kh || existingAI.radar_ai_title_kh,
        content_kh: result.content_kh || existingAI.radar_ai_content_kh,
      };
    } catch (error: any) {
      console.error("❌ Failed to generate updated AI insight:", error.message);
      return this.generateAIInsight(newArticles);
    }
  }

  /**
   * Build prompt for updating existing content
   */
  private buildUpdatePrompt(
    newArticlesText: string,
    existingAI: ExistingAI
  ): string {
    const truncate = (text: string, maxLength = 3000) =>
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    return `You are a news editor updating an existing article with new developments.

EXISTING ARTICLE:
Title: ${existingAI.radar_ai_title_en}
Content: ${existingAI.radar_ai_content_en}

NEW DEVELOPMENTS:
${truncate(newArticlesText)}

TASK: Merge new information into existing article.

UPDATE RULES:
- PRESERVE original context and story flow
- ADD new facts, quotes, numbers, developments
- UPDATE outdated figures with newer data
- REMOVE contradicted information
- Maintain chronological order: background → latest developments
- Length: 300-600 words (longer than original if substantial updates)
- Tone: neutral, professional

Return ONLY this JSON (no markdown):
{"title_en": "updated title", "content_en": "updated 300-600 word article", "title_kh": null, "content_kh": null}`;
  }
}

export default new RadarAIService();
