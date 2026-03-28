const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectMockNotification() {
  // 테스트 고수 계정 ID
  const testUserId = "00000000-0000-0000-0000-000000000002";

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: testUserId,
      type: "NEW_REQUEST",
      message: "새로운 견적 요청서가 도착했습니다!",
      is_read: false,
    })
    .select();

  if (error) {
    console.error("Insert error:", error);
  } else {
    console.log("Mock notification inserted!", data);
  }
}

injectMockNotification();
