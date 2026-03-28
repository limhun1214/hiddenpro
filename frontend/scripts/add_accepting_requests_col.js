const fs = require("fs");
const { Client } = require("pg");

const envFile = fs.readFileSync("../.env.local", "utf8");
const directUrlLine = envFile
  .split("\n")
  .find((line) => line.startsWith("DIRECT_URL="));
const directUrl = directUrlLine.split("=")[1].replace(/"/g, "").trim();

async function addColumn() {
  const client = new Client({
    connectionString: directUrl,
  });

  try {
    await client.connect();

    // Check if column exists first
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='pro_profiles' AND column_name='is_accepting_requests';
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding is_accepting_requests to Pro_Profiles...");
      await client.query(`
        ALTER TABLE Pro_Profiles
        ADD COLUMN is_accepting_requests BOOLEAN NOT NULL DEFAULT true;
      `);
      console.log("Successfully added the column.");
    } else {
      console.log("Column already exists.");
    }
  } catch (err) {
    console.error("Error adding column:", err);
  } finally {
    await client.end();
  }
}

addColumn();
