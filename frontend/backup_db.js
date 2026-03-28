const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envFile = fs.readFileSync("C:\\HiddenPro\\frontend\\.env.local", "utf-8");
const env = {};
envFile.split("\n").forEach((line) => {
  const parts = line.split("=");
  const key = parts[0]?.trim();
  if (key && parts.length > 1) {
    env[key] = parts
      .slice(1)
      .join("=")
      .trim()
      .replace(/^["']|["']$/g, "");
  }
});

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey =
  env["SUPABASE_SERVICE_ROLE_KEY"] || env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  "users",
  "pro_profiles",
  "match_requests",
  "match_quotes",
  "chat_rooms",
  "reviews",
];
const backupData = {};

async function backup() {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      backupData[table] = data;
    }
  }

  fs.writeFileSync(
    "C:\\HiddenPro\\backup_20260225\\db_full_backup.json",
    JSON.stringify(backupData, null, 2),
  );
  console.log("DB Backup saved.");
}

backup();
