const { Client } = require("pg");
const fs = require("fs");

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
if (!dbUrlMatch) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrlMatch[1],
});

async function run() {
  await client.connect();
  const query = `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'pro_profiles' ORDER BY ordinal_position;`;

  try {
    console.log("=== pro_profiles Table Structure ===");
    const res = await client.query(query);
    console.table(res.rows);
  } catch (e) {
    console.error("Query failed:", e.message);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
