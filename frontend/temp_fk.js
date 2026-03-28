require("dotenv").config({ path: ".env.local" });
const { Client } = require("pg");

async function addFk() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      "ALTER TABLE match_quotes ADD CONSTRAINT match_quotes_pro_id_users_fkey FOREIGN KEY (pro_id) REFERENCES users(user_id) ON DELETE CASCADE;",
    );
    console.log("FK added");
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("schema reloaded");
  } catch (e) {
    console.error(e.message);
  }
  await client.end();
}
addFk();
