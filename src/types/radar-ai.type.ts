export interface NewsRadarAI {
  radar_ai_id?: number;
  radar_ai_category_id: number;
  radar_ai_story_number: number;
  radar_ai_title_en: string;
  radar_ai_title_kh: string;
  radar_ai_content_en: string;
  radar_ai_content_kh: string;
  radar_ai_generated_fro: string;
  rddar_ai_version: number;
  radar_ai_is_published: Date;
  radar_ai_published_at: Date;
  radar_ai_status: string;
  created_at: Date;
  udpated_at: Date;
  is_deleted: boolean;
  careated_by: number;
  udpated_by: number;
  __v: number;
}

export interface NewsRadarAIFilters {
  search?: string;
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
