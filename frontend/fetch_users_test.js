const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://sjhemxejhyztbsctkqvb.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaGVteGVqaHl6dGJzY3RrcXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI2MDY2MSwiZXhwIjoyMDg2ODM2NjYxfQ.evoTmf6AW1WMAGhhS0GNKB_T06Xsrd7uhxKLE4PPIaY";
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, email, name, nickname, role, status")
    .limit(5);

  if (error) {
    console.error("Error fetching users:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

fetchUsers();
