const { Client } = require("pg");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf-8");
const connectionString = env
  .split("\n")
  .find((l) => l.startsWith("DIRECT_URL"))
  .split("=")[1]
  .trim()
  .replace(/^"|"$/g, "");

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename IN ('reviews', 'chat_rooms', 'match_requests', 'match_quotes');
  `);
  console.log("=== RLS POLICIES ===");
  console.table(res.rows);

  await client.end();
}
run();
