export interface NewsPostDelivery {
  delivery_id?: number;
  post_id: number;
  telegram_id: number;
  telegram_message_id?: number;
  delivery_status: "PENDING" | "SENT" | "EDITED" | "DELETED" | "FAILED";
  retry_count: number;
  last_error?: string;
  sent_at?: Date | string;
  edited_at?: Date | string;
  deleted_at?: Date | string;
  created_at?: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  created_by?: number;
  updated_by?: number;
  __v?: number;
}

export interface NewsPostDeliveryFilters {
  search?: string;
  post_id?: number;
  telegram_id?: number;
  delivery_status?: string;
  date_from?: string;
  date_to?: string;
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
  delivery_status?: string;
}

export interface BulkDeleteRequest {
  ids: number[];
  soft?: boolean;
}

export interface DeliveryStats {
  total: number;
  pending: number;
  sent: number;
  edited: number;
  deleted: number;
  failed: number;
  success_rate: number;
}
