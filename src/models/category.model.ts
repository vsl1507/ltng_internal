export interface Category {
  category_id: number;
  category_name_en: string;
  category_name_kh: string;
  category_slug: string;
  category_description?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
  category_order?: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  __v: number;
}

export interface CategoryKeyword {
  keyword_id: number;
  category_id: number;
  keyword: string;
  language: "en" | "kh";
  weight: number;
  is_exact_match: boolean;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  __v: number;
}

export interface CategoryFilters {
  search?: string;
  language?: "en" | "kh";
  sort_by?: string;
  sort_order?: "ASC" | "DESC";
  is_deleted?: boolean;
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
