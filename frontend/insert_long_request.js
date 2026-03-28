const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const envLocal = fs.readFileSync(".env.local", "utf-8");
let supabaseUrl = "";
let supabaseKey = "";

envLocal.split("\n").forEach((line) => {
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL="))
    supabaseUrl = line.split("=")[1].trim();
  if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY="))
    supabaseKey = line.split("=")[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const longText = `동해 물과 백두산이 마르고 닳도록
하느님이 보우하사 우리나라 만세
무궁화 삼천리 화려 강산
대한 사람 대한으로 길이 보전하세

남산 위에 저 소나무 철갑을 두른 듯
바람 서리 불변함은 우리 기상일세
무궁화 삼천리 화려 강산
대한 사람 대한으로 길이 보전하세

가을 하늘 공활한데 높고 구름 없이
밝은 달은 우리 가슴 일편단심일세
무궁화 삼천리 화려 강산
대한 사람 대한으로 길이 보전하세

이 기상과 이 맘으로 충성을 다하여
괴로우나 즐거우나 나라 사랑하세
무궁화 삼천리 화려 강산
대한 사람 대한으로 길이 보전하세`;

  const request = {
    customer_id: "a909ac48-e8cb-4654-8c83-faab6a84c6af", // test customer or anyone
    category_id: "cleaning",
    region_id: "seoul",
    service_type: "매우 긴 테스트",
    region: "광화문",
    dynamic_answers: {
      details: longText,
    },
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };

  const { data, error } = await supabase
    .from("match_requests")
    .insert([request])
    .select();
  if (error) console.error(error);
  else console.log("Insert success:", data[0].request_id);
}
run();
