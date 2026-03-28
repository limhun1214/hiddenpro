const fs = require("fs");
const envPath = require("path").join(__dirname, "frontend", ".env.local");
const env = fs.readFileSync(envPath, "utf8");
const dbUrl = env
  .split("\n")
  .find((l) => l.startsWith("DATABASE_URL"))
  .split("=")[1]
  .replace(/['"]/g, "")
  .trim();
const { Client } = require("pg");
const client = new Client({ connectionString: dbUrl });
client
  .connect()
  .then(() =>
    client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'profile_image_updated_at';",
    ),
  )
  .then((res) => {
    console.log("DB_RESULT:", JSON.stringify(res.rows));
    client.end();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
