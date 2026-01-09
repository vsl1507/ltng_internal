import axios from "axios";
import * as cheerio from "cheerio";

type CheerioAPI = ReturnType<typeof cheerio.load>;
type CheerioElement = cheerio.Element;

interface HTMLAnalysis {
  base_url: string;
  article_links: {
    count: number;
    selectors: string[];
    sample_urls: string[];
  };
  common_patterns: {
    titles: string[];
    content: string[];
    dates: string[];
    images: string[];
  };
  detected_framework: string;
  has_rss: boolean;
  rss_feeds: string[];
}

export class HTMLAnalyzerService {
  /**
   * Analyze HTML structure of a news website
   */
  async analyzeWebsite(url: string): Promise<any> {
    console.log(`🔍 Analyzing website structure: ${url}`);

    // Fetch the HTML
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);

    // Extract base URL
    const baseUrl = new URL(url);
    const base_url = `${baseUrl.protocol}//${baseUrl.host}`;

    // // Detect framework
    const detected_framework = this.detectFramework($, html);

    // // Find RSS feeds
    const rss_feeds = this.findRSSFeeds($, base_url);

    // // Analyze article links
    const article_links = this.analyzeArticleLinks($, base_url);

    // Fetch and analyze a sample article
    const common_patterns = await this.analyzeSampleArticle(
      article_links.sample_urls[0] || url
    );

    console.log(`✅ Analysis complete for: ${article_links}`);

    return {
      base_url,
      article_links,
      common_patterns,
      detected_framework,
      has_rss: rss_feeds.length > 0,
      rss_feeds,
    };
  }

  /**
   * Fetch HTML from URL
   */
  private async fetchHTML(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 30000,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  /**
   * Detect framework/platform (React, WordPress, etc.)
   */
  private detectFramework($: CheerioAPI, html: string): string {
    const indicators = {
      React: /_react|__NEXT_DATA__|__reactProps/i,
      Vue: /__VUE__|v-app|data-v-/i,
      WordPress: /wp-content|wp-includes/i,
      Angular: /ng-version|ng-app/i,
      Next: /__NEXT_DATA__/i,
    };

    for (const [framework, pattern] of Object.entries(indicators)) {
      if (
        pattern.test(html) ||
        $(`[class*="${framework.toLowerCase()}"]`).length > 0
      ) {
        return framework;
      }
    }

    return "Unknown";
  }

  /**
   * Find RSS/Atom feeds
   */
  private findRSSFeeds($: CheerioAPI, baseUrl: string): string[] {
    const feeds: string[] = [];

    // Check link tags
    $(
      'link[type="application/rss+xml"], link[type="application/atom+xml"]'
    ).each((_, el) => {
      const href = $(el).attr("href");
      if (href) {
        feeds.push(this.resolveUrl(href, baseUrl));
      }
    });

    // Common RSS paths
    const commonPaths = ["/rss", "/feed", "/rss.xml", "/feed.xml", "/atom.xml"];
    feeds.push(...commonPaths.map((p) => `${baseUrl}${p}`));

    return [...new Set(feeds)];
  }

  /**
   * Analyze article links on the page
   */
  private analyzeArticleLinks(
    $: CheerioAPI,
    baseUrl: string
  ): HTMLAnalysis["article_links"] {
    const links: Map<string, Set<string>> = new Map();
    const urlPattern = /\/(article|news|story|post|[0-9]{4}\/[0-9]{2})\//i;

    // Find all links that look like articles
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:"))
        return;

      const fullUrl = this.resolveUrl(href, baseUrl);

      // Check if URL looks like an article
      if (urlPattern.test(fullUrl) || this.isArticleUrl(fullUrl)) {
        const selector = this.generateSelector($, el);
        if (!links.has(selector)) {
          links.set(selector, new Set());
        }
        links.get(selector)!.add(fullUrl);
      }
    });

    console.log("   Links:", links);

    // Rank selectors by number of matches
    const ranked = Array.from(links.entries())
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5);

    const selectors = ranked.map((r) => r[0]);
    const sample_urls = Array.from(ranked[0]?.[1] || []).slice(0, 3);

    return {
      count: ranked[0]?.[1].size || 0,
      selectors,
      sample_urls,
    };
  }

  /**
   * Check if URL looks like an article
   */
  private isArticleUrl(url: string): boolean {
    const articlePatterns = [
      /\/article\//,
      /\/news\//,
      /\/story\//,
      /\/post\//,
      /\/\d{4}\/\d{2}\/\d{2}\//,
      /\/[a-z0-9-]{20,}\/?$/,
    ];

    const excludePatterns = [
      /\/(category|tag|author|about|contact|privacy|terms)\//,
      /\.(css|js|json|xml|jpg|png|gif)$/,
    ];

    return (
      articlePatterns.some((p) => p.test(url)) &&
      !excludePatterns.some((p) => p.test(url))
    );
  }

  /**
   * Analyze a sample article page
   */
  private async analyzeSampleArticle(
    url: string
  ): Promise<HTMLAnalysis["common_patterns"]> {
    try {
      const html = await this.fetchHTML(url);
      const $ = cheerio.load(html);

      return {
        titles: this.findTitleSelectors($),
        content: this.findContentSelectors($),
        dates: this.findDateSelectors($),
        images: this.findImageSelectors($),
      };
    } catch (error) {
      console.warn(`⚠️ Could not analyze sample article: ${error}`);
      return {
        titles: ["h1", "article h1", ".article-title"],
        content: ["article p", ".article-content p", ".post-content p"],
        dates: ["time[datetime]", ".publish-date", ".article-date"],
        images: ["article img", "figure img", ".article-image img"],
      };
    }
  }

  /**
   * Find title selectors
   */
  private findTitleSelectors($: CheerioAPI): string[] {
    const selectors: string[] = [];

    // Priority order
    const candidates = [
      'h1[itemprop="headline"]',
      "h1[data-testid*='headline']",
      "h1.article-title",
      "h1.headline",
      "h1.post-title",
      "article.recap h1",
      "article h1",
      "main h1",
      "h1",
    ];

    for (const selector of candidates) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        if (selectors.length >= 3) break;
      }
    }

    return selectors.length > 0 ? selectors : ["h1"];
  }

  /**
   * Find content selectors
   */
  private findContentSelectors($: CheerioAPI): string[] {
    const selectors: string[] = [];

    const candidates = [
      'div[itemprop="articleBody"] p',
      "article p",
      ".article-content p",
      ".article-body p",
      ".post-content p",
      ".content-text p",
      ".entry-content p",
      "main p",
    ];

    for (const selector of candidates) {
      const count = $(selector).length;
      if (count >= 3) {
        // At least 3 paragraphs
        selectors.push(selector);
        if (selectors.length >= 3) break;
      }
    }

    return selectors.length > 0 ? selectors : ["article p", "main p"];
  }

  /**
   * Find date selectors
   */
  private findDateSelectors($: CheerioAPI): string[] {
    const selectors: string[] = [];

    const candidates = [
      "time[datetime]",
      'meta[property="article:published_time"]',
      "[data-testid*='date']",
      "[data-testid*='time']",
      ".publish-date",
      ".article-date",
      ".posted-on",
    ];

    for (const selector of candidates) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        if (selectors.length >= 3) break;
      }
    }

    return selectors.length > 0 ? selectors : ["time[datetime]"];
  }

  /**
   * Find image selectors
   */
  private findImageSelectors($: CheerioAPI): string[] {
    const selectors: string[] = [];

    const candidates = [
      "article img",
      "figure img",
      ".article-image img",
      ".featured-image img",
      "main img",
    ];

    for (const selector of candidates) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        if (selectors.length >= 3) break;
      }
    }

    return selectors.length > 0 ? selectors : ["article img"];
  }

  /**
   * Find author selectors
   */
  private findAuthorSelectors($: CheerioAPI): string[] {
    const selectors: string[] = [];

    const candidates = [
      '[rel="author"]',
      '[itemprop="author"]',
      ".author-name",
      ".byline",
      ".author",
      "[data-testid*='author']",
    ];

    for (const selector of candidates) {
      if ($(selector).length > 0) {
        selectors.push(selector);
        if (selectors.length >= 3) break;
      }
    }

    return selectors.length > 0
      ? selectors
      : [".author", ".byline", '[rel="author"]'];
  }

  /**
   * Generate a CSS selector for an element
   */
  private generateSelector($: CheerioAPI, el: CheerioElement): string {
    const $el = $(el);

    // Prefer data attributes
    const testId = $el.attr("data-testid");
    if (testId) return `a[data-testid="${testId}"]`;

    const linkType = $el.attr("data-link-type");
    if (linkType) return `a[data-link-type="${linkType}"]`;

    const linkName = $el.attr("data-link-name");
    if (linkName) return `a[data-link-name="${linkName}"]`;

    // Use class if distinctive
    const classes = $el.attr("class")?.trim().split(/\s+/) || [];
    const distinctiveClass = classes.find(
      (c) =>
        c.includes("article") ||
        c.includes("headline") ||
        c.includes("link") ||
        c.includes("promo")
    );

    if (distinctiveClass) {
      return `a.${distinctiveClass}`;
    }

    // Use partial class match
    if (classes.length > 0) {
      const firstClass = classes[0];
      if (firstClass.length > 3) {
        return `a[class*="${firstClass}"]`;
      }
    }

    // Fallback to parent container
    const parent = $el.parent();
    const parentClass = parent.attr("class")?.split(/\s+/)[0];
    if (parentClass) {
      return `.${parentClass} a`;
    }

    return "a";
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(href: string, baseUrl: string): string {
    try {
      return new URL(href, baseUrl).href;
    } catch {
      return href;
    }
  }

  /**
   * Generate configuration from analysis
   */
  generateConfigFromAnalysis(analysis: HTMLAnalysis): any {
    const platform = "website";
    const parsedUrl = new URL(analysis.base_url);

    return {
      platform,
      common: {
        media: {
          include: true,
          download: true,
          max_per_item: 5,
          allowed_types: ["image"],
        },
        state: {
          last_item_id: null,
          last_fetched_at: null,
        },
        content: {
          strip_urls: false,
          strip_emojis: false,
          skip_patterns: [
            "subscribe to",
            "sign up for",
            "advertisement",
            "cookie policy",
            "newsletter",
          ],
          min_text_length: 300,
        },
        fetch_limit: 20,
        deduplication_strategy: "content_hash",
      },
      website: {
        base_url: analysis.base_url,
        rss_feeds: analysis.has_rss ? analysis.rss_feeds.slice(0, 3) : [],
        listing_path: parsedUrl.pathname || "/",
        listing_selector: analysis.article_links.selectors.join(", "),
        article_selectors: {
          title: analysis.common_patterns.titles,
          content: analysis.common_patterns.content,
          publish_date: analysis.common_patterns.dates,
          images: analysis.common_patterns.images,
          remove: [
            ".ad",
            ".advertisement",
            ".social-share",
            "aside",
            "nav",
            ".related-content",
            ".comments",
            ".newsletter-signup",
          ],
        },
      },
    };
  }
}

export default new HTMLAnalyzerService();
