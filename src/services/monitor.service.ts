import { NewsPostDeliveryService } from "./post-delivery.service";
import { BotService } from "./bot.service";

export class MonitorService {
  private postDeliveryService: NewsPostDeliveryService;
  private botService: BotService;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.postDeliveryService = new NewsPostDeliveryService();
    this.botService = new BotService();
  }

  start(intervalMs: number = 10000): void {
    console.log(`🔄 Starting monitor service (checking every ${intervalMs}ms)`);

    this.intervalId = setInterval(async () => {
      await this.checkAndPostNewData();
    }, intervalMs);

    // Check immediately on start
    this.checkAndPostNewData();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log("⏹️ Monitor service stopped");
    }
  }

  private async checkAndPostNewData(): Promise<void> {
    try {
      const unpostedPosts = await this.postDeliveryService.getUnpostedPosts();
      console.log(unpostedPosts);

      if (unpostedPosts.length > 0) {
        console.log(`📝 Found ${unpostedPosts.length} new post(s)`);

        for (const post of unpostedPosts) {
          // Format the message
          const formattedMessage = this.formatPostMessage(post);

          // Send to Telegram
          const messageId = await this.botService.sendMessage(
            post.chat_id,
            formattedMessage
          );

          // Update delivery status
          await this.postDeliveryService.updateDelivery(
            post.delivery_id,
            messageId,
            "SENT"
          );

          console.log(
            `✅ Posted to ${post.telegram_name} (Message ID: ${messageId})`
          );

          // Rate limiting delay
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (error) {
      console.error("❌ Error in monitor service:", error);
    }
  }

  private formatPostMessage(post: any): string {
    let message = "";

    /* ---------------- Khmer Section ---------------- */
    if (post.title_kh && post.content_kh) {
      // Category (Khmer)
      if (post.category_name_kh) {
        message += `**#${this.toCamelCase(post.category_name_kh)}**\n`;
      }

      // Tags (Khmer)
      const khTags = this.extractTags(post.tags, "kh");
      if (khTags.length > 0) {
        message +=
          khTags.map((tag) => `#_${this.toCamelCase(tag)}`).join(" ") + "\n";
      }

      // Title + Content (Khmer)
      message += `🇰🇭 **${post.title_kh}**\n\n`;
      message += `${post.content_kh}\n\n`;

      message += "\n━━━━━━━━━━━━━━━━\n\n";
    }

    /* ---------------- English Section ---------------- */

    // Category (English)
    if (post.category_name_en) {
      message += `**#${this.toCamelCase(post.category_name_en)}**\n`;
    }

    // Tags (English)
    const enTags = this.extractTags(post.tags, "en");
    if (enTags.length > 0) {
      message +=
        enTags.map((tag) => `#_${this.toCamelCase(tag)}`).join(" ") + "\n";
    }

    // Title + Content (English)
    message += `🇬🇧 **${post.title_en}**\n\n`;
    message += `${post.content_en}\n\n`;

    /* ---------------- Sources ---------------- */
    if (post.article_urls) {
      try {
        let urls: string[] = [];

        if (Array.isArray(post.article_urls)) {
          urls = post.article_urls;
        } else if (typeof post.article_urls === "string") {
          urls = JSON.parse(post.article_urls);
        }

        if (urls.length > 0) {
          message += "\n━━━━━━━━━━━━━━━━\n";
          message += "📌 **Sources:**\n";

          urls.forEach((url: string, index: number) => {
            message += `${index + 1}. ${url}\n`;
          });
        }
      } catch (error) {
        console.warn("⚠️ Failed to parse article URLs:", error);
      }
    }

    return this.truncateMessage(message);
  }

  private truncateMessage(message: string, maxLength: number = 4096): string {
    if (message.length <= maxLength) {
      return message;
    }

    console.warn(
      `⚠️ Message too long (${message.length} chars), truncating...`
    );
    return (
      message.substring(0, maxLength - 50) + "\n\n[... Content truncated ...]"
    );
  }

  private extractTags(tags: any, lang: "en" | "kh"): string[] {
    try {
      let parsedTags: any[] = [];

      if (Array.isArray(tags)) {
        parsedTags = tags;
      } else if (typeof tags === "string") {
        parsedTags = JSON.parse(tags);
      }

      return parsedTags
        .map((tag) => (lang === "kh" ? tag.tag_name_kh : tag.tag_name_en))
        .filter(Boolean);
    } catch (error) {
      console.warn("⚠️ Failed to parse tags:", error);
      console.log("Raw tags:", tags);
      return [];
    }
  }

  private toCamelCase(text: string): string {
    return text
      .replace(/[^a-zA-Z0-9\u1780-\u17FF\s]/g, "")
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }
}
