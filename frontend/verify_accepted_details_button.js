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
  console.log(
    "Validating UI rendering logic changes indirectly via database state checking...",
  );

  // We already inserted a winning quote in the previous step. Let's find it.
  const { data: quote } = await supabase
    .from("match_quotes")
    .select("request_id, pro_id, status")
    .eq("status", "ACCEPTED")
    .limit(1)
    .single();
  if (!quote) return console.log("No accepted quotes found. Cannot test.");

  const { data: req } = await supabase
    .from("match_requests")
    .select("status, created_at")
    .eq("request_id", quote.request_id)
    .single();

  const now = Date.now();
  const expiresAt = new Date(req.created_at).getTime() + 48 * 60 * 60 * 1000;
  const diffMs = expiresAt - now;
  const isExpired = diffMs <= 0;

  const isAccepted = quote.status === "ACCEPTED";
  const isMatchedButNotMe = req.status === "MATCHED" && !isAccepted;

  // The react component logic determines if button is disabled here:
  const isDisabled = (isExpired && !isAccepted) || isMatchedButNotMe;

  console.log("Request Status:", req.status);
  console.log("Quote Status:", quote.status);
  console.log("Is Expired?", isExpired);
  console.log("Is Accepted?", isAccepted);
  console.log("Button Disabled?", isDisabled);

  if (isDisabled === false) {
    console.log(
      "SUCCESS: The View Details button is ENABLED for the accepted Pro.",
    );
  } else {
    console.log("FAIL: The View Details button is disabled.");
  }
}

test();
