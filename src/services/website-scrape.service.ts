import axios from "axios";
import pool from "../config/mysql.config";
import {
  ScrapedArticle,
  ScrapeStats,
  WebsiteSourceConfig,
} from "../types/website.type";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import {
  generateContentHash,
  stripUrls,
  stripEmojis,
  findOrCreateStoryNumber,
  findStoryLeader,
  shouldSkipContent,
  isDuplicate,
} from "../utils/scrape.utils";
import radarAIService from "./radar-ai.service";
import mediaService from "./media.service";

export class WebsiteScrapeService {
  private rssParser: Parser;

  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ["media:content", "media:thumbnail", "content:encoded"],
      },
    });
  }

  /**
   * Main scraping orchestrator
   */
  async scrapeFromSource(): Promise<any> {
    const sources = await this.fetchActiveSources();

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

  /**
   * Fetch active website sources from database
   */
  private async fetchActiveSources(): Promise<any[]> {
    const [sources] = (await pool.query(
      `SELECT *
       FROM ltng_news_sources s
       JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id
       WHERE s.source_is_active = TRUE 
       AND st.source_type_slug = 'website'
       AND s.is_deleted = FALSE`,
      []
    )) as any;

    return sources;
  }

  /**
   * Scrape a single website source
   */
  private async scrapeWebsiteSource(source: any): Promise<void> {
    const config: WebsiteSourceConfig = JSON.parse(
      JSON.stringify(source.source_config)
    );

    console.log(`\n📄 Scraping: ${source.source_name}`);
    console.log(`   Base URL: ${config.website.base_url}`);

    let articles: ScrapedArticle[] = [];

    // Method 1: Scrape from RSS feeds
    // if (config.website.rss_feeds && config.website.rss_feeds.length > 0) {
    //   console.log(`📡 Using RSS feeds (${config.website.rss_feeds.length})`);
    //   articles = await this.scrapeFromRSS(config);
    // }

    // Method 2: Scrape from listing page
    if (config.website.listing_path && config.website.listing_selector) {
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
    // const fetchLimit = config.common.fetch_limit || 10;
    const fetchLimit = 6;
    articles = articles.slice(0, fetchLimit);

    // Process articles
    const stats = await this.processArticles(articles, source, config);

    // Update source state
    await this.updateSourceConfig(source.source_id, config, articles[0]?.url);

    // Print summary
    this.printSummary(source.source_name, stats);
  }

  /**
   * Process all articles from a source
   */
  private async processArticles(
    articles: ScrapedArticle[],
    source: any,
    config: WebsiteSourceConfig
  ): Promise<ScrapeStats> {
    const stats: ScrapeStats = {
      savedCount: 0,
      skippedCount: 0,
      duplicateCount: 0,
      mediaCount: 0,
    };

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];

      console.log(`\n[${i + 1}/${articles.length}] Processing: ${article.url}`);

      try {
        // Process content
        let processedText = article.content || "";

        if (config.common.content.strip_urls) {
          processedText = stripUrls(processedText);
        }

        if (config.common.content.strip_emojis) {
          processedText = stripEmojis(processedText);
        }

        // Check skip patterns
        if (
          shouldSkipContent(processedText, config.common.content.skip_patterns)
        ) {
          console.log(`⭐️ Skipped: Matches skip pattern`);
          stats.skippedCount++;
          continue;
        }

        // Check minimum length
        if (processedText.length < config.common.content.min_text_length) {
          console.log(
            `⭐️ Skipped: Content too short (${processedText.length} chars)`
          );
          stats.skippedCount++;
          continue;
        }

        // Generate content hash
        const contentHash = await generateContentHash(processedText);

        // Check for duplicates
        if (await isDuplicate(article.url, contentHash)) {
          console.log(`⭐️ Skipped: Duplicate article`);
          stats.duplicateCount++;
          continue;
        }

        // Save article
        const articleId = await this.saveArticle(
          article,
          processedText,
          contentHash,
          source,
          config
        );

        if (articleId) {
          stats.savedCount++;

          // Handle media
          const mediaDownloaded = await this.handleMedia(
            article,
            articleId,
            config.website.base_url,
            config
          );

          if (mediaDownloaded) {
            stats.mediaCount++;
          }

          // Process with AI if enabled
          // if (config.common.ai.enabled) {
          //   await this.processWithAI(articleId);
          // }
        }
      } catch (error) {
        console.error("❌ Processing failed:", error);
      }
    }

    return stats;
  }

  /**
   * Save article to database
   */
  private async saveArticle(
    article: ScrapedArticle,
    processedText: string,
    contentHash: string,
    source: any,
    config: WebsiteSourceConfig
  ): Promise<number | null> {
    // Find or create story number
    const storyResult = await findOrCreateStoryNumber(
      article.title,
      processedText,
      source.source_id
    );

    let parentId = null;
    const storyNumber = storyResult.storyNumber;
    const isNewStory = storyResult.isNewStory;

    // Find story leader if not a new story
    if (!isNewStory) {
      parentId = await findStoryLeader(storyNumber);
      if (parentId) {
        console.log(
          `🔎 Linked to story #${storyNumber} (leader: #${parentId})`
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
        radar_story_number,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW())`,
      [
        parentId,
        source.source_id,
        article.title,
        processedText,
        contentHash,
        article.url,
        article.publishedAt || new Date(),
        isNewStory,
        storyNumber,
      ]
    )) as any;

    const postId = insertResult.insertId;
    console.log(`✅ Saved article #${postId} (Story #${storyNumber})`);

    return postId;
  }

  /**
   * Process article with AI service
   */
  private async processWithAI(articleId: number): Promise<void> {
    try {
      const content_ai = await radarAIService.runByArticleId(articleId);
      if (content_ai) {
        console.log("✅ AI processing complete:", content_ai);
      }
    } catch (error) {
      console.error("❌ AI processing failed:", error);
    }
  }

  /**
   * Scrape from RSS feeds
   */
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

  /**
   * Scrape from listing page
   */
  private async scrapeFromListing(
    config: WebsiteSourceConfig
  ): Promise<ScrapedArticle[]> {
    const articles: ScrapedArticle[] = [];

    const listingUrl =
      config.website.base_url + (config.website.listing_path || "");

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
        console.log(`   Found link: ${href}`);

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
      for (let i = 0; i < 6; i++) {
        try {
          const article = await this.scrapeArticleContent(
            articleLinks[i],
            config
          );
          articles.push(article);
        } catch (error: any) {
          console.error(
            `   ⚠️ Failed to scrape ${articleLinks[i]}: ${error.message}`
          );
        }
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to fetch listing: ${error.message}`);
    }

    return articles;
  }

  /**
   * Scrape individual article content
   */
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

  /**
   * Extract images from RSS item
   */
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

  /**
   * Update source configuration in database
   */
  private async updateSourceConfig(
    sourceId: number,
    config: WebsiteSourceConfig,
    lastItemUrl: string | null
  ): Promise<void> {
    config.common.state.last_fetched_at = new Date().toISOString();
    config.common.state.last_item_id = lastItemUrl || null;

    await pool.query(
      `UPDATE ltng_news_sources
       SET source_config = ?
       WHERE source_id = ?`,
      [JSON.stringify(config), sourceId]
    );
  }

  /**
   * Print summary statistics
   */
  private printSummary(sourceName: string, stats: ScrapeStats): void {
    console.log(`\n📊 Summary for ${sourceName}:`);
    console.log(`   ✅ Saved: ${stats.savedCount}`);
    console.log(`   ⭐️  Skipped: ${stats.skippedCount}`);
    console.log(`   📄 Duplicates: ${stats.duplicateCount}`);
    console.log(`   🖼️  Media: ${stats.mediaCount}`);
  }

  /**
   * Hanle media of webiste
   */
  private async handleMedia(
    article: any,
    articleId: number,
    sourceName: string,
    config: any
  ): Promise<boolean> {
    if (!config.common.media.include) {
      return false;
    }

    // Check if article has images
    if (!article.images || article.images.length === 0) {
      console.log(`   ℹ️  No media found in article`);
      return false;
    }

    console.log(`   🖼️  Found ${article.images.length} media items`);

    // Limit media per item
    const maxMedia = config.common.media.max_per_item || 3;
    const mediaToProcess = article.images.slice(0, maxMedia);

    let processedCount = 0;

    for (const mediaUrl of mediaToProcess) {
      try {
        // Check if media type is allowed
        const mediaType = this.getMediaTypeFromUrl(mediaUrl);

        if (!this.isMediaTypeAllowed(mediaType, config)) {
          console.log(`   ⏭️  Skipping ${mediaType}: not in allowed types`);
          continue;
        }

        // Download or save media using unified service
        if (config.common.media.download) {
          const result = await mediaService.downloadFromUrl(mediaUrl, {
            articleId,
            sourceName,
            sourceType: "website",
            timeout: 30000,
            maxRetries: 1,
          });

          if (result.success) {
            console.log(`   ✅ Downloaded ${mediaType}`);
            processedCount++;
          } else {
            console.log(`   ⚠️  Download failed: ${result.error}`);
            // Fallback: save URL only
            await mediaService.saveUrlReference(
              mediaUrl,
              {
                articleId,
                sourceName,
                sourceType: "website",
              },
              mediaType
            );
            processedCount++;
          }
        } else {
          // Just save media URL without downloading
          await mediaService.saveUrlReference(
            mediaUrl,
            {
              articleId,
              sourceName,
              sourceType: "website",
            },
            mediaType
          );
          console.log(`   💾 Saved ${mediaType} URL (no download)`);
          processedCount++;
        }
      } catch (error: any) {
        console.error(`   ❌ Media processing failed: ${error.message}`);
        continue;
      }
    }

    if (processedCount > 0) {
      console.log(`   ✅ Processed ${processedCount} media items`);
      return true;
    }

    return false;
  }

  private getMediaTypeFromUrl(url: string): string {
    const urlLower = url.toLowerCase();

    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(urlLower)) {
      return "image";
    }
    if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(urlLower)) {
      return "video";
    }
    if (/\.(mp3|wav|ogg|aac)(\?|$)/i.test(urlLower)) {
      return "audio";
    }

    return "image"; // Default for news sites
  }

  private isMediaTypeAllowed(mediaType: string, config: any): boolean {
    const allowedTypes = config.common.media.allowed_types;
    if (allowedTypes.length === 0) return true;
    return allowedTypes.includes(mediaType as any);
  }
}
