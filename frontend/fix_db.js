const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function run() {
  await client.connect();

  try {
    console.log("Altering column type to UUID...");
    await client.query(`
      ALTER TABLE match_requests 
      ALTER COLUMN category_id TYPE uuid USING category_id::uuid;
    `);
    console.log("✅ Column type altered successfully.");

    console.log("Adding Foreign Key constraint...");
    await client.query(`
      ALTER TABLE match_requests
      ADD CONSTRAINT match_requests_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id)
      ON DELETE SET NULL;
    `);
    console.log("✅ Foreign Key added successfully.");

    console.log("Reloading schema cache...");
    await client.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("✅ Schema cache reloaded.");
  } catch (e) {
    console.error("Error during DB operations:", e);
  } finally {
    await client.end();
  }
}

run().catch(console.error);
