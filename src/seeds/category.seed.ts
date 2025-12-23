import pool from "../config/mysql.config";

export const seedCategories = async () => {
  const categories = [
    {
      category_name_en: "Politics",
      category_name_kh: "នយោបាយ",
      category_slug: "politics",
      category_description: "Political news",
      category_color: "#FF0000",
      category_icon: "fa-solid fa-landmark",
      category_order: 1,
    },
    {
      category_name_en: "Technology",
      category_name_kh: "បច្ចេកវិទ្យា",
      category_slug: "technology",
      category_description: "Tech news",
      category_color: "#007BFF",
      category_icon: "fa-solid fa-microchip",
      category_order: 2,
    },
  ];

  for (const c of categories) {
    await pool.execute(
      `
      INSERT INTO ltng_news_categories
      (
        category_name_en,
        category_name_kh,
        category_slug,
        category_description,
        category_color,
        category_icon,
        category_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        category_name_en = VALUES(category_name_en),
        category_name_kh = VALUES(category_name_kh),
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        c.category_name_en,
        c.category_name_kh,
        c.category_slug,
        c.category_description,
        c.category_color,
        c.category_icon,
        c.category_order,
      ]
    );
  }

  console.log("✅ Categories seeded");
};
