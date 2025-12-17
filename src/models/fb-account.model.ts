export interface FBAccount {
  acc_id?: number; // AUTO_INCREMENT
  acc_name: string; // varchar(100), NOT NULL
  acc_username: string; // varchar(100), NOT NULL
  acc_password: string; // varchar(100), NOT NULL
  acc_2fa: string; // varchar(50), NOT NULL
  acc_cookie?: string | null; // text, NULL
  acc_uid: string; // varchar(50), NOT NULL
  acc_phone: string; // varchar(100), NOT NULL
  acc_email: string; // varchar(100), NOT NULL
  acc_gender: "FEMALE" | "MALE"; // enum('FEMALE','MALE'), NOT NULL
  acc_friend_count: number; // int, NOT NULL, default 0
  acc_friend_suggestion: "YES" | "NO"; // enum('YES','NO'), NOT NULL
  acc_set_intro: "YES" | "NO"; // enum('YES','NO'), NOT NULL
  acc_set_pic: "YES" | "NO"; // enum('YES','NO'), NOT NULL, default 'NO'
  acc_follower: "YES" | "NO"; // enum('YES','NO'), NOT NULL
  acc_date_created: string; // date, NOT NULL
  acc_date_update?: Date; // timestamp, auto-update CURRENT_TIMESTAMP
  acc_device?: string | null; // longtext, NULL
  acc_notes: string; // varchar(255), NOT NULL
  acc_status:
    | "ACTIVE"
    | "CHECKPOINT"
    | "LOCKED"
    | "DISABLED"
    | "APPEAL_CHECKPOINT"
    | "ERROR_PASSWORD"
    | "ERROR_2FA"
    | "DELETED";
}

export interface FBAccountFilters {
  search?: string;
  acc_status?: string;
  acc_friend_suggestion?: string;
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
  acc_status?:
    | "ACTIVE"
    | "CHECKPOINT"
    | "LOCKED"
    | "DISABLED"
    | "APPEAL_CHECKPOINT"
    | "ERROR_PASSWORD"
    | "ERROR_2FA";
}

export interface BulkDeleteRequest {
  ids: number[];
}
