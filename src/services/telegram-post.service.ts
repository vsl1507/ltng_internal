import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  TelegramPost,
  TelegramPostFilters,
  PaginatedResponse,
} from "../models/telegram-post.model";

export class TelegramPostService {
  // Get all telegram posts with filters and pagination
  async getAllPosts(
    filters: TelegramPostFilters
  ): Promise<PaginatedResponse<TelegramPost>> {
    const {
      radar_ai_id,
      post_version,
      has_message_id,
      is_major_update,
      is_deleted = false,
      sort_by = "created_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = `
      SELECT tp.*, t.telegram_name, t.telegram_chat_id 
      FROM ltng_news_posts tp 
      LEFT JOIN ltng_news_telegram t ON tp.telegram_id = t.telegram_id 
      WHERE tp.is_deleted = ?
    `;
    const params: any[] = [is_deleted];

    // Radar AI ID filter
    if (radar_ai_id) {
      query += " AND tp.radar_ai_id = ?";
      params.push(radar_ai_id);
    }

    // Version filter
    if (post_version) {
      query += " AND tp.post_version = ?";
      params.push(post_version);
    }

    // Has message ID filter
    if (has_message_id !== undefined) {
      if (has_message_id) {
        query += " AND tp.post_message_id IS NOT NULL";
      } else {
        query += " AND tp.post_message_id IS NULL";
      }
    }

    // Major update filter
    if (is_major_update !== undefined) {
      query += " AND tp.post_is_major_update = ?";
      params.push(is_major_update);
    }

    // Count total records
    const countQuery = query.replace(
      "SELECT tp.*, t.telegram_name, t.telegram_chat_id",
      "SELECT COUNT(*) as total"
    );
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "post_id",
      "radar_ai_id",
      "telegram_id",
      "post_version",
      "created_at",
      "updated_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? `tp.${sort_by}`
      : "tp.created_at";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return {
      success: true,
      data: rows as TelegramPost[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get post by ID
  async getPostById(id: number): Promise<TelegramPost | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tp.*, t.telegram_name, t.telegram_chat_id 
       FROM ltng_news_posts tp 
       LEFT JOIN ltng_news_telegram t ON tp.telegram_id = t.telegram_id 
       WHERE tp.post_id = ? AND tp.is_deleted = FALSE`,
      [id]
    );

    return rows.length > 0 ? (rows[0] as TelegramPost) : null;
  }

  // Get unread messages (posts without message_id)
  async getUnreadMessages(
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<TelegramPost>> {
    return this.getAllPosts({ has_message_id: false, page, limit });
  }

  // Get posts by radar AI ID
  async getPostsByRadarAiId(
    radarAiId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<TelegramPost>> {
    return this.getAllPosts({ radar_ai_id: radarAiId, page, limit });
  }

  // Get posts by telegram ID
  async getPostsByTelegramId(
    telegramId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<TelegramPost>> {
    return this.getAllPosts({ page, limit });
  }

  // Get specific version for radar AI and telegram
  async getPostVersion(
    radarAiId: number,
    telegramId: number,
    version: number
  ): Promise<TelegramPost | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT tp.*, t.telegram_name, t.telegram_chat_id 
       FROM ltng_news_posts tp 
       LEFT JOIN ltng_news_telegram t ON tp.telegram_id = t.telegram_id 
       WHERE tp.radar_ai_id = ? AND tp.telegram_id = ? AND tp.post_version = ? AND tp.is_deleted = FALSE`,
      [radarAiId, telegramId, version]
    );

    return rows.length > 0 ? (rows[0] as TelegramPost) : null;
  }

  // Check if radar AI exists
  async verifyRadarAiExists(radarAiId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM ltng_news_radar_ai WHERE radar_ai_id = ? AND is_deleted = FALSE",
      [radarAiId]
    );
    return rows[0].count > 0;
  }

  // Check if telegram exists
  async verifyTelegramExists(telegramId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM ltng_news_telegram WHERE telegram_id = ? AND is_deleted = FALSE",
      [telegramId]
    );
    return rows[0].count > 0;
  }

  // Create new telegram post
  async createPost(post: TelegramPost, userId?: number): Promise<TelegramPost> {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [result] = await connection.query<ResultSetHeader>(
        `INSERT INTO ltng_news_posts 
           (radar_ai_id, story_id, post_version, is_major_update, post_content, 
            post_media, created_by, updated_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          post.radar_ai_id,
          post.story_id,
          post.post_version,
          post.is_major_update || false,
          post.post_content,
          post.post_media ? JSON.stringify(post.post_media) : null,
          post.created_by || userId,
          post.updated_by || userId,
        ]
      );

      const postId = result.insertId;

      const [telegrams] = await connection.query<RowDataPacket[]>(
        `SELECT telegram_id, telegram_name 
           FROM ltng_news_telegram 
           WHERE is_deleted = FALSE 
           AND telegram_is_active = TRUE
           ORDER BY telegram_id`
      );

      if (telegrams.length > 0) {
        // Prepare bulk insert values
        const deliveryValues = telegrams.map((telegram: any) => [
          postId,
          telegram.telegram_id,
          "PENDING",
          0, // retry_count
          post.created_by || null,
          post.updated_by || null,
        ]);

        const placeholders = deliveryValues
          .map(() => "(?, ?, ?, ?, ?, ?)")
          .join(",");
        const flatValues = deliveryValues.flat();

        await connection.query<ResultSetHeader>(
          `INSERT INTO ltng_news_post_deliveries 
             (post_id, telegram_id, delivery_status, retry_count, created_by, updated_by) 
             VALUES ${placeholders}`,
          flatValues
        );
      } else {
        console.log("⚠️ No active telegrams found, no deliveries created");
      }

      await connection.commit();
      return { post_id: postId, ...post };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Create posts for all active telegrams (when new radar AI post is created)
  async createPostsForAllTelegrams(
    radarAiId: number,
    postVersion: number,
    isMajorUpdate: boolean = false,
    userId?: number
  ): Promise<number> {
    // Get all active telegrams
    const [telegrams] = await pool.query<RowDataPacket[]>(
      "SELECT telegram_id FROM ltng_news_telegram WHERE telegram_is_active = TRUE AND is_deleted = FALSE"
    );

    if (telegrams.length === 0) return 0;

    // Create post records for each telegram
    const values = telegrams.map((t: any) => [
      radarAiId,
      t.telegram_id,
      null, // post_message_id starts as NULL
      isMajorUpdate,
      postVersion,
      userId || null,
    ]);

    const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?)").join(",");
    const flatValues = values.flat();

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_news_posts 
       (radar_ai_id, telegram_id, post_message_id, post_is_major_update, post_version, created_by) 
       VALUES ${placeholders}`,
      flatValues
    );

    return result.affectedRows;
  }

  // Update message ID (after successful Telegram send)
  async updateMessageId(
    postId: number,
    messageId: number,
    userId?: number
  ): Promise<boolean> {
    const fields = ["post_message_id = ?", "__v = __v + 1"];
    const values: any[] = [messageId];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(postId);
    const query = `UPDATE ltng_news_posts SET ${fields.join(
      ", "
    )} WHERE post_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Bulk update message IDs
  async bulkUpdateMessageIds(
    updates: Array<{ post_id: number; post_message_id: number }>,
    userId?: number
  ): Promise<number> {
    if (updates.length === 0) return 0;

    let affectedRows = 0;

    // Update each one individually to track affected rows
    for (const update of updates) {
      const updated = await this.updateMessageId(
        update.post_id,
        update.post_message_id,
        userId
      );
      if (updated) affectedRows++;
    }

    return affectedRows;
  }

  // Update post
  async updatePost(
    id: number,
    post: Partial<TelegramPost>,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (post.is_major_update !== undefined) {
      fields.push("post_is_major_update = ?");
      values.push(post.is_major_update);
    }
    if (post.post_version !== undefined) {
      fields.push("post_version = ?");
      values.push(post.post_version);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    // Increment version
    fields.push("__v = __v + 1");

    if (fields.length === 1) return false;

    values.push(id);
    const query = `UPDATE ltng_news_posts SET ${fields.join(
      ", "
    )} WHERE post_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Soft delete post
  async softDeletePost(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_posts SET ${fields.join(
      ", "
    )} WHERE post_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Hard delete post
  async hardDeletePost(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_posts WHERE post_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Restore post
  async restorePost(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = FALSE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_posts SET ${fields.join(
      ", "
    )} WHERE post_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Bulk soft delete
  async bulkSoftDelete(ids: number[], userId?: number): Promise<number> {
    if (ids.length === 0) return 0;

    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    const placeholders = ids.map(() => "?").join(",");
    values.push(...ids);

    const query = `UPDATE ltng_news_posts SET ${fields.join(
      ", "
    )} WHERE post_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
  }

  // Bulk hard delete
  async bulkHardDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM ltng_news_posts WHERE post_id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }

  // async getUnpostedPosts(): Promise<
  //   {
  //     post_id: number;
  //     chat_id: string;
  //     content_en: string;
  //   }[]
  // > {
  //   const [rows] = await pool.query<RowDataPacket[]>(
  //     `
  //   SELECT
  //     p.post_id,
  //     t.telegram_chat_id AS chat_id,
  //     r.radar_ai_content_en AS content_en
  //   FROM ltng_news_posts p
  //   JOIN ltng_news_telegram t
  //     ON p.telegram_id = t.telegram_id
  //   JOIN ltng_news_radar_ai r
  //     ON p.radar_ai_id = r.radar_ai_id
  //   WHERE p.post_message_id IS NULL
  //     AND p.is_deleted = FALSE
  //   ORDER BY p.post_id ASC
  //   `
  //   );

  //   return rows as any[];
  // }
}

export default new TelegramPostService();
