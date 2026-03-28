const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
});

async function run() {
  await client.connect();

  console.log("Checking columns of match_requests:");
  const resColumns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'match_requests';
  `);
  console.log(resColumns.rows);

  console.log("\nChecking columns of categories:");
  const resCat = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'categories';
  `);
  console.log(resCat.rows);

  // Check foreign keys for match_requests
  console.log("\nChecking FKs on match_requests:");
  const resFk = await client.query(`
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='match_requests';
  `);
  console.log(resFk.rows);

  await client.end();
}

run().catch(console.error);
