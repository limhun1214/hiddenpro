import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Fallback to anon key if service role key is not found (though RLS may apply)
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
    'users',
    'pro_profiles',
    'services',
    'categories',
    'quotes',
    'reviews',
    'chat_rooms',
    'messages',
    'notifications',
];

async function backupAll() {
    const backup: Record<string, any[]> = {};
    const errors: string[] = [];

    for (const table of TABLES) {
        const { data, error } = await supabase
            .from(table)
            .select('*');

        if (error) {
            console.warn(`[SKIP] ${table}: ${error.message}`);
            errors.push(table);
            backup[table] = [];
        } else {
            backup[table] = data || [];
            console.log(`[OK] ${table}: ${data?.length ?? 0}건`);
        }
    }

    const outputPath = path.join(process.cwd(), 'backup_20260308', 'db_full_backup.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        backup_date: new Date().toISOString(),
        tables: backup,
        skipped_tables: errors
    }, null, 2), 'utf-8');

    console.log(`\n✅ DB 백업 완료: ${outputPath}`);
    if (errors.length > 0) {
        console.warn(`⚠️ 누락된 테이블: ${errors.join(', ')}`);
    }
}

backupAll();
