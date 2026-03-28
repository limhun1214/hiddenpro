const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env.local", "utf-8");
const url = env
  .split("\n")
  .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL"))
  .split("=")[1]
  .trim();
const key = env
  .split("\n")
  .find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  .split("=")[1]
  .trim();
const supabase = createClient(url, key);

async function test() {
  // 1. Get a customer user
  const { data: customer } = await supabase
    .from("users")
    .select("*")
    .eq("role", "CUSTOMER")
    .limit(1)
    .single();
  if (!customer) return console.log("No customer found");

  const longText = "가나다라마바사아자차카타파하1234567890".repeat(10); // 100+ chars without spaces

  // 2. Insert mock request
  const { data: req, error } = await supabase
    .from("match_requests")
    .insert({
      customer_id: customer.id,
      category_id: "cleaning",
      region_id: "seoul",
      service_type: "줄바꿈없는긴텍스트버그테스트",
      region: "광화문",
      dynamic_answers: { details: longText },
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error inserting mock request:", error);
  } else {
    console.log("Successfully inserted mock request:", req.request_id);
  }
}

test();
