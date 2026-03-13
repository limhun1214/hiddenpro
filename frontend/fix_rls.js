const { Client } = require('pg');
const url = 'postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString: url });

async function run() {
    await client.connect();
    try {
        await client.query(`INSERT INTO storage.buckets (id, name, public) VALUES ('quote_images', 'quote_images', true) ON CONFLICT (id) DO UPDATE SET public = true;`);

        await client.query(`DROP POLICY IF EXISTS "Allow public SELECT on quote_images" ON storage.objects;`);
        await client.query(`DROP POLICY IF EXISTS "Allow public INSERT on quote_images" ON storage.objects;`);
        await client.query(`DROP POLICY IF EXISTS "Allow public UPDATE on quote_images" ON storage.objects;`);

        await client.query(`CREATE POLICY "Allow public SELECT on quote_images" ON storage.objects FOR SELECT USING ( bucket_id = 'quote_images' );`);
        await client.query(`CREATE POLICY "Allow public INSERT on quote_images" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'quote_images' );`);
        await client.query(`CREATE POLICY "Allow public UPDATE on quote_images" ON storage.objects FOR UPDATE USING ( bucket_id = 'quote_images' );`);

        console.log('Storage RLS modified successfully.');
    } catch (e) {
        console.error('Error applying RLS:', e);
    } finally {
        await client.end();
    }
}

run();
