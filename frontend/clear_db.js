const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function clearDB() {
  try {
    await client.connect();
    // match_quotes (which might have been originally requested as quotes)
    await client.query("DELETE FROM match_quotes");
    await client.query("DELETE FROM match_requests");
    await client.query("DELETE FROM notifications");
    console.log("All requested tables cleared successfully.");
  } catch (e) {
    console.error("DB Error:", e);
  } finally {
    await client.end();
  }
}

clearDB();
