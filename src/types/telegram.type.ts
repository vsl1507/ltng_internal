// types/source-config.ts
export interface TelegramSourceConfig {
  platform: string;
  telegram: {
    type: string;
    username: string;
    id: string | null;  
  };
  fetch: {
    method: "bot" | "api" | "scraper";
    poll_interval_seconds: number;
    fetch_limit: number;
    include_forwards: boolean;
    include_replies: boolean;
  };
  content: {
    use_caption_if_media: boolean;
    strip_urls: boolean;
    strip_emojis: boolean;
    min_text_length: number;
  };
  media: {
    include: boolean;
    download: boolean;
    allowed_types: string[];
    max_media_per_message: number;
  };
  deduplication: {
    strategy: "message_id" | "hash";
    hash_fields: string[];
  };
  language: string;
  timezone: string;
  state: {
    last_message_id: number | null;
    last_fetched_at: string | null;
  };
}

export interface ScrapeOptionsFromConfig {
  sourceId: number;
  config: TelegramSourceConfig;
}

export interface ScrapeResult {
  success: boolean;
  sourceId: number;
  channel: string;
  messagesScraped: number;
  mediaDownloaded: number;
  totalMessages: number;
}
