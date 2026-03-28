const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const client = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to the database.");

    const query = `
      ALTER TABLE IF EXISTS public.reviews
      ADD COLUMN IF NOT EXISTS is_featured_on_main BOOLEAN DEFAULT false;
    `;

    await client.query(query);
    console.log(
      "Successfully added is_featured_on_main column to reviews table.",
    );

    const commentQuery = `
      COMMENT ON COLUMN public.reviews.is_featured_on_main IS '메인 페이지 프론트엔드 노출 여부를 관리자가 결정하는 플래그';
    `;
    await client.query(commentQuery);
    console.log("Successfully added comment to the column.");
  } catch (err) {
    console.error("Error executing query", err.stack);
  } finally {
    await client.end();
  }
}

run();
