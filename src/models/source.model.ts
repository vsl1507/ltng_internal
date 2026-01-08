export interface NewsSource {
  source_id?: number;
  source_type_id: number;
  source_name: string;
  source_identifier: string;
  source_config?: Record<string, any> | string;
  source_is_active?: boolean;
  source_is_trusted?: boolean;
  source_country?: string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface NewsSourceFilters {
  search?: string;
  source_type_id?: number;
  source_is_active?: boolean;
  source_is_trusted?: boolean;
  source_country?: string;
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
  source_is_active?: boolean;
  source_is_trusted?: boolean;
}

export interface BulkDeleteRequest {
  ids: number[];
  soft?: boolean;
}
