import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  Telegram,
  TelegramFilters,
  PaginatedResponse,
} from "../models/telegram.model";

export class TelegramService {
  // Get all telegrams with filters and pagination
  async getAllTelegrams(
    filters: TelegramFilters
  ): Promise<PaginatedResponse<Telegram>> {
    const {
      search = "",
      telegram_type = "",
      telegram_is_active = undefined,
      telegram_chat_id = "",
      telegram_username = "",
      is_deleted = false,
      sort_by = "updated_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = "SELECT * FROM ltng_news_telegram WHERE 1=1";
    const params: any[] = [];

    // Exclude deleted records by default
    query += " AND is_deleted = ?";
    params.push(is_deleted);

    // Search filter
    if (search) {
      query +=
        " AND (telegram_name LIKE ? OR telegram_username LIKE ? OR telegram_chat_id LIKE ? OR telegram_description LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Type filter
    if (telegram_type) {
      query += " AND telegram_type = ?";
      params.push(telegram_type);
    }

    // Active status filter
    if (telegram_is_active !== undefined) {
      query += " AND telegram_is_active = ?";
      params.push(telegram_is_active);
    }

    // Chat ID filter
    if (telegram_chat_id) {
      query += " AND telegram_chat_id = ?";
      params.push(telegram_chat_id);
    }

    // Username filter
    if (telegram_username) {
      query += " AND telegram_username LIKE ?";
      params.push(`%${telegram_username}%`);
    }

    // Count total records
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "telegram_id",
      "telegram_name",
      "telegram_username",
      "telegram_type",
      "telegram_is_active",
      "created_at",
      "updated_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "updated_at";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return {
      success: true,
      data: rows as Telegram[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get telegram by ID
  async getTelegramById(id: number): Promise<Telegram | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_telegram WHERE telegram_id = ? AND is_deleted = FALSE",
      [id]
    );
    return rows.length > 0 ? (rows[0] as Telegram) : null;
  }

  // Get telegram by chat ID
  async getTelegramByChatId(chatId: string): Promise<Telegram | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_telegram WHERE telegram_chat_id = ? AND is_deleted = FALSE",
      [chatId]
    );
    return rows.length > 0 ? (rows[0] as Telegram) : null;
  }

  // Get telegram by username
  async getTelegramByUsername(username: string): Promise<Telegram | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_telegram WHERE telegram_username = ? AND is_deleted = FALSE",
      [username]
    );
    return rows.length > 0 ? (rows[0] as Telegram) : null;
  }

  // Create new telegram
  async createTelegram(telegram: Telegram): Promise<Telegram> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_news_telegram 
       (telegram_name, telegram_username, telegram_chat_id, telegram_type, 
        telegram_is_active, telegram_description, created_by, updated_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        telegram.telegram_name,
        telegram.telegram_username || null,
        telegram.telegram_chat_id,
        telegram.telegram_type,
        telegram.telegram_is_active !== undefined
          ? telegram.telegram_is_active
          : true,
        telegram.telegram_description || null,
        telegram.created_by || null,
        telegram.updated_by || null,
      ]
    );

    return { telegram_id: result.insertId, ...telegram };
  }

  // Update telegram
  async updateTelegram(
    id: number,
    telegram: Partial<Telegram>
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (telegram.telegram_name !== undefined) {
      fields.push("telegram_name = ?");
      values.push(telegram.telegram_name);
    }
    if (telegram.telegram_username !== undefined) {
      fields.push("telegram_username = ?");
      values.push(telegram.telegram_username);
    }
    if (telegram.telegram_chat_id !== undefined) {
      fields.push("telegram_chat_id = ?");
      values.push(telegram.telegram_chat_id);
    }
    if (telegram.telegram_type !== undefined) {
      fields.push("telegram_type = ?");
      values.push(telegram.telegram_type);
    }
    if (telegram.telegram_is_active !== undefined) {
      fields.push("telegram_is_active = ?");
      values.push(telegram.telegram_is_active);
    }
    if (telegram.telegram_description !== undefined) {
      fields.push("telegram_description = ?");
      values.push(telegram.telegram_description);
    }
    if (telegram.updated_by !== undefined) {
      fields.push("updated_by = ?");
      values.push(telegram.updated_by);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const query = `UPDATE ltng_news_telegram SET ${fields.join(
      ", "
    )} WHERE telegram_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Delete telegram (soft delete)
  async deleteTelegram(id: number, userId?: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE ltng_news_telegram SET is_deleted = TRUE, updated_by = ? WHERE telegram_id = ?",
      [userId || null, id]
    );
    return result.affectedRows > 0;
  }

  // Hard delete telegram
  async hardDeleteTelegram(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_telegram WHERE telegram_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Bulk update active status
  async bulkUpdateStatus(
    ids: number[],
    isActive: boolean,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_news_telegram SET telegram_is_active = ?, updated_by = ? WHERE telegram_id IN (${placeholders}) AND is_deleted = FALSE`,
      [isActive, userId || null, ...ids]
    );
    return result.affectedRows;
  }

  // Bulk delete (soft delete)
  async bulkDelete(
    ids: number[],
    soft: boolean = true,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");

    if (soft) {
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE ltng_news_telegram SET is_deleted = TRUE, updated_by = ? WHERE telegram_id IN (${placeholders})`,
        [userId || null, ...ids]
      );
      return result.affectedRows;
    } else {
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM ltng_news_telegram WHERE telegram_id IN (${placeholders})`,
        ids
      );
      return result.affectedRows;
    }
  }

  // Restore deleted telegram
  async restoreTelegram(id: number, userId?: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE ltng_news_telegram SET is_deleted = FALSE, updated_by = ? WHERE telegram_id = ?",
      [userId || null, id]
    );
    return result.affectedRows > 0;
  }

  // Get telegram statistics
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byType: { type: string; count: number }[];
  }> {
    // Total count
    const [totalResult] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as total FROM ltng_news_telegram WHERE is_deleted = FALSE"
    );

    // Active count
    const [activeResult] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as active FROM ltng_news_telegram WHERE is_deleted = FALSE AND telegram_is_active = TRUE"
    );

    // Inactive count
    const [inactiveResult] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as inactive FROM ltng_news_telegram WHERE is_deleted = FALSE AND telegram_is_active = FALSE"
    );

    // By type
    const [typeResult] = await pool.query<RowDataPacket[]>(
      "SELECT telegram_type as type, COUNT(*) as count FROM ltng_news_telegram WHERE is_deleted = FALSE GROUP BY telegram_type"
    );

    return {
      total: totalResult[0].total,
      active: activeResult[0].active,
      inactive: inactiveResult[0].inactive,
      byType: typeResult as { type: string; count: number }[],
    };
  }
}

export default new TelegramService();
