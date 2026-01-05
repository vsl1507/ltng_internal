import axios from "axios";
import pool from "../config/mysql.config";
import { WebsiteSourceConfig } from "../types/website.type";
import Parser from "rss-parser";
import { mediaService } from "./media.service";
import { RadarAIService } from "./radar-ai.service";
import * as cheerio from "cheerio";

interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt?: Date;
  images?: string[];
}

interface StoryNumberResult {
  storyNumber: number;
  isNewStory: boolean;
  isBreaking?: boolean;
  similarity?: number;
  matchedArticleId?: number;
}
const radarAIService = new RadarAIService();

export class WebsiteScrapeService {
  private rssParser: Parser;

  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ["media:content", "media:thumbnail", "content:encoded"],
      },
    });
  }

  async scrapeFromSource(): Promise<any> {
    // Fetch active website sources
    const [sources] = (await pool.query(
      `SELECT *
       FROM ltng_news_sources s
       JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id
       WHERE s.source_is_active = TRUE 
       AND st.source_type_slug = 'website'
       AND s.is_deleted = FALSE`,
      []
    )) as any;

    if (sources.length === 0) {
      console.log("⚠️ No active website sources found");
      return [];
    }

    console.log(`\n📰 Found ${sources.length} website sources to scrape`);

    for (const source of sources) {
      try {
        await this.scrapeWebsiteSource(source);
      } catch (error: any) {
        console.error(
          `❌ Failed to scrape ${source.source_name}:`,
          error.message
        );
        continue;
      }
    }
  }

  private async scrapeWebsiteSource(source: any): Promise<void> {
    const config: WebsiteSourceConfig = JSON.parse(
      JSON.stringify(source.source_config)
    );

    console.log(`\n📄 Scraping: ${source.source_name}`);
    console.log(`   Base URL: ${config.website.base_url}`);

    let articles: ScrapedArticle[] = [];
    console.log(config);

    // Method 1: Scrape from RSS feeds
    if (config.website.rss_feeds && config.website.rss_feeds.length > 0) {
      console.log(`📡 Using RSS feeds (${config.website.rss_feeds.length})`);
      articles = await this.scrapeFromRSS(config);
    }

    // Method 2: Scrape from listing page
    if (config.website.listing_path && config.website.listing_selector) {
      console.log("articles : ", articles);
      articles = await this.scrapeFromListing(config);
    } else {
      console.error("❌ No scraping method configured (RSS or listing)");
      return;
    }

    console.log(`📊 Found ${articles.length} articles`);

    if (articles.length === 0) {
      console.log("⚠️ No articles found");
      return;
    }

    // Limit articles based on config
    const fetchLimit = config.common.fetch_limit || 10;
    articles = articles.slice(0, fetchLimit);

    let savedCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let mediaCount = 0;

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      console.log(`\n[${i + 1}/${articles.length}] Processing: ${article.url}`);

      try {
        // Process content
        let processedText = article.content || "";

        if (config.common.content.strip_urls) {
          processedText = this.stripUrls(processedText);
        }

        if (config.common.content.strip_emojis) {
          processedText = this.stripEmojis(processedText);
        }

        // Check skip patterns
        if (
          this.shouldSkipContent(
            processedText,
            config.common.content.skip_patterns
          )
        ) {
          console.log(`⏭️ Skipped: Matches skip pattern`);
          skippedCount++;
          continue;
        }

        // Check minimum length
        if (processedText.length < config.common.content.min_text_length) {
          console.log(
            `⏭️ Skipped: Content too short (${processedText.length} chars)`
          );
          skippedCount++;
          continue;
        }

        // Generate content hash
        const contentHash = this.generateContentHash(processedText);

        // Check for duplicates
        const [existingRows] = (await pool.query(
          `SELECT radar_id FROM ltng_news_radar 
           WHERE (radar_url = ? OR radar_content_hash = ?)
           AND is_deleted = FALSE 
           LIMIT 1`,
          [article.url, contentHash]
        )) as any;

        if (existingRows.length > 0) {
          console.log(`⏭️ Skipped: Duplicate article`);
          duplicateCount++;
          continue;
        }

        // Generate embedding
        const embedding = await this.generateEmbedding(processedText);

        if (!embedding) {
          console.log(`⚠️ Failed to generate embedding, skipping`);
          skippedCount++;
          continue;
        }

        // Find or create story number
        const storyResult = await this.findOrCreateStoryNumber(
          article.title,
          processedText
        );

        let parentId = null;
        const storyNumber = storyResult.storyNumber;
        const isNewStory = storyResult.isNewStory;

        // Find story leader if not a new story
        if (!isNewStory) {
          const [leaderRows] = (await pool.query(
            `SELECT radar_id 
             FROM ltng_news_radar 
             WHERE radar_story_number = ? 
               AND radar_is_story_leader = TRUE 
               AND is_deleted = FALSE 
             LIMIT 1`,
            [storyNumber]
          )) as any;

          if (leaderRows.length > 0) {
            parentId = leaderRows[0].radar_id;
            console.log(
              `📎 Linked to story #${storyNumber} (leader: #${parentId})`
            );
          }
        } else {
          console.log(`🆕 Created new story #${storyNumber}`);
        }

        // Insert article into database
        const [insertResult] = (await pool.query(
          `INSERT INTO ltng_news_radar (
  radar_parent_id,
  radar_source_id,
  radar_title,
  radar_content,
  radar_content_hash,
  radar_url,
  radar_published_at,
  radar_scraped_at,
  radar_is_story_leader,
  radar_embedding,
  radar_story_number,
  created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW()) `,
          [
            parentId,
            source.source_id,
            article.title,
            processedText,
            contentHash,
            article.url,
            article.publishedAt || new Date(),
            isNewStory,
            JSON.stringify(embedding),
            storyNumber,
          ]
        )) as any;

        const postId = insertResult.insertId;
        savedCount++;

        console.log(`✅ Saved article #${postId} (Story #${storyNumber})`);

        // Handle media/images
        // if (
        //   config.common.media.include &&
        //   article.images &&
        //   article.images.length > 0
        // ) {
        //   const maxMedia = config.common.media.max_per_item || 5;
        //   const imagesToDownload = article.images.slice(0, maxMedia);

        //   for (const imageUrl of imagesToDownload) {
        //     try {
        //       if (config.common.media.download) {
        //         const mediaPath = await mediaService.downloadMessageMedia(
        //           imageUrl,
        //           postId,
        //           source.source_name
        //         );

        //         if (mediaPath) {
        //           mediaCount++;
        //         }
        //       } else {
        //         // await mediaService.saveMediaInfo({
        //         //   url: imageUrl,
        //         //   type: "image",
        //         //   postId,
        //         // });
        //       }
        //     } catch (mediaError) {
        //       console.error(`⚠️ Failed to handle image: ${mediaError.message}`);
        //     }
        //   }
        // }

        // Process with AI if enabled
        if (config.common.ai.enabled) {
          const content_ai = await radarAIService.runByArticleId(postId);
          if (content_ai) {
            console.log("✅ Processing complete:", content_ai);
          }
        }
      } catch (error) {
        console.error("❌ Processing failed:", error);
      }
    }

    // Update source state
    config.common.state.last_fetched_at = new Date().toISOString();
    config.common.state.last_item_id = articles[0]?.url || null;

    await pool.query(
      `UPDATE ltng_news_sources
       SET source_config = ?
       WHERE source_id = ?`,
      [JSON.stringify(config), source.source_id]
    );

    console.log(`\n📊 Summary for ${source.source_name}:`);
    console.log(`   ✅ Saved: ${savedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   🔄 Duplicates: ${duplicateCount}`);
    console.log(`   🖼️  Media: ${mediaCount}`);
  }

  // Scrape from RSS feeds
  private async scrapeFromRSS(
    config: WebsiteSourceConfig
  ): Promise<ScrapedArticle[]> {
    const articles: ScrapedArticle[] = [];

    for (const feedUrl of config.website.rss_feeds || []) {
      try {
        console.log(`   📡 Fetching RSS: ${feedUrl}`);
        const feed = await this.rssParser.parseURL(feedUrl);

        for (const item of feed.items) {
          const articleUrl = item.link || item.guid;

          if (!articleUrl) {
            continue;
          }

          // Scrape full article content
          const fullArticle = await this.scrapeArticleContent(
            articleUrl,
            config
          );

          articles.push({
            title: fullArticle.title || item.title || "Untitled",
            content:
              fullArticle.content || item.contentSnippet || item.content || "",
            url: articleUrl,
            author: fullArticle.author || item.creator,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            images: fullArticle.images || this.extractRSSImages(item),
          });
        }
      } catch (error: any) {
        console.error(`   ❌ Failed to parse RSS ${feedUrl}: ${error.message}`);
      }
    }

    return articles;
  }

  // Scrape from listing page
  private async scrapeFromListing(
    config: WebsiteSourceConfig
  ): Promise<ScrapedArticle[]> {
    const articles: ScrapedArticle[] = [];

    const listingUrl =
      config.website.base_url + (config.website.listing_path || "");

    console.log("listingUrl : ", listingUrl);

    console.log(`   🔍 Fetching listing: ${listingUrl}`);

    try {
      const response = await axios.get(listingUrl, {
        timeout: 30000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const $ = cheerio.load(response.data);
      const articleLinks: string[] = [];

      // Extract article URLs from listing
      $(config.website.listing_selector!).each((i, element) => {
        let href = $(element).attr("href");

        if (!href) return;

        // Make absolute URL
        if (href.startsWith("/")) {
          href = config.website.base_url + href;
        } else if (!href.startsWith("http")) {
          href = config.website.base_url + "/" + href;
        }

        articleLinks.push(href);
      });

      console.log(`   Found ${articleLinks.length} article links`);

      // Scrape each article
      for (const url of articleLinks) {
        try {
          const article = await this.scrapeArticleContent(url, config);
          articles.push(article);
        } catch (error: any) {
          console.error(`   ⚠️ Failed to scrape ${url}: ${error.message}`);
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to fetch listing: ${error.message}`);
    }

    return articles;
  }

  // Scrape individual article content
  private async scrapeArticleContent(
    url: string,
    config: WebsiteSourceConfig
  ): Promise<ScrapedArticle> {
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);
    const selectors = config.website.article_selectors;

    // Remove unwanted elements
    if (selectors.remove) {
      selectors.remove.forEach((selector) => {
        $(selector).remove();
      });
    }

    // Extract title
    let title = "";
    for (const selector of selectors.title) {
      const element = $(selector).first();
      if (element.length > 0) {
        title = element.text().trim();
        break;
      }
    }

    // Extract author
    let author: string | undefined;
    if (selectors.author) {
      for (const selector of selectors.author) {
        const element = $(selector).first();
        if (element.length > 0) {
          author = element.text().trim();
          break;
        }
      }
    }

    // Extract publish date
    let publishedAt: Date | undefined;
    if (selectors.publish_date) {
      for (const selector of selectors.publish_date) {
        const element = $(selector).first();
        if (element.length > 0) {
          const dateText = element.attr("datetime") || element.text().trim();
          publishedAt = new Date(dateText);
          break;
        }
      }
    }

    // Extract content
    let content = "";
    for (const selector of selectors.content) {
      const elements = $(selector);
      if (elements.length > 0) {
        elements.each((i, el) => {
          content += $(el).text().trim() + "\n\n";
        });
        break;
      }
    }

    // Extract images
    let images: string[] = [];
    if (selectors.images) {
      for (const selector of selectors.images) {
        $(selector).each((i, el) => {
          let src = $(el).attr("src") || $(el).attr("data-src");
          if (src) {
            // Make absolute URL
            if (src.startsWith("/")) {
              src = config.website.base_url + src;
            } else if (!src.startsWith("http")) {
              src = config.website.base_url + "/" + src;
            }
            images.push(src);
          }
        });

        if (images.length > 0) break;
      }
    }

    return {
      title: title || "Untitled",
      content: content.trim(),
      url,
      author,
      publishedAt: publishedAt || new Date(),
      images,
    };
  }

  // Helper: Extract images from RSS item
  private extractRSSImages(item: any): string[] {
    const images: string[] = [];

    // Check media:content
    if (item["media:content"]) {
      const media = Array.isArray(item["media:content"])
        ? item["media:content"]
        : [item["media:content"]];

      media.forEach((m: any) => {
        if (m.$ && m.$.url && m.$.medium === "image") {
          images.push(m.$.url);
        }
      });
    }

    // Check enclosure
    if (item.enclosure && item.enclosure.type?.startsWith("image/")) {
      images.push(item.enclosure.url);
    }

    return images;
  }

  // Helper: Check if content should be skipped
  private shouldSkipContent(content: string, skipPatterns: string[]): boolean {
    if (!skipPatterns || skipPatterns.length === 0) {
      return false;
    }

    const lowerContent = content.toLowerCase();
    return skipPatterns.some((pattern) =>
      lowerContent.includes(pattern.toLowerCase())
    );
  }

  /**
   * Find or Create story number for group story
   */
  private async findOrCreateStoryNumber(
    title: string,
    content: string
  ): Promise<StoryNumberResult> {
    // 1. Check for similar articles in the same category (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [existingArticles]: any = await pool.query(
      `
  SELECT *
  FROM (
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
    WHERE radar_scraped_at >= ?
      AND radar_story_number IS NOT NULL
      AND is_deleted = FALSE
  ) t
  WHERE radar_is_story_leader = 1
     OR rn_last = 1
  ORDER BY radar_story_number, radar_scraped_at
  `,
      [sevenDaysAgo]
    );

    // 2. If no existing articles, create new story
    if (existingArticles.length === 0) {
      const newStoryNumber = await this.generateNewStoryNumber();
      return {
        storyNumber: newStoryNumber,
        isNewStory: true,
      };
    }

    // 3. Calculate similarity with existing articles
    for (const article of existingArticles) {
      const similarity = await this.calculateTextSimilarity(
        title + " " + content,
        article.radar_title + " " + article.radar_content
      );

      console.log("similarity : ", similarity);
      // similarity can be null → must check
      if (similarity !== null && similarity.same_story > 0.65) {
        console.log(
          `📎 Found similar article (${Math.round(
            similarity.same_story * 100
          )}% match), using story number: ${article.radar_story_number}`
        );

        return {
          storyNumber: article.radar_story_number,
          isNewStory: false,
        };
      }
    }

    // 4. No similar article found, generate new story number
    const newStoryNumber = await this.generateNewStoryNumber();
    console.log(
      `🆕 No similar articles found, created new story #${newStoryNumber}`
    );

    return {
      storyNumber: newStoryNumber,
      isNewStory: true,
    };
  }

  /**
   * Calculate text similarity
   */
  private async calculateTextSimilarity(
    text1: string,
    text2: string
  ): Promise<any> {
    try {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";

      // Truncate texts for efficiency
      const truncate = (text: string, maxLength: number = 1000) =>
        text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

      const prompt = `
You are a STRICT semantic comparison engine.

TASK:
Determine whether Article 1 and Article 2 describe the SAME REAL-WORLD EVENT.
Compare the MEANING of these two news articles.

DEFINITION:
"SAME STORY" means BOTH articles describe:
- the same people or group
- the same date or time period
- the same location
- the same action
- the same purpose or outcome

RULES (VERY IMPORTANT):
- Compare ONLY meaning and facts.
- IGNORE writing style, repetition, truncation, formatting.
- IGNORE titles, hashtags, links, emojis, calls to action.
- IGNORE duplicated or partially cut sentences.
- Do NOT infer missing facts.
- Do NOT penalize missing social links or media references.
- If core facts match → same_story = true.

ADDITIONAL CLASSIFICATION:

Also determine whether the event described is BREAKING NEWS or NOT.

DEFINITIONS:
- BREAKING NEWS:
  An event that is new, urgent, and time-sensitive.
  Indicators may include:
  - just occurred, ongoing, or unfolding
  - mentions of "today", "now", "just", "latest", "breaking"
  - emergency, crisis, attack, disaster, arrest, resignation, sudden decision

RULES:
- Base the decision ONLY on the article content.
- Do NOT assume urgency without explicit textual evidence.
- If no clear urgency is stated → is_breaking = false.

DIFFERENCE SCORE:
- Return a number from 0 to 100 representing how different the MEANING is.
- 0 = identical meaning
- 100 = completely unrelated

Article 1:
<<<
${truncate(text1)}
>>>

Article 2:
<<<
${truncate(text2)}
>>>

Respond ONLY with valid JSON.
NO markdown.
NO extra text.

JSON FORMAT:
{
  "same_story": true or false,
  "difference": 0-100,
  "is_breaking": true or false,
  "confidence": 0.0,
  "reasoning": "one short sentence"
}

`;

      const ollamaModel = process.env.OLLAMA_MODEL;
      const ollamaAPIKey = process.env.OLLAMA_API_KEY;
      const res = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model: ollamaModel,
          prompt,
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 1000,
          },
        },
        {
          timeout: 180000,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ollamaAPIKey}`,
          },
        }
      );

      if (!res.data || !res.data.response) {
        throw new Error("Empty response from Ollama");
      }

      // Parse response
      let rawResponse = res.data.response;

      // Extract JSON
      let jsonStr = rawResponse;
      const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const result = JSON.parse(jsonStr);

      if (
        !result.hasOwnProperty("same_story") ||
        !result.hasOwnProperty("confidence")
      ) {
        throw new Error("Invalid response structure from Ollama");
      }

      console.log(
        `🤖 AI comparison: ${
          result.same_story ? "SAME" : "DIFFERENT"
        } story (${Math.round(result.confidence * 100)}% confidence)`
      );
      console.log(`Reasoning: ${result.reasoning}`);

      // Return confidence score (0-1)
      return {
        same_story: result.same_story
          ? result.confidence
          : 1 - result.confidence,
        is_breaking: result.is_breaking,
      };
    } catch (error) {
      console.error(
        "❌ AI similarity calculation failed, falling back to text-based:",
        error
      );
    }
  }

  /**
   * Generate stroy number
   */
  private async generateNewStoryNumber(): Promise<number> {
    const [result]: any = await pool.query(
      `SELECT MAX(radar_story_number) as max_story_number 
     FROM ltng_news_radar 
     WHERE is_deleted = FALSE`
    );

    const maxStoryNumber = result[0]?.max_story_number || 0;
    const newStoryNumber = maxStoryNumber + 1;

    console.log(`🆕 Generated new story number: ${newStoryNumber}`);
    return newStoryNumber;
  }
  /**
   * Generate embedding code
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    try {
      const ollamaUrl = process.env.OLLAMA_API_URL || "http://localhost:11434";
      const embeddingModel =
        process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text";

      const res = await axios.post(
        `${ollamaUrl}/api/embeddings`,
        {
          model: embeddingModel,
          prompt: text.substring(0, 2000), // Truncate for embedding
        },
        { timeout: 10000 }
      );

      return res.data.embedding;
    } catch (error) {
      console.error("❌ Embedding generation failed:", error);
      return null;
    }
  }

  /**
  * Filter helper: Should we process this message?
  * /
  // private shouldProcessMessage(
  //   message: any,
  //   config: TelegramSourceConfig
  // ): boolean {
  //   // Check if it's a forward
  //   if (!config.fetch.include_forwards && message.fwdFrom) {
  //     return false;
  //   }

  //   // Check if it's a reply
  //   if (!config.fetch.include_replies && message.replyTo) {
  //     return false;
  //   }

  //   return true;
  // }

  /**
   * Function to defind media type form telegram
   */

  /**
   * Get meida type
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
   * Strip urls
   */
  private stripUrls(text: string): string {
    return text.replace(/https?:\/\/[^\s]+/g, "");
  }

  /**
   *  Strip Emojis
   */
  private stripEmojis(text: string): string {
    return text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    );
  }

  /**
   * Generate content hash for check duplicate
   */
  private generateContentHash(content: string): string {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
