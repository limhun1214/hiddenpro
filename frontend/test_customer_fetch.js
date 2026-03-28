require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function test() {
  const { data: customerRequests, error } = await supabase
    .from("match_requests")
    .select(
      `
            request_id, status, dynamic_answers, customer_id, quote_count, created_at,
            service_type, region,
            match_quotes (
                quote_id, pro_id, created_at, status, price, description, image_url, is_read,
                pro_profiles (pro_id, average_rating, review_count, is_phone_verified, facebook_url, intro, detailed_intro, users (name, nickname, avatar_url))
            )
        `,
    )
    .limit(1);

  if (error) {
    console.error("ERROR FETCHING:", error);
  } else {
    console.log(
      "SUCCESS FETCHING",
      customerRequests ? customerRequests.length : 0,
    );
  }
}
test();
