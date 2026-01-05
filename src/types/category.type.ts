export interface OllamaCategoryTagResult {
  category: {
    en: string;
    kh: string;
  };
  tags: {
    en: string;
    kh: string;
  }[];
}

export interface CategoryKeyword {
  keyword_id: number;
  category_id: number;
  keyword: string;
  language: "en" | "kh";
  weight: number;
  is_exact_match: boolean;
}

export interface CategoryMatch {
  category_id: number;
  category_name_en: string;
  category_name_kh: string;
  score: number;
  matched_keywords: string[];
}

export interface ClassificationConfig {
  keywordThreshold: number;
  useAIFallback: boolean;
  combineResults: boolean;
  autoLearnKeywords: boolean;
  autoLearnMinWeight: number;
}
