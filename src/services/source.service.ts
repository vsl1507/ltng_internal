import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  NewsSource,
  NewsSourceFilters,
  PaginatedResponse,
} from "../models/source.model";
import axios from "axios";
import HTMLAnalyzerService from "./HTMLAnalyzerService ";
import {
  OLLAMA_API_KEY,
  OLLAMA_CLOUD_MODEL,
  OLLAMA_TEMPERATURE,
  OLLAMA_TIMEOUT,
  OLLAMA_URL,
} from "../types/constants.type";

export class NewsSourceService {
  /**
   * Get all sources
   */
  async getAllSources(
    filters: NewsSourceFilters
  ): Promise<PaginatedResponse<NewsSource>> {
    const {
      search = "",
      source_type_id,
      source_is_active,
      source_is_trusted,
      source_country,
      is_deleted = false,
      sort_by = "created_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = `
      SELECT s.*, st.source_type_name, st.source_type_slug 
      FROM ltng_news_sources s 
      LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
      WHERE s.is_deleted = ?
    `;
    const params: any[] = [is_deleted];

    // Search filter
    if (search) {
      query += " AND (s.source_name LIKE ? OR s.source_identifier LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Source type filter
    if (source_type_id) {
      query += " AND s.source_type_id = ?";
      params.push(source_type_id);
    }

    // Active filter
    if (source_is_active !== undefined) {
      query += " AND s.source_is_active = ?";
      params.push(source_is_active);
    }

    // Trusted filter
    if (source_is_trusted !== undefined) {
      query += " AND s.source_is_trusted = ?";
      params.push(source_is_trusted);
    }

    // Country filter
    if (source_country) {
      query += " AND s.source_country = ?";
      params.push(source_country);
    }

    // Count total records
    const countQuery = query.replace(
      "SELECT s.*, st.source_type_name, st.source_type_slug",
      "SELECT COUNT(*) as total"
    );
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;
    const total_pages = Math.ceil(total / limit);

    // Sorting
    const validSortColumns = [
      "source_id",
      "source_name",
      "source_identifier",
      "source_type_id",
      "source_is_active",
      "source_is_trusted",
      "created_at",
      "updated_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? `s.${sort_by}`
      : "s.created_at";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Parse JSON config for each row
    const parsedRows = rows.map((row) => {
      if (row.source_config && typeof row.source_config === "string") {
        try {
          row.source_config = JSON.parse(row.source_config);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      return row;
    });

    return {
      data: parsedRows as NewsSource[],
      pagination: {
        total,
        page,
        limit,
        total_pages,
      },
    };
  }

  /**
   * Get source by ID
   */
  async getSourceById(id: number): Promise<NewsSource | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, st.source_type_name, st.source_type_slug 
       FROM ltng_news_sources s 
       LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
       WHERE s.source_id = ? AND s.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) return null;

    const source = rows[0];
    if (source.source_config && typeof source.source_config === "string") {
      try {
        source.source_config = JSON.parse(source.source_config);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return source as NewsSource;
  }

  /**
   * Get source by identifier
   */
  async getSourceByIdentifier(identifier: string): Promise<NewsSource | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, st.source_type_name, st.source_type_slug 
       FROM ltng_news_sources s 
       LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
       WHERE s.source_identifier = ? AND s.is_deleted = FALSE`,
      [identifier]
    );

    if (rows.length === 0) return null;

    const source = rows[0];
    if (source.source_config && typeof source.source_config === "string") {
      try {
        source.source_config = JSON.parse(source.source_config);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return source as NewsSource;
  }

  /**
   *  Create source
   */
  async createSource(source: NewsSource, userId?: number): Promise<NewsSource> {
    const data = await this.generateSourceConfigAI(source.source_identifier);
    const configJson = data ? JSON.stringify(data) : null;

    const [result] = await pool.query<ResultSetHeader>(
      `
  INSERT INTO ltng_news_sources 
  (source_type_id, source_name, source_identifier, source_config,
   source_is_active, source_is_trusted, source_country, created_by, __v)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `,
      [
        source.source_type_id,
        source.source_name,
        source.source_identifier,
        configJson,
        source.source_is_active ?? true,
        source.source_is_trusted ?? true,
        source.source_country ?? null,
        userId ?? null,
      ]
    );

    return { source_id: result.insertId, ...source };
  }

  /**
   *  Update source
   */
  async updateSource(
    id: number,
    source: Partial<NewsSource>,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (source.source_type_id !== undefined) {
      fields.push("source_type_id = ?");
      values.push(source.source_type_id);
    }
    if (source.source_name !== undefined) {
      fields.push("source_name = ?");
      values.push(source.source_name);
    }
    if (source.source_identifier !== undefined) {
      fields.push("source_identifier = ?");
      values.push(source.source_identifier);
    }
    if (source.source_config !== undefined) {
      fields.push("source_config = ?");
      const configJson = source.source_config
        ? JSON.stringify(source.source_config)
        : null;
      values.push(configJson);
    }
    if (source.source_is_active !== undefined) {
      fields.push("source_is_active = ?");
      values.push(source.source_is_active);
    }
    if (source.source_is_trusted !== undefined) {
      fields.push("source_is_trusted = ?");
      values.push(source.source_is_trusted);
    }
    if (source.source_country !== undefined) {
      fields.push("source_country = ?");
      values.push(source.source_country);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    if (fields.length === 0) {
      return false;
    }

    // Increment version
    fields.push("__v = __v + 1");

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Soft delete source by ID
   */
  async softDeleteSource(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  /**
   * Hard delete source by ID
   */
  async hardDeleteSource(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_sources WHERE source_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Restore soft delete source by ID
   */
  async restoreSource(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = FALSE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Bulk update status
  async bulkUpdateStatus(
    ids: number[],
    isActive?: boolean,
    isTrusted?: boolean,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const fields = ["__v = __v + 1"];
    const values: any[] = [];

    if (isActive !== undefined) {
      fields.push("source_is_active = ?");
      values.push(isActive);
    }
    if (isTrusted !== undefined) {
      fields.push("source_is_trusted = ?");
      values.push(isTrusted);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    const placeholders = ids.map(() => "?").join(",");
    values.push(...ids);

    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
  }

  /**
   * Bulk soft delete source
   */
  async bulkSoftDelete(ids: number[], userId?: number): Promise<number> {
    if (ids.length === 0) return 0;

    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    const placeholders = ids.map(() => "?").join(",");
    values.push(...ids);

    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
  }

  /**
   * Bulk hard delete source
   */
  async bulkHardDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM ltng_news_sources WHERE source_id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }

  /*========== TOOLS ==========*/
  /**
   * Generate source config by AI
   */
  async generateSourceConfigAI(sourceIdentifier: string): Promise<any> {
    // Detect platform
    const isTelegram =
      sourceIdentifier.includes("t.me/") || sourceIdentifier.startsWith("@");

    // Telegram
    if (isTelegram) {
      return this.generateTelegramConfig(sourceIdentifier);
    }

    // For websites, analyze real HTML structure
    try {
      console.log(`🔍 Analyzing HTML structure of ${sourceIdentifier}`);

      // Ensure URL has protocol
      const url = sourceIdentifier.startsWith("http")
        ? sourceIdentifier
        : `https://${sourceIdentifier}`;

      // Analyze the website
      const analysis = await HTMLAnalyzerService.analyzeWebsite(url);

      console.log(`🔎 Analysis results for:`, analysis);

      console.log(`✅ Analysis complete:
        - Found ${analysis.article_links.count} article links
        - Detected framework: ${analysis.detected_framework}
        - RSS feeds: ${analysis.rss_feeds.length}
        - Sample selectors: ${analysis.article_links.selectors
          .slice(0, 2)
          .join(", ")}`);

      // Generate config from real analysis
      const config = HTMLAnalyzerService.generateConfigFromAnalysis(analysis);

      return config;
    } catch (error) {
      console.error(`❌ HTML analysis failed: ${error}`);
      console.log(`🤖 Falling back to AI generation...`);

      // Fallback to AI if scraping fails
      return this.generateWebsiteConfig(sourceIdentifier);
    }
  }

  /**
   * Generate telegram config
   */
  private generateTelegramConfig(identifier: string): any {
    const username = identifier
      .replace("https://t.me/", "")
      .replace("@", "")
      .trim();

    return {
      platform: "telegram",
      common: {
        ai: { enabled: true },
        media: {
          include: true,
          download: true,
          max_per_item: 10,
          allowed_types: ["photo", "video", "document"],
        },
        state: {
          last_message_id: null,
          last_fetched_at: null,
        },
        content: {
          strip_urls: false,
          strip_emojis: false,
          skip_patterns: ["ad", "sponsored", "subscribe"],
          min_text_length: 30,
          use_caption_if_media: true,
        },
        fetch_limit: 50,
        deduplication_strategy: "message_id",
      },
      telegram: {
        type: "channel",
        username,
        access_method: "user",
      },
    };
  }

  /**
   * Generate website config
   */
  private async generateWebsiteConfig(sourceIdentifier: string): Promise<any> {
    const prompt = this.buildSourceConfigPrompt(sourceIdentifier);

    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_CLOUD_MODEL,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: OLLAMA_TEMPERATURE,
          num_predict: 3000,
          num_ctx: 4096,
          top_p: 0.9,
          repeat_penalty: 1.1,
        },
      },
      {
        timeout: OLLAMA_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OLLAMA_API_KEY}`,
        },
      }
    );

    if (!res.data || !res.data.response) {
      throw new Error("Empty response from Ollama");
    }

    let config;
    try {
      let jsonStr = res.data.response.trim();
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");

      config = JSON.parse(jsonStr);
    } catch (error: any) {
      console.error("Failed to parse Ollama response:", res.data.response);
      throw new Error(`Invalid JSON from AI: ${error.message}`);
    }

    if (!config.platform || !config.common) {
      throw new Error("Generated config missing required fields");
    }

    return config;
  }

  /**
   * Prompt that build for source config
   */
  private buildSourceConfigPrompt(sourceIdentifier: string): string {
    return `You are a news source configuration generator. Generate a complete JSON configuration for: ${sourceIdentifier}

IMPORTANT: Detect the platform type from the identifier:
- If it contains "t.me/", "@", or looks like a Telegram channel → use "telegram" platform
- If it's a URL (http/https) or domain → use "website" platform

=== KNOWN NEWS SITES - USE THESE EXACT SELECTORS ===

BBC News (bbc.com, bbc.co.uk):
{
  "listing_selector": "a[class*='PromoLink'], a.gs-c-promo-heading, a[data-testid='internal-link']",
  "article_selectors": {
    "title": ["h1#main-heading", "h1.ssrcss-15xko80-StyledHeading", ".article-headline h1"],
    "content": ["div[data-component='text-block'] p", "article p", ".ssrcss-1q0x1qg-Paragraph p"],
    "publish_date": ["time[datetime]", ".ssrcss-1if1g9v-MetadataText time"],
    "images": ["figure img", ".ssrcss-evoj7m-Image img", "img[src*='ichef.bbci.co.uk']"],
    "remove": [".ssrcss-1xe1zmd-StyledVideoPlayer", "aside", "nav", "[data-testid='advertisement']"]
  }
}

CNN (cnn.com, edition.cnn.com):
{
  "listing_selector": "a.container__link, a[data-link-type='article'], a.cd__headline-text",
  "article_selectors": {
    "title": ["h1.headline__text", "h1[data-editable='headline']"],
    "content": [".article__content p.paragraph", ".article__content p"],
    "publish_date": ["time[datetime]", ".timestamp"],
    "images": [".image__picture img", ".media__image img"],
    "remove": [".ad-slot", ".related-content", "aside", "nav"]
  }
}

Reuters (reuters.com):
{
  "listing_selector": "a[data-testid='Heading'], a.text__text__1FZLe",
  "article_selectors": {
    "title": ["h1[data-testid='Heading']", "h1.ArticleHeader_headline"],
    "content": ["div[data-testid='paragraph'] p", "article p"],
    "publish_date": ["time[datetime]", "span[data-testid='ArticleTimestamp']"],
    "images": ["figure img", "img[data-testid='Image']"],
    "remove": [".AdSlot", ".RelatedCoverage", "aside"]
  }
}

Al Jazeera (aljazeera.com):
{
  "listing_selector": "a.u-clickable-card__link, article a, a[class*='article-card']",
  "article_selectors": {
    "title": ["h1.article-heading", "header h1"],
    "content": [".wysiwyg p", "article p", ".article-p-wrapper p"],
    "publish_date": ["time[datetime]", ".date-simple"],
    "images": [".responsive-image img", "figure img"],
    "remove": [".article-trending", "aside", "nav"]
  }
}

The Guardian (theguardian.com):
{
  "listing_selector": "a[data-link-name='article'], a.u-faux-block-link__overlay",
  "article_selectors": {
    "title": ["h1[itemprop='headline']", "h1.content__headline"],
    "content": ["div.content__article-body p", "article p"],
    "publish_date": ["time[datetime]", ".content__dateline time"],
    "images": ["figure img", ".img--inline img"],
    "remove": [".submeta", "aside", "nav", ".ad-slot"]
  }
}

NY Times (nytimes.com):
{
  "listing_selector": "a.css-9mylee, a[data-testid='headline-link'], section a",
  "article_selectors": {
    "title": ["h1[data-testid='headline']", "h1.css-1xbyom1"],
    "content": ["section[name='articleBody'] p", "article p.css-at9mc1"],
    "publish_date": ["time[datetime]", ".css-1d2s8do time"],
    "images": ["figure img", "article img"],
    "remove": [".ad", "aside", "nav", "[data-testid='inline-message']"]
  }
}

=== LISTING SELECTOR STRATEGY ===

For article links on listing pages, prefer this order:
1. **Specific data attributes**: a[data-link-type='article'], a[data-testid='article-link']
2. **Semantic class names**: a.article-link, a.story-link, a.headline-link
3. **Container patterns**: a.container__link, a.card-link, a.promo-link
4. **Partial class matches**: a[class*='article'], a[class*='headline']
5. **Generic fallback**: article a, .article-list a, main a

CRITICAL RULES:
- Use MULTIPLE selectors separated by commas for fallback
- Start with most specific, end with generic
- Prefer data attributes over classes (more stable)
- Include container classes (container__, card__, promo__)
- Test mental pattern: "Would this match ONLY article links?"

=== WEBSITE STRUCTURE PATTERNS ===

Modern News Sites (SPA/React):
- Use data-testid, data-link-name, data-component attributes
- Classes often have hashes: .css-abc123, .ssrcss-xyz789
- Prefer attribute selectors: [data-testid='...'], [class*='...']

Traditional Sites:
- Semantic classes: .article-title, .post-content
- Standard tags: article, time[datetime], figure
- Microdata: [itemprop='headline'], [itemprop='articleBody']

=== FOR TELEGRAM SOURCES ===
{
  "platform": "telegram",
  "common": {
    "ai": { "enabled": true },
    "media": {
      "include": true,
      "download": true,
      "max_per_item": 10,
      "allowed_types": ["photo", "video", "document"]
    },
    "state": {
      "last_message_id": null,
      "last_fetched_at": null
    },
    "content": {
      "strip_urls": false,
      "strip_emojis": false,
      "skip_patterns": ["ad", "sponsored", "subscribe"],
      "min_text_length": 30,
      "use_caption_if_media": true
    },
    "fetch_limit": 50,
    "deduplication_strategy": "message_id"
  },
  "telegram": {
    "type": "channel",
    "username": "extracted_username",
    "access_method": "user"
  }
}

=== FOR WEBSITE SOURCES ===
{
  "platform": "website",
  "common": {
    "media": {
      "include": true,
      "download": true,
      "max_per_item": 5,
      "allowed_types": ["image"]
    },
    "state": {
      "last_item_id": null,
      "last_fetched_at": null
    },
    "content": {
      "strip_urls": false,
      "strip_emojis": false,
      "skip_patterns": ["subscribe to", "sign up for", "advertisement", "cookie policy", "newsletter"],
      "min_text_length": 300
    },
    "fetch_limit": 20,
    "deduplication_strategy": "content_hash"
  },
  "website": {
    "base_url": "https://example.com",
    "rss_feeds": ["https://example.com/rss", "https://example.com/feed"],
    "listing_path": "/news",
    "listing_selector": "MULTIPLE,FALLBACK,SELECTORS",
    "article_selectors": {
      "title": ["MOST_SPECIFIC", "FALLBACK", "GENERIC"],
      "author": ["SPECIFIC", "FALLBACK"],
      "content": ["SPECIFIC p", "article p"],
      "publish_date": ["time[datetime]", "FALLBACK"],
      "images": ["figure img", "article img"],
      "remove": [".ad", ".advertisement", ".social-share", "aside", "nav", ".related", ".comments", ".newsletter"]
    }
  }
}

=== OUTPUT REQUIREMENTS ===
1. If source matches a known site above, USE THOSE EXACT SELECTORS
2. Return ONLY valid JSON (no markdown, no explanations)
3. Use 3-5 fallback selectors for each element
4. Prefer data-* attributes over classes
5. Always include generic fallbacks
6. Set state values to null
7. For unknown sites, use comprehensive generic patterns

Generate configuration for: ${sourceIdentifier}`;
  }

  /**
   * Check identifier of source
   */
  async checkIdentifierExists(
    identifier: string,
    excludeId?: number
  ): Promise<boolean> {
    let query =
      "SELECT COUNT(*) as count FROM ltng_news_sources WHERE source_identifier = ? AND is_deleted = FALSE";
    const params: any[] = [identifier];

    if (excludeId) {
      query += " AND source_id != ?";
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count > 0;
  }

  /**
   * Verify source type exists
   */
  async verifySourceTypeExists(sourceTypeId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM ltng_news_source_types WHERE source_type_id = ? AND is_deleted = FALSE",
      [sourceTypeId]
    );
    return rows[0].count > 0;
  }
}

export default new NewsSourceService();
