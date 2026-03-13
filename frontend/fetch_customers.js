const { Client } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const DIRECT_URL = envConfig.DIRECT_URL || envConfig.DATABASE_URL;

async function run() {
    const client = new Client({
        connectionString: DIRECT_URL,
    });

    try {
        await client.connect();
        const result = await client.query(`
      SELECT user_id, nickname, name, avatar_url
      FROM public.users
      WHERE role = 'CUSTOMER'
      LIMIT 10;
    `);

        console.log(JSON.stringify(result.rows, null, 2));

        const nullNicknames = result.rows.filter(r => !r.nickname).length;
        const nullNames = result.rows.filter(r => !r.name).length;
        const nullAvatars = result.rows.filter(r => !r.avatar_url).length;

        console.log('\n--- SUMMARY ---');
        console.log(`1. nickname 비어있는 고객: ${nullNicknames}명`);
        console.log(`2. name 비어있는 고객: ${nullNames}명`);
        console.log(`3. avatar_url 비어있는 고객: ${nullAvatars}명`);

    } catch (err) {
        console.error('Error executing query', err.stack);
    } finally {
        await client.end();
    }
}

run();
