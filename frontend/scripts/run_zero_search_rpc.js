const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to the database.');

        const sqlPath = path.join(__dirname, '../../database/update_zero_search_rpc.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        await client.query(sql);
        console.log('Successfully executed update_zero_search_rpc.sql');

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

run();
