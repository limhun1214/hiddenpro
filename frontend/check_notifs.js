const fs = require("fs");
const env = fs
  .readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const idx = line.indexOf("=");
    if (idx > -1) {
      const k = line.slice(0, idx).trim();
      const v = line
        .slice(idx + 1)
        .trim()
        .replace(/['"]/g, "");
      acc[k] = v;
    }
    return acc;
  }, {});
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
async function check() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, message, sender_id, created_at")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) console.error(error);
  else {
    console.table(data);
    const nullCount = data.filter((d) => d.sender_id === null).length;
    console.log(`NULL sender_id count: ${nullCount}`);
  }
}
check();
