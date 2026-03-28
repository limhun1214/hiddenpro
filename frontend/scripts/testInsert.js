const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();

    const customerId = "00000000-0000-0000-0000-000000000001";
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await client.query(
      `
      INSERT INTO match_requests (customer_id, category_id, region_id, dynamic_answers, status, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        customerId,
        1,
        1,
        JSON.stringify({
          q_001: "이사/입주 청소",
          q_002: ["냉장고 내부 청소"],
          q_003: "테스트",
        }),
        "OPEN",
        expiresAt,
      ],
    );

    console.log(
      "Successfully inserted test request with expires_at:",
      expiresAt,
    );
  } catch (err) {
    console.error("Error inserting data:", err);
  } finally {
    await client.end();
  }
}

run();
