export interface NewsRadarAI {
  radar_ai_id: number;
  radar_ai_story_number: number | null;
  radar_ai_title_en: BilingualText;
  radar_ai_title_kh: BilingualText;
  radar_ai_content_en: BilingualText;
  radar_ai_content_kh: BilingualText;
  radar_ai_category_id: NewsCategory | null;
  tags: NewsTag[];
  radar_ai_generated_from: any;
  radar_ai_version: number;
  radar_ai_is_published: boolean;
  radar_ai_published_at: Date | null;
  radar_ai_status: boolean;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface BilingualText {
  en: string;
  kh: string;
}

export interface NewsCategory {
  id: number;
  name_en: string;
  name_kh: string;
  slug: string;
}

export interface NewsTag {
  tag_id: number;
  name_en: string;
  name_kh: string;
}
export interface NewsRadarAIGenerate {
  radar_id: number;
}

export interface NewsRadarAIFilters {
  search?: string;
  radar_ai_category_id?: number;
  radar_ai_story_number?: number;
  radar_ai_is_published?: boolean;
  radar_ai_status?: boolean;
  is_deleted?: boolean;
  sort_by?: string;
  sort_order?: "ASC" | "DESC";
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}
