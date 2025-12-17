import pool from "../config/mysql.config";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  NewsSource,
  NewsSourceFilters,
  PaginatedResponse,
} from "../models/source.model";

export class NewsSourceService {
  // Get all sources with filters and pagination
  async getAllSources(
    filters: NewsSourceFilters
  ): Promise<PaginatedResponse<NewsSource>> {
    const {
      search = "",
      source_type_id,
      source_is_active,
      source_is_trusted,
      source_country,
      is_deleted = false,
      sort_by = "create_at",
      sort_order = "DESC",
      page = 1,
      limit = 50,
    } = filters;

    let query = `
      SELECT s.*, st.source_type_name, st.source_type_slug 
      FROM ltng_news_sources s 
      LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
      WHERE s.is_deleted = ?
    `;
    const params: any[] = [is_deleted];

    // Search filter
    if (search) {
      query += " AND (s.source_name LIKE ? OR s.source_identifier LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    // Source type filter
    if (source_type_id) {
      query += " AND s.source_type_id = ?";
      params.push(source_type_id);
    }

    // Active filter
    if (source_is_active !== undefined) {
      query += " AND s.source_is_active = ?";
      params.push(source_is_active);
    }

    // Trusted filter
    if (source_is_trusted !== undefined) {
      query += " AND s.source_is_trusted = ?";
      params.push(source_is_trusted);
    }

    // Country filter
    if (source_country) {
      query += " AND s.source_country = ?";
      params.push(source_country);
    }

    // Count total records
    const countQuery = query.replace(
      "SELECT s.*, st.source_type_name, st.source_type_slug",
      "SELECT COUNT(*) as total"
    );
    const [countResult] = await pool.query<RowDataPacket[]>(countQuery, params);
    const total = countResult[0].total;

    // Sorting
    const validSortColumns = [
      "source_id",
      "source_name",
      "source_identifier",
      "source_type_id",
      "source_is_active",
      "source_is_trusted",
      "create_at",
      "update_at",
    ];
    const sortColumn = validSortColumns.includes(sort_by)
      ? `s.${sort_by}`
      : "s.create_at";
    query += ` ORDER BY ${sortColumn} ${sort_order}`;

    // Pagination
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const [rows] = await pool.query<RowDataPacket[]>(query, params);

    // Parse JSON config for each row
    const parsedRows = rows.map((row) => {
      if (row.source_config && typeof row.source_config === "string") {
        try {
          row.source_config = JSON.parse(row.source_config);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      return row;
    });

    return {
      success: true,
      data: parsedRows as NewsSource[],
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get source by ID
  async getSourceById(id: number): Promise<NewsSource | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, st.source_type_name, st.source_type_slug 
       FROM ltng_news_sources s 
       LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
       WHERE s.source_id = ? AND s.is_deleted = FALSE`,
      [id]
    );

    if (rows.length === 0) return null;

    const source = rows[0];
    if (source.source_config && typeof source.source_config === "string") {
      try {
        source.source_config = JSON.parse(source.source_config);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return source as NewsSource;
  }

  // Get source by identifier
  async getSourceByIdentifier(identifier: string): Promise<NewsSource | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, st.source_type_name, st.source_type_slug 
       FROM ltng_news_sources s 
       LEFT JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id 
       WHERE s.source_identifier = ? AND s.is_deleted = FALSE`,
      [identifier]
    );

    if (rows.length === 0) return null;

    const source = rows[0];
    if (source.source_config && typeof source.source_config === "string") {
      try {
        source.source_config = JSON.parse(source.source_config);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

    return source as NewsSource;
  }

  // Check if identifier exists
  async checkIdentifierExists(
    identifier: string,
    excludeId?: number
  ): Promise<boolean> {
    let query =
      "SELECT COUNT(*) as count FROM ltng_news_sources WHERE source_identifier = ? AND is_deleted = FALSE";
    const params: any[] = [identifier];

    if (excludeId) {
      query += " AND source_id != ?";
      params.push(excludeId);
    }

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows[0].count > 0;
  }

  // Verify source type exists
  async verifySourceTypeExists(sourceTypeId: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(*) as count FROM ltng_news_source_types WHERE source_type_id = ? AND is_deleted = FALSE",
      [sourceTypeId]
    );
    return rows[0].count > 0;
  }

  // Create new source
  async createSource(source: NewsSource, userId?: number): Promise<NewsSource> {
    // Convert config object to JSON string
    const configJson = source.source_config
      ? JSON.stringify(source.source_config)
      : null;

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ltng_news_sources 
       (source_type_id, source_name, source_identifier, source_config, 
        source_is_active, source_is_trusted, source_country, created_by, __v) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        source.source_type_id,
        source.source_name,
        source.source_identifier,
        configJson,
        source.source_is_active !== undefined ? source.source_is_active : true,
        source.source_is_trusted !== undefined
          ? source.source_is_trusted
          : true,
        source.source_country || null,
        userId || null,
      ]
    );

    return { source_id: result.insertId, ...source };
  }

  // Update source
  async updateSource(
    id: number,
    source: Partial<NewsSource>,
    userId?: number
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: any[] = [];

    if (source.source_type_id !== undefined) {
      fields.push("source_type_id = ?");
      values.push(source.source_type_id);
    }
    if (source.source_name !== undefined) {
      fields.push("source_name = ?");
      values.push(source.source_name);
    }
    if (source.source_identifier !== undefined) {
      fields.push("source_identifier = ?");
      values.push(source.source_identifier);
    }
    if (source.source_config !== undefined) {
      fields.push("source_config = ?");
      const configJson = source.source_config
        ? JSON.stringify(source.source_config)
        : null;
      values.push(configJson);
    }
    if (source.source_is_active !== undefined) {
      fields.push("source_is_active = ?");
      values.push(source.source_is_active);
    }
    if (source.source_is_trusted !== undefined) {
      fields.push("source_is_trusted = ?");
      values.push(source.source_is_trusted);
    }
    if (source.source_country !== undefined) {
      fields.push("source_country = ?");
      values.push(source.source_country);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    // Increment version
    fields.push("__v = __v + 1");

    if (fields.length === 1) return false; // Only __v increment

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ? AND is_deleted = FALSE`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Soft delete source
  async softDeleteSource(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = TRUE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Hard delete source
  async hardDeleteSource(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM ltng_news_sources WHERE source_id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  // Restore soft deleted source
  async restoreSource(id: number, userId?: number): Promise<boolean> {
    const fields = ["is_deleted = FALSE", "__v = __v + 1"];
    const values: any[] = [];

    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    values.push(id);
    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id = ?`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows > 0;
  }

  // Bulk update status
  async bulkUpdateStatus(
    ids: number[],
    isActive?: boolean,
    isTrusted?: boolean,
    userId?: number
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const fields = ["__v = __v + 1"];
    const values: any[] = [];

    if (isActive !== undefined) {
      fields.push("source_is_active = ?");
      values.push(isActive);
    }
    if (isTrusted !== undefined) {
      fields.push("source_is_trusted = ?");
      values.push(isTrusted);
    }
    if (userId !== undefined) {
      fields.push("updated_by = ?");
      values.push(userId);
    }

    const placeholders = ids.map(() => "?").join(",");
    values.push(...ids);

    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
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

    const query = `UPDATE ltng_news_sources SET ${fields.join(
      ", "
    )} WHERE source_id IN (${placeholders})`;

    const [result] = await pool.query<ResultSetHeader>(query, values);
    return result.affectedRows;
  }

  // Bulk hard delete
  async bulkHardDelete(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM ltng_news_sources WHERE source_id IN (${placeholders})`,
      ids
    );
    return result.affectedRows;
  }

  // Get sources by type
  async getSourcesByType(
    sourceTypeId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<NewsSource>> {
    return this.getAllSources({ source_type_id: sourceTypeId, page, limit });
  }

  // Get active sources
  async getActiveSources(
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<NewsSource>> {
    return this.getAllSources({ source_is_active: true, page, limit });
  }

  // Get trusted sources
  async getTrustedSources(
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<NewsSource>> {
    return this.getAllSources({ source_is_trusted: true, page, limit });
  }
}

export default new NewsSourceService();
