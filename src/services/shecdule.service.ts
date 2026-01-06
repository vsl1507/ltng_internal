import * as cron from "node-cron";
import pool from "../config/mysql.config";
import { ResultSetHeader } from "mysql2";

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  // Initialize all scheduled jobs
  initializeJobs(): void {
    console.log("Initializing scheduled jobs...");

    // // Run cleanup daily at 2 AM
    // this.scheduleCleanupJob();

    // Optional: Run cleanup check every 6 hours
    this.scheduleFrequentCleanup();
  }

  // Main cleanup job - runs daily at 2 AM
  private scheduleCleanupJob(): void {
    // const job = cron.schedule("0 2 * * *", async () => {
    //   console.log("Running scheduled cleanup job at", new Date().toISOString());
    //   await this.cleanupOldDeletedRecords();
    // });

    const job = cron.schedule("40 16 * * *", async () => {
      console.log("Running scheduled cleanup job at", new Date().toISOString());
      await this.cleanupOldDeletedRecords();
    });

    this.jobs.set("dailyCleanup", job);
    console.log("✓ Daily cleanup job scheduled (2 AM daily)");
  }

  // Optional: More frequent cleanup - every 6 hours
  private scheduleFrequentCleanup(): void {
    console.log("Running frequent cleanup at");
    const job = cron.schedule("* * * * *", async () => {
      console.log("Running frequent cleanup at", new Date().toISOString());
      await this.cleanupOldDeletedRecords();
    });

    this.jobs.set("frequentCleanup", job);
    console.log("✓ Frequent cleanup job scheduled (every 6 hours)");
  }

  // Main cleanup logic
  private async cleanupOldDeletedRecords(): Promise<void> {
    try {
      console.log("Starting cleanup of old deleted records...");

      // Cleanup news radar records
      const radarCount = await this.cleanupNewsRadar();
      console.log(`✓ Cleaned up ${radarCount} news radar records`);

      // Cleanup telegram records
      const telegramCount = await this.cleanupTelegram();
      console.log(`✓ Cleaned up ${telegramCount} telegram records`);

      // Add more cleanup methods for other tables as needed

      console.log("Cleanup completed successfully");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  // Cleanup news radar records deleted more than 7 days ago
  private async cleanupNewsRadar(): Promise<number> {
    const queries = [
      `DELETE FROM ltng_news_radar
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_radar_ai
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_tags
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_radar_ai_tags
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_media
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_post_deliveries
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,

      `DELETE FROM ltng_news_radar_media
       AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    ];

    let totalAffected = 0;

    for (const q of queries) {
      const [result] = await pool.query<ResultSetHeader>(q);
      totalAffected += result.affectedRows;
    }

    return totalAffected;
  }

  // Cleanup telegram records deleted more than 7 days ago
  private async cleanupTelegram(): Promise<number> {
    const query = `
      DELETE FROM ltng_news_radar
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_radar_ai
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_tags
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_radar_ai_tags
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_media
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_post_deliveries
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);

DELETE FROM ltng_news_radar_media
  AND updated_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
    `;

    try {
      const [result] = await pool.query<ResultSetHeader>(query);
      return result.affectedRows;
    } catch (error) {
      console.error("Error cleaning up telegram:", error);
      return 0;
    }
  }

  // Manual cleanup trigger (can be called via API endpoint)
  async runManualCleanup(): Promise<{
    success: boolean;
    radarCount: number;
    telegramCount: number;
  }> {
    try {
      const radarCount = await this.cleanupNewsRadar();
      const telegramCount = await this.cleanupTelegram();

      return {
        success: true,
        radarCount,
        telegramCount,
      };
    } catch (error) {
      console.error("Error in manual cleanup:", error);
      throw error;
    }
  }

  // Stop all scheduled jobs
  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✓ Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  // Get status of all jobs
  getJobsStatus(): Array<{ name: string; running: boolean }> {
    const status: Array<{ name: string; running: boolean }> = [];
    this.jobs.forEach((job, name) => {
      status.push({ name, running: job.getStatus() === "scheduled" });
    });
    return status;
  }
}

export default new SchedulerService();
