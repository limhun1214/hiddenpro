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
  // 1. Get an open request
  const { data: request } = await supabase
    .from("match_requests")
    .select("*")
    .eq("status", "OPEN")
    .limit(1)
    .single();
  if (!request) return console.log("No open requests");

  // 2. Get a pro user to act as quoter
  const { data: pro } = await supabase
    .from("users")
    .select("*")
    .eq("role", "PRO")
    .limit(1)
    .single();

  // 3. Simulate handleStartChat DB logic
  const customerId = request.customer_id;
  const proId = pro.id;
  const requestId = request.request_id;

  console.log("Inserting chat room for request", requestId);
  const { data: room, error } = await supabase
    .from("chat_rooms")
    .insert({
      request_id: requestId,
      customer_id: customerId,
      pro_id: proId,
      status: "OPEN",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      console.log("Room already exists, moving on.");
    } else {
      console.error("Error inserting room:", error);
      return;
    }
  } else {
    console.log("Room inserted:", room.room_id);
  }

  // 4. Verify match_requests status is STILL open
  const { data: verifyReq } = await supabase
    .from("match_requests")
    .select("status")
    .eq("request_id", requestId)
    .single();
  console.log("Request status after fake chat click:", verifyReq.status);
  if (verifyReq.status === "OPEN") {
    console.log("SUCCESS: Request is still OPEN. Magic matching bug is fixed.");
  } else {
    console.log("FAIL: Request status changed to", verifyReq.status);
  }
}

test();
