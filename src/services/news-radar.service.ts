import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  NewsRadar,
  NewsRadarFilters,
  PaginatedResponse,
} from "../models/news-radar.model";

export class NewsRadarService {
  // Get all radars with filters and pagination
  async getAllRadars(
    filters: NewsRadarFilters
  ): Promise<PaginatedResponse<NewsRadar>> {
    const {
      search = "",
      radar_category_id,
      radar_source_id,
      radar_processing_status = "",
      radar_is_breaking,
      radar_is_duplicated,
      radar_story_number,
      is_deleted = false,
      published_year = "",
      sort_by = "updated_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = "SELECT * FROM ltng_news_radar WHERE 1=1";
    const params: any[] = [];

    // Exclude deleted by default
    query += " AND is_deleted = ?";
    params.push(is_deleted);

    // Search filter
    if (search) {
      query +=
        " AND (radar_title LIKE ? OR radar_content LIKE ? OR radar_url LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Category filter
    if (radar_category_id) {
      query += " AND radar_category_id = ?";
      params.push(radar_category_id);
    }

    // Source filter
    if (radar_source_id) {
      query += " AND radar_source_id = ?";
      params.push(radar_source_id);
    }

    // Processing status filter
    if (radar_processing_status && radar_processing_status !== "All") {
      query += " AND radar_processing_status = ?";
      params.push(radar_processing_status);
    }

    // Breaking news filter
    if (radar_is_breaking !== undefined) {
      query += " AND radar_is_breaking = ?";
      params.push(radar_is_breaking);
    }

    // Duplicated filter
    if (radar_is_duplicated !== undefined) {
      query += " AND radar_is_duplicated = ?";
      params.push(radar_is_duplicated);
    }

    // Story number filter
    if (radar_story_number) {
      query += " AND radar_story_number = ?";
      params.push(radar_story_number);
    }

    // Published year filter
    if (published_year && published_year !== "All") {
      if (published_year === "< 2024") {
        query += " AND YEAR(radar_published_at) < 2024";
      } else if (published_year === "2023-2024") {
        query += " AND YEAR(radar_published_at) BETWEEN 2023 AND 2024";
      } else if (published_year === "> 2024") {
        query += " AND YEAR(radar_published_at) > 2024";
      }
    }

    // Count total records
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "radar_id",
      "radar_published_at",
      "radar_scraped_at",
      "radar_story_number",
      "radar_processing_status",
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
      data: rows as NewsRadar[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get radar by ID
  async getRadarById(id: number): Promise<NewsRadar | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_radar WHERE radar_id = ? AND is_deleted = FALSE",
      [id]
    );
    return rows.length > 0 ? (rows[0] as NewsRadar) : null;
  }

  // Get radars by story number
  async getRadarsByStoryNumber(storyNumber: number): Promise<NewsRadar[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_radar WHERE radar_story_number = ? AND is_deleted = FALSE ORDER BY radar_published_at DESC",
      [storyNumber]
    );
    return rows as NewsRadar[];
  }

  // Get child radars (related articles)
  async getChildRadars(parentId: number): Promise<NewsRadar[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_radar WHERE radar_parent_id = ? AND is_deleted = FALSE ORDER BY radar_published_at DESC",
      [parentId]
    );
    return rows as NewsRadar[];
  }

  // Create new radar
  async createRadar(radar: NewsRadar, userId?: number): Promise<NewsRadar> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_news_radar 
       (radar_parent_id, radar_category_id, radar_source_id, radar_title, radar_content,
        radar_content_hash, radar_url, radar_published_at, radar_scraped_at, radar_story_number,
        radar_is_breaking, radar_is_duplicated, radar_processing_status, created_by, updated_by, __v) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        radar.radar_parent_id || null,
        radar.radar_category_id,
        radar.radar_source_id,
        radar.radar_title,
        radar.radar_content,
        radar.radar_content_hash || null,
        radar.radar_url,
        radar.radar_published_at || null,
        radar.radar_scraped_at || new Date(),
        radar.radar_story_number || null,
        radar.radar_is_breaking || false,
        radar.radar_is_duplicated || false,
        radar.radar_processing_status || "NEW",
        userId || null,
        userId || null,
        radar.__v || 0,
      ]
    );

    return { radar_id: result.insertId, ...radar };
  }

  // Update radar
  async updateRadar(
    id: number,
    radar: Partial<NewsRadar>,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (radar.radar_parent_id !== undefined) {
      fields.push("radar_parent_id = ?");
      values.push(radar.radar_parent_id);
    }
    if (radar.radar_category_id !== undefined) {
      fields.push("radar_category_id = ?");
      values.push(radar.radar_category_id);
    }
    if (radar.radar_source_id !== undefined) {
      fields.push("radar_source_id = ?");
      values.push(radar.radar_source_id);
    }
    if (radar.radar_title !== undefined) {
      fields.push("radar_title = ?");
      values.push(radar.radar_title);
    }
    if (radar.radar_content !== undefined) {
      fields.push("radar_content = ?");
      values.push(radar.radar_content);
    }
    if (radar.radar_content_hash !== undefined) {
      fields.push("radar_content_hash = ?");
      values.push(radar.radar_content_hash);
    }
    if (radar.radar_url !== undefined) {
      fields.push("radar_url = ?");
      values.push(radar.radar_url);
    }
    if (radar.radar_published_at !== undefined) {
      fields.push("radar_published_at = ?");
      values.push(radar.radar_published_at);
    }
    if (radar.radar_scraped_at !== undefined) {
      fields.push("radar_scraped_at = ?");
      values.push(radar.radar_scraped_at);
    }
    if (radar.radar_story_number !== undefined) {
      fields.push("radar_story_number = ?");
      values.push(radar.radar_story_number);
    }
    if (radar.radar_is_breaking !== undefined) {
      fields.push("radar_is_breaking = ?");
      values.push(radar.radar_is_breaking);
    }
    if (radar.radar_is_duplicated !== undefined) {
      fields.push("radar_is_duplicated = ?");
      values.push(radar.radar_is_duplicated);
    }
    if (radar.radar_processing_status !== undefined) {
      fields.push("radar_processing_status = ?");
      values.push(radar.radar_processing_status);
    }
    if (radar.is_deleted !== undefined) {
      fields.push("is_deleted = ?");
      values.push(radar.is_deleted);
    }
    if (radar.__v !== undefined) {
      fields.push("__v = ?");
      values.push(radar.__v);
    }

    // Add updated_by if userId provided
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    if (fields.length === 0) return false;

    values.push(id);
    const query = `UPDATE ltng_news_radar SET ${fields.join(
      ", "
    )} WHERE radar_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Delete radar (soft delete)
  async deleteRadar(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = TRUE"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_news_radar SET ${fields.join(
        ", "
      )} WHERE radar_id = ? AND is_deleted = FALSE`,
      values
    );
    return result.affectedRows > 0;
  }

  // Hard delete radar (permanent)
  async hardDeleteRadar(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_radar WHERE radar_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Restore deleted radar
  async restoreRadar(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = FALSE"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_news_radar SET ${fields.join(
        ", "
      )} WHERE radar_id = ? AND is_deleted = TRUE`,
      values
    );
    return result.affectedRows > 0;
  }

  // Bulk update processing status
  async bulkUpdateStatus(
    ids: number[],
    status: string,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const fields = ["radar_processing_status = ?"];
    const values: any[] = [status];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(...ids);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_news_radar SET ${fields.join(
        ", "
      )} WHERE radar_id IN (${placeholders}) AND is_deleted = FALSE`,
      values
    );
    return result.affectedRows;
  }

  // Bulk update breaking news flag
  async bulkUpdateBreaking(
    ids: number[],
    isBreaking: boolean,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const fields = ["radar_is_breaking = ?"];
    const values: any[] = [isBreaking];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(...ids);
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE ltng_news_radar SET ${fields.join(
        ", "
      )} WHERE radar_id IN (${placeholders}) AND is_deleted = FALSE`,
      values
    );
    return result.affectedRows;
  }

  // Bulk delete (soft delete)
  async bulkDelete(
    ids: number[],
    hard: boolean = false,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");

    if (hard) {
      const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM ltng_news_radar WHERE radar_id IN (${placeholders})`,
        ids
      );
      return result.affectedRows;
    } else {
      const fields = ["is_deleted = TRUE"];
      const values: any[] = [];

      if (userId !== undefined) {
        fields.push("updated_by = ?");
        values.push(userId);
      }

      values.push(...ids);
      const [result] = await pool.query<ResultSetHeader>(
        `UPDATE ltng_news_radar SET ${fields.join(
          ", "
        )} WHERE radar_id IN (${placeholders}) AND is_deleted = FALSE`,
        values
      );
      return result.affectedRows;
    }
  }

  
}

  export default new NewsRadarService();
