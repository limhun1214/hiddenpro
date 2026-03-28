require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function runMigration() {
  const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("ERROR: DATABASE_URL or DIRECT_URL is not set in .env");
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log("Connected to the database.");

    // SQL 파일 읽기
    const sqlFilePath = path.join(__dirname, "../database/update_cms_v2.sql");
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

    console.log("Executing SQL migration script...");
    await client.query(sqlContent);

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

runMigration();
