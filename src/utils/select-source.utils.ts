import pool from "../config/mysql.config";

export class SelectSource {
  async sourceScrape(source_type_slug: string): Promise<any> {
    const [sources] = (await pool.query(
      `SELECT * 
        FROM ltng_news_sources s
        JOIN ltng_news_source_types st ON s.source_type_id = st.source_type_id
        WHERE s.source_is_active = TRUE
        AND st.source_type_slug = ?
        AND s.is_deleted  = FALSE `,
      [source_type_slug]
    )) as any;
    return sources;
  }
}
