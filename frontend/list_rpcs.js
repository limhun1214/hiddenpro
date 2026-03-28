const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

async function run() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  await client.connect();
  try {
    const res = await client.query(
      "SELECT proname, prosrc FROM pg_proc WHERE proname LIKE '%quote%' OR proname LIKE '%cash%'",
    );
    res.rows.forEach((r) => {
      console.log(`\n--- RPC: ${r.proname} ---`);
      console.log(r.prosrc);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
run();
