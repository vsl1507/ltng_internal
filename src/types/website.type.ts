export type WebsitePlatform = "website";

export interface WebsiteCommonConfig {
  fetch_limit: number;
  deduplication_strategy: "url" | "content_hash";

  content: {
    strip_urls: boolean;
    strip_emojis: boolean;
    min_text_length: number;
    skip_patterns: string[];
  };

  media: {
    include: boolean;
    download: boolean;
    max_per_item: number;
    allowed_types: Array<"image" | "video" | "audio">;
  };

  ai: {
    enabled: boolean;
    prefer_local_ollama: boolean;
  };

  relevance: {
    enabled: boolean;
    check_cambodia_world_news: boolean;
    min_confidence: number;
  };

  state: {
    last_fetched_at: string | null;
    last_item_id: string | null;
  };
}

export interface WebsiteArticleSelectors {
  title: string[];
  author?: string[];
  publish_date?: string[];
  content: string[];
  images?: string[];
  remove?: string[];
}

export interface WebsiteConfig {
  base_url: string;
  rss_feeds?: string[];
  listing_path?: string;
  listing_selector?: string;
  article_selectors: WebsiteArticleSelectors;
}

export interface WebsiteSourceConfig {
  platform: WebsitePlatform;
  common: WebsiteCommonConfig;
  website: WebsiteConfig;
}

export interface ScrapedArticle {
  title: string;
  content: string;
  url: string;
  author?: string;
  publishedAt?: Date;
  images?: string[];
}

export interface ScrapeStats {
  savedCount: number;
  skippedCount: number;
  duplicateCount: number;
  mediaCount: number;
}
