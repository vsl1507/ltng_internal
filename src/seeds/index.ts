import { seedCategories } from "./category.seed";
import { seedSourceTypes } from "./source-type.seed";
import pool from "../config/mysql.config";
import { seedSources } from "./source.seed";

const runSeeds = async () => {
  try {
    console.log("🌱 Seeding database...");

    await seedSourceTypes();
    await seedCategories();
    await seedSources();

    console.log("🎉 Seeding completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runSeeds();
