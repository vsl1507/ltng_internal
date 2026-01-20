export interface ScrapeOptions {
  channelUsername: string;
  limit?: number;
  downloadMedia?: boolean;
}

export interface StoryNumberResult {
  storyNumber: number;
  isNewStory: boolean;
  isBreaking?: boolean;
  similarity?: number;
  matchedArticleId?: number;
}

export interface SimilarityResult {
  same_story: number;
  is_breaking: boolean;
}

export const SIMILARITY_CONFIG = {
  temperature: 0.1,
  num_predict: 1000,
  num_ctx: 6144,
  top_p: 0.9,
  top_k: 10,
  repeat_penalty: 1.1,
  stop: ["}"],
} as any;

export const BILINGUAL_GENERATION_CONFIG = {
  temperature: 0.3,
  num_predict: 1400,
  num_ctx: 10240,
  top_p: 0.95,
  top_k: 40,
  repeat_penalty: 1.2,
  presence_penalty: 0.6,
  frequency_penalty: 0.3,
  stop: ["\n\n\n", "```"],
  format: "json",
} as any;

export const NEWS_UPDATE_CONFIG = {
  temperature: 0.4,
  num_predict: 1800,
  num_ctx: 12288,
  top_p: 0.92,
  top_k: 35,
  repeat_penalty: 1.3,
  presence_penalty: 0.7,
  frequency_penalty: 0.4,
  stop: ["\n\n\n", "```", "---"],
  format: "json",
} as any;

export const CATEGORY_CONFIG = {
  temperature: 0.3,
  num_predict: 2000,
  num_ctx: 2048,
} as any;
