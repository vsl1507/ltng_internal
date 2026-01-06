import pool from "../config/mysql.config";

export const seedSourceTypes = async () => {
  const sourceTypes = [
    {
      name: "Website",
      slug: "website",
      description: "News from websites",
    },
    {
      name: "Telegram",
      slug: "telegram",
      description: "News from telegram",
    },
  ];

  for (const s of sourceTypes) {
    await pool.execute(
      `
      INSERT INTO ltng_news_source_types (source_type_name, source_type_slug, source_type_description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
           source_type_name = VALUES(source_type_name),
        updated_at = CURRENT_TIMESTAMP
      `,
      [s.name, s.slug, s.description]
    );
  }

  console.log("✅ Source types seeded");
};
