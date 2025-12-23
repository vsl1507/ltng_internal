// import express, { Request, Response, NextFunction } from "express";
// import dotenv from "dotenv";
// import cors from "cors";
// import path from "path";
// // Load environment variables
// dotenv.config();
// import { ScrapeService } from "./services/telegram-scrape.service";
// import pool, { testConnection } from "./config/mysql.config";
// import { MonitorService } from "./services/monitor.service";
// import { ensureMediaDirExists, MEDIA_DIR } from "./utils/media-path";

// const app = express();
// const PORT = process.env.PORT || 3500;
// const HOST = process.env.DB_HOST || "localhost";
// const monitorService = new MonitorService();
// const scrapeService = new ScrapeService();

// const startServer = async () => {
//   await testConnection();
//   monitorService.start();

//   // Middleware
//   app.use(cors());
//   app.use(express.json({ limit: "10mb" }));
//   app.use(express.urlencoded({ extended: true, limit: "10mb" }));

//   // Save media after scarpe
//   ensureMediaDirExists();
//   app.use("/media", express.static(MEDIA_DIR));

//   // Set the view engine to EJS with folder for views and dist
//   app.set("view engine", "ejs");
//   app.set("views", "./dist/views");
//   app.set("views", path.join(__dirname, "views"));

//   app.listen(3500, () => {
//     console.log(`🚀 Server is running on local:  http://localhost:${PORT}`);
//     console.log(
//       `📚 API Documentation on local: http://localhost:${PORT}/api-docs`
//     );
//     console.log(
//       `📊 API Endpoints on local: http://localhost:${PORT}/api/fb-accounts`
//     );
//     console.log(`🚀 Server is running on local:  http://${HOST}:${PORT}`);
//     console.log(
//       `📚 API Documentation on local: http://${HOST}:${PORT}/api-docs`
//     );
//     console.log(
//       `📊 API Endpoints on local: http://${HOST}:${PORT}/api/fb-accounts`
//     );
//   });

//   // Test scraping after server starts (with a 3 second delay)
//   setTimeout(() => {
//     testScraping();
//   }, 3000);

//   // Graceful shutdown
//   process.on("SIGINT", () => {
//     console.log("\n🛑 Shutting down gracefully...");
//     monitorService.stop();
//     pool.end();
//     process.exit(0);
//   });
// };

// // Test function to run scraping once
// async function testScraping() {
//   console.log("\n" + "=".repeat(60));
//   console.log("🧪 TESTING TELEGRAM SCRAPER");
//   console.log("=".repeat(60) + "\n");

//   try {
//     // Get all active sources
//     const [sources] = (await pool.query(`
//       SELECT source_id, source_name, source_identifier
//       FROM ltng_news_sources 
//       WHERE source_is_active = TRUE 
//       AND is_deleted = FALSE
//     `)) as any;

//     console.log("sources : ", sources);

//     if (sources.length === 0) {
//       console.log("⚠️  No active sources found in database");
//       console.log("💡 Tip: Add sources to ltng_news_sources table first\n");
//       return;
//     }

//     console.log(`📡 Found ${sources.length} active source(s):\n`);
//     sources.forEach((s: any, i: number) => {
//       console.log(`   ${i + 1}. ${s.source_name} (ID: ${s.source_id})`);
//     });
//     console.log("");

//     // Test scraping each source
//     let totalMessages = 0;
//     let totalMedia = 0;
//     let successCount = 0;
//     let failCount = 0;

//     for (const source of sources) {
//       try {
//         console.log(`\n${"─".repeat(60)}`);
//         console.log(`📥 Scraping: ${source.source_name}`);
//         console.log(`   Source ID: ${source.source_id}`);
//         console.log(`   Channel: ${source.source_identifier}`);
//         console.log(`${"─".repeat(60)}`);

//         const result = await scrapeService.scrapeFromSource(source.source_id);

//         console.log(`\n✅ Success!`);
//         console.log(`   Messages scraped: ${result.messagesScraped}`);
//         console.log(`   Media downloaded: ${result.mediaDownloaded}`);
//         console.log(`   Total messages: ${result.totalMessages}`);
//         console.log(`   Skipped: ${result.skipped}`);

//         totalMessages += result.messagesScraped;
//         totalMedia += result.mediaDownloaded;
//         successCount++;

//         // Add delay between sources to avoid rate limits
//         if (sources.length > 1) {
//           console.log("\n⏳ Waiting 3 seconds before next source...");
//           await delay(3000);
//         }
//       } catch (error: any) {
//         console.log(`\n❌ Failed to scrape ${source.source_name}`);
//         console.log(`   Error: ${error.message}`);
//         failCount++;
//       }
//     }

//     // Summary
//     console.log("\n" + "=".repeat(60));
//     console.log("📊 SCRAPING TEST SUMMARY");
//     console.log("=".repeat(60));
//     console.log(`✅ Successful: ${successCount}/${sources.length}`);
//     console.log(`❌ Failed: ${failCount}/${sources.length}`);
//     console.log(`📝 Total messages: ${totalMessages}`);
//     console.log(`🖼️  Total media: ${totalMedia}`);
//     console.log("=".repeat(60) + "\n");
//   } catch (error) {
//     console.error("\n❌ Test scraping failed:", error);
//     console.log("");
//   }
// }

// // Helper: delay function
// function delay(ms: number): Promise<void> {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// startServer();

// // ============================================
// // ALTERNATIVE: Test specific source by ID
// // ============================================

// // If you want to test just ONE specific source, use this instead:

// async function testSingleSource(sourceId: number) {
//   console.log(`\n🧪 Testing scrape for source ID: ${sourceId}\n`);

//   try {
//     const result = await scrapeService.scrapeFromSource(sourceId);

//     console.log("\n✅ Scraping completed!");
//     console.log(JSON.stringify(result, null, 2));
//   } catch (error: any) {
//     console.error("\n❌ Scraping failed:", error.message);
//   }
// }

// // Uncomment to test a specific source (e.g., source ID 1):
// // setTimeout(() => {
// //   testSingleSource(1);
// // }, 3000);

// // ============================================
// // ALTERNATIVE: Manual trigger via endpoint
// // ============================================

// // Add this to your routes for manual testing via API:

// // app.post("/api/scrape/test", async (req: Request, res: Response) => {
// //   try {
// //     console.log(req.body.source_id);
// //     console.log("\n🧪 Manual scrape triggered via API");

// //     const sourceId = req.body.source_id;
// //     if (sourceId) {
// //       // Test single source
// //       const result = await scrapeService.scrapeFromSource(sourceId);

// //       res.json({
// //         success: true,
// //         message: "Single source scraped",
// //         result,
// //       });
// //     } else {
// //       // Test all sources
// //       const [sources] = (await pool.query(`
// //         SELECT source_id
// //         FROM ltng_news_sources
// //         WHERE source_is_active = TRUE
// //         AND is_deleted = FALSE
// //       `)) as any;

// //       const results = [];
// //       for (const source of sources) {
// //         try {
// //           const result = await scrapeService.scrapeFromSource(source.source_id);
// //           results.push({ source_id: source.source_id, ...result });
// //           await delay(2000);
// //         } catch (error: any) {
// //           results.push({
// //             source_id: source.source_id,
// //             success: false,
// //             error: error.message,
// //           });
// //         }
// //       }

// //       res.json({
// //         success: true,
// //         message: "All sources scraped",
// //         results,
// //       });
// //     }
// //   } catch (error: any) {
// //     res.status(500).json({
// //       success: false,
// //       error: error.message,
// //     });
// //   }
// // });

// // Test via:
// // curl -X POST http://localhost:3000/api/scrape/test
// // or with specific source:
// // curl -X POST http://localhost:3000/api/scrape/test -H "Content-Type: application/json" -d '{"source_id": 1}'
