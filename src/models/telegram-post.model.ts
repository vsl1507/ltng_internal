export interface TelegramPost {
  post_id?: number;
  radar_ai_id: number;
  story_id: number;
  post_version: number;
  is_major_update?: boolean;
  post_content: string;
  post_media?: any;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface TelegramPostFilters {
  radar_ai_id?: number;
  post_version?: number;
  has_message_id?: boolean; // true = has message_id, false = no message_id
  is_major_update?: boolean;
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

export interface BulkUpdateMessageIdRequest {
  post_id: number;
  post_message_id: number;
}

export interface BulkDeleteRequest {
  ids: number[];
  soft?: boolean;
}
