const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRole() {
  const { data: users, error } = await supabase.from("users").select("*");
  if (error) {
    console.error("Error:", error.message);
    return;
  }
  console.log(JSON.stringify(users, null, 2));
}

checkRole();
