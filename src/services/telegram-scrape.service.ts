import pool from "../config/mysql.config";
import { getTelegramClient } from "../config/telegram.config";
import { ScrapeResult, TelegramSourceConfig } from "../types/telegram.type";
import mediaService from "./media.service";
import {
  generateContentHash,
  findOrCreateStoryNumber,
  findStoryLeader,
  isDuplicate,
  stripUrls,
  stripEmojis,
  sourceScrape,
} from "../utils/scrape.utils";
import radarAiService from "./radar-ai.service";
import { TITLE_MAX_LENGTH, TITLE_MIN_LENGTH } from "../types/constants.type";

export class ScrapeService {
  private source = "telegram";

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
          `❌ Failed to scrape source "${source.source_name}":`,
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
    const sources = await sourceScrape(this.source);

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
        const processedText = await this.processMessageText(
          mainMessage.message,
          config
        );
        const contentHash = await generateContentHash(processedText);

        // Validate and check for duplicates
        if (this.shouldSkipMessage(processedText, mediaGroup, config)) {
          skippedCount++;
          continue;
        }

        if (await isDuplicate(messageUrl, contentHash)) {
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

        const article: any = await pool.query(
          "SELECT * FROM ltng_news_radar WHERE id = ?",
          [articleId]
        );

        if (articleId) {
          savedCount++;

          // Handle media
          const mediaDownloaded = await this.handleMedia(
            mediaGroup,
            articleId,
            article.radar_story_number,
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

    const storyResult = await findOrCreateStoryNumber(
      title,
      processedText,
      source.source_id
    );
    const parentId = storyResult.isNewStory
      ? null
      : await findStoryLeader(storyResult.storyNumber);

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
   * Handle media attachments - only processes the FIRST valid media
   */
  private async handleMedia(
    mediaGroup: any[],
    articleId: number,
    storyNumber: number,
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
        const mediaPath = await mediaService.downloadFromTelegram(msg, {
          articleId: articleId,
          sourceName: config.telegram.username,
          sourceType: config.platform,
          storyNumber: storyNumber,
        });

        if (mediaPath) {
          console.log(`✅ Downloaded first media: ${mediaPath}`);
          return true;
        }
      } else {
        console.log(`✅ Saved first media info`);
        return true;
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
      const content_ai = await radarAiService.runByArticleId(articleId);
      if (content_ai) {
        console.log("✅ AI processing complete:", content_ai);
      }
    } catch (error) {
      console.error("❌ AI processing failed:", error);
    }
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
  private async processMessageText(
    text: string,
    config: TelegramSourceConfig
  ): Promise<string> {
    let processedText = text || "";

    if (config.common.content.strip_urls) {
      processedText = await stripUrls(processedText);
    }

    if (config.common.content.strip_emojis) {
      processedText = await stripEmojis(processedText);
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
    return content.length > TITLE_MIN_LENGTH
      ? content.substring(0, TITLE_MIN_LENGTH - 3) + "..."
      : content || "Untitled";
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

export default new ScrapeService();
