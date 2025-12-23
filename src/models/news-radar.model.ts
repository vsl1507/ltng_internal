export interface NewsRadar {
  radar_id?: number; // AUTO_INCREMENT
  radar_parent_id?: number | null; // int, NULL
  radar_category_id: number; // int, NOT NULL
  radar_source_id: number; // int, NOT NULL
  radar_title: string; // text, NOT NULL
  radar_content: string; // text, NOT NULL
  radar_content_hash?: string | null; // varchar(64), NULL
  radar_url: string; // varchar(255), NOT NULL
  radar_published_at?: Date | null; // datetime, NULL
  radar_scraped_at?: Date; // datetime, DEFAULT CURRENT_TIMESTAMP
  radar_story_number?: number | null; // int, NULL
  radar_is_breaking: boolean; // boolean, DEFAULT FALSE
  radar_is_duplicated: boolean; // boolean, DEFAULT FALSE
  radar_processing_status: "NEW" | "PROCESSING" | "PROCESSED" | "ERROR"; // enum, DEFAULT 'NEW'
  created_at?: Date; // datetime, DEFAULT CURRENT_TIMESTAMP
  updated_at?: Date; // datetime, auto-update CURRENT_TIMESTAMP
  is_deleted: boolean; // boolean, DEFAULT FALSE
  created_by?: number | null; // int, NULL
  updated_by?: number | null; // int, NULL
  __v: number; // int, DEFAULT 0
}

export interface NewsRadarFilters {
  search?: string;
  radar_category_id?: number;
  radar_source_id?: number;
  radar_processing_status?: string;
  radar_is_breaking?: boolean;
  radar_is_duplicated?: boolean;
  radar_story_number?: number;
  is_deleted?: boolean;
  published_year?: string;
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

export interface BulkUpdateRequest {
  ids: number[];
  radar_processing_status?: "NEW" | "PROCESSING" | "PROCESSED" | "ERROR";
  radar_is_breaking?: boolean;
  radar_is_duplicated?: boolean;
  is_deleted?: boolean;
}

export interface BulkDeleteRequest {
  ids: number[];
}
