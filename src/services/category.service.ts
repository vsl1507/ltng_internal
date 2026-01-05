import axios from "axios";
import pool from "../config/mysql.config";
import {
  CategoryKeyword,
  CategoryMatch,
  ClassificationConfig,
  OllamaCategoryTagResult,
} from "../types/category.type";
import { slugify } from "../utils/helpers";

export class CategoryService {
  private config: ClassificationConfig = {
    keywordThreshold: 3.0,
    useAIFallback: true,
    combineResults: true,
    autoLearnKeywords: true,
    autoLearnMinWeight: 1.5,
  };

  /**
   * Auto-categorize using hybrid approach: Keywords first, AI as fallback
   * Always uses EXISTING categories or creates new ones
   */
  async autoCategorizeAndTag(
    radarId: number,
    title: string,
    content: string,
    userId: number | null
  ): Promise<{
    categoryId: number;
    tagIds: number[];
    method: string;
    isNewCategory: boolean;
  }> {
    console.log(`🔍 Starting hybrid categorization for radar ${radarId}`);

    let categoryId: number;
    let tagIds: number[] = [];
    let method = "";
    let isNewCategory = false;

    // 1. Get existing categories for AI reference
    const existingCategories = await this.getExistingCategories();

    // 2. Try keyword-based matching first
    const keywordMatch = await this.matchByKeywords(title, content);

    // 2. Decide categorization strategy
    if (keywordMatch && keywordMatch.score >= this.config.keywordThreshold) {
      // High confidence keyword match - use existing category
      console.log(
        `✅ Keyword match found: ${keywordMatch.category_name_en} (score: ${keywordMatch.score})`
      );
      categoryId = keywordMatch.category_id;
      method = "keyword";

      // Still use AI for tags generation if configured
      if (this.config.combineResults) {
        const aiResult = await this.classifyWithOllama(
          title,
          content,
          existingCategories
        );
        tagIds = await this.processTagsWithAutoCreate(aiResult.tags, userId);
      }
    } else {
      // Low confidence or no keyword match - use AI
      console.log(
        keywordMatch
          ? `⚠️  Keyword match score too low (${keywordMatch.score}), using AI`
          : "⚠️  No keyword match found, using AI"
      );

      const aiResult = await this.classifyWithOllama(
        title,
        content,
        existingCategories
      );
      method = "ai";

      // Check if AI-suggested category exists, otherwise create it
      const existingCategory = await this.findCategoryByName(
        aiResult.category.en,
        aiResult.category.kh
      );

      if (existingCategory) {
        // Use existing category
        console.log(
          `✅ Using existing category: ${existingCategory.category_name_en} (ID: ${existingCategory.category_id})`
        );
        categoryId = existingCategory.category_id;
        isNewCategory = false;
      } else {
        // Create new category
        console.log(
          `🆕 Creating new category: ${aiResult.category.en} / ${aiResult.category.kh}`
        );
        categoryId = await this.createCategory(
          aiResult.category.en,
          aiResult.category.kh,
          userId
        );
        isNewCategory = true;

        // Auto-learn keywords from this article if enabled
        if (this.config.autoLearnKeywords) {
          await this.autoLearnKeywordsFromArticle(
            categoryId,
            title,
            content,
            aiResult.category.en,
            userId
          );
        }
      }

      // Process tags (create if not exist)
      tagIds = await this.processTagsWithAutoCreate(aiResult.tags, userId);
    }

    // // 3. Save category to radar
    // await pool.query(
    //   `UPDATE ltng_news_radar SET radar_category_id = ? WHERE radar_id = ?`,
    //   [categoryId, radarId]
    // );

    // // 4. Link tags to radar
    // if (tagIds.length > 0) {
    //   await this.attachTagsToRadar(radarId, tagIds);
    // }

    // console.log(
    //   `✅ Categorization complete: Category ${categoryId}, ${
    //     tagIds.length
    //   } tags, method: ${method}${isNewCategory ? " (NEW)" : ""}`
    // );

    return { categoryId, tagIds, method, isNewCategory };
  }

  /**
   * Get all existing categories for AI reference
   */
  private async getExistingCategories(): Promise<
    Array<{ en: string; kh: string }>
  > {
    const [categories]: any = await pool.query(
      `SELECT category_name_en as en, category_name_kh as kh 
       FROM ltng_news_categories 
       WHERE is_deleted = 0 
       ORDER BY category_name_en`
    );

    return categories;
  }

  /**
   * Find existing category by name (fuzzy match on slug)
   */
  private async findCategoryByName(
    nameEn: string,
    nameKh?: string
  ): Promise<{
    category_id: number;
    category_name_en: string;
    category_name_kh: string;
  } | null> {
    const slug = slugify(nameEn);

    // Try exact slug match
    const [exactMatch]: any = await pool.query(
      `SELECT category_id, category_name_en, category_name_kh 
       FROM ltng_news_categories
       WHERE category_slug = ? AND is_deleted = 0`,
      [slug]
    );

    if (exactMatch.length > 0) {
      return exactMatch[0];
    }

    // Try fuzzy match on name (case-insensitive)
    const [fuzzyMatch]: any = await pool.query(
      `SELECT category_id, category_name_en, category_name_kh 
       FROM ltng_news_categories
       WHERE LOWER(category_name_en) = LOWER(?) AND is_deleted = 0`,
      [nameEn]
    );

    if (fuzzyMatch.length > 0) {
      return fuzzyMatch[0];
    }

    // Try Khmer match if provided
    if (nameKh) {
      const [khMatch]: any = await pool.query(
        `SELECT category_id, category_name_en, category_name_kh 
         FROM ltng_news_categories
         WHERE category_name_kh = ? AND is_deleted = 0`,
        [nameKh]
      );

      if (khMatch.length > 0) {
        return khMatch[0];
      }
    }

    return null;
  }

  /**
   * Create new category
   */
  private async createCategory(
    nameEn: string,
    nameKh: string,
    userId: number | null
  ): Promise<number> {
    const slug = slugify(nameEn);

    // Ensure unique slug
    let finalSlug = slug;
    let counter = 1;
    while (await this.slugExists(finalSlug)) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }

    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_categories
       (category_name_en, category_name_kh, category_slug, created_by)
       VALUES (?, ?, ?, ?)`,
      [nameEn, nameKh || nameEn, finalSlug, userId]
    );

    console.log(`✅ Created category: ${nameEn} (ID: ${result.insertId})`);
    return result.insertId;
  }

  /**
   * Check if slug exists
   */
  private async slugExists(slug: string): Promise<boolean> {
    const [rows]: any = await pool.query(
      `SELECT category_id FROM ltng_news_categories WHERE category_slug = ? AND is_deleted = 0`,
      [slug]
    );
    return rows.length > 0;
  }

  /**
   * Auto-learn keywords from article for new category
   */
  private async autoLearnKeywordsFromArticle(
    categoryId: number,
    title: string,
    content: string,
    categoryName: string,
    userId: number | null
  ): Promise<void> {
    console.log(`🧠 Auto-learning keywords for category ${categoryId}...`);

    try {
      // Extract important terms from title and content
      const keywords = this.extractKeywords(title, content, categoryName);

      if (keywords.length === 0) {
        console.log("⚠️  No keywords extracted");
        return;
      }

      // Add keywords with conservative weight
      for (const keyword of keywords) {
        try {
          await this.addCategoryKeyword(
            categoryId,
            keyword,
            "en", // Detect language in production
            this.config.autoLearnMinWeight,
            false, // Fuzzy match for auto-learned
            userId
          );
        } catch (err: any) {
          // Ignore duplicates
          if (!err.message?.includes("Duplicate")) {
            console.warn(
              `⚠️  Could not add keyword "${keyword}":`,
              err.message
            );
          }
        }
      }

      console.log(`✅ Auto-learned ${keywords.length} keywords`);
    } catch (err) {
      console.error("❌ Auto-learning failed:", err);
      // Don't throw - auto-learning is optional
    }
  }

  /**
   * Extract keywords from text (simple implementation)
   * In production, use NLP library like natural or compromise
   */
  private extractKeywords(
    title: string,
    content: string,
    categoryName: string
  ): string[] {
    const keywords: Set<string> = new Set();

    // Add category name itself
    keywords.add(categoryName.toLowerCase());

    // Common stop words to exclude
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "was",
      "are",
      "been",
      "be",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "what",
      "which",
      "who",
      "when",
      "where",
      "why",
      "how",
      "all",
      "each",
      "every",
      "both",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "no",
      "not",
      "only",
      "own",
      "same",
      "so",
      "than",
      "too",
      "very",
      "said",
      "says",
      "just",
      "like",
    ]);

    // Extract from title (higher priority)
    const titleWords = title
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    titleWords.forEach((w) => keywords.add(w));

    // Extract from first 500 chars of content
    const contentWords = content
      .substring(0, 500)
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 5 && !stopWords.has(w));

    // Add most frequent words from content (max 3)
    const wordFreq = new Map<string, number>();
    contentWords.forEach((w) => {
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    });

    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    topWords.forEach((w) => keywords.add(w));

    // Limit to 5 keywords max
    return Array.from(keywords).slice(0, 5);
  }

  /**
   * Process tags - create if they don't exist
   */
  private async processTagsWithAutoCreate(
    tags: Array<{ en: string; kh: string }>,
    userId: number | null
  ): Promise<number[]> {
    const tagIds: number[] = [];

    for (const tag of tags) {
      try {
        const tagId = await this.getOrCreateTag(tag.en, tag.kh, userId);
        tagIds.push(tagId);
      } catch (err) {
        console.warn(`⚠️  Could not create tag "${tag.en}":`, err);
        // Continue with other tags
      }
    }

    return tagIds;
  }

  /**
   * Get or create tag (with better duplicate handling)
   */
  private async getOrCreateTag(
    tagEn: string,
    tagKh: string,
    userId: number | null
  ): Promise<number> {
    const slug = slugify(tagEn);

    // Check if tag exists
    const [rows]: any = await pool.query(
      `SELECT tag_id FROM ltng_news_tags
       WHERE tag_slug = ? AND is_deleted = 0`,
      [slug]
    );

    if (rows.length > 0) {
      return rows[0].tag_id;
    }

    // Create new tag
    try {
      const [result]: any = await pool.query(
        `INSERT INTO ltng_news_tags
         (tag_name_en, tag_name_kh, tag_slug, created_by)
         VALUES (?, ?, ?, ?)`,
        [tagEn, tagKh || tagEn, slug, userId]
      );

      console.log(`✅ Created tag: ${tagEn} (ID: ${result.insertId})`);
      return result.insertId;
    } catch (err: any) {
      // Handle race condition - tag might have been created by another process
      if (err.code === "ER_DUP_ENTRY") {
        const [rows]: any = await pool.query(
          `SELECT tag_id FROM ltng_news_tags WHERE tag_slug = ? AND is_deleted = 0`,
          [slug]
        );
        if (rows.length > 0) {
          return rows[0].tag_id;
        }
      }
      throw err;
    }
  }

  /**
   * Match category by keywords with scoring
   */
  private async matchByKeywords(
    title: string,
    content: string
  ): Promise<CategoryMatch | null> {
    // Get all active keywords
    const [keywords]: any = await pool.query(
      `SELECT 
        ck.keyword_id,
        ck.category_id,
        ck.keyword,
        ck.language,
        ck.weight,
        ck.is_exact_match,
        c.category_name_en,
        c.category_name_kh
      FROM ltng_news_category_keywords ck
      JOIN ltng_news_categories c ON ck.category_id = c.category_id
      WHERE ck.is_deleted = 0 AND c.is_deleted = 0
      ORDER BY ck.weight DESC`
    );

    if (keywords.length === 0) {
      console.log("⚠️  No keywords configured in database");
      return null;
    }

    // Prepare text for matching
    const fullText = `${title} ${content}`.toLowerCase();
    const titleLower = title.toLowerCase();

    // Score each category
    const categoryScores = new Map<
      number,
      {
        score: number;
        category_name_en: string;
        category_name_kh: string;
        matched_keywords: string[];
      }
    >();

    for (const kw of keywords as CategoryKeyword[]) {
      const keywordLower = kw.keyword.toLowerCase();
      let matched = false;
      let matchCount = 0;

      if (kw.is_exact_match) {
        const regex = new RegExp(
          `\\b${this.escapeRegex(keywordLower)}\\b`,
          "gi"
        );
        const matches = fullText.match(regex);
        if (matches) {
          matched = true;
          matchCount = matches.length;
        }
      } else {
        if (fullText.includes(keywordLower)) {
          matched = true;
          const regex = new RegExp(this.escapeRegex(keywordLower), "gi");
          const matches = fullText.match(regex);
          matchCount = matches ? matches.length : 1;
        }
      }

      if (matched) {
        const existing = categoryScores.get(kw.category_id);
        let score = kw.weight * matchCount;

        // 2x bonus if in title
        if (titleLower.includes(keywordLower)) {
          score *= 2;
        }

        if (existing) {
          existing.score += score;
          existing.matched_keywords.push(kw.keyword);
        } else {
          categoryScores.set(kw.category_id, {
            score,
            category_name_en: "",
            category_name_kh: "",
            matched_keywords: [kw.keyword],
          });
        }
      }
    }

    if (categoryScores.size === 0) {
      return null;
    }

    // Find highest scoring category
    let bestMatch: CategoryMatch | null = null;
    let highestScore = 0;

    for (const [categoryId, data] of categoryScores.entries()) {
      if (data.score > highestScore) {
        const [rows]: any = await pool.query(
          `SELECT category_name_en, category_name_kh 
           FROM ltng_news_categories 
           WHERE category_id = ?`,
          [categoryId]
        );

        if (rows.length > 0) {
          highestScore = data.score;
          bestMatch = {
            category_id: categoryId,
            category_name_en: rows[0].category_name_en,
            category_name_kh: rows[0].category_name_kh,
            score: data.score,
            matched_keywords: data.matched_keywords,
          };
        }
      }
    }

    if (bestMatch) {
      console.log(
        `🎯 Best keyword match: ${bestMatch.category_name_en} ` +
          `(score: ${bestMatch.score.toFixed(2)}, ` +
          `keywords: ${bestMatch.matched_keywords.join(", ")})`
      );
    }

    return bestMatch;
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Add a keyword to a category
   */
  async addCategoryKeyword(
    categoryId: number,
    keyword: string,
    language: "en" | "kh",
    weight: number = 1.0,
    isExactMatch: boolean = false,
    userId: number | null = null
  ): Promise<number> {
    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_category_keywords
       (category_id, keyword, language, weight, is_exact_match, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         weight = VALUES(weight),
         is_exact_match = VALUES(is_exact_match),
         updated_by = VALUES(created_by)`,
      [categoryId, keyword, language, weight, isExactMatch, userId]
    );

    return result.insertId || result.affectedRows;
  }

  /**
   * Get all keywords for a category
   */
  async getCategoryKeywords(categoryId: number): Promise<CategoryKeyword[]> {
    const [rows]: any = await pool.query(
      `SELECT * FROM ltng_news_category_keywords
       WHERE category_id = ? AND is_deleted = 0
       ORDER BY weight DESC, keyword`,
      [categoryId]
    );

    return rows;
  }

  /**
   * Bulk import keywords
   */
  async bulkAddKeywords(
    categoryId: number,
    keywords: Array<{
      keyword: string;
      language: "en" | "kh";
      weight?: number;
      isExactMatch?: boolean;
    }>,
    userId: number | null = null
  ): Promise<void> {
    for (const kw of keywords) {
      await this.addCategoryKeyword(
        categoryId,
        kw.keyword,
        kw.language,
        kw.weight || 1.0,
        kw.isExactMatch || false,
        userId
      );
    }
    console.log(
      `✅ Added ${keywords.length} keywords to category ${categoryId}`
    );
  }

  /**
   * Delete a keyword
   */
  async deleteCategoryKeyword(keywordId: number): Promise<void> {
    await pool.query(
      `UPDATE ltng_news_category_keywords SET is_deleted = 1 WHERE keyword_id = ?`,
      [keywordId]
    );
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ClassificationConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ClassificationConfig {
    return { ...this.config };
  }

  async attachTagsToRadar(radarId: number, tagIds: number[]) {
    for (const tagId of tagIds) {
      await pool.query(
        `INSERT IGNORE INTO ltng_news_radar_ai_tags (radar_ai_id, tag_id)
         VALUES (?, ?)`,
        [radarId, tagId]
      );
    }
  }

  private async classifyWithOllama(
    title: string,
    content: string,
    existingCategories: Array<{ en: string; kh: string }> = []
  ): Promise<OllamaCategoryTagResult> {
    // Format existing categories for the prompt
    const categoriesList =
      existingCategories.length > 0
        ? existingCategories.map((c) => `- ${c.en} (${c.kh})`).join("\n")
        : "No existing categories";

    const categoryCount = existingCategories.length;

    const prompt = `
You are a news analysis engine.

${
  categoryCount > 0
    ? `IMPORTANT: There are ${categoryCount} EXISTING categories. You MUST check if the article fits into one of them BEFORE suggesting a new category.`
    : ""
}

EXISTING CATEGORIES (choose from these FIRST):
${categoriesList}

From the article below:
- STEP 1: Check if the article topic matches ANY existing category above
- STEP 2: If YES, use EXACTLY that category name (copy both English and Khmer exactly as shown)
- STEP 3: If NO existing category fits well, ONLY THEN suggest a new broad category
- STEP 4: Identify 2 to 3 specific tags

Category Matching Guidelines:
- An article about elections → use "Politics" (if exists)
- An article about business, trade, GDP → use "Economy" (if exists)  
- An article about smartphones, software, AI → use "Technology" (if exists)
- An article about diseases, hospitals → use "Health" (if exists)
- An article about football, sports events → use "Sports" (if exists)
- An article about climate, floods → use "Environment" (if exists)
- An article about schools, universities → use "Education" (if exists)
- An article about police, crime → use "Crime" (if exists)
- Use existing categories even if they're broad - that's intentional

Rules:
- ALWAYS prefer existing categories (even if broad) over creating new ones
- Only create new category if article truly doesn't fit ANY existing category
- New categories must be broad (1-2 words), not specific topics
- Tags must be nouns and specific to the article
- Use Title Case for English
- Khmer must be natural Khmer language
- Do NOT invent explanations
- Do NOT return markdown
- Respond ONLY valid JSON in this exact format:

{
  "category": {
    "en": "string",
    "kh": "string"
  },
  "tags": [
    { "en": "string", "kh": "string" }
  ]
}

Article title:
${title}

Article content:
${content.substring(0, 2000)}
`;

    try {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
      const apiEndpoint = `${ollamaUrl}/api/generate`;
      const ollamaModel = process.env.OLLAMA_MODEL;
      const ollamaAPIKey = process.env.OLLAMA_API_KEY;

      console.log(`🤖 Calling Ollama API at: ${apiEndpoint}`);

      const res = await axios.post(
        apiEndpoint,
        {
          model: ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 2000,
            num_ctx: 2048,
          },
        },
        {
          timeout: 180000,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ollamaAPIKey}`,
          },
        }
      );

      if (!res.data || !res.data.response) {
        throw new Error("Empty response from Ollama");
      }

      let rawResponse = res.data.response.trim();
      console.log(
        "📥 Ollama raw response (first 500 chars):",
        rawResponse.substring(0, 500)
      );

      let jsonStr = rawResponse;
      const jsonBlockMatch = rawResponse.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
      );
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
      } else {
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      jsonStr = jsonStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      let parsed: OllamaCategoryTagResult;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("📄 Attempted to parse:", jsonStr);
        throw new Error(`Failed to parse Ollama response: ${parseError}`);
      }

      if (!parsed.category?.en || !parsed.tags || !Array.isArray(parsed.tags)) {
        console.error("❌ Invalid structure:", JSON.stringify(parsed, null, 2));
        throw new Error("Invalid response structure from Ollama");
      }

      const validTags = parsed.tags.filter((tag) => tag.en && tag.en.trim());
      parsed.tags = validTags.length > 0 ? validTags : [];

      if (!parsed.category.kh) {
        parsed.category.kh = parsed.category.en;
      }
      parsed.tags = parsed.tags.map((tag) => ({
        en: tag.en,
        kh: tag.kh || tag.en,
      }));

      console.log(
        `✅ Ollama classified: ${parsed.category.en} with ${parsed.tags.length} tags`
      );
      return parsed;
    } catch (err: any) {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";

      if (err.code === "ECONNREFUSED") {
        console.error(`❌ Cannot connect to Ollama at ${ollamaUrl}`);
        throw new Error(`Ollama service is not reachable at ${ollamaUrl}`);
      }

      if (err.code === "ETIMEDOUT" || err.message?.includes("timeout")) {
        console.error(`❌ Ollama request timed out after 60s`);
        throw new Error("Ollama request timed out - check server status");
      }

      if (
        err.code === "ECONNRESET" ||
        err.message?.includes("socket hang up")
      ) {
        console.error(`❌ Connection to Ollama was reset`);
        throw new Error(
          "Connection to Ollama failed - check if service is healthy"
        );
      }

      console.error("❌ Ollama error:", err.message);
      throw err;
    }
  }
}
