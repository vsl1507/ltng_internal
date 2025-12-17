import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  NewsSourceType,
  NewsSourceTypeFilters,
  PaginatedResponse,
} from "../models/source-type.model";

export class NewsSourceTypeService {
  // Get all source types with filters and pagination
  async getAllSourceTypes(
    filters: NewsSourceTypeFilters
  ): Promise<PaginatedResponse<NewsSourceType>> {
    const {
      search = "",
      is_deleted = false,
      sort_by = "create_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = "SELECT * FROM ltng_news_source_types WHERE is_deleted = ?";
    const params: any[] = [is_deleted];

    // Search filter
    if (search) {
      query +=
        " AND (source_type_name LIKE ? OR source_type_slug LIKE ? OR source_type_description LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Count total records
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "source_type_id",
      "source_type_name",
      "source_type_slug",
      "create_at",
      "update_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? sort_by
      : "create_at";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    return {
      success: true,
      data: rows as NewsSourceType[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get source type by ID
  async getSourceTypeById(id: number): Promise<NewsSourceType | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_source_types WHERE source_type_id = ? AND is_deleted = FALSE",
      [id]
    );
    return rows.length > 0 ? (rows[0] as NewsSourceType) : null;
  }

  // Get source type by slug
  async getSourceTypeBySlug(slug: string): Promise<NewsSourceType | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM ltng_news_source_types WHERE source_type_slug = ? AND is_deleted = FALSE",
      [slug]
    );
    return rows.length > 0 ? (rows[0] as NewsSourceType) : null;
  }

  // Check if name exists
  async checkNameExists(name: string, excludeId?: number): Promise<boolean> {
    let query =
      "SELECT COUNT(*) as count FROM ltng_news_source_types WHERE source_type_name = ? AND is_deleted = FALSE";
    const params: any[] = [name];

    if (excludeId) {
      query += " AND source_type_id != ?";
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count > 0;
  }

  // Check if slug exists
  async checkSlugExists(slug: string, excludeId?: number): Promise<boolean> {
    let query =
      "SELECT COUNT(*) as count FROM ltng_news_source_types WHERE source_type_slug = ? AND is_deleted = FALSE";
    const params: any[] = [slug];

    if (excludeId) {
      query += " AND source_type_id != ?";
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count > 0;
  }

  // Create new source type
  async createSourceType(
    sourceType: NewsSourceType,
    userId?: number
  ): Promise<NewsSourceType> {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_news_source_types 
       (source_type_name, source_type_slug, source_type_description, created_by, __v) 
       VALUES (?, ?, ?, ?, 0)`,
      [
        sourceType.source_type_name,
        sourceType.source_type_slug,
        sourceType.source_type_description || null,
        userId || null,
      ]
    );

    return { source_type_id: result.insertId, ...sourceType };
  }

  // Update source type
  async updateSourceType(
    id: number,
    sourceType: Partial<NewsSourceType>,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (sourceType.source_type_name !== undefined) {
      fields.push("source_type_name = ?");
      values.push(sourceType.source_type_name);
    }
    if (sourceType.source_type_slug !== undefined) {
      fields.push("source_type_slug = ?");
      values.push(sourceType.source_type_slug);
    }
    if (sourceType.source_type_description !== undefined) {
      fields.push("source_type_description = ?");
      values.push(sourceType.source_type_description);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    // Increment version
    fields.push("__v = __v + 1");

    if (fields.length === 0) return false;

    values.push(id);
    const query = `UPDATE ltng_news_source_types SET ${fields.join(
      ", "
    )} WHERE source_type_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Soft delete source type
  async softDeleteSourceType(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_source_types SET ${fields.join(
      ", "
    )} WHERE source_type_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Hard delete source type
  async hardDeleteSourceType(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_source_types WHERE source_type_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Restore soft deleted source type
  async restoreSourceType(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = FALSE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_source_types SET ${fields.join(
      ", "
    )} WHERE source_type_id = ?`;

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

    const query = `UPDATE ltng_news_source_types SET ${fields.join(
      ", "
    )} WHERE source_type_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
  }

  // Bulk hard delete
  async bulkHardDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM ltng_news_source_types WHERE source_type_id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }
}

export default new NewsSourceTypeService();
