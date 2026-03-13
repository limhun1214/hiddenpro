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

        // 1. Get pg_policies
        console.log('--- Query 1: pg_policies for users table ---');
        const policies = await client.query(`
      SELECT policyname, roles, cmd, qual
      FROM pg_policies
      WHERE tablename = 'users'
      ORDER BY policyname;
    `);
        console.log(JSON.stringify(policies.rows, null, 2));

        // 2. Get a PRO user ID using admin privileges
        const proUserResult = await client.query(`
      SELECT user_id FROM public.users WHERE role = 'PRO' LIMIT 1;
    `);

        if (proUserResult.rows.length === 0) {
            console.log('No PRO users found to simulate.');
            return;
        }
        const proUserId = proUserResult.rows[0].user_id;
        console.log(`\nFound PRO user: ${proUserId}, simulating authenticated request...`);

        // 3. Simulate authenticated request
        console.log('\n--- Query 2: Simulating PRO user reading CUSTOMER data ---');

        await client.query('BEGIN');

        // Set to authenticated role like PostgREST does
        await client.query('SET LOCAL ROLE authenticated');

        // Set JWT claims so auth.uid() and auth.jwt() work
        const claims = JSON.stringify({
            role: 'authenticated',
            sub: proUserId,
            app_metadata: { role: 'PRO' },
            user_metadata: { role: 'PRO' }
        });

        await client.query(`SET LOCAL request.jwt.claims = '${claims}'`);

        // Attempt the query
        const simResult = await client.query(`
      SELECT * FROM public.users
      WHERE role = 'CUSTOMER'
      LIMIT 5;
    `);

        console.log(`Rows returned for PRO reading CUSTOMER data: ${simResult.rows.length}`);
        if (simResult.rows.length > 0) {
            console.log(JSON.stringify(simResult.rows.map(r => ({ user_id: r.user_id, role: r.role })), null, 2));
        }

        await client.query('COMMIT');

    } catch (err) {
        console.error('Error executing query', err);
        try { await client.query('ROLLBACK'); } catch (e) { }
    } finally {
        await client.end();
    }
}

run();
