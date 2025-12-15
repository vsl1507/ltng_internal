export interface FBAccount {
  acc_id?: number;
  acc_name: string;
  acc_username: string;
  acc_password: string;
  acc_2fa?: string;
  acc_cookie?: string;
  acc_uid?: string;
  acc_phone?: string;
  acc_email?: string;
  acc_gender?: string;
  acc_friend_count: number;
  acc_friend_suggestion: boolean;
  acc_set_intro: boolean;
  acc_set_pic: boolean;
  acc_follower: boolean;
  acc_date_created?: Date | string;
  acc_date_update?: Date;
  acc_device?: string;
  acc_notes?: string;
  status: "Active" | "Checkpoint" | "Locked" | "Disabled";
}

export interface FBAccountFilters {
  search?: string;
  status?: string;
  friend_suggestion?: string;
  creation_year?: string;
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
  status?: "Active" | "Checkpoint" | "Locked" | "Disabled";
}

export interface BulkDeleteRequest {
  ids: number[];
}
