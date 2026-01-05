import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  NewsPostDelivery,
  NewsPostDeliveryFilters,
  PaginatedResponse,
  DeliveryStats,
} from "../models/post-delivery.model";

export class NewsPostDeliveryService {
  async getUnpostedPosts(): Promise<
    {
      delivery_id: number;
      radar_ai_id: number;
      telegram_id: number;
      chat_id: string;
      telegram_name: string;
      content_en: string;
      post_content: string;
    }[]
  > {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
       SELECT
  pd.delivery_id,
  pd.radar_ai_id,
  pd.telegram_id,

  t.telegram_chat_id AS chat_id,
  t.telegram_name,

  ai.radar_ai_title_en AS title_en,
  ai.radar_ai_content_en AS content_en,
  ai.radar_ai_title_kh AS title_kh,
  ai.radar_ai_content_kh AS content_kh,
  ai.radar_ai_story_number AS story_number,

  c.category_id,
  c.category_name_en AS category_name_en,
  c.category_name_kh AS category_name_kh,

  /* Article URLs */
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(r.radar_url)
      FROM ltng_news_radar r
      WHERE r.radar_story_number = ai.radar_ai_story_number
        AND r.is_deleted = FALSE
        AND r.radar_url IS NOT NULL
    ),
    JSON_ARRAY()
  ) AS article_urls,

  /* Tags */
  COALESCE(
    (
      SELECT JSON_ARRAYAGG(
        JSON_OBJECT(
          'tag_id', tg.tag_id,
          'tag_name_en', tg.tag_name_en,
          'tag_name_kh', tg.tag_name_kh
        )
      )
      FROM ltng_news_radar_ai_tags ait
      JOIN ltng_news_tags tg
        ON tg.tag_id = ait.tag_id
      WHERE ait.radar_ai_id = ai.radar_ai_id
        AND tg.is_deleted = FALSE
    ),
    JSON_ARRAY()
  ) AS tags

FROM ltng_news_post_deliveries pd

JOIN ltng_news_radar_ai ai
  ON pd.radar_ai_id = ai.radar_ai_id

JOIN ltng_news_telegram t
  ON pd.telegram_id = t.telegram_id

LEFT JOIN ltng_news_categories c
  ON ai.radar_ai_category_id = c.category_id
  AND c.is_deleted = FALSE

WHERE pd.telegram_message_id IS NULL
  AND pd.delivery_status = 'PENDING'
  AND pd.is_deleted = FALSE
  AND ai.is_deleted = FALSE
  AND t.is_deleted = FALSE
  AND t.telegram_is_active = TRUE

ORDER BY pd.delivery_id ASC;

      `
    );

    return rows as any[];
  }

  //   // Get all deliveries with filters and pagination
  //   async getAllDeliveries(
  //     filters: NewsPostDeliveryFilters
  //   ): Promise<PaginatedResponse<NewsPostDelivery>> {
  //     const {
  //       search = "",
  //       radar_ai_id,
  //       telegram_id,
  //       delivery_status,
  //       date_from,
  //       date_to,
  //       is_deleted = false,
  //       sort_by = "created_at",
  //       sort_order = "DESC",
  //       page = 1,
  //       limit = 50,
  //     } = filters;

  //     let query = `
  //       SELECT d.*, p.post_content, p.post_version, t.telegram_name, t.telegram_chat_id
  //       FROM ltng_news_post_deliveries d
  //       LEFT JOIN ltng_news_posts p ON d.radar_ai_id = p.radar_ai_id
  //       LEFT JOIN ltng_news_telegram t ON d.telegram_id = t.telegram_id
  //       WHERE d.is_deleted = ?
  //     `;
  //     const params: any[] = [is_deleted];

  //     // Search filter
  //     if (search) {
  //       query += " AND (d.last_error LIKE ? OR t.telegram_name LIKE ?)";
  //       const searchPattern = `%${search}%`;
  //       params.push(searchPattern, searchPattern);
  //     }

  //     // Post ID filter
  //     if (radar_ai_id) {
  //       query += " AND d.radar_ai_id = ?";
  //       params.push(radar_ai_id);
  //     }

  //     // Telegram ID filter
  //     if (telegram_id) {
  //       query += " AND d.telegram_id = ?";
  //       params.push(telegram_id);
  //     }

  //     // Status filter
  //     if (delivery_status) {
  //       query += " AND d.delivery_status = ?";
  //       params.push(delivery_status);
  //     }

  //     // Date range filter
  //     if (date_from) {
  //       query += " AND d.created_at >= ?";
  //       params.push(date_from);
  //     }
  //     if (date_to) {
  //       query += " AND d.created_at <= ?";
  //       params.push(date_to);
  //     }

  //     // Count total records
  //     const countQuery = query.replace(
  //       "SELECT d.*, p.post_content, p.post_version, t.telegram_name, t.telegram_chat_id",
  //       "SELECT COUNT(*) as total"
  //     );
  //     const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
  //     const total = countResult[0].total;

  //     // Sorting
  //     const validSortColumns = [
  //       "delivery_id",
  //       "radar_ai_id",
  //       "telegram_id",
  //       "delivery_status",
  //       "sent_at",
  //       "created_at",
  //     ];
  //     const sortColumn = validSortColumns.includes(sort_by)
  //       ? `d.${sort_by}`
  //       : "d.created_at";
  //     query += ` ORDER BY ${sortColumn} ${sort_order}`;

  //     // Pagination
  //     const offset = (page - 1) * limit;
  //     query += " LIMIT ? OFFSET ?";
  //     params.push(limit, offset);

  //     const [rows] = await pool.query<RowDataPacket[]>(query, params);

  //     return {
  //       success: true,
  //       data: rows as NewsPostDelivery[],
  //       pagination: {
  //         total,
  //         page,
  //         limit,
  //         total_pages: Math.ceil(total / limit),
  //       },
  //     };
  //   }

  //   // Get delivery by ID
  //   async getDeliveryById(id: number): Promise<NewsPostDelivery | null> {
  //     const [rows] = await pool.query<RowDataPacket[]>(
  //       `SELECT d.*, p.post_content, p.post_version, t.telegram_name, t.telegram_chat_id
  //        FROM ltng_news_post_deliveries d
  //        LEFT JOIN ltng_news_posts p ON d.radar_ai_id = p.radar_ai_id
  //        LEFT JOIN ltng_news_telegram t ON d.telegram_id = t.telegram_id
  //        WHERE d.delivery_id = ? AND d.is_deleted = FALSE`,
  //       [id]
  //     );

  //     return rows.length > 0 ? (rows[0] as NewsPostDelivery) : null;
  //   }

  //   // Get deliveries by post ID
  //   async getDeliveriesByPostId(
  //     postId: number,
  //     page: number = 1,
  //     limit: number = 50
  //   ): Promise<PaginatedResponse<NewsPostDelivery>> {
  //     return this.getAllDeliveries({ radar_ai_id: postId, page, limit });
  //   }

  //   // Get deliveries by telegram ID
  //   async getDeliveriesByTelegramId(
  //     telegramId: number,
  //     page: number = 1,
  //     limit: number = 50
  //   ): Promise<PaginatedResponse<NewsPostDelivery>> {
  //     return this.getAllDeliveries({ telegram_id: telegramId, page, limit });
  //   }

  //   // Get pending deliveries
  //   async getPendingDeliveries(): Promise<NewsPostDelivery[]> {
  //     const [rows] = await pool.query<RowDataPacket[]>(
  //       `SELECT d.*, p.post_content, p.post_version, t.telegram_name, t.telegram_chat_id
  //        FROM ltng_news_post_deliveries d
  //        LEFT JOIN ltng_news_posts p ON d.radar_ai_id = p.radar_ai_id
  //        LEFT JOIN ltng_news_telegram t ON d.telegram_id = t.telegram_id
  //        WHERE d.delivery_status = 'PENDING'
  //        AND d.is_deleted = FALSE
  //        ORDER BY d.created_at ASC`
  //     );
  //     return rows as NewsPostDelivery[];
  //   }

  //   // Get failed deliveries that can be retried
  //   async getRetryableDeliveries(): Promise<NewsPostDelivery[]> {
  //     const [rows] = await pool.query<RowDataPacket[]>(
  //       `SELECT d.*, p.post_content, p.post_version, t.telegram_name, t.telegram_chat_id
  //        FROM ltng_news_post_deliveries d
  //        LEFT JOIN ltng_news_posts p ON d.radar_ai_id = p.radar_ai_id
  //        LEFT JOIN ltng_news_telegram t ON d.telegram_id = t.telegram_id
  //        WHERE d.delivery_status = 'FAILED'
  //        AND d.retry_count < 3
  //        AND d.is_deleted = FALSE
  //        ORDER BY d.created_at ASC`
  //     );
  //     return rows as NewsPostDelivery[];
  //   }

  //   // Get delivery statistics
  //   async getDeliveryStats(): Promise<DeliveryStats> {
  //     const [rows] = await pool.query<RowDataPacket[]>(
  //       `SELECT
  //         COUNT(*) as total,
  //         SUM(CASE WHEN delivery_status = 'PENDING' THEN 1 ELSE 0 END) as pending,
  //         SUM(CASE WHEN delivery_status = 'SENT' THEN 1 ELSE 0 END) as sent,
  //         SUM(CASE WHEN delivery_status = 'EDITED' THEN 1 ELSE 0 END) as edited,
  //         SUM(CASE WHEN delivery_status = 'DELETED' THEN 1 ELSE 0 END) as deleted,
  //         SUM(CASE WHEN delivery_status = 'FAILED' THEN 1 ELSE 0 END) as failed
  //        FROM ltng_news_post_deliveries
  //        WHERE is_deleted = FALSE`
  //     );

  //     const stats = rows[0];
  //     const successRate = stats.total > 0 ? (stats.sent / stats.total) * 100 : 0;

  //     return {
  //       total: stats.total,
  //       pending: stats.pending,
  //       sent: stats.sent,
  //       edited: stats.edited,
  //       deleted: stats.deleted,
  //       failed: stats.failed,
  //       success_rate: parseFloat(successRate.toFixed(2)),
  //     };
  //   }

  //   // Create delivery for all active telegrams when new post is created
  //   async createDeliveriesForPost(
  //     postId: number,
  //     userId?: number
  //   ): Promise<number> {
  //     // Get all active telegrams
  //     const [telegrams] = await pool.query<RowDataPacket[]>(
  //       "SELECT telegram_id FROM ltng_news_telegram WHERE telegram_is_active = TRUE AND is_deleted = FALSE"
  //     );

  //     if (telegrams.length === 0) return 0;

  //     // Create delivery records for each telegram
  //     const values = telegrams.map((t: any) => [
  //       postId,
  //       t.telegram_id,
  //       "PENDING",
  //       0,
  //       userId || null,
  //     ]);

  //     const placeholders = values.map(() => "(?, ?, ?, ?, ?)").join(",");
  //     const flatValues = values.flat();

  //     const [result] = await pool.query<ResultSetHeader>(
  //       `INSERT INTO ltng_news_post_deliveries
  //        (radar_ai_id, telegram_id, delivery_status, retry_count, created_by)
  //        VALUES ${placeholders}`,
  //       flatValues
  //     );

  //     return result.affectedRows;
  //   }

  //   // Create single delivery
  //   async createDelivery(
  //     delivery: NewsPostDelivery,
  //     userId?: number
  //   ): Promise<NewsPostDelivery> {
  //     const [result] = await pool.query<ResultSetHeader>(
  //       `INSERT INTO ltng_news_post_deliveries
  //        (radar_ai_id, telegram_id, telegram_message_id, delivery_status, retry_count,
  //         last_error, sent_at, edited_at, deleted_at, created_by, __v)
  //        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  //       [
  //         delivery.radar_ai_id,
  //         delivery.telegram_id,
  //         delivery.telegram_message_id || null,
  //         delivery.delivery_status || "PENDING",
  //         delivery.retry_count || 0,
  //         delivery.last_error || null,
  //         delivery.sent_at || null,
  //         delivery.edited_at || null,
  //         delivery.deleted_at || null,
  //         userId || null,
  //       ]
  //     );

  //     return { delivery_id: result.insertId, ...delivery };
  //   }

  //   // Update delivery
  async updateDelivery(
    id: number,
    messageId: number,
    deliveryStatus: string,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    // Add telegram_message_id update
    fields.push("telegram_message_id = ?");
    values.push(messageId);

    // Add delivery_status update
    fields.push("delivery_status = ?");
    values.push(deliveryStatus);

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    fields.push("__v = __v + 1");

    // Add the WHERE clause parameter (id)
    values.push(id);

    const query = `UPDATE ltng_news_post_deliveries SET ${fields.join(
      ", "
    )} WHERE delivery_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  //   // Mark as sent (after successful Telegram post)
  //   async markAsSent(
  //     id: number,
  //     messageId: number,
  //     userId?: number
  //   ): Promise<boolean> {
  //     return this.updateDelivery(
  //       id,
  //       {
  //         delivery_status: "SENT",
  //         telegram_message_id: messageId,
  //         sent_at: new Date().toISOString(),
  //         last_error: null,
  //       },
  //       userId
  //     );
  //   }

  //   // Mark as edited (after successful edit)
  //   async markAsEdited(
  //     id: number,
  //     messageId: number,
  //     userId?: number
  //   ): Promise<boolean> {
  //     return this.updateDelivery(
  //       id,
  //       {
  //         delivery_status: "EDITED",
  //         telegram_message_id: messageId,
  //         edited_at: new Date().toISOString(),
  //       },
  //       userId
  //     );
  //   }

  //   // Mark as deleted
  //   async markAsDeleted(id: number, userId?: number): Promise<boolean> {
  //     return this.updateDelivery(
  //       id,
  //       {
  //         delivery_status: "DELETED",
  //         deleted_at: new Date().toISOString(),
  //       },
  //       userId
  //     );
  //   }

  //   // Mark as failed and increment retry count
  //   async markAsFailed(
  //     id: number,
  //     error: string,
  //     userId?: number
  //   ): Promise<boolean> {
  //     const delivery = await this.getDeliveryById(id);
  //     if (!delivery) return false;

  //     return this.updateDelivery(
  //       id,
  //       {
  //         delivery_status: "FAILED",
  //         retry_count: (delivery.retry_count || 0) + 1,
  //         last_error: error,
  //       },
  //       userId
  //     );
  //   }

  //   // Retry failed delivery
  //   async retryDelivery(id: number, userId?: number): Promise<boolean> {
  //     const delivery = await this.getDeliveryById(id);
  //     if (!delivery || delivery.delivery_status !== "FAILED") return false;
  //     if ((delivery.retry_count || 0) >= 3) return false;

  //     return this.updateDelivery(
  //       id,
  //       {
  //         delivery_status: "PENDING",
  //         last_error: null,
  //       },
  //       userId
  //     );
  //   }

  //   // Soft delete delivery
  //   async softDeleteDelivery(id: number, userId?: number): Promise<boolean> {
  //     const fields = ["is_deleted = TRUE", "__v = __v + 1"];
  //     const values: any[] = [];

  //     if (userId !== undefined) {
  //       fields.push("updated_by = ?");
  //       values.push(userId);
  //     }

  //     values.push(id);
  //     const query = `UPDATE ltng_news_post_deliveries SET ${fields.join(
  //       ", "
  //     )} WHERE delivery_id = ?`;

  //     const [result] = await pool.query<ResultSetHeader>(query, values);
  //     return result.affectedRows > 0;
  //   }

  //   // Hard delete delivery
  //   async hardDeleteDelivery(id: number): Promise<boolean> {
  //     const [result] = await pool.query<ResultSetHeader>(
  //       "DELETE FROM ltng_news_post_deliveries WHERE delivery_id = ?",
  //       [id]
  //     );
  //     return result.affectedRows > 0;
  //   }

  //   // Bulk update status
  //   async bulkUpdateStatus(
  //     ids: number[],
  //     status: string,
  //     userId?: number
  //   ): Promise<number> {
  //     if (ids.length === 0) return 0;

  //     const fields = ["delivery_status = ?", "__v = __v + 1"];
  //     const values: any[] = [status];

  //     if (userId !== undefined) {
  //       fields.push("updated_by = ?");
  //       values.push(userId);
  //     }

  //     const placeholders = ids.map(() => "?").join(",");
  //     values.push(...ids);

  //     const query = `UPDATE ltng_news_post_deliveries SET ${fields.join(
  //       ", "
  //     )} WHERE delivery_id IN (${placeholders})`;

  //     const [result] = await pool.query<ResultSetHeader>(query, values);
  //     return result.affectedRows;
  //   }
}

export default new NewsPostDeliveryService();
