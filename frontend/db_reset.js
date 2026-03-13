const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function resetDB() {
    const client = new Client({ connectionString: process.env.DIRECT_URL });
    await client.connect();

    try {
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name NOT IN ('users', 'pro_profiles', 'categories', 'regions', 'services')
        `);

        const tablesToClear = [];
        const pattern = /notification|message|chat|quote|request|cash|ledger|wallet|point|review|transaction/i;

        for (let row of res.rows) {
            if (pattern.test(row.table_name)) {
                tablesToClear.push(row.table_name);
            }
        }

        console.log("Tables to clear:", tablesToClear);

        if (tablesToClear.length > 0) {
            const query = `TRUNCATE TABLE ${tablesToClear.map(t => '"' + t + '"').join(', ')} CASCADE;`;
            console.log("Executing:", query);
            await client.query(query);
            console.log("Reset successful.");
        } else {
            console.log("No matching tables found.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}
resetDB();
