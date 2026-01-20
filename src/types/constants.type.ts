export const OLLAMA_URL = process.env.OLLAMA_API_URL || "localhost:13114";
export const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
export const OLLAMA_LOCAL_MODEL =
  process.env.OLLAMA_LOCAL_MODEL || "qwen2.5:14b";
export const OLLAMA_CLOUD_MODEL =
  process.env.OLLAMA_CLOUD_MODEL || "gpt-oss:120b-cloud";
export const OLLAMA_TIMEOUT = Number(process.env.OLLAMA_TIMEOUT) || 20000;
export const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE);
export const TEXT_COMPARISON_LIMIT =
  Number(process.env.TEXT_COMPARISON_LIMIT) || 3000;
export const TITLE_MAX_LENGTH = Number(process.env.TITLE_MAX_LENGTH) || 200;
export const TITLE_MIN_LENGTH = Number(process.env.TITLE_MIN_LENGTH) || 100;
export const SIMILARITY_THRESHOLD =
  Number(process.env.SIMILARITY_THRESHOLD) || 0.65;
export const STORY_LOOKBACK_DAYS = Number(process.env.STORY_LOOKBACK_DAYS) || 2;
export const EMBEDDING_TEXT_LIMIT =
  Number(process.env.EMBEDDING_TEXT_LIMIT) || 2000;
export const EMBEDDING_TIMEOUT = Number(process.env.EMBEDDING_TIMEOUT) || 10000;
