import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "";
let supabaseKey = "";

envFile.split("\n").forEach((line) => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = line.split("=")[1].trim().replace(/^"|"$/g, "");
  }
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) {
    supabaseKey = line.split("=")[1].trim().replace(/^"|"$/g, "");
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: data2, error: err2 } = await supabase
    .from("chat_rooms")
    .select(
      `
            room_id, customer_id, pro_id,
            customer:users!customer_id (name),
            pro:users!pro_id (name)
        `,
    )
    .limit(2);
  console.log("Error 2:", err2);
  if (data2) console.log("Data 2:", JSON.stringify(data2, null, 2));

  const { data: data3, error: err3 } = await supabase
    .from("chat_rooms")
    .select(
      `
            room_id, customer_id, pro_id,
            customer:customer_id(name),
            pro:pro_id(name)
        `,
    )
    .limit(2);
  console.log("Error 3:", err3);
  if (data3) console.log("Data 3:", JSON.stringify(data3, null, 2));
}

check();
