const fs = require('fs');
const { Client } = require('pg');

const env = fs.readFileSync('.env.local', 'utf-8');
const connectionString = env.split('\n').find(l => l.startsWith('DIRECT_URL')).split('=')[1].trim().replace(/^"|"$/g, '');

const sql = fs.readFileSync('migrate_reviews.sql', 'utf-8');

async function migrate() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        console.log('Connected to DB');
        await client.query(sql);
        console.log('Migration completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
