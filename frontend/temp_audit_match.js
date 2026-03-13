const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const connectionString = env.split('\n').find(l => l.startsWith('DIRECT_URL')).split('=')[1].trim().replace(/^"|"$/g, '');

async function run() {
    const client = new Client({ connectionString });
    await client.connect();

    // 1. Get Reviews table schema and constraints
    const resColumns = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'reviews';
  `);
    console.log("=== REVIEWS COLUMNS ===");
    console.table(resColumns.rows);

    const resConstraints = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'reviews'::regclass;
  `);
    console.log("=== REVIEWS CONSTRAINTS ===");
    console.table(resConstraints.rows);

    // 2. Search for related RPCs
    const resRPC = await client.query(`
    SELECT proname, pg_get_functiondef(oid)
    FROM pg_proc
    WHERE proname IN ('confirm_match', 'create_review', 'submit_review', 'accept_quote')
       OR proname LIKE '%match%' OR proname LIKE '%review%';
  `);
    console.log("=== RELATED RPCs ===");
    resRPC.rows.forEach(r => {
        console.log(`\n--- ${r.proname} ---`);
        console.log(r.pg_get_functiondef);
    });

    // 3. Search for DB triggers on match_requests or chat_rooms
    const resTriggers = await client.query(`
    SELECT tgname, tgrelid::regclass AS table_name, pg_get_triggerdef(oid) AS trigger_def
    FROM pg_trigger
    WHERE NOT tgisinternal
      AND tgrelid::regclass::text IN ('match_requests', 'chat_rooms', 'match_quotes')
  `);
    console.log('\n=== DB TRIGGERS ===');
    resTriggers.rows.forEach(r => {
        console.log(`\n[${r.table_name}] ${r.tgname}`);
        console.log(r.trigger_def);
    });

    await client.end();
}
run();
