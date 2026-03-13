const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf-8');
const connectionString = env.split('\n').find(l => l.startsWith('DIRECT_URL')).split('=')[1].trim().replace(/^"|"$/g, '');

const client = new Client({ connectionString });

async function getEnums() {
    await client.connect();

    // Get all ENUM types and their values
    const enumQuery = `
    SELECT t.typname, e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    ORDER BY t.typname, e.enumsortorder;
  `;
    const enumRes = await client.query(enumQuery);
    console.log("=== ENUM VALUES ===");
    console.log(enumRes.rows);

    // Get schema of pro_profiles
    const proProfileQuery = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'pro_profiles';
  `;
    const ppRes = await client.query(proProfileQuery);
    console.log("=== PRO_PROFILES COLUMNS ===");
    console.table(ppRes.rows);

    // Get Cash_Ledger columns to see if tx_type uses an enum
    const ledgerQuery = `
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_name = 'cash_ledger';
  `;
    const clRes = await client.query(ledgerQuery);
    console.log("=== CASH_LEDGER COLUMNS ===");
    console.table(clRes.rows);

    await client.end();
}
getEnums();
