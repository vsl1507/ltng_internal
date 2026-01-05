import { TelegramPostService } from "./telegram-post.service";
import { NewsPostDeliveryService } from "./post-delivery.service";
import { BotService } from "./bot.service";

export class MonitorService {
  private postDeliveryService: NewsPostDeliveryService;
  private postService: TelegramPostService;
  private botService: BotService;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.postDeliveryService = new NewsPostDeliveryService();
    this.postService = new TelegramPostService();
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

    // Khmer Section
    if (post.title_kh && post.content_kh) {
      message += `🇰🇭 **${post.title_kh}**\n\n`;
      message += `${post.content_kh}\n\n`;
      message += "━━━━━━━━━━━━━━━━\n\n";
    }

    // English Section
    message += `🇬🇧 **${post.title_en}**\n\n`;
    message += `${post.content_en}\n\n`;

    // Source URLs - Safe parsing
    if (post.article_urls) {
      try {
        let urls: string[] = [];

        // Check if it's already an array
        if (Array.isArray(post.article_urls)) {
          urls = post.article_urls;
        }
        // Check if it's a string that needs parsing
        else if (typeof post.article_urls === "string") {
          urls = JSON.parse(post.article_urls);
        }

        if (urls && urls.length > 0) {
          message += "━━━━━━━━━━━━━━━━\n";
          message += "📌 **Sources:**\n";

          urls.forEach((url: string, index: number) => {
            message += `${index + 1}. ${url}\n`;
          });
        }
      } catch (error) {
        console.warn("⚠️ Failed to parse article URLs:", error);
        console.log("Raw article_urls:", post.article_urls);
        // Continue without URLs rather than failing completely
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
}
