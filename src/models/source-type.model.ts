export interface NewsSourceType {
  source_type_id?: number;
  source_type_name: string;
  source_type_slug: string;
  source_type_description?: string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface NewsSourceTypeFilters {
  search?: string;
  slug?: string;
  is_deleted?: boolean;
  sort_by?: string;
  sort_order?: "ASC" | "DESC";
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export interface BulkDeleteRequest {
  ids: number[];
  soft?: boolean;
}
