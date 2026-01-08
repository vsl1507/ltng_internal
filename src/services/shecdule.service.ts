import * as cron from "node-cron";
import pool from "../config/mysql.config";
import { PoolConnection, ResultSetHeader } from "mysql2/promise";

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  initializeJobs(): void {
    console.log("Initializing scheduled jobs...");
    this.scheduleFrequentCleanup();
  }

  // Runs every minute (change if needed)
  private scheduleFrequentCleanup(): void {
    const job = cron.schedule("*/1 * * * *", async () => {
      console.log("Running frequent cleanup at", new Date().toISOString());
      await this.cleanupOldDeletedRecords();
    });

    this.jobs.set("frequentCleanup", job);
    console.log("✓ Frequent cleanup job scheduled (every minute)");
  }

  private async cleanupOldDeletedRecords(): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      console.log("Starting cleanup transaction...");

      const radarCount = await this.cleanupNewsRadar(connection);
      console.log(`✓ Cleaned ${radarCount} radar-related rows`);

      await connection.commit();
      console.log("Cleanup committed successfully");
    } catch (error) {
      await connection.rollback();
      console.error("Cleanup rolled back:", error);
    } finally {
      connection.release();
    }
  }

  /**
   * Deletes radar data older than 7 days
   * Order matters because of foreign keys
   */
  private async cleanupNewsRadar(conn: PoolConnection): Promise<number> {
    const queries = [
      // Delete child radar records first (records with radar_parent_id)
      {
        name: "child_radars",
        query: `
          DELETE c
          FROM ltng_news_radar c
          INNER JOIN ltng_news_radar p ON c.radar_parent_id = p.radar_id
          WHERE p.radar_scraped_at 
        `,
      },
      // Delete parent radar records older than 7 days
      {
        name: "parent_radars",
        query: `
          DELETE FROM ltng_news_radar
          WHERE radar_scraped_at 
            AND radar_parent_id IS NULL
        `,
      },
      // Clean up any orphaned records (just in case)
      {
        name: "orphaned_radars",
        query: `
          DELETE FROM ltng_news_radar
          WHERE radar_scraped_at 
        `,
      },
    ];

    let total = 0;
    for (const { name, query } of queries) {
      try {
        const [res] = await conn.query<ResultSetHeader>(query);
        if (res.affectedRows > 0) {
          console.log(`  - ${name}: ${res.affectedRows} rows deleted`);
        }
        total += res.affectedRows;
      } catch (error: any) {
        console.error(`Error executing ${name} cleanup query:`, error.message);
        // Continue with other queries even if one fails
      }
    }

    return total;
  }

  /**
   * Optional: Cleanup AI-related tables if they exist
   * This method can be called separately if the AI tables have different structure
   */
  private async cleanupNewsRadarAI(conn: PoolConnection): Promise<number> {
    // First, check if the AI tables exist and have the correct columns
    try {
      const [columns]: any = await conn.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'ltng_news_radar_ai'
      `);

      const columnNames = columns.map((col: any) => col.COLUMN_NAME);
      console.log("Available columns in ltng_news_radar_ai:", columnNames);

      // Based on actual columns, construct appropriate cleanup queries
      // Example: if the linking column is different
      // const queries = [...];

      return 0; // Placeholder
    } catch (error: any) {
      console.error("AI table cleanup skipped:", error.message);
      return 0;
    }
  }

  stopAllJobs(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✓ Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  getJobsStatus(): Array<{ name: string; running: boolean }> {
    return Array.from(this.jobs.entries()).map(([name, job]) => ({
      name,
      running: job.getStatus() === "scheduled",
    }));
  }
}

export default new SchedulerService();
