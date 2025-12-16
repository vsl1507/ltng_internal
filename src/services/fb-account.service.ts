import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  FBAccount,
  FBAccountFilters,
  PaginatedResponse,
} from "../models/fb-account.model";

export class FBAccountService {
  // Get all accounts with filters and pagination
  async getAllAccounts(
    filters: FBAccountFilters
  ): Promise<PaginatedResponse<FBAccount>> {
    const {
      search = "",
      acc_status = "",
      acc_friend_suggestion = "",
      creation_year = "",
      sort_by = "acc_date_update",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = "SELECT * FROM ltng_media_facebook_acc WHERE 1=1";
    const params: any[] = [];

    // Search filter
    if (search) {
      query +=
        " AND (acc_username LIKE ? OR acc_uid LIKE ? OR acc_name LIKE ? OR acc_notes LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Status filter
    if (acc_status && acc_status !== "All") {
      query += " AND acc_status = ?";
      params.push(acc_status);
    }

    // Friend suggestion filter
    if (acc_friend_suggestion && acc_friend_suggestion !== "All") {
      query += " AND acc_friend_suggestion = ?";
      params.push(acc_friend_suggestion);
    }

    // Creation year filter
    if (creation_year && creation_year !== "All") {
      if (creation_year === "< 2024") {
        query += " AND YEAR(acc_date_created) < 2024";
      } else if (creation_year === "2023-2024") {
        query += " AND YEAR(acc_date_created) BETWEEN 2023 AND 2024";
      } else if (creation_year === "> 2024") {
        query += " AND YEAR(acc_date_created) > 2024";
      }
    }

    // Count total records
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "acc_friend_count",
      "acc_date_update",
      "acc_date_created",
      "acc_username",
      "acc_name",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "acc_date_update";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return {
      success: true,
      data: rows as FBAccount[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get account by ID
  async getAccountById(id: number): Promise<FBAccount | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_media_facebook_acc WHERE acc_id = ?",
      [id]
    );
    return rows.length > 0 ? (rows[0] as FBAccount) : null;
  }

  // Get account by username
  async getAccountByUsername(username: string): Promise<FBAccount | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_media_facebook_acc WHERE acc_username = ?",
      [username]
    );
    return rows.length > 0 ? (rows[0] as FBAccount) : null;
  }

  // Create new account
  async createAccount(account: FBAccount): Promise<FBAccount> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_media_facebook_acc 
       (acc_name, acc_username, acc_password, acc_2fa, acc_cookie, acc_uid, 
        acc_phone, acc_email, acc_gender, acc_friend_count, acc_friend_suggestion,
        acc_set_intro, acc_set_pic, acc_follower, acc_date_created, acc_device, 
        acc_notes, acc_status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        account.acc_name,
        account.acc_username,
        account.acc_password,
        account.acc_2fa,
        account.acc_cookie || null,
        account.acc_uid,
        account.acc_phone,
        account.acc_email,
        account.acc_gender,
        account.acc_friend_count || 0,
        account.acc_friend_suggestion,
        account.acc_set_intro,
        account.acc_set_pic || "NO",
        account.acc_follower,
        account.acc_date_created,
        account.acc_device || null,
        account.acc_notes,
        account.acc_status,
      ]
    );

    return { acc_id: result.insertId, ...account };
  }

  // Update account
  async updateAccount(
    id: number,
    account: Partial<FBAccount>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (account.acc_name !== undefined) {
      fields.push("acc_name = ?");
      values.push(account.acc_name);
    }
    if (account.acc_username !== undefined) {
      fields.push("acc_username = ?");
      values.push(account.acc_username);
    }
    if (account.acc_password !== undefined) {
      fields.push("acc_password = ?");
      values.push(account.acc_password);
    }
    if (account.acc_2fa !== undefined) {
      fields.push("acc_2fa = ?");
      values.push(account.acc_2fa);
    }
    if (account.acc_cookie !== undefined) {
      fields.push("acc_cookie = ?");
      values.push(account.acc_cookie);
    }
    if (account.acc_uid !== undefined) {
      fields.push("acc_uid = ?");
      values.push(account.acc_uid);
    }
    if (account.acc_phone !== undefined) {
      fields.push("acc_phone = ?");
      values.push(account.acc_phone);
    }
    if (account.acc_email !== undefined) {
      fields.push("acc_email = ?");
      values.push(account.acc_email);
    }
    if (account.acc_gender !== undefined) {
      fields.push("acc_gender = ?");
      values.push(account.acc_gender);
    }
    if (account.acc_friend_count !== undefined) {
      fields.push("acc_friend_count = ?");
      values.push(account.acc_friend_count);
    }
    if (account.acc_friend_suggestion !== undefined) {
      fields.push("acc_friend_suggestion = ?");
      values.push(account.acc_friend_suggestion);
    }
    if (account.acc_set_intro !== undefined) {
      fields.push("acc_set_intro = ?");
      values.push(account.acc_set_intro);
    }
    if (account.acc_set_pic !== undefined) {
      fields.push("acc_set_pic = ?");
      values.push(account.acc_set_pic);
    }
    if (account.acc_follower !== undefined) {
      fields.push("acc_follower = ?");
      values.push(account.acc_follower);
    }
    if (account.acc_date_created !== undefined) {
      fields.push("acc_date_created = ?");
      values.push(account.acc_date_created);
    }
    if (account.acc_device !== undefined) {
      fields.push("acc_device = ?");
      values.push(account.acc_device);
    }
    if (account.acc_notes !== undefined) {
      fields.push("acc_notes = ?");
      values.push(account.acc_notes);
    }
    if (account.acc_status !== undefined) {
      fields.push("acc_status = ?");
      values.push(account.acc_status);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const query = `UPDATE ltng_media_facebook_acc SET ${fields.join(
      ", "
    )} WHERE acc_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Delete account
  async deleteAccount(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_media_facebook_acc WHERE acc_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Bulk update status
  async bulkUpdateStatus(ids: number[], status: string): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_media_facebook_acc SET acc_status = ? WHERE acc_id IN (${placeholders})`,
      [status, ...ids]
    );
    return result.affectedRows;
  }

  // Bulk delete
  async bulkDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM ltng_media_facebook_acc WHERE acc_id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }
}

export default new FBAccountService();
