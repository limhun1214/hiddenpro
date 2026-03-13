// DB Backup without dependencies using native fetch
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key not found');
    process.exit(1);
}

const TABLES = [
    'users',
    'pro_profiles',
    'match_requests',
    'match_quotes',
    'chat_rooms',
    'chat_messages',
    'reviews',
    'cash_ledger',
    'notifications',
    'admin_action_logs',
    'inquiries',
    'pro_quote_templates',
    'user_penalty_stats',
    'platform_settings',
    'cms_banners',
    'cms_categories',
];

async function main() {
    console.log('=== Native API DB Backup Start ===');
    const backup = {};

    for (const table of TABLES) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();
            backup[table] = { rows: data.length, data: data };
            console.log(`  [OK] ${table}: ${data.length} rows`);
        } catch (e) {
            console.warn(`  [ERR] ${table}: ${e.message}`);
            backup[table] = { error: e.message, rows: 0 };
        }
    }

    const outPath = path.join(__dirname, '..', 'backup_20260303', 'db_full_backup.json');
    fs.writeFileSync(outPath, JSON.stringify(backup, null, 2), 'utf-8');

    const sizeMB = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);
    console.log(`\n=== Complete! ${outPath} (${sizeMB} MB) ===`);
}

main().catch(console.error);
