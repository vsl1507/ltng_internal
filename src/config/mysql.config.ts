import mysql from "mysql2/promise";

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "fb_account_manager",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
export const testConnection = async () => {
  try {
    console.log("🔄 Attempting to connect to MySQL...");
    console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`   User: ${dbConfig.user}`);
    console.log(`   Database: ${dbConfig.database}`);

    const connection = await pool.getConnection();
    console.log("✅ MySQL Connected Successfully!");

    // Test query
    const [rows] = await connection.query("SELECT 1 + 1 AS result");
    console.log("✅ Database query test successful");

    connection.release();
    return true;
  } catch (error: any) {
    console.error("❌ MySQL Connection Error:", error.message);
    console.error("\n📋 Troubleshooting checklist:");
    console.error("   1. Is MySQL server running?");
    console.error("   2. Check your .env file configuration");
    console.error("   3. Verify host and port are correct");
    console.error("   4. Check username and password");
    console.error("   5. Ensure database exists");
    console.error("   6. Check firewall settings");
    console.error("   7. Verify MySQL is accepting connections");

    if (error.code === "ETIMEDOUT") {
      console.error(
        "\n⚠️  Connection timeout - MySQL server may not be running or not accessible"
      );
    } else if (error.code === "ECONNREFUSED") {
      console.error(
        "\n⚠️  Connection refused - MySQL server is not running on specified host/port"
      );
    } else if (error.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("\n⚠️  Access denied - Check username and password");
    } else if (error.code === "ER_BAD_DB_ERROR") {
      console.error(
        "\n⚠️  Database does not exist - Create the database first"
      );
    }

    return false;
  }
};

export default pool;
