import axios from "axios";
import pool from "../config/mysql.config";
import {
  OLLAMA_API_KEY,
  OLLAMA_CLOUD_MODEL,
  OLLAMA_LOCAL_MODEL,
  OLLAMA_TIMEOUT,
  OLLAMA_URL,
  SIMILARITY_THRESHOLD,
  STORY_LOOKBACK_DAYS,
  TEXT_COMPARISON_LIMIT,
} from "../types/constants.type";
import {
  SIMILARITY_CONFIG,
  SimilarityResult,
  StoryNumberResult,
} from "../types/scrape.type";

// ========== TEXT PROCESSING UTILS ==========

/**
 * Strip URLs from text
 */
export function stripUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/g, "");
}

/**
 * Strip emojis from text
 */
export function stripEmojis(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ""
  );
}

/**
 * Generate SHA-256 hash of content for deduplication
 */
export async function generateContentHash(content: string): Promise<string> {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(content).digest("hex");
}

// ========== SIMILARITY UTILS ==========

/**
 * Calculate semantic similarity between two texts using AI model
 */
export async function calculateTextSimilarity(
  text1: string,
  text2: string
): Promise<SimilarityResult | null> {
  try {
    const prompt = buildSimilarityPrompt(text1, text2);

    const res = await axios.post(
      `${OLLAMA_URL}/api/generate`,
      {
        model: OLLAMA_CLOUD_MODEL,
        prompt,
        stream: false,
        options: SIMILARITY_CONFIG,
      },
      {
        timeout: OLLAMA_TIMEOUT,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OLLAMA_API_KEY}`,
        },
      }
    );

    console.log("res: ", res);

    if (!res.data?.response) {
      throw new Error("Empty response from Ollama");
    }

    const result = parseSimilarityResponse(res.data.response);
    logSimilarityResult(result);

    return {
      same_story: result.same_story ? result.confidence : 1 - result.confidence,
      is_breaking: result.is_breaking,
    };
  } catch (error) {
    console.error("❌ AI similarity calculation failed:", error);
    return null;
  }
}

/**
 * Build AI prompt for similarity comparison
 */
function buildSimilarityPrompt(text1: string, text2: string): string {
  const truncate = (text: string, maxLength: number = TEXT_COMPARISON_LIMIT) =>
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  return `You are a STRICT semantic comparison engine.

TASK: Determine whether Article 1 and Article 2 describe the SAME REAL-WORLD EVENT.

DEFINITION: "SAME STORY" means BOTH articles describe:
- the same people or group
- the same date or time period
- the same location
- the same action
- the same purpose or outcome

RULES:
- Compare ONLY meaning and facts
- IGNORE writing style, formatting, emojis, hashtags
- IGNORE duplicated or truncated sentences
- Do NOT infer missing facts
- If core facts match → same_story = true

BREAKING NEWS CLASSIFICATION:
- BREAKING NEWS: New, urgent, time-sensitive events
- Indicators: "today", "now", "just", "latest", "breaking"
- Emergency, crisis, attack, disaster, arrest, resignation

Article 1:
<<<
${truncate(text1)}
>>>

Article 2:
<<<
${truncate(text2)}
>>>

Respond ONLY with valid JSON. NO markdown. NO extra text.

JSON FORMAT:
{
  "same_story": true or false,
  "difference": 0-100,
  "is_breaking": true or false,
  "confidence": 0.0-1.0,
  "reasoning": "one short sentence"
};`;
}

/**
 * Parse AI similarity response
 */
function parseSimilarityResponse(rawResponse: string): any {
  const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
  const result = JSON.parse(jsonStr);

  if (
    !result.hasOwnProperty("same_story") ||
    !result.hasOwnProperty("confidence")
  ) {
    throw new Error("Invalid response structure from Ollama");
  }

  return result;
}

/**
 * Log similarity comparison result
 */
function logSimilarityResult(result: any): void {
  const status = result.same_story ? "SAME" : "DIFFERENT";
  const confidence = Math.round(result.confidence * 100);
  console.log(`🤖 AI comparison: ${status} story (${confidence}% confidence)`);
  console.log(`Reasoning: ${result.reasoning}`);
}

// ========== STORY GROUPING UTILS ==========

/**
 * Generate new story number
 */
export async function generateNewStoryNumber(): Promise<number> {
  const [result] = (await pool.query(
    `SELECT MAX(radar_story_number) as max_story_number 
     FROM ltng_news_radar 
     WHERE is_deleted = FALSE`
  )) as any;

  const maxStoryNumber = result[0]?.max_story_number || 0;
  const newStoryNumber = maxStoryNumber + 1;

  console.log(`🆕 Generated new story number: ${newStoryNumber}`);
  return newStoryNumber;
}

/**
 * Fetch recent articles for similarity comparison
 */
export async function fetchRecentArticles(
  excludeSourceId?: number
): Promise<any[]> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - STORY_LOOKBACK_DAYS);

  let query = `
    SELECT * FROM (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY radar_story_number ORDER BY radar_scraped_at ASC) AS rn_first,
        ROW_NUMBER() OVER (PARTITION BY radar_story_number ORDER BY radar_scraped_at DESC) AS rn_last
      FROM ltng_news_radar
      WHERE radar_scraped_at >= ?
        AND radar_story_number IS NOT NULL
        AND is_deleted = FALSE
        ${excludeSourceId ? "AND radar_source_id != ?" : ""}
    ) t
    WHERE radar_is_story_leader = 1 OR rn_last = 1
    ORDER BY radar_story_number, radar_scraped_at
  `;

  const params = excludeSourceId
    ? [lookbackDate, excludeSourceId]
    : [lookbackDate];

  const [existingArticles] = (await pool.query(query, params)) as any;

  return existingArticles;
}

/**
 * Find similar article from existing articles
 */
export async function findSimilarArticle(
  title: string,
  content: string,
  existingArticles: any[]
): Promise<any | null> {
  const newText = `${title} ${content}`;

  for (const article of existingArticles) {
    const existingText = `${article.radar_title} ${article.radar_content}`;
    const similarity = await calculateTextSimilarity(newText, existingText);

    if (similarity && similarity.same_story > SIMILARITY_THRESHOLD) {
      const matchPercent = Math.round(similarity.same_story * 100);
      console.log(
        `🔎 Found similar article (${matchPercent}% match), using story #${article.radar_story_number}`
      );
      return article;
    }
  }

  return null;
}

/**
 * Find or create story number for grouping related articles
 */
export async function findOrCreateStoryNumber(
  title: string,
  content: string,
  excludeSourceId?: number
): Promise<StoryNumberResult> {
  const existingArticles = await fetchRecentArticles(excludeSourceId);

  if (existingArticles.length === 0) {
    const newStoryNumber = await generateNewStoryNumber();
    return { storyNumber: newStoryNumber, isNewStory: true };
  }

  const similarArticle = await findSimilarArticle(
    title,
    content,
    existingArticles
  );

  if (similarArticle) {
    return {
      storyNumber: similarArticle.radar_story_number,
      isNewStory: false,
    };
  }

  const newStoryNumber = await generateNewStoryNumber();
  console.log(
    `🆕 No similar articles found, created new story #${newStoryNumber}`
  );

  return { storyNumber: newStoryNumber, isNewStory: true };
}

/**
 * Find story leader for a given story number
 */
export async function findStoryLeader(
  storyNumber: number
): Promise<number | null> {
  const [leaderRows] = (await pool.query(
    `SELECT radar_id FROM ltng_news_radar 
     WHERE radar_story_number = ? 
       AND radar_is_story_leader = TRUE 
       AND is_deleted = FALSE 
     LIMIT 1`,
    [storyNumber]
  )) as any;

  if (leaderRows.length > 0) {
    console.log(`🔎 Found story leader: Article #${leaderRows[0].radar_id}`);
    return leaderRows[0].radar_id;
  }

  console.warn(`⚠️ No leader found for story #${storyNumber}`);
  return null;
}

// ========== VALIDATION UTILS ==========

/**
 * Source scrape by source type
 */
export async function sourceScrape(source_type_slug: string): Promise<any> {
  const [sources] = (await pool.query(
    `SELECT * 
        FROM ltng_news_sources s
        JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id
        WHERE s.source_is_active = TRUE
        AND st.source_type_slug = ?
        AND s.is_deleted  = FALSE `,
    [source_type_slug]
  )) as any;
  return sources;
}

/**
 * Check if content should be skipped based on patterns
 */
export function shouldSkipContent(
  content: string,
  skipPatterns: string[]
): boolean {
  if (!skipPatterns || skipPatterns.length === 0) {
    return false;
  }

  const lowerContent = content.toLowerCase();
  return skipPatterns.some((pattern) =>
    lowerContent.includes(pattern.toLowerCase())
  );
}

/**
 * Check if article already exists by URL or content hash
 */
export async function isDuplicate(
  url: string,
  contentHash: string
): Promise<boolean> {
  const [existingRows] = (await pool.query(
    `SELECT radar_id FROM ltng_news_radar 
     WHERE (radar_url = ? OR radar_content_hash = ?)
       AND is_deleted = FALSE 
     LIMIT 1`,
    [url, contentHash]
  )) as any;

  return existingRows.length > 0;
}
