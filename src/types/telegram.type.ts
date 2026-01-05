export interface TelegramCommonConfig {
  common: {
    fetch_limit: number;
    deduplication_strategy: "message_id" | "url" | "content_hash";
    content: {
      use_caption_if_media: boolean;
      strip_urls: boolean;
      strip_emojis: boolean;
      min_text_length: number;
    };
    media: {
      include: boolean;
      download: boolean;
      allowed_types: ("photo" | "video" | "audio" | "document" | "animation")[];
      max_per_item: number;
    };
    state: {
      last_message_id: number | null;
      last_fetched_at: string | null;
      last_item_timestamp?: string | null;
    };
    scrape_delay_ms?: number;
  };
  telegram: {
    username: string;
    type?: "channel" | "group";
    access_method: "user" | "bot";
  };
}

export type TelegramSourceConfig = TelegramCommonConfig & {
  platform: "telegram";
};

export interface ScrapeOptionsFromConfig {
  sourceId: number;
  sourceName: string;
  config: TelegramSourceConfig;
}

export interface ScrapeResult {
  success: boolean;
  sourceId: number;
  sourceName: string;
  channel: string;
  messagesScraped: number;
  mediaDownloaded: number;
  totalMessages: number;
  skipped?: number;
  duplicateUrls?: number;
}
