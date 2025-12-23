// services/telegram-auto-scrape.service.ts

import pool from "../config/mysql.config";
import { getTelegramClient } from "../config/telegram.config";
import { TelegramSourceConfig } from "../types/telegram.type";
import { normalizeChannelUsername } from "../utils/helpers";
import { mediaService } from "./media.service";
import newsRadarService from "./news-radar.service";
import { NewMessage } from "telegram/events";
import { Api } from "telegram";

export class TelegramAutoScrapeService {
  private isListening = false;
  private activeSources: Map<string, TelegramSourceConfig> = new Map();

  // Start listening for new messages
  async startAutoScrape(): Promise<void> {
    if (this.isListening) {
      console.log("⚠️ Auto-scrape is already running");
      return;
    }

    console.log("🚀 Starting Telegram Auto-Scrape Service...");

    // Load all active sources
    await this.loadActiveSources();

    if (this.activeSources.size === 0) {
      console.log("⚠️ No active sources found. Auto-scrape not started.");
      return;
    }

    const client = getTelegramClient();

    // Add event handler for new messages
    client.addEventHandler(async (event: any) => {
      await this.handleNewMessage(event);
    }, new NewMessage({}));

    this.isListening = true;
    console.log(
      `✅ Auto-scrape started. Monitoring ${this.activeSources.size} sources`
    );
  }

  // Stop listening
  stopAutoScrape(): void {
    this.isListening = false;
    console.log("🛑 Auto-scrape service stopped");
  }

  // Load active sources from database
  private async loadActiveSources(): Promise<void> {
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

    this.activeSources.clear();

    for (const source of rows) {
      const config: TelegramSourceConfig = JSON.parse(
        JSON.stringify(source.source_config, null, 3)
      );

      if (config.platform === "telegram") {
        const channelUsername = normalizeChannelUsername(
          source.source_config.telegram.username
        );
        this.activeSources.set(channelUsername.toLowerCase(), {
          ...config,
          sourceId: source.source_id,
          sourceName: source.source_name,
        } as any);
        console.log(
          `📌 Loaded source: ${source.source_name} (@${channelUsername})`
        );
      }
    }
  }

  // Handle incoming message
  private async handleNewMessage(event: any): Promise<void> {
    try {
      const message = event.message;

      // Get chat information
      const chat = await message.getChat();
      if (!chat) return;

      // Get channel username
      let channelUsername = "";
      if (chat.username) {
        channelUsername = chat.username.toLowerCase();
      } else if ((chat as any).id) {
        // For channels without username, use ID
        channelUsername = (chat as any).id.toString();
      }

      // Check if this channel is in our active sources
      const config = this.activeSources.get(channelUsername);
      if (!config) {
        return; // Not monitoring this channel
      }

      console.log(
        `\n📨 New message from: ${
          (config as any).sourceName
        } (@${channelUsername})`
      );

      // Apply filters
      if (!this.shouldProcessMessage(message, config)) {
        console.log("⏭️ Message filtered out by config");
        return;
      }

      // Process the message
      await this.processMessage(message, config, channelUsername);
    } catch (error) {
      console.error("❌ Error handling new message:", error);
    }
  }

  // Process a single message
  private async processMessage(
    message: any,
    config: TelegramSourceConfig,
    channelUsername: string
  ): Promise<void> {
    try {
      // Generate message URL
      const messageUrl = `https://t.me/${channelUsername}/${message.id}`;

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
        return;
      }

      // Process text content
      let processedText = message.message || "";
      if (config.content.strip_urls) {
        processedText = this.stripUrls(processedText);
      }
      if (config.content.strip_emojis) {
        processedText = this.stripEmojis(processedText);
      }

      // Check minimum text length
      if (
        processedText.length < config.content.min_text_length &&
        !message.media
      ) {
        console.log(`⏭️ Message too short (${processedText.length} chars)`);
        return;
      }

      // Generate title
      const title = this.generateTitle(processedText, message.message);

      // Generate content hash
      const contentHash = this.generateContentHash(processedText);

      console.log(`💾 Saving message: ${title.substring(0, 50)}...`);

      // Save to database
      const radarData = await newsRadarService.createRadar({
        radar_category_id: 5,
        radar_source_id: (config as any).sourceId,
        radar_title: title,
        radar_content: processedText,
        radar_content_hash: contentHash,
        radar_url: messageUrl,
        radar_published_at: message.date
          ? new Date(message.date * 1000)
          : new Date(),
        radar_scraped_at: new Date(),
        radar_story_number: 123,
        radar_is_breaking: false,
        radar_is_duplicated: false,
        radar_processing_status: "NEW",
        is_deleted: false,
        __v: 0,
      });

      const postId = radarData.radar_id!;

      // Handle media if present
      if (message.media && config.media.include) {
        const mediaType = this.getMediaType(message.media);

        // Check if media type is allowed
        if (
          config.media.allowed_types.length === 0 ||
          config.media.allowed_types.includes(mediaType)
        ) {
          if (config.media.download) {
            const mediaPath = await mediaService.downloadMessageMedia(
              message,
              postId,
              channelUsername
            );
            if (mediaPath) {
              console.log(`📥 Media downloaded: ${mediaPath}`);
            }
          } else {
            await mediaService.saveMediaInfo(message, postId);
          }
        }
      }

      // Update last message ID in config
      await this.updateLastMessageId((config as any).sourceId, message.id);

      console.log(`✅ Message processed successfully (ID: ${postId})`);
    } catch (error) {
      console.error("❌ Error processing message:", error);
    }
  }

  // Update last message ID in database
  private async updateLastMessageId(
    sourceId: number,
    messageId: number
  ): Promise<void> {
    try {
      // Get current config
      const [rows] = (await pool.query(
        `SELECT source_config FROM ltng_news_sources WHERE source_id = ?`,
        [sourceId]
      )) as any;

      if (rows.length > 0) {
        const config = JSON.parse(JSON.stringify(rows[0].source_config));
        config.state.last_message_id = messageId;
        config.state.last_fetched_at = new Date().toISOString();

        // Update in database
        await pool.query(
          `UPDATE ltng_news_sources SET source_config = ? WHERE source_id = ?`,
          [JSON.stringify(config), sourceId]
        );
      }
    } catch (error) {
      console.error("Error updating last message ID:", error);
    }
  }

  // Filter helper
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

  // Generate title
  private generateTitle(processedText: string, originalText: string): string {
    const firstLine = (processedText || originalText).split("\n")[0].trim();

    if (firstLine.length > 0) {
      return firstLine.length > 200
        ? firstLine.substring(0, 197) + "..."
        : firstLine;
    }

    const content = (processedText || originalText).trim();
    return content.length > 100
      ? content.substring(0, 97) + "..."
      : content || "Untitled";
  }

  // Generate content hash
  private generateContentHash(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  // Reload sources (call this when sources are updated)
  async reloadSources(): Promise<void> {
    console.log("🔄 Reloading sources...");
    await this.loadActiveSources();
    console.log(
      `✅ Sources reloaded. Now monitoring ${this.activeSources.size} sources`
    );
  }
}

// Export singleton instance
export const autoScrapeService = new TelegramAutoScrapeService();
