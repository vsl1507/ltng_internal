export const OLLAMA_URL = process.env.OLLAMA_API_URL;
export const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || "";
export const OLLAMA_LOCAL_MODEL = process.env.OLLAMA_MODEL;
export const OLLAMA_CLOUD_MODEL = process.env.OLLAMA_MODEL;
export const OLLAMA_TIMEOUT = Number(process.env.OLLAMA_TIMEOUT);
export const OLLAMA_TEMPERATURE = Number(process.env.OLLAMA_TEMPERATURE);
export const TEXT_COMPARISON_LIMIT =
  Number(process.env.TEXT_COMPARISON_LIMIT) || 3000;
export const TITLE_MAX_LENGTH = Number(process.env.TITLE_MAX_LENGTH) || 200;
export const TITLE_MIN_LENGTH = Number(process.env.TITLE_MIN_LENGTH) || 100;
