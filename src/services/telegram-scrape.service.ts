// services/scrape.service.ts

import pool from "../config/mysql.config";
import { getTelegramClient } from "../config/telegram.config";
import { ScrapeResult, TelegramSourceConfig } from "../types/telegram.type";
import { normalizeChannelUsername } from "../utils/helpers";
import { mediaService } from "./media.service";
import newsRadarService from "./news-radar.service";
import { slugify } from "../utils/helpers";
import axios from "axios";

interface OllamaCategoryTagResult {
  category: {
    en: string;
    kh: string;
  };
  tags: {
    en: string;
    kh: string;
  }[];
}

export class ScrapeService {
  // Scrape based on source_id from ltng_news_sources
  async scrapeFromSource(): Promise<any> {
    // Get source from database
    const [rows] = (await pool.query(
      `SELECT 
      s.source_id,
      s.source_name,
      s.source_config
     FROM ltng_news_sources s
     JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id
     WHERE s.source_is_active = TRUE
     AND s.is_deleted = FALSE`,
      []
    )) as any;

    if (rows.length === 0) {
      throw new Error(`Source not found or inactive`);
    }

    const results = [];

    for (const source of rows) {
      const config: TelegramSourceConfig = JSON.parse(
        JSON.stringify(source.source_config, null, 3)
      );

      // Validate it's a Telegram source
      if (config.platform !== "telegram") {
        throw new Error(
          `Source ${source.source_name} is not a Telegram source`
        );
      }

      // Extract channel username
      let channelUsername = source.source_config.telegram.username;
      channelUsername = normalizeChannelUsername(channelUsername);

      console.log(`\n📄 Scraping: ${source.source_name} (${channelUsername})`);

      const client = getTelegramClient();
      const entity = await client.getEntity(channelUsername);

      // Determine fetch parameters
      // const fetchLimit = config.fetch.fetch_limit || 50;
      const fetchLimit = 2;
      const lastMessageId = config.state.last_message_id || 0;
      const onlyNewMessages = config.deduplication.strategy === "message_id";

      // Fetch messages (only new ones if strategy is message_id)
      const messages = await client.getMessages(entity, {
        limit: fetchLimit,
        minId: onlyNewMessages ? lastMessageId : undefined,
      });

      if (messages.length === 0) {
        console.log("No new messages");
        results.push({
          success: true,
          sourceId: source.source_id,
          sourceName: source.source_name,
          channel: channelUsername,
          messagesScraped: 0,
          mediaDownloaded: 0,
          totalMessages: 0,
        });
        continue;
      }

      let savedCount = 0;
      let mediaCount = 0;
      let skippedCount = 0;
      let duplicateUrlCount = 0;
      let processedGroupIds = new Set<string>();
      let maxMessageId = lastMessageId;

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        // Track highest message ID
        if (message.id > maxMessageId) {
          maxMessageId = message.id;
        }

        // Apply filters from config
        if (!this.shouldProcessMessage(message, config)) {
          skippedCount++;
          continue;
        }

        // Skip if part of already processed group
        if (
          message.groupedId &&
          processedGroupIds.has(message.groupedId.toString())
        ) {
          continue;
        }

        // Handle media groups
        let mediaGroup: any[] = [message];
        if (message.groupedId) {
          const groupId = message.groupedId.toString();
          mediaGroup = messages.filter(
            (m) => m.groupedId && m.groupedId.toString() === groupId
          );
          processedGroupIds.add(groupId);
        }

        // Get main message
        const mainMessage = mediaGroup.find((m) => m.message) || mediaGroup[0];

        // Generate message URL early to check for duplicates
        const messageUrl = `https://t.me/${channelUsername}/${mainMessage.id}`;

        // Check if radar_url already exists in database
        const [existingRows] = (await pool.query(
          `SELECT radar_id FROM ltng_news_radar 
           WHERE radar_url = ? 
           AND is_deleted = FALSE 
           LIMIT 1`,
          [messageUrl]
        )) as any;

        if (existingRows.length > 0) {
          console.log(`⏭️ Skipping duplicate URL: ${messageUrl}`);
          duplicateUrlCount++;
          continue;
        }

        // Process text content based on config
        let processedText = mainMessage.message || "";
        if (config.content.strip_urls) {
          processedText = this.stripUrls(processedText);
        }
        if (config.content.strip_emojis) {
          processedText = this.stripEmojis(processedText);
        }

        // Check minimum text length
        // if (
        //   processedText.length < config.content.min_text_length &&
        //   !mediaGroup.some((m) => m.media)
        // ) {
        //   skippedCount++;
        //   continue;
        // }

        // ==========================================
        // Save post with source_id
        // ==========================================
        if (mainMessage.message || mediaGroup.some((m) => m.media)) {
          const title = this.generateTitle(processedText, mainMessage.message);
          const contentHash = this.generateContentHash(processedText);

          // Step 1: Get AI-generated category FIRST
          // let categoryId = 5; // Fallback default category
          // let tagIds: number[] = [];

          // try {
          //   const aiResult = await this.classifyWithOllama(
          //     title,
          //     processedText
          //   );
          //   categoryId = await this.getOrCreateCategory(
          //     aiResult.category.en,
          //     aiResult.category.kh,
          //     null
          //   );

          //   // Prepare tags for later linking
          //   for (const tag of aiResult.tags) {
          //     const tagId = await this.getOrCreateTag(tag.en, tag.kh, null);
          //     tagIds.push(tagId);
          //   }
          //   console.log(
          //     `🤖 AI classified as category: ${aiResult.category.en}`
          //   );
          // } catch (error) {
          //   console.error(
          //     `⚠️  AI classification failed, using default category:`,
          //     error
          //   );
          // }

          const { categoryId, tagIds } = await this.getCategoryAndTagsFromAI(
            title,
            processedText,
            null // userId
          );

          // Find or create story number based on similarity
          const storyNumber = await this.findOrCreateStoryNumber(
            title,
            processedText,
            categoryId
          );

          // Step 2: Create radar entry with AI-determined category
          const radarData = await newsRadarService.createRadar({
            radar_category_id: categoryId,
            radar_source_id: source.source_id,
            radar_title: title,
            radar_content: processedText,
            radar_content_hash: contentHash,
            radar_url: messageUrl,
            radar_published_at: mainMessage.date
              ? new Date(mainMessage.date * 1000)
              : null,
            radar_scraped_at: new Date(),
            radar_story_number: storyNumber,
            radar_is_breaking: false,
            radar_is_duplicated: false,
            radar_processing_status: "NEW",
            is_deleted: false,
            __v: 0,
          });

          const postId = radarData.radar_id!;
          savedCount++;

          if (tagIds.length > 0) {
            await this.attachTagsToRadar(postId, tagIds);
          }

          // Step 3: Link tags to radar (if AI classification succeeded)
          if (tagIds.length > 0) {
            try {
              await this.attachTagsToRadar(postId, tagIds);
              console.log(`✅ Linked ${tagIds.length} tags to radar ${postId}`);
            } catch (error) {
              console.error(
                `❌ Failed to link tags to radar ${postId}:`,
                error
              );
            }
          }

          // Download media based on config
          if (config.media.include) {
            let mediaInThisPost = 0;

            for (const msg of mediaGroup) {
              if (!msg.media) continue;

              // Check max media limit
              if (
                config.media.max_media_per_message &&
                mediaInThisPost >= config.media.max_media_per_message
              ) {
                break;
              }

              // Check if media type is allowed
              const mediaType = this.getMediaType(msg.media);
              if (
                config.media.allowed_types.length > 0 &&
                !config.media.allowed_types.includes(mediaType)
              ) {
                continue;
              }

              // Download media if configured
              if (config.media.download) {
                const mediaPath = await mediaService.downloadMessageMedia(
                  msg,
                  postId,
                  channelUsername
                );
                if (mediaPath) {
                  mediaCount++;
                  mediaInThisPost++;
                }
              } else {
                // Just save media info without downloading
                await mediaService.saveMediaInfo(msg, postId);
                mediaInThisPost++;
              }
            }
          }
        }
      }

      // Update config state in database
      config.state.last_message_id = maxMessageId;
      config.state.last_fetched_at = new Date().toISOString();

      await pool.query(
        `UPDATE ltng_news_sources 
         SET source_config = ? 
         WHERE source_id = ?`,
        [JSON.stringify(config), source.source_id]
      );

      results.push({
        success: true,
        sourceId: source.source_id,
        sourceName: source.source_name,
        channel: channelUsername,
        messagesScraped: savedCount,
        mediaDownloaded: mediaCount,
        totalMessages: messages.length,
        skipped: skippedCount,
        duplicateUrls: duplicateUrlCount,
      });
    }

    return results;
  }

  // Filter helper: Should we process this message?
  private shouldProcessMessage(
    message: any,
    config: TelegramSourceConfig
  ): boolean {
    // Check if it's a forward
    if (!config.fetch.include_forwards && message.fwdFrom) {
      return false;
    }

    // Check if it's a reply
    if (!config.fetch.include_replies && message.replyTo) {
      return false;
    }

    return true;
  }

  // Get media type
  private getMediaType(media: any): string {
    if (!media) return "unknown";

    if (media.photo) return "photo";
    if (media.document) {
      const mimeType = media.document.mimeType || "";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType.startsWith("audio/")) return "audio";
      return "document";
    }

    return media.className || "unknown";
  }

  // Strip URLs from text
  private stripUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/g, "");
  }

  // Strip emojis from text
  private stripEmojis(text: string): string {
    return text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    );
  }

  private generateTitle(processedText: string, originalText: string): string {
    // Try to get first line as title
    const firstLine = (processedText || originalText).split("\n")[0].trim();

    if (firstLine.length > 0) {
      // Truncate if too long
      return firstLine.length > 200
        ? firstLine.substring(0, 197) + "..."
        : firstLine;
    }

    // Fallback to truncated content
    const content = (processedText || originalText).trim();
    return content.length > 100
      ? content.substring(0, 97) + "..."
      : content || "Untitled";
  }

  // Generate content hash for deduplication
  private generateContentHash(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async autoCategorizeAndTag(
    radarId: number,
    title: string,
    content: string,
    userId: number | null
  ): Promise<{ categoryId: number; tagIds: number[] }> {
    // 1. Ask Ollama
    const aiResult = await this.classifyWithOllama(title, content);

    // 2. Category
    const categoryId = await this.getOrCreateCategory(
      aiResult.category.en,
      aiResult.category.kh,
      userId
    );

    // 3. Save category to radar
    await pool.query(
      `UPDATE ltng_news_radar SET radar_category_id = ? WHERE radar_id = ?`,
      [categoryId, radarId]
    );

    // 4. Tags
    const tagIds: number[] = [];
    for (const tag of aiResult.tags) {
      const tagId = await this.getOrCreateTag(tag.en, tag.kh, userId);
      tagIds.push(tagId);
    }

    // 5. Link tags to radar
    await this.attachTagsToRadar(radarId, tagIds);

    return { categoryId, tagIds };
  }

  // Get category and tags BEFORE creating radar
  private async getCategoryAndTagsFromAI(
    title: string,
    content: string,
    userId: number | null
  ): Promise<{ categoryId: number; tagIds: number[] }> {
    // 1. Ask Ollama for classification
    const aiResult = await this.classifyWithOllama(title, content);

    // 2. Get or create category
    const categoryId = await this.getOrCreateCategory(
      aiResult.category.en,
      aiResult.category.kh,
      userId
    );

    // 3. Get or create tags
    const tagIds: number[] = [];
    for (const tag of aiResult.tags) {
      const tagId = await this.getOrCreateTag(tag.en, tag.kh, userId);
      tagIds.push(tagId);
    }

    console.log(
      `🤖 AI classified as: ${aiResult.category.en} with ${tagIds.length} tags`
    );

    return { categoryId, tagIds };
  }

  private async getOrCreateCategory(
    catEn: string,
    catKh: string,
    userId: number | null
  ): Promise<number> {
    const slug = slugify(catEn);

    const [rows]: any = await pool.query(
      `SELECT category_id FROM ltng_news_categories
       WHERE category_slug = ? AND is_deleted = 0`,
      [slug]
    );

    if (rows.length) return rows[0].category_id;

    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_categories
       (category_name_en, category_name_kh, category_slug, created_by)
       VALUES (?, ?, ?, ?)`,
      [catEn, catKh || catEn, slug, userId]
    );

    return result.insertId;
  }

  private async getOrCreateTag(
    tagEn: string,
    tagKh: string,
    userId: number | null
  ): Promise<number> {
    const slug = slugify(tagEn);

    const [rows]: any = await pool.query(
      `SELECT tag_id FROM ltng_news_tags
       WHERE tag_slug = ? AND is_deleted = 0`,
      [slug]
    );

    if (rows.length) return rows[0].tag_id;

    const [result]: any = await pool.query(
      `INSERT INTO ltng_news_tags
       (tag_name_en, tag_name_kh, tag_slug, created_by)
       VALUES (?, ?, ?, ?)`,
      [tagEn, tagKh || tagEn, slug, userId]
    );

    return result.insertId;
  }

  private async attachTagsToRadar(radarId: number, tagIds: number[]) {
    for (const tagId of tagIds) {
      await pool.query(
        `INSERT IGNORE INTO ltng_news_radar_tags (radar_id, tag_id)
         VALUES (?, ?)`,
        [radarId, tagId]
      );
    }
  }

  private async classifyWithOllama(
    title: string,
    content: string
  ): Promise<OllamaCategoryTagResult> {
    const prompt = `
  You are a news analysis engine.

  From the article below:
  - Identify ONE broad news category
  - Identify 3 to 6 specific tags

  Rules:
  - Category must be broad (1–2 words)
  - Tags must be nouns
  - Use Title Case
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

      console.log(`🤖 Calling Ollama API at: ${apiEndpoint}`);

      const res = await axios.post(
        apiEndpoint,
        {
          model: "qwen2.5:14b",
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 500, // Increased from 200 to allow full response
          },
        },
        {
          timeout: 60000,
          headers: {
            "Content-Type": "application/json",
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

      // Extract JSON from markdown code blocks or raw text
      let jsonStr = rawResponse;

      // Remove markdown code blocks
      const jsonBlockMatch = rawResponse.match(
        /```(?:json)?\s*(\{[\s\S]*?\})\s*```/
      );
      if (jsonBlockMatch) {
        jsonStr = jsonBlockMatch[1];
      } else {
        // Try to find JSON object in the response
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
      }

      // Clean up any remaining markdown or extra text
      jsonStr = jsonStr
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      console.log(
        "🔄 Cleaned JSON string (first 300 chars):",
        jsonStr.substring(0, 300)
      );

      // Parse JSON
      let parsed: OllamaCategoryTagResult;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("❌ JSON parse error:", parseError);
        console.error("📄 Attempted to parse:", jsonStr);
        throw new Error(`Failed to parse Ollama response: ${parseError}`);
      }

      // Validate response structure
      if (!parsed.category?.en || !parsed.tags || !Array.isArray(parsed.tags)) {
        console.error("❌ Invalid structure:", JSON.stringify(parsed, null, 2));
        throw new Error("Invalid response structure from Ollama");
      }

      // Validate tags have required fields
      const validTags = parsed.tags.filter((tag) => tag.en && tag.en.trim());
      if (validTags.length === 0) {
        console.warn("⚠️  No valid tags found, using empty array");
        parsed.tags = [];
      } else {
        parsed.tags = validTags;
      }

      // Ensure Khmer fields exist (use English as fallback)
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
        console.error("   Solutions:");
        console.error("   1. Make sure Ollama is running: ollama serve");
        console.error("   2. Check firewall allows port 11434");
        console.error("   3. Set OLLAMA_API_URL environment variable");
        throw new Error(`Ollama service is not reachable at ${ollamaUrl}`);
      }

      if (err.code === "ETIMEDOUT" || err.message?.includes("timeout")) {
        console.error(`❌ Ollama request timed out after 60s at ${ollamaUrl}`);
        console.error("   This might be due to:");
        console.error("   1. Network latency to remote server");
        console.error("   2. Model not downloaded: ollama pull phi3");
        console.error("   3. Server overloaded or out of memory");
        throw new Error("Ollama request timed out - check server status");
      }

      if (
        err.code === "ECONNRESET" ||
        err.message?.includes("socket hang up")
      ) {
        console.error(`❌ Connection to Ollama was reset at ${ollamaUrl}`);
        console.error("   Try:");
        console.error("   1. Restart Ollama: ollama serve");
        console.error("   2. Pull the model: ollama pull phi3");
        console.error("   3. Check server resources: free -h && top");
        console.error("   4. Check network connectivity between servers");
        throw new Error(
          "Connection to Ollama failed - check if service is healthy"
        );
      }

      console.error("❌ Ollama error:", err.message);
      throw err;
    }
  }

  // Add to ScrapeService class

  /**
   * Find similar articles and get their story number
   * Returns existing story number if similar article found, otherwise generates new one
   */
  private async findOrCreateStoryNumber(
    title: string,
    content: string,
    categoryId: number
  ): Promise<number> {
    // 1. Check for similar articles in the same category (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [existingArticles]: any = await pool.query(
      `SELECT 
      radar_id,
      radar_title,
      radar_content,
      radar_story_number
     FROM ltng_news_radar
     WHERE radar_category_id = ?
     AND radar_scraped_at >= ?
     AND radar_story_number IS NOT NULL
     AND is_deleted = FALSE
     ORDER BY radar_scraped_at DESC
     LIMIT 50`,
      [categoryId, sevenDaysAgo]
    );

    if (existingArticles.length === 0) {
      return await this.generateNewStoryNumber();
    }

    // 2. Calculate similarity with existing articles
    for (const article of existingArticles) {
      const similarity = this.calculateTextSimilarity(
        title + " " + content,
        article.radar_title + " " + article.radar_content
      );

      // If similarity > 70%, consider them the same story
      if (similarity > 0.7) {
        console.log(
          `📎 Found similar article (${Math.round(
            similarity * 100
          )}% match), ` + `using story number: ${article.radar_story_number}`
        );
        return article.radar_story_number;
      }
    }

    // 3. No similar article found, generate new story number
    return await this.generateNewStoryNumber();
  }

  /**
   * Generate a new unique story number
   */
  private async generateNewStoryNumber(): Promise<number> {
    const [result]: any = await pool.query(
      `SELECT MAX(radar_story_number) as max_story_number 
     FROM ltng_news_radar 
     WHERE is_deleted = FALSE`
    );

    const maxStoryNumber = result[0]?.max_story_number || 0;
    const newStoryNumber = maxStoryNumber + 1;

    console.log(`🆕 Generated new story number: ${newStoryNumber}`);
    return newStoryNumber;
  }

  /**
   * Calculate text similarity using Cosine Similarity
   * Returns value between 0 (completely different) and 1 (identical)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .trim();

    const t1 = normalize(text1);
    const t2 = normalize(text2);

    // Tokenize
    const words1 = t1.split(/\s+/);
    const words2 = t2.split(/\s+/);

    // Create word frequency maps
    const freq1 = this.createFrequencyMap(words1);
    const freq2 = this.createFrequencyMap(words2);

    // Calculate cosine similarity
    return this.cosineSimilarity(freq1, freq2);
  }

  /**
   * Create frequency map of words
   */
  private createFrequencyMap(words: string[]): Map<string, number> {
    const freqMap = new Map<string, number>();
    for (const word of words) {
      if (word.length > 2) {
        // Ignore very short words
        freqMap.set(word, (freqMap.get(word) || 0) + 1);
      }
    }
    return freqMap;
  }

  /**
   * Calculate cosine similarity between two frequency maps
   */
  private cosineSimilarity(
    freq1: Map<string, number>,
    freq2: Map<string, number>
  ): number {
    // Get all unique words
    const allWords = new Set([...freq1.keys(), ...freq2.keys()]);

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (const word of allWords) {
      const f1 = freq1.get(word) || 0;
      const f2 = freq2.get(word) || 0;

      dotProduct += f1 * f2;
      magnitude1 += f1 * f1;
      magnitude2 += f2 * f2;
    }

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2));
  }

  /**
   * Manual method: Link articles to same story by IDs
   */
  async linkArticlesToStory(
    radarIds: number[],
    storyNumber?: number
  ): Promise<void> {
    if (radarIds.length === 0) {
      throw new Error("No radar IDs provided");
    }

    // Use provided story number or get the first article's story number
    let targetStoryNumber = storyNumber;

    if (!targetStoryNumber) {
      const [firstArticle]: any = await pool.query(
        `SELECT radar_story_number FROM ltng_news_radar 
       WHERE radar_id = ? AND is_deleted = FALSE`,
        [radarIds[0]]
      );

      if (firstArticle.length === 0) {
        throw new Error(`Radar ID ${radarIds[0]} not found`);
      }

      targetStoryNumber =
        firstArticle[0].radar_story_number ||
        (await this.generateNewStoryNumber());
    }

    // Update all articles to use the same story number
    await pool.query(
      `UPDATE ltng_news_radar 
     SET radar_story_number = ? 
     WHERE radar_id IN (?) 
     AND is_deleted = FALSE`,
      [targetStoryNumber, radarIds]
    );

    console.log(
      `✅ Linked ${radarIds.length} articles to story number ${targetStoryNumber}`
    );
  }

  /**
   * Get all articles in the same story
   */
  async getArticlesByStoryNumber(storyNumber: number): Promise<any[]> {
    const [articles]: any = await pool.query(
      `SELECT 
      r.radar_id,
      r.radar_title,
      r.radar_content,
      r.radar_url,
      r.radar_published_at,
      r.radar_scraped_at,
      s.source_name,
      c.category_name_en
     FROM ltng_news_radar r
     LEFT JOIN ltng_news_sources s ON r.radar_source_id = s.source_id
     LEFT JOIN ltng_news_categories c ON r.radar_category_id = c.category_id
     WHERE r.radar_story_number = ?
     AND r.is_deleted = FALSE
     ORDER BY r.radar_published_at DESC`,
      [storyNumber]
    );

    return articles;
  }
}
