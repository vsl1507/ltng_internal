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
      console.log(unpostedPosts);
      if (unpostedPosts.length > 0) {
        console.log(`📝 Found ${unpostedPosts.length} new post(s)`);

        for (const post of unpostedPosts) {
          const messageId = await this.botService.sendMessage(
            post.chat_id,
            post.content_en
          );

          await this.postDeliveryService.updateDelivery(
            post.delivery_id,
            messageId,
            "SENT"
          ),
            await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } catch (error) {
      console.error("❌ Error in monitor service:", error);
    }
  }
}
