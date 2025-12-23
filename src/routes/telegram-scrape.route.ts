// // routes/scrape.routes.ts

// // Scrape a specific source by ID
// app.post('/sources/:sourceId/scrape', async (req: Request, res: Response) => {
//   try {
//     const { sourceId } = req.params;

//     const result = await scrapeService.scrapeFromConfig(parseInt(sourceId));

//     res.json(result);
//   } catch (error: any) {
//     console.error('Scraping error:', error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Scrape all active sources
// app.post('/sources/scrape-all', async (req: Request, res: Response) => {
//   try {
//     const [sources] = await pool.query(
//       `SELECT source_id
//        FROM ltng_sources
//        WHERE source_is_active = TRUE
//        AND source_type_id = (
//          SELECT source_type_id
//          FROM ltng_source_types
//          WHERE source_type_slug = 'telegram channel'
//        )
//        AND is_deleted = FALSE`
//     ) as any;

//     const results = [];

//     for (const source of sources) {
//       try {
//         const result = await scrapeService.scrapeFromConfig(source.source_id);
//         results.push(result);
//       } catch (error: any) {
//         results.push({
//           success: false,
//           sourceId: source.source_id,
//           error: error.message,
//         });
//       }
//     }

//     res.json({
//       success: true,
//       totalSources: sources.length,
//       results,
//     });
//   } catch (error: any) {
//     res.status(500).json({ error: error.message });
//   }
// });
