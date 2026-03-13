const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DIRECT_URL });

async function main() {
    await client.connect();
    console.log("Connected to Supabase.");

    try {
        await client.query('BEGIN');

        const sql = `
      -- [비파괴적 보존] 기존 정책 원본:
      -- CREATE POLICY users_select_safe ON public.users FOR SELECT TO authenticated USING (
      --   ((get_user_role(auth.uid()) = 'ADMIN'::text) OR (user_id = auth.uid()))
      -- );
      
      -- 기존 함수 호출 기반 정책 비활성화(DROP)
      DROP POLICY IF EXISTS users_select_safe ON public.users;

      -- JWT 기반 신규 초경량 RLS 정책 생성 (10만 CCU 지원)
      CREATE POLICY users_select_jwt_safe ON public.users 
      FOR SELECT 
      TO authenticated 
      USING (
        -- 본인이거나, JWT 토큰상의 app_metadata(또는 user_metadata) role이 ADMIN일 때 허용
        (user_id = auth.uid()) OR 
        (COALESCE(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role') = 'ADMIN')
      );
    `;

        await client.query(sql);

        await client.query('COMMIT');
        console.log("Successfully updated RLS policies in transaction.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
