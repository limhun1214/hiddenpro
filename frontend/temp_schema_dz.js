require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function schemas() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        await client.query("ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'CANCELED_BY_ADMIN';");
        console.log('Added CANCELED_BY_ADMIN to request_status');
    } catch (e) { console.error('Error adding enum:', e.message); }

    try {
        await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;");
        console.log('Added suspension_reason to users');
    } catch (e) { console.error('Error adding column:', e.message); }

    try {
        await client.query("NOTIFY pgrst, 'reload schema';");
        console.log('schema reloaded');
    } catch (e) { console.error('Error reloading schema:', e.message); }

    await client.end();
}
schemas();
