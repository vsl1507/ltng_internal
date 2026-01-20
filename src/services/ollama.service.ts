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
    options: any[] | any = {}
  ): Promise<string> {
    try {
      console.log(`🤖 Generating with model: ${model}`);

      const requestData = {
        model: model,
        prompt: prompt,
        stream: false,
        options: Array.isArray(options) ? {} : options,
      };

      console.log(`📤 Request data:`, {
        model: requestData.model,
        prompt: requestData.prompt.substring(0, 100) + "...",
        stream: requestData.stream,
        options: requestData.options,
      });

      const response = await this.client.post("/api/generate", requestData, {
        timeout: timeout,
      });

      console.log(`📥 Response status: ${response.status}`);
      console.log(`📥 Response data keys:`, Object.keys(response.data || {}));

      if (!response.data) {
        throw new Error("No data in Ollama response");
      }

      if (!response.data.response) {
        console.error(
          "❌ Response structure:",
          JSON.stringify(response.data, null, 2)
        );
        throw new Error("Empty response field from Ollama");
      }

      const rawResponse = response.data.response.trim();
      if (!rawResponse) {
        throw new Error("Empty response content from Ollama");
      }

      console.log(`✅ Generated response (${rawResponse.length} chars)`);
      return rawResponse;
    } catch (error: any) {
      console.error("❌ Ollama API error:", error.message);

      if (error.response) {
        console.error("📄 Error response status:", error.response.status);
        console.error(
          "📄 Error response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }

      if (error.code === "ECONNREFUSED") {
        console.error(
          "🔌 Cannot connect to Ollama server. Check if it's running."
        );
      }

      // If model not found, try with a fallback model
      if (error.response?.status === 404 && model !== "qwen2.5:14b") {
        console.log("🔄 Trying fallback model: qwen2.5:14b");
        return this.generate(prompt, "qwen2.5:14b", timeout, options);
      }

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

  /**
   * Check if server is accessible and list available models
   */
  async checkConnection(): Promise<{ connected: boolean; models?: string[] }> {
    try {
      const response = await this.client.get("/api/tags", { timeout: 5000 });
      const models = response.data.models?.map((m: any) => m.name) || [];

      console.log("✅ Ollama server is accessible");
      console.log("📋 Available models:", models.join(", ") || "None");

      return { connected: true, models };
    } catch (error: any) {
      console.error("❌ Ollama server not accessible:", error.message);
      return { connected: false };
    }
  }
}

export default new OllamaService();
