require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const client = new Client(process.env.DATABASE_URL);
(async () => {
    await client.connect();
    const cols = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1;', ['users']);
    console.log('Users cols:', cols.rows.map(r => r.column_name));
    client.end();
})();
