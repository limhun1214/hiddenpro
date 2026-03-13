const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: 'postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS cms_features (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                media_url TEXT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                bg_color VARCHAR(50) DEFAULT '#f1f5f9',
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            ALTER TABLE cms_features ENABLE ROW LEVEL SECURITY;

            -- Allow public read access
            DO $$ BEGIN
                CREATE POLICY "Allow public select on cms_features" 
                ON cms_features FOR SELECT USING (true);
            EXCEPTION WHEN duplicate_object THEN null; END $$;

            -- Allow admin full access
            DO $$ BEGIN
                CREATE POLICY "Allow admin full access on cms_features" 
                ON cms_features FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM users 
                        WHERE users.user_id = auth.uid() AND users.role = 'ADMIN'
                    )
                );
            EXCEPTION WHEN duplicate_object THEN null; END $$;

            -- Insert default data if empty
            INSERT INTO cms_features (media_url, title, description, bg_color, sort_order)
            SELECT '*🛡️', '100% 신원 검증', '엄격한 심사와 신원 확인을 거친<br />검증된 현지 전문가만 활동합니다.', '#E8E0FD', 1
            WHERE NOT EXISTS (SELECT 1 FROM cms_features);

            INSERT INTO cms_features (media_url, title, description, bg_color, sort_order)
            SELECT '*🤝', '수수료 없는 투명한 직거래', '고객에게는 어떠한 매칭 수수료도<br />요구하지 않는 투명한 시스템입니다.', '#FFDCCC', 2
            WHERE NOT (SELECT COUNT(*) FROM cms_features) > 1;

            INSERT INTO cms_features (media_url, title, description, bg_color, sort_order)
            SELECT '*⚡', '선착순 5명 견적 비교', '무분별한 연락을 방지하기 위해<br />최대 5명의 견적만 받아볼 수 있습니다.', '#CCF4E0', 3
            WHERE NOT (SELECT COUNT(*) FROM cms_features) > 2;

        `);
        console.log('cms_features table created and seeded');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

migrate();
