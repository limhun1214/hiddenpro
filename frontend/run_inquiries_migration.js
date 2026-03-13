require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const directUrl = process.env.DIRECT_URL; // 필수

if (!supabaseUrl || !supabaseKey || !directUrl) {
    console.error("Missing environment variables. Please check your .env.local file.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: directUrl,
});

async function runMigration() {
    console.log("Starting inquiries migration...");

    try {
        const sqlFilePath = path.join(__dirname, '..', 'database', 'create_inquiries_table.sql');
        const sqlQuery = fs.readFileSync(sqlFilePath, 'utf8');

        console.log("Executing SQL script...");
        await pool.query(sqlQuery);
        console.log("Migration executed successfully!");

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        await pool.end();
        console.log("Pool connection closed.");
    }
}

runMigration();
