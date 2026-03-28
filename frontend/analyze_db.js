const { Client } = require("pg");
require("dotenv").config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.DIRECT_URL });

async function main() {
  await client.connect();

  console.log("--- 1. PROFILE SCHEMA ---");
  const res1 = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('users', 'pro_profiles', 'profiles') AND table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);
  res1.rows.forEach((r) =>
    console.log(`${r.table_name}.${r.column_name} (${r.data_type})`),
  );

  console.log("\n--- 2. AUTH TRIGGERS ---");
  const res2 = await client.query(`
    SELECT trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth' AND event_object_table = 'users';
  `);
  res2.rows.forEach((r) =>
    console.log(`Trigger: ${r.trigger_name} -> ${r.action_statement}`),
  );

  const resFunc = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    WHERE proname IN ('handle_user_sync', 'handle_new_user');
  `);
  resFunc.rows.forEach((r) =>
    console.log(`Function ${r.proname}:\n${r.prosrc}`),
  );

  console.log("\n--- 3. RLS POLICIES ---");
  const res3 = await client.query(`
    SELECT tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('users', 'pro_profiles');
  `);
  res3.rows.forEach((r) =>
    console.log(
      `Table: ${r.tablename} | Policy: ${r.policyname} | Roles: ${r.roles} | Cmd: ${r.cmd}\n  Qual: ${r.qual}`,
    ),
  );

  await client.end();
}

main().catch(console.error);
