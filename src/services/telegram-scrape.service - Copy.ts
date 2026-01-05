import pool from "../config/mysql.config";
import { getTelegramClient } from "../config/telegram.config";
import { TelegramSourceConfig } from "../types/telegram.type";
import { mediaService } from "./media.service";
import axios from "axios";
import { radarAIService } from "./radar-ai.service";
import { sourceScrape } from "../utils/scrape.utils";

// ========== CONSTANTS ==========
const SIMILARITY_THRESHOLD = 0.65;
const TEXT_COMPARISON_LIMIT = 1000;
const TITLE_MAX_LENGTH = 200;
const TITLE_SHORT_LENGTH = 100;
const OLLAMA_TIMEOUT = 180000;
const OLLAMA_URL = process.env.OLLAMA_API_URL;
const OLLAMA_MDOEL = process.env.OLLAMA_MODEL;
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;

// ========== INTERFACES ==========
interface StoryNumberResult {
  storyNumber: number;
  isNewStory: boolean;
  isBreaking?: boolean;
  similarity?: number;
  matchedArticleId?: number;
}

interface ScrapeResult {
  success: boolean;
  sourceId: number;
  sourceName: string;
  channel: string;
  messagesScraped: number;
  mediaDownloaded: number;
  totalMessages: number;
  skipped: number;
  duplicateUrls: number;
  errors?: string[];
}

interface SimilarityResult {
  same_story: number;
  is_breaking: boolean;
}

// ========== SERVICE ==========
export class ScrapeService {
  private radarAIService;

  constructor() {
    this.radarAIService = radarAIService;
  }

  /**
   * Main scraping orchestrator
   */
  async scrapeFromSource(): Promise<ScrapeResult[]> {
    const sources = await this.fetchActiveSources();
    const results: ScrapeResult[] = [];

    for (const source of sources) {
      try {
        const result = await this.scrapeSource(source);
        results.push(result);
      } catch (error) {
        console.error(
          `❌ Failed to scrape source ${source.source_name}:`,
          error
        );
        results.push(this.createErrorResult(source, error));
      }
    }

    return results;
  }

  /**
   * Fetch active Telegram sources from database
   */
  private async fetchActiveSources(): Promise<any[]> {
    const sources = await sourceScrape("telegram");

    console.log(`🔍 Found ${sources.length} active Telegram sources`);

    if (sources.length === 0) {
      throw new Error("No active Telegram sources found");
    }

    return sources;
  }

  /**
   * Scrape a single source
   */
  private async scrapeSource(source: any): Promise<ScrapeResult> {
    const config: TelegramSourceConfig = this.parseSourceConfig(
      source.source_config
    );
    const channelUsername = config.telegram.username;

    console.log(`\n📄 Scraping: ${source.source_name} (${channelUsername})`);

    const client = getTelegramClient();
    const entity = await client.getEntity(channelUsername);

    const messages = await this.fetchMessages(client, entity, config);

    if (messages.length === 0) {
      console.log("No new messages");
      return this.createSuccessResult(source, channelUsername, 0, 0, 0, 0, 0);
    }

    const stats = await this.processMessages(
      messages,
      source,
      config,
      channelUsername
    );

    await this.updateSourceConfig(source.source_id, config, stats.maxMessageId);

    return this.createSuccessResult(
      source,
      channelUsername,
      stats.savedCount,
      stats.mediaCount,
      messages.length,
      stats.skippedCount,
      stats.duplicateUrlCount
    );
  }

  /**
   * Process all messages from a source
   */
  private async processMessages(
    messages: any[],
    source: any,
    config: TelegramSourceConfig,
    channelUsername: string
  ) {
    let mediaCount = 0;
    let skippedCount = 0;
    let duplicateUrlCount = 0;
    let savedCount = 0;
    let processedGroupIds = new Set<string>();
    let maxMessageId = config.common.state.last_message_id || 0;

    for (const message of messages) {
      try {
        maxMessageId = Math.max(maxMessageId, message.id);

        // Skip already processed groups
        if (this.isProcessedGroup(message, processedGroupIds)) {
          continue;
        }

        // Get media group if applicable
        const mediaGroup = this.getMediaGroup(
          message,
          messages,
          processedGroupIds
        );
        const mainMessage = this.getMainMessage(mediaGroup);

        // Generate message metadata
        const messageUrl = this.generateMessageUrl(
          channelUsername,
          mainMessage.id
        );
        const messagePublished = new Date(mainMessage.date * 1000);
        const processedText = this.processMessageText(
          mainMessage.message,
          config
        );
        const contentHash = this.generateContentHash(processedText);

        // Validate and check for duplicates
        if (this.shouldSkipMessage(processedText, mediaGroup, config)) {
          skippedCount++;
          continue;
        }

        if (await this.isDuplicate(messageUrl, contentHash)) {
          console.log(`⭐️ Skipping duplicate URL: ${messageUrl}`);
          duplicateUrlCount++;
          continue;
        }

        // Process and save article
        const articleId = await this.saveArticle(
          mainMessage,
          processedText,
          contentHash,
          messageUrl,
          messagePublished,
          source,
          config
        );

        if (articleId) {
          savedCount++;

          // Handle media
          const mediaDownloaded = await this.handleMedia(
            mediaGroup,
            articleId,
            channelUsername,
            config
          );

          if (mediaDownloaded) {
            mediaCount++;
          }

          // Process with AI
          await this.processWithAI(articleId);
        }
      } catch (error) {
        console.error(`❌ Failed to process message ${message.id}:`, error);
      }
    }

    return {
      savedCount,
      mediaCount,
      skippedCount,
      duplicateUrlCount,
      maxMessageId,
    };
  }

  /**
   * Save article to database
   */
  private async saveArticle(
    mainMessage: any,
    processedText: string,
    contentHash: string,
    messageUrl: string,
    messagePublished: Date,
    source: any,
    config: TelegramSourceConfig
  ): Promise<number | null> {
    const title = this.generateTitle(processedText, mainMessage.message);

    const storyResult = await this.findOrCreateStoryNumber(
      title,
      processedText,
      source.source_id
    );

    const parentId = storyResult.isNewStory
      ? null
      : await this.findStoryLeader(storyResult.storyNumber);

    const [insertResult] = (await pool.query(
      `INSERT INTO ltng_news_radar (
        radar_parent_id, radar_source_id, radar_title, radar_content,
        radar_content_hash, radar_url, radar_published_at, radar_scraped_at,
        radar_is_story_leader, radar_story_number, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())`,
      [
        parentId,
        source.source_id,
        title,
        processedText,
        contentHash,
        messageUrl,
        messagePublished,
        storyResult.isNewStory,
        storyResult.storyNumber,
      ]
    )) as any;

    return insertResult.insertId;
  }

  /**
   * Find story leader for a given story number
   */
  private async findStoryLeader(storyNumber: number): Promise<number | null> {
    const [leaderRows] = (await pool.query(
      `SELECT radar_id FROM ltng_news_radar 
       WHERE radar_story_number = ? 
         AND radar_is_story_leader = TRUE 
         AND is_deleted = FALSE 
       LIMIT 1`,
      [storyNumber]
    )) as any;

    if (leaderRows.length > 0) {
      console.log(`🔎 Found story leader: Article #${leaderRows[0].radar_id}`);
      return leaderRows[0].radar_id;
    }

    console.warn(`⚠️ No leader found for story #${storyNumber}`);
    return null;
  }

  /**
   * Handle media attachments - only processes the FIRST valid media
   */
  private async handleMedia(
    mediaGroup: any[],
    articleId: number,
    channelUsername: string,
    config: TelegramSourceConfig
  ): Promise<boolean> {
    if (!config.common.media.include) {
      return false;
    }

    // Process only the first valid media
    for (const msg of mediaGroup) {
      if (!msg.media) continue;

      const mediaType: any = this.getMediaType(msg.media);

      if (!this.isMediaTypeAllowed(mediaType, config)) {
        console.log(`⏭️  Skipping media type: ${mediaType} (not allowed)`);
        continue;
      }

      // Found first valid media - process it
      if (config.common.media.download) {
        const mediaPath = await mediaService.downloadMessageMedia(
          msg,
          articleId,
          channelUsername
        );

        if (mediaPath) {
          console.log(`✅ Downloaded first media: ${mediaPath}`);
          return true; // Stop after first successful download
        }
      } else {
        await mediaService.saveMediaInfo(msg, articleId);
        console.log(`✅ Saved first media info`);
        return true; // Stop after first successful save
      }
    }

    console.log(`⚠️  No valid media found in group`);
    return false;
  }

  /**
   * Process article with AI service
   */
  private async processWithAI(articleId: number): Promise<void> {
    try {
      const content_ai = await this.radarAIService.runByArticleId(articleId);
      if (content_ai) {
        console.log("✅ AI processing complete:", content_ai);
      }
    } catch (error) {
      console.error("❌ AI processing failed:", error);
    }
  }

  /**
   * Find or create story number for grouping related articles
   */
  private async findOrCreateStoryNumber(
    title: string,
    content: string,
    sourceId: number
  ): Promise<StoryNumberResult> {
    const existingArticles = await this.fetchRecentArticles(sourceId);

    if (existingArticles.length === 0) {
      const newStoryNumber = await this.generateNewStoryNumber();
      return { storyNumber: newStoryNumber, isNewStory: true };
    }

    const similarArticle = await this.findSimilarArticle(
      title,
      content,
      existingArticles
    );

    if (similarArticle) {
      return {
        storyNumber: similarArticle.radar_story_number,
        isNewStory: false,
      };
    }

    const newStoryNumber = await this.generateNewStoryNumber();
    console.log(
      `🆕 No similar articles found, created new story #${newStoryNumber}`
    );

    return { storyNumber: newStoryNumber, isNewStory: true };
  }

  /**
   * Fetch recent articles for similarity comparison
   */
  private async fetchRecentArticles(sourceId: number): Promise<any[]> {
    const [rows] = await pool.query(
      `
    SELECT * FROM (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY radar_story_number 
          ORDER BY radar_scraped_at ASC
        ) AS rn_first,
        ROW_NUMBER() OVER (
          PARTITION BY radar_story_number 
          ORDER BY radar_scraped_at DESC
        ) AS rn_last
      FROM ltng_news_radar
      WHERE radar_story_number IS NOT NULL
        AND is_deleted = FALSE
        AND radar_source_id != ?
        AND radar_scraped_at >= NOW() - INTERVAL 48 HOUR
    ) t
    WHERE radar_is_story_leader = 1
       OR rn_last = 1
    ORDER BY radar_scraped_at DESC
    LIMIT 200
    `,
      [sourceId]
    );

    return rows as any[];
  }

  /**
   * Find similar article from existing articless
   */
  private async findSimilarArticle(
    title: string,
    content: string,
    existingArticles: any[]
  ): Promise<any | null> {
    const newText = `${title} ${content}`;

    for (const article of existingArticles) {
      const existingText = `${article.radar_title} ${article.radar_content}`;
      const similarity = await this.calculateTextSimilarity(
        newText,
        existingText
      );

      if (similarity && similarity.same_story > SIMILARITY_THRESHOLD) {
        const matchPercent = Math.round(similarity.same_story * 100);
        console.log(
          `🔎 Found similar article (${matchPercent}% match), using story #${article.radar_story_number}`
        );
        return article;
      }
    }

    return null;
  }

  /**
   * Calculate semantic similarity between two texts using AI
   */
  private async calculateTextSimilarity(
    text1: string,
    text2: string
  ): Promise<SimilarityResult | null> {
    try {
      const prompt = this.buildSimilarityPrompt(text1, text2);

      const res = await axios.post(
        `${OLLAMA_URL}/api/generate`,
        {
          model: OLLAMA_MDOEL,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 1000,
          },
        },
        {
          timeout: OLLAMA_TIMEOUT,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OLLAMA_API_KEY}`,
          },
        }
      );

      if (!res.data?.response) {
        throw new Error("Empty response from Ollama");
      }

      const result = this.parseSimilarityResponse(res.data.response);
      this.logSimilarityResult(result);

      return {
        same_story: result.same_story
          ? result.confidence
          : 1 - result.confidence,
        is_breaking: result.is_breaking,
      };
    } catch (error) {
      console.error("❌ AI similarity calculation failed:", error);
      return null;
    }
  }

  private buildSimilarityPrompt(text1: string, text2: string): string {
    const truncate = (
      text: string,
      maxLength: number = TEXT_COMPARISON_LIMIT
    ) =>
      text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

    return `You are a STRICT semantic comparison engine.

TASK: Determine whether Article 1 and Article 2 describe the SAME REAL-WORLD EVENT.

DEFINITION: "SAME STORY" means BOTH articles describe:
- the same people or group
- the same date or time period
- the same location
- the same action
- the same purpose or outcome

RULES:
- Compare ONLY meaning and facts
- IGNORE writing style, formatting, emojis, hashtags
- IGNORE duplicated or truncated sentences
- Do NOT infer missing facts
- If core facts match → same_story = true

BREAKING NEWS CLASSIFICATION:
- BREAKING NEWS: New, urgent, time-sensitive events
- Indicators: "today", "now", "just", "latest", "breaking"
- Emergency, crisis, attack, disaster, arrest, resignation

Article 1:
<<<
${truncate(text1)}
>>>

Article 2:
<<<
${truncate(text2)}
>>>

Respond ONLY with valid JSON. NO markdown. NO extra text.

JSON FORMAT:
{
  "same_story": true or false,
  "difference": 0-100,
  "is_breaking": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "one short sentence"
}`;
  }

  /**
   * Parse AI similarity response
   */
  private parseSimilarityResponse(rawResponse: string): any {
    const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
    const result = JSON.parse(jsonStr);

    if (
      !result.hasOwnProperty("same_story") ||
      !result.hasOwnProperty("confidence")
    ) {
      throw new Error("Invalid response structure from Ollama");
    }

    return result;
  }

  /**
   * Log similarity comparison result
   */
  private logSimilarityResult(result: any): void {
    const status = result.same_story ? "SAME" : "DIFFERENT";
    const confidence = Math.round(result.confidence * 100);
    console.log(
      `🤖 AI comparison: ${status} story (${confidence}% confidence)`
    );
    console.log(`Reasoning: ${result.reasoning}`);
  }

  /**
   * Generate new story number
   */
  private async generateNewStoryNumber(): Promise<number> {
    const [result] = (await pool.query(
      `SELECT MAX(radar_story_number) as max_story_number 
       FROM ltng_news_radar 
       WHERE is_deleted = FALSE`
    )) as any;

    const maxStoryNumber = result[0]?.max_story_number || 0;
    const newStoryNumber = maxStoryNumber + 1;

    console.log(`🆕 Generated new story number: ${newStoryNumber}`);
    return newStoryNumber;
  }

  // ========== HELPER METHODS ==========

  /**
   * Parse source configuration
   */
  private parseSourceConfig(config: any): TelegramSourceConfig {
    return JSON.parse(JSON.stringify(config, null, 3));
  }

  /**
   * Fetch messages from Telegram
   */
  private async fetchMessages(
    client: any,
    entity: any,
    config: TelegramSourceConfig
  ) {
    const fetchLimit = config.common.fetch_limit || 2;
    const lastMessageId = config.common.state.last_message_id || 0;
    const onlyNewMessages =
      config.common.deduplication_strategy === "message_id";

    return await client.getMessages(entity, {
      limit: fetchLimit,
      minId: onlyNewMessages ? lastMessageId : undefined,
    });
  }

  /**
   * Check if message is part of already processed group
   */
  private isProcessedGroup(
    message: any,
    processedGroupIds: Set<string>
  ): boolean {
    return (
      message.groupedId && processedGroupIds.has(message.groupedId.toString())
    );
  }

  /**
   * Get media group for message
   */
  private getMediaGroup(
    message: any,
    allMessages: any[],
    processedGroupIds: Set<string>
  ): any[] {
    if (!message.groupedId) {
      return [message];
    }

    const groupId = message.groupedId.toString();
    const mediaGroup = allMessages.filter(
      (m) => m.groupedId && m.groupedId.toString() === groupId
    );
    processedGroupIds.add(groupId);

    return mediaGroup;
  }

  /**
   * Get main message from media group
   */
  private getMainMessage(mediaGroup: any[]): any {
    return mediaGroup.find((m) => m.message) || mediaGroup[0];
  }

  /**
   * Generate message URL
   */
  private generateMessageUrl(
    channelUsername: string,
    messageId: number
  ): string {
    return `https://t.me/${channelUsername}/${messageId}`;
  }

  /**
   * Process message text according to config
   */
  private processMessageText(
    text: string,
    config: TelegramSourceConfig
  ): string {
    let processedText = text || "";

    if (config.common.content.strip_urls) {
      processedText = this.stripUrls(processedText);
    }

    if (config.common.content.strip_emojis) {
      processedText = this.stripEmojis(processedText);
    }

    return processedText;
  }

  /**
   * Check if message should be skipped
   */
  private shouldSkipMessage(
    processedText: string,
    mediaGroup: any[],
    config: TelegramSourceConfig
  ): boolean {
    const hasMedia = mediaGroup.some((m) => m.media);
    const minLength = config.common.content.min_text_length;

    return processedText.length < minLength && !hasMedia;
  }

  /**
   * Check if article already exists
   */
  private async isDuplicate(
    messageUrl: string,
    contentHash: string
  ): Promise<boolean> {
    const [existingRows] = (await pool.query(
      `SELECT radar_id FROM ltng_news_radar 
       WHERE (radar_url = ? OR radar_content_hash = ?)
         AND is_deleted = FALSE 
       LIMIT 1`,
      [messageUrl, contentHash]
    )) as any;

    return existingRows.length > 0;
  }

  /**
   * Check if media type is allowed
   */
  private isMediaTypeAllowed(
    mediaType: "photo" | "video" | "audio" | "document" | "animation",
    config: TelegramSourceConfig
  ): boolean {
    const allowedTypes = config.common.media.allowed_types;
    return allowedTypes.length === 0 || allowedTypes.includes(mediaType);
  }

  /**
   * Get media type from Telegram media object
   */
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

  /**
   * Strip URLs from text
   */
  private stripUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/g, "");
  }

  /**
   * Strip emojis from text
   */
  private stripEmojis(text: string): string {
    return text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    );
  }

  /**
   * Generate title from message text
   */
  private generateTitle(processedText: string, originalText: string): string {
    const firstLine = (processedText || originalText).split("\n")[0].trim();

    if (firstLine.length > 0) {
      return firstLine.length > TITLE_MAX_LENGTH
        ? firstLine.substring(0, TITLE_MAX_LENGTH - 3) + "..."
        : firstLine;
    }

    const content = (processedText || originalText).trim();
    return content.length > TITLE_SHORT_LENGTH
      ? content.substring(0, TITLE_SHORT_LENGTH - 3) + "..."
      : content || "Untitled";
  }

  /**
   * Generate SHA-256 hash of content for deduplication
   */
  private generateContentHash(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Update source configuration in database
   */
  private async updateSourceConfig(
    sourceId: number,
    config: TelegramSourceConfig,
    maxMessageId: number
  ): Promise<void> {
    config.common.state.last_message_id = maxMessageId;
    config.common.state.last_fetched_at = new Date().toISOString();

    await pool.query(
      `UPDATE ltng_news_sources SET source_config = ? WHERE source_id = ?`,
      [JSON.stringify(config), sourceId]
    );
  }

  /**
   * Create success result object
   */
  private createSuccessResult(
    source: any,
    channel: string,
    messagesScraped: number,
    mediaDownloaded: number,
    totalMessages: number,
    skipped: number,
    duplicateUrls: number
  ): ScrapeResult {
    return {
      success: true,
      sourceId: source.source_id,
      sourceName: source.source_name,
      channel,
      messagesScraped,
      mediaDownloaded,
      totalMessages,
      skipped,
      duplicateUrls,
    };
  }

  /**
   * Create error result object
   */
  private createErrorResult(source: any, error: any): ScrapeResult {
    return {
      success: false,
      sourceId: source.source_id,
      sourceName: source.source_name,
      channel: "",
      messagesScraped: 0,
      mediaDownloaded: 0,
      totalMessages: 0,
      skipped: 0,
      duplicateUrls: 0,
      errors: [error.message],
    };
  }
}
