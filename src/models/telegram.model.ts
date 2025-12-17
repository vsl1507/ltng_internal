export interface Telegram {
  telegram_id?: number;
  telegram_name: string;
  telegram_username?: string;
  telegram_chat_id: string;
  telegram_type: "CHANNEL" | "GROUP" | "PRIVATE";
  telegram_is_active?: boolean;
  telegram_description?: string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface TelegramFilters {
  search?: string;
  telegram_type?: "CHANNEL" | "GROUP" | "PRIVATE";
  telegram_is_active?: boolean;
  telegram_chat_id?: string;
  telegram_username?: string;
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

export interface BulkUpdateRequest {
  ids: number[];
  telegram_is_active?: boolean;
}

export interface BulkDeleteRequest {
  ids: number[];
  soft?: boolean;
}
