import axios, { AxiosInstance } from "axios";
import {
  OLLAMA_API_KEY,
  OLLAMA_CLOUD_MODEL,
  OLLAMA_URL,
} from "../types/constants.type";
import { AIConfig } from "../types/ollama.type";

const OLLAMA_CONFIG = {
  URL: OLLAMA_URL,
  API_KEY: OLLAMA_API_KEY,
} as const;

export class OllamaService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: OLLAMA_CONFIG.URL,
      headers: {
        "Content-Type": "application/json",
        ...(OLLAMA_CONFIG.API_KEY && {
          Authorization: `Bearer ${OLLAMA_CONFIG.API_KEY}`,
        }),
      },
    });
  }

  async generate(
    prompt: string,
    model: string,
    timeout: number,
    options: any[]
  ): Promise<string> {
    try {
      const response = await this.client.post("/api/generate", {
        model: model,
        timeout: timeout,
        prompt: prompt,
        stream: false,
        options: options,
      });

      const rawResponse = response.data?.response?.trim();
      if (!rawResponse) {
        throw new Error("Empty response from Ollama");
      }

      return rawResponse;
    } catch (error: any) {
      console.error("❌ Ollama API error:", error.message);
      throw error;
    }
  }

  parseJSON<T>(response: string): T {
    // Remove markdown code blocks
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Extract JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export default new OllamaService();
