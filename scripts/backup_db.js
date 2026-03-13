// 실행: node scripts/backup_db.js
// 결과: 프로젝트 루트에 backup_YYYYMMDD_HHMMSS/ 폴더 생성
// 포함: db_full_backup.json + restore.sql + env_backup + source_code_backup.zip

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── 환경변수 파싱 ──
const envPath = path.join(__dirname, '..', 'frontend', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 누락');
    process.exit(1);
}

// ── 백업 폴더 자동 생성 (날짜/시간 기반) ──
const now = new Date();
const pad = n => String(n).padStart(2, '0');
const timestamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const backupDir = path.join(__dirname, '..', `backup_${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });
console.log(`\n📁 백업 폴더 생성: backup_${timestamp}\n`);

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

// ── SQL 이스케이프 헬퍼 ──
function escapeSQL(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return val;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
    console.log('=== HiddenPro DB 백업 시작 ===\n');
    const backup = {};
    const sqlLines = [];

    sqlLines.push('-- HiddenPro DB Restore Script');
    sqlLines.push(`-- 생성 시각: ${now.toISOString()}`);
    sqlLines.push('-- 실행 방법: Supabase SQL Editor에 전체 붙여넣기 후 실행\n');
    sqlLines.push('BEGIN;\n');

    // ── 1. DB 데이터 백업 ──
    for (const table of TABLES) {
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
                headers: {
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Prefer': 'count=exact'
                }
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            backup[table] = { rows: data.length, data };
            console.log(`  ✅ ${table}: ${data.length}건`);

            // SQL INSERT 생성
            if (data.length > 0) {
                sqlLines.push(`-- ── ${table} (${data.length}건) ──`);
                sqlLines.push(`DELETE FROM ${table} WHERE 1=1;`);
                for (const row of data) {
                    const cols = Object.keys(row).join(', ');
                    const vals = Object.values(row).map(escapeSQL).join(', ');
                    sqlLines.push(`INSERT INTO ${table} (${cols}) VALUES (${vals});`);
                }
                sqlLines.push('');
            }
        } catch (e) {
            console.warn(`  ❌ ${table}: ${e.message}`);
            backup[table] = { error: e.message, rows: 0 };
        }
    }

    sqlLines.push('COMMIT;');

    // ── 2. JSON 백업 저장 ──
    const jsonPath = path.join(backupDir, 'db_full_backup.json');
    fs.writeFileSync(jsonPath, JSON.stringify(backup, null, 2), 'utf-8');
    const jsonSizeMB = (fs.statSync(jsonPath).size / 1024).toFixed(1);
    console.log(`\n  💾 db_full_backup.json 저장 완료 (${jsonSizeMB} KB)`);

    // ── 3. SQL 복원 스크립트 저장 ──
    const sqlPath = path.join(backupDir, 'restore.sql');
    fs.writeFileSync(sqlPath, sqlLines.join('\n'), 'utf-8');
    const sqlSizeKB = (fs.statSync(sqlPath).size / 1024).toFixed(1);
    console.log(`  💾 restore.sql 저장 완료 (${sqlSizeKB} KB)`);

    // ── 4. env 백업 ──
    const envBackupPath = path.join(backupDir, 'env_backup');
    fs.copyFileSync(envPath, envBackupPath);
    console.log(`  💾 env_backup 저장 완료`);

    // ── 5. 소스코드 ZIP 백업 (node_modules/.next/dist 제외) ──
    try {
        const srcDir = path.join(__dirname, '..', 'frontend');
        const zipPath = path.join(backupDir, 'source_code_backup.zip');
        const tmpDir = path.join(backupDir, '_tmp_src');

        // 임시 폴더에 제외 대상 빼고 복사
        const excludeDirs = ['node_modules', '.next', 'dist'];

        function copyRecursive(src, dst) {
            if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
            for (const item of fs.readdirSync(src)) {
                if (excludeDirs.includes(item)) continue;
                const srcItem = path.join(src, item);
                const dstItem = path.join(dst, item);
                const stat = fs.statSync(srcItem);
                if (stat.isDirectory()) {
                    copyRecursive(srcItem, dstItem);
                } else {
                    fs.copyFileSync(srcItem, dstItem);
                }
            }
        }

        copyRecursive(srcDir, tmpDir);

        // 임시 폴더 압축
        execSync(
            `powershell -Command "Compress-Archive -Path '${tmpDir.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force"`,
            { stdio: 'pipe' }
        );

        // 임시 폴더 정리
        fs.rmSync(tmpDir, { recursive: true, force: true });

        const zipSizeMB = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(1);
        console.log(`  💾 source_code_backup.zip 저장 완료 (${zipSizeMB} MB)`);
    } catch (e) {
        console.warn(`  ⚠️ 소스코드 ZIP 생성 실패: ${e.message}`);
    }

    // ── 최종 요약 ──
    const totalRows = Object.values(backup).reduce((sum, t) => sum + (t.rows || 0), 0);
    console.log(`\n=== ✅ 백업 완료 ===`);
    console.log(`📁 위치: backup_${timestamp}/`);
    console.log(`📊 총 ${TABLES.length}개 테이블 / ${totalRows}건 데이터`);
    console.log(`\n🔄 롤백 방법:`);
    console.log(`   Supabase SQL Editor → restore.sql 내용 전체 붙여넣기 → 실행`);
}

main().catch(console.error);
