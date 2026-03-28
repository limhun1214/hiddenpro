const { Client } = require("pg");
const fs = require("fs");
const dotenv = require("dotenv");

const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
const DIRECT_URL = envConfig.DIRECT_URL || envConfig.DATABASE_URL;

async function run() {
  const client = new Client({
    connectionString: DIRECT_URL,
  });

  try {
    await client.connect();

    console.log(
      "--- Query: Checking match_requests table for answers column ---",
    );
    const result = await client.query(`
      SELECT request_id, status, service_type, region, customer_id, answers
      FROM public.match_requests
      LIMIT 5;
    `);

    console.log("Query successful!");
    console.log(`Rows returned: ${result.rows.length}`);
    if (result.rows.length > 0) {
      console.log(JSON.stringify(result.rows, null, 2));
    }
  } catch (err) {
    console.error("Error executing query:", err.message);
  } finally {
    await client.end();
  }
}

run();
