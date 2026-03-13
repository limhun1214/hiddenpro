const { Client } = require('pg');

async function checkDB() {
    const client = new Client({
        connectionString: 'postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name LIKE 'cms_%'`);
        console.log(res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

checkDB();
