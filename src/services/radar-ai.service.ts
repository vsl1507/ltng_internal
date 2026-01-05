import axios from "axios";
import pool from "../config/mysql.config";
import { CategoryService } from "./category.service";

const categoryService = new CategoryService();
interface ProcessStoryResult {
  success: boolean;
  action: "created" | "updated" | "skipped";
  storyNumber: number;
  aiId: number;
  version: number;
  difference?: number;
  reason?: string;
}

export class RadarAIService {
  constructor() {}

  /**
   * Process a single article by its ID
   */
  async runByArticleId(articleId: number) {
    console.log(`🔍 Looking up article Id = ${articleId}...`);

    // Get the article and its story number
    const articles = await pool.query<any>(
      `SELECT *
      FROM ltng_news_radar
      WHERE radar_id = ?
        AND is_deleted = FALSE
      LIMIT 1`,
      articleId
    );

    const article = articles[0];
    // Process the story
    return await this.processStory(article, 1);
  }

  /**
   * Core processing logic for a single story
   */
  private async processStory(article: any, systemUserId: number) {
    const storyNumber = article[0].radar_story_number;
    const articleId = article[0].radar_id;

    if (!storyNumber) {
      console.error(`❌ Article #${articleId} has no story number`);
      throw new Error(`Article #${articleId} has no story number`);
    }

    console.log(`📰 Article #${articleId} belongs to story #${storyNumber}`);

    // Check if AI already generated
    const [existingAI] = await pool.query<any[]>(
      `SELECT 
      radar_ai_id,
      radar_ai_title_en,
      radar_ai_content_en,
      radar_ai_title_kh,
      radar_ai_content_kh,
      radar_ai_version,
      radar_ai_generated_from,
      radar_ai_category_id
     FROM ltng_news_radar_ai
     WHERE radar_ai_story_number = ?
     ORDER BY radar_ai_version DESC
     LIMIT 1`,
      [storyNumber]
    );

    console.log("exists radar ia ", existingAI);

    // if (existingAI.length > 0) {
    //   // Calculate meaning difference
    //   const difference = await this.calculateMeaningDifference(article);
    //   console.log(`📊 Meaning difference: ${difference}%`);
    // }

    const SIMILARITY_THRESHOLD = 80;
    const UPDATE_THRESHOLD = 60;

    // CASE 1: AI content already exists - check if update is needed
    if (existingAI.length > 0) {
      const existing = existingAI[0];
      console.log(
        `📋 Found existing AI content (ID: ${existing.radar_ai_id}, Version: ${existing.radar_ai_version})`
      );

      // Calculate difference between new article and existing AI content
      const newArticleText =
        article[0].radar_title + " " + article[0].radar_content;
      const existingAIText =
        existing.radar_ai_title_en + " " + existing.radar_ai_content_en;

      const differenceResult = await this.calculateContentDifference(
        newArticleText,
        existingAIText
      );

      console.log(`📊 Content Analysis:`);
      console.log(`   Difference: ${differenceResult.difference}%`);
      console.log(
        `   Has new info: ${
          differenceResult.has_new_information ? "YES" : "NO"
        }`
      );
      console.log(`   Reason: ${differenceResult.reasoning}`);

      // SKIP: Too similar, no meaningful update
      if (differenceResult.difference < 100 - SIMILARITY_THRESHOLD) {
        console.log(
          `⏭️  SKIPPED: Content too similar (${
            100 - differenceResult.difference
          }% match)`
        );
        return {
          success: true,
          action: "skipped",
          storyNumber,
          aiId: existing.radar_ai_id,
          version: existing.radar_ai_version,
          difference: differenceResult.difference,
          reason: "Content too similar, no update needed",
        };
      }

      // SKIP: Different but no new important information
      if (!differenceResult.has_new_information) {
        console.log(`⏭️  SKIPPED: No new important information`);
        return {
          success: true,
          action: "skipped",
          storyNumber,
          aiId: existing.radar_ai_id,
          version: existing.radar_ai_version,
          difference: differenceResult.difference,
          reason: "No new important information",
        };
      }

      // UPDATE: Has meaningful new information
      if (
        differenceResult.difference < SIMILARITY_THRESHOLD &&
        differenceResult.difference > UPDATE_THRESHOLD
      ) {
        console.log(
          `🔄 UPDATE NEEDED: ${differenceResult.difference}% different with new info`
        );

        // Generate updated AI content that merges old + new
        const updatedAI = await this.generateUpdatedAIInsight(
          article,
          existing
        );

        // Get existing generated_from array
        let generatedFrom: number[] = [];
        if (existing.radar_ai_generated_from) {
          generatedFrom = JSON.parse(existing.radar_ai_generated_from);
        }

        // Add new article ID if not already included
        if (!generatedFrom.includes(articleId)) {
          generatedFrom.push(articleId);
        }

        const newVersion = existing.radar_ai_version + 1;

        // Auto-categorize the updated content
        // const result = await categoryService.autoCategorizeAndTag(
        //   articleId,
        //   updatedAI.title_en,
        //   updatedAI.content_en,
        //   systemUserId
        // );

        // Update existing AI content with new version
        await pool.query(
          `INSERT INTO ltng_news_radar_ai
         SET 
           radar_ai_title_en = ?,
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
            updatedAI.title_kh || existing.radar_ai_title_kh,
            updatedAI.content_kh || existing.radar_ai_content_kh,
            JSON.stringify(generatedFrom),
            newVersion,
            // result.categoryId,
            systemUserId,
            existing.radar_ai_id,
          ]
        );

        // // Update tags
        // if (result.tagIds.length > 0) {
        //   // Remove old tags
        //   await pool.query(
        //     `DELETE FROM ltng_news_radar_ai_tags WHERE radar_ai_id = ?`,
        //     [existing.radar_ai_id]
        //   );
        //   // Add new tags
        //   await categoryService.attachTagsToRadar(
        //     existing.radar_ai_id,
        //     result.tagIds
        //   );
        // }

        console.log(
          `✅ UPDATED Story #${storyNumber} (Version ${existing.radar_ai_version} → ${newVersion})`
        );
        console.log(`   Generated from ${generatedFrom.length} articles`);

        return {
          success: true,
          action: "updated",
          storyNumber,
          aiId: existing.radar_ai_id,
          version: newVersion,
          difference: differenceResult.difference,
          reason: "Updated with new information",
        };
      }

      // CREATE : If bigger than ex

      if (differenceResult.difference >= UPDATE_THRESHOLD) {
        console.log(`🆕 CREATING NEW AI VERSION`);

        const newAI = await this.generateAIInsight(article);

        let generatedFrom: number[] = [];
        if (existing.radar_ai_generated_from) {
          generatedFrom = JSON.parse(existing.radar_ai_generated_from);
        }
        if (!generatedFrom.includes(articleId)) {
          generatedFrom.push(articleId);
        }

        const [insertResult] = (await pool.query(
          `INSERT INTO ltng_news_radar_ai (
      radar_ai_category_id,
      radar_ai_story_number,
      radar_ai_title_en,
      radar_ai_content_en,
      radar_ai_title_kh,
      radar_ai_content_kh,
      radar_ai_generated_from,
      radar_ai_version,
      radar_ai_is_published,
      radar_ai_published_at,
      radar_ai_status,
      created_by,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            existing.radar_ai_category_id,
            storyNumber,
            newAI.title_en,
            newAI.content_en,
            newAI.title_kh || existing.radar_ai_title_kh,
            newAI.content_kh || existing.radar_ai_content_kh,
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
          aiId: insertResult.insertId,
          version: 1,
          reason: "Major content change",
        };
      }
    }

    // CASE 2: No existing AI content - create new
    console.log(`🆕 Creating new AI content for Story #${storyNumber}`);

    const aiResult = await this.generateAIInsight(article);

    console.log(`✅ Generated AI content:`);
    console.log(`   Title: ${aiResult.title_en?.substring(0, 60)}...`);
    console.log(`   Content length: ${aiResult.content_en?.length || 0} chars`);

    // Auto-categorize
    const result = await categoryService.autoCategorizeAndTag(
      articleId,
      aiResult.title_en,
      aiResult.content_en,
      systemUserId
    );

    const categoryId = result.categoryId;
    const tagIds = result.tagIds;

    // Insert new AI content
    const [insertResult] = (await pool.query(
      `INSERT INTO ltng_news_radar_ai (
      radar_ai_category_id,
      radar_ai_story_number,
      radar_ai_title_en,
      radar_ai_content_en,
      radar_ai_title_kh,
      radar_ai_content_kh,
      radar_ai_generated_from,
      radar_ai_version,
      radar_ai_is_published,
      radar_ai_published_at,
      radar_ai_status,
      created_by,
      updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        categoryId,
        storyNumber,
        aiResult.title_en,
        aiResult.content_en,
        aiResult.title_kh || "",
        aiResult.content_kh || "",
        JSON.stringify([articleId]),
        1, // Initial version
        true,
        new Date(),
        true,
        systemUserId,
        systemUserId,
      ]
    )) as any;

    const aiId = insertResult.insertId;

    // Attach tags
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
   * Calculate difference meaning
   */
  private async calculateMeaningDifference(
    articles: { radar_title: string; radar_content: string }[]
  ): Promise<number> {
    const baseText = articles[0].radar_title + "\n" + articles[0].radar_content;
    const latestText =
      articles[articles.length - 1].radar_title +
      "\n" +
      articles[articles.length - 1].radar_content;

    const prompt = `
Compare the MEANING of these two news articles.
Return ONLY a number from 0 to 100 representing how different the meaning is.

Article A: ${baseText.substring(0, 1000)}

Article B: ${latestText.substring(0, 1000)}
`;
    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const apiEndpoint = `${ollamaUrl}/api/generate`;
    const ollamaAPIKey = process.env.OLLAMA_API_KEY;

    console.log(`🤖 Calculating meaning difference...`);

    const res = await axios.post(
      apiEndpoint,
      {
        model: "gpt-oss:120b-cloud",
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100,
        },
      },
      {
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ollamaAPIKey}`,
        },
      }
    );
    const raw = res.data?.response?.trim();

    const score = Number.parseInt(raw, 10);

    if (Number.isNaN(score)) {
      console.warn("⚠️ Ollama returned non-numeric value:", raw);
      return 0;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate content meaning
   */
  private async calculateContentDifference(
    newArticle: string,
    existingAI: string
  ): Promise<{
    difference: number;
    has_new_information: boolean;
    reasoning: string;
  }> {
    try {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
      const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
      const ollamaAPIKey = process.env.OLLAMA_API_KEY;

      const truncate = (text: string, maxLength: number = 1500) =>
        text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

      const prompt = `You are a news content analyzer.

TASK:
Compare the NEW ARTICLE with the EXISTING AI CONTENT.
Determine:
1. How different is the new article? (0-100%)
2. Does the new article contain NEW IMPORTANT information not in existing content?

NEW IMPORTANT INFORMATION means:
- New facts, numbers, or data
- New developments or updates to the story
- New quotes from sources
- New context or background
- Corrections to previous information

NOT important:
- Reworded sentences with same meaning
- Different writing style
- Minor details or formatting

EXISTING AI CONTENT (what we already have):
<<<
${truncate(existingAI)}
>>>

NEW ARTICLE:
<<<
${truncate(newArticle)}
>>>

Return ONLY valid JSON (no markdown, no extra text):
{
  "difference": 35,
  "has_new_information": true,
  "reasoning": "New article adds updated casualty figures and government response"
}`;

      const res = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model: ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 1000,
            num_ctx: 4096,
          },
        },
        {
          timeout: 120000,
          headers: {
            "Content-Type": "application/json",
            ...(ollamaAPIKey && { Authorization: `Bearer ${ollamaAPIKey}` }),
          },
        }
      );

      let rawResponse = res.data.response || res.data.thinking || "";

      if (!rawResponse) {
        console.warn("⚠️ Empty response from AI, using defaults");
        return {
          difference: 50,
          has_new_information: true,
          reasoning: "AI analysis unavailable",
        };
      }

      rawResponse = rawResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        return {
          difference: 50,
          has_new_information: true,
          reasoning: "Parse error",
        };
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        difference: result.difference || 50,
        has_new_information: result.has_new_information !== false,
        reasoning: result.reasoning || "No reasoning provided",
      };
    } catch (error: any) {
      console.error("❌ Content difference calculation failed:", error.message);
      // Default to allowing update on error
      return {
        difference: 50,
        has_new_information: true,
        reasoning: "Error in AI analysis, defaulting to update",
      };
    }
  }

  /**
   * Generate AI insight
   */

  private async generateAIInsight(
    articles: any[],
    difference?: number
  ): Promise<{
    article_id: number;
    title_en: string;
    content_en: string;
    title_kh: string | null;
    content_kh: string | null;
  }> {
    const artilceId = articles[0].radar_id;
    const combined = articles
      .map(
        (a, i) =>
          `Article ${i + 1}: ${a.radar_title}\n${a.radar_content.substring(
            0,
            500
          )}`
      )
      .join("\n\n");

    const prompt = `
You are a professional news editor.

TASK:
Based on the following ${articles.length} related articles about the SAME REAL-WORLD EVENT,
generate ONE clean, neutral BASE NEWS ARTICLE.

DEFINITION:
A BASE ARTICLE is:
- a single coherent news article
- fact-based and neutral
- free of duplication, opinions, and speculation
- written as if for a professional news outlet

RULES (MANDATORY):
- Use ONLY facts that appear in the provided articles.
- Do NOT invent or infer missing details.
- If facts conflict, use the most commonly stated version.
- Remove repetition, noise, hashtags, emojis, and source-specific wording.
- Do NOT mention sources, platforms, or article counts.
- Do NOT say “according to reports” or similar phrases.
- Keep tone factual and objective.

LANGUAGE RULES:
- English content is REQUIRED.
- Khmer content is OPTIONAL.
- If Khmer is generated, it must match the English meaning.

CONTENT REQUIREMENTS:
- Title must be concise and factual.
- English content length: 200–500 words.
- Structure as a standard news article (lead → details → context).

INPUT ARTICLES:
<<<
${combined}
>>>

OUTPUT RULES:
- Return ONLY valid JSON.
- NO markdown.
- NO extra text.
- No line breaks inside strings
- Always close all quotes and braces

Return ONLY valid JSON FORMAT
{
  "title_en": "Concise factual English title (max 100 chars)",
  "content_en": "Single base news article in English (200–500 words)",
  "title_kh": "Optional Khmer title or null",
  "content_kh": "Optional Khmer content or null"
}
`;

    const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
    const apiEndpoint = `${ollamaUrl}/api/generate`;
    const ollamaAPIKey = process.env.OLLAMA_API_KEY;

    console.log(`🤖 Generating AI insight...`);

    const res = await axios.post(
      apiEndpoint,
      {
        model: "gpt-oss:120b-cloud",
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 2000,
          num_ctx: 4096,
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
    // console.log("API Response : ", res);

    const raw = res.data?.response?.trim();

    if (!raw) {
      throw new Error("Empty AI response");
    }

    // Extract JSON from response
    let jsonStr = raw;
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      console.error("❌ Invalid JSON from AI:", raw);
      throw err;
    }

    return {
      article_id: artilceId,
      title_en: parsed.title_en ?? "",
      content_en: parsed.content_en ?? "",
      title_kh: parsed.title_kh,
      content_kh: parsed.content_kh,
    };
  }

  /**
   * Generate update AI insight
   */
  private async generateUpdatedAIInsight(
    newArticles: any[],
    existingAI: any
  ): Promise<{
    title_en: string;
    content_en: string;
    title_kh: string | null;
    content_kh: string | null;
  }> {
    try {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
      const ollamaModel = process.env.OLLAMA_MODEL || "gpt-oss:120b-cloud";
      const ollamaAPIKey = process.env.OLLAMA_API_KEY;

      // Combine new articles
      const newArticlesText = newArticles
        .map((a, i) => `Article ${i + 1}: ${a.radar_title}\n${a.radar_content}`)
        .join("\n\n---\n\n");

      const prompt = `You are a professional news editor.

TASK:
You have an EXISTING news article and NEW articles about the SAME story.
UPDATE the existing article by integrating new information while keeping the original context.

EXISTING ARTICLE:
Title: ${existingAI.radar_ai_title_en}
Content:
${existingAI.radar_ai_content_en}

NEW ARTICLES WITH UPDATES:
${newArticlesText.substring(0, 2000)}

RULES:
- Keep the original story structure and context
- Add NEW facts, developments, or updates
- Update numbers, figures, or quotes if newer information is available
- Maintain chronological order (old → new developments)
- Remove outdated information if contradicted by new facts
- Keep tone neutral and professional
- English content: 300-600 words
- Khmer content: Optional, translate if possible

Return ONLY valid JSON (no markdown):
{
  "title_en": "Updated English title",
  "content_en": "Updated English content with new information integrated",
  "title_kh": "Updated Khmer title or null",
  "content_kh": "Updated Khmer content or null"
}`;

      const res = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model: ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 3000,
            num_ctx: 4096,
          },
        },
        {
          timeout: 180000,
          headers: {
            "Content-Type": "application/json",
            ...(ollamaAPIKey && { Authorization: `Bearer ${ollamaAPIKey}` }),
          },
        }
      );

      let rawResponse = res.data.response || res.data.thinking || "";

      if (!rawResponse) {
        throw new Error("Empty response from AI");
      }

      rawResponse = rawResponse
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) {
        throw new Error("No JSON in response");
      }

      const result = JSON.parse(jsonMatch[0]);

      return {
        title_en: result.title_en || existingAI.radar_ai_title_en,
        content_en: result.content_en || existingAI.radar_ai_content_en,
        title_kh: result.title_kh || existingAI.radar_ai_title_kh,
        content_kh: result.content_kh || existingAI.radar_ai_content_kh,
      };
    } catch (error: any) {
      console.error("❌ Failed to generate updated AI insight:", error.message);
      // Fallback: generate from scratch
      return this.generateAIInsight(newArticles);
    }
  }
}
