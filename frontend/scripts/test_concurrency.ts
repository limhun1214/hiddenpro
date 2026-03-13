/**
 * 선착순 5명 동시성 방어 자동 테스트 스크립트
 * 실행 방법: npx ts-node scripts/test_concurrency.ts
 *
 * 목적: 10명의 고수가 동시에 견적을 발송할 때 최대 5건만 수락되는지 검증
 * 방식: Supabase RPC send_quote_and_deduct_cash 동시 호출 (p_deduct_amount=0)
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// ── .env.local 파싱 ──
const envPath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let serviceRoleKey = '';

// service role key 가능한 키 이름 (프로젝트 .env.local에 맞게 우선순위 순)
const SERVICE_ROLE_KEY_NAMES = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
];

envFile.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = trimmed.split('=').slice(1).join('=').replace(/^"|"$/g, '');
    }
    for (const keyName of SERVICE_ROLE_KEY_NAMES) {
        if (trimmed.startsWith(`${keyName}=`)) {
            serviceRoleKey = trimmed.split('=').slice(1).join('=').replace(/^"|"$/g, '');
            break;
        }
    }
});

if (!supabaseUrl) {
    console.error('❌ .env.local 에서 NEXT_PUBLIC_SUPABASE_URL 을 찾을 수 없습니다.');
    process.exit(1);
}

if (!serviceRoleKey) {
    console.error('❌ .env.local 에서 Service Role Key 를 찾을 수 없습니다.');
    console.error('   현재 .env.local 에 아래 중 하나를 추가해 주세요:');
    SERVICE_ROLE_KEY_NAMES.forEach(k => console.error(`   ${k}=<your-service-role-key>`));
    console.error('   (Supabase 대시보드 → Project Settings → API → service_role 키)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const CONCURRENCY = 10;  // 동시 호출 수
const EXPECTED_MAX = 5;  // 선착순 최대 허용 수

async function run() {
    let testRequestId: string | null = null;

    try {
        // ── STEP 1: 테스트용 customer_id 조회 ──
        const { data: customerData, error: custErr } = await supabase
            .from('users')
            .select('user_id')
            .eq('role', 'CUSTOMER')
            .eq('status', 'ACTIVE')
            .limit(1)
            .single();

        if (custErr || !customerData) {
            console.error('❌ 활성 고객 계정을 찾을 수 없습니다:', custErr?.message);
            process.exit(1);
        }
        const testCustomerId = customerData.user_id;
        console.log(`📋 테스트 고객 ID: ${testCustomerId.slice(0, 8)}...`);

        // ── STEP 2a: 실제 category_id (UUID) 조회 ──
        // categories.id 는 UUID 타입이므로 반드시 실제 값을 조회해서 사용
        const { data: catData, error: catErr } = await supabase
            .from('categories')
            .select('id')
            .limit(1)
            .single();

        if (catErr || !catData) {
            console.error('❌ categories 테이블에서 카테고리를 찾을 수 없습니다:', catErr?.message);
            process.exit(1);
        }
        const testCategoryId: string = catData.id;
        console.log(`📂 테스트 카테고리 ID: ${testCategoryId.slice(0, 8)}...`);

        // ── STEP 2b: 테스트용 match_request INSERT ──
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const { data: reqData, error: reqErr } = await supabase
            .from('match_requests')
            .insert({
                customer_id: testCustomerId,
                category_id: testCategoryId,  // UUID (categories.id)
                region_id: 1,                 // INT (regions 테이블 FK)
                service_type: '[TEST] 동시성_테스트',
                region: 'Test Region',
                dynamic_answers: { test: true },
                status: 'OPEN',
                expires_at: expiresAt
            })
            .select('request_id')
            .single();

        if (reqErr || !reqData) {
            console.error('❌ 테스트 요청서 생성 실패:', reqErr?.message);
            process.exit(1);
        }
        testRequestId = reqData.request_id;
        console.log(`✅ 테스트 요청서 생성: ${testRequestId}`);

        // ── STEP 3: 활성 고수 10명 조회 ──
        const { data: prosData, error: prosErr } = await supabase
            .from('pro_profiles')
            .select('pro_id, current_cash')
            .eq('is_accepting_requests', true)
            .limit(CONCURRENCY);

        if (prosErr) {
            console.error('❌ 고수 조회 실패:', prosErr.message);
            process.exit(1);
        }

        if (!prosData || prosData.length < CONCURRENCY) {
            console.error(`❌ 활성 고수 계정 부족 (필요: ${CONCURRENCY}명, 확인: ${prosData?.length ?? 0}명)`);
            process.exit(1);
        }
        console.log(`👥 활성 고수 ${prosData.length}명 확인`);

        // ── STEP 4: 10개 동시 RPC 호출 ──
        console.log(`\n🚀 동시 견적 발송 시작 (${CONCURRENCY}명 동시 호출)...\n`);

        const results = await Promise.all(
            prosData.map(async (pro, idx) => {
                try {
                    const { data, error } = await supabase.rpc('send_quote_and_deduct_cash', {
                        p_pro_id: pro.pro_id,
                        p_request_id: testRequestId,
                        p_deduct_amount: 0,
                        p_price: 100,
                        p_description: `[TEST] 동시성 테스트 견적 #${idx + 1}`,
                        p_image_url: null
                    });

                    if (error) {
                        console.log(`  [${idx + 1}] ❌ 실패 - ${pro.pro_id.slice(0, 8)}... : ${error.message}`);
                        return { success: false, proId: pro.pro_id, error: error.message };
                    } else {
                        console.log(`  [${idx + 1}] ✅ 성공 - ${pro.pro_id.slice(0, 8)}... : quote_id=${String(data).slice(0, 8)}...`);
                        return { success: true, proId: pro.pro_id, quoteId: data };
                    }
                } catch (e: any) {
                    console.log(`  [${idx + 1}] ❌ 예외 - ${pro.pro_id.slice(0, 8)}... : ${e.message}`);
                    return { success: false, proId: pro.pro_id, error: e.message };
                }
            })
        );

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        console.log(`\n📊 결과: 성공 ${successCount}건 / 실패 ${failCount}건`);

        // ── STEP 5: 500ms 대기 후 DB COUNT 검증 ──
        await new Promise(resolve => setTimeout(resolve, 500));

        const { count, error: countErr } = await supabase
            .from('match_quotes')
            .select('*', { count: 'exact', head: true })
            .eq('request_id', testRequestId);

        if (countErr) {
            console.error('❌ COUNT 조회 실패:', countErr.message);
        } else if (count === EXPECTED_MAX) {
            console.log(`\n✅ 동시성 방어 정상 — DB COUNT: ${count} (선착순 ${EXPECTED_MAX}명 제한 정상 동작)`);
        } else {
            console.log(`\n❌ Race-condition 감지 — COUNT: ${count} (예상: ${EXPECTED_MAX})`);
        }

    } finally {
        // ── STEP 6: 테스트 데이터 자동 정리 ──
        if (testRequestId) {
            console.log('\n🧹 테스트 데이터 정리 중...');

            const { error: delQuotesErr } = await supabase
                .from('match_quotes')
                .delete()
                .eq('request_id', testRequestId);
            if (delQuotesErr) console.error('  match_quotes 삭제 실패:', delQuotesErr.message);

            const { error: delLedgerErr } = await supabase
                .from('cash_ledger')
                .delete()
                .eq('reference_id', testRequestId)
                .eq('tx_type', 'DEDUCT_QUOTE');
            if (delLedgerErr) console.error('  cash_ledger 삭제 실패:', delLedgerErr.message);

            const { error: delReqErr } = await supabase
                .from('match_requests')
                .delete()
                .eq('request_id', testRequestId);
            if (delReqErr) console.error('  match_requests 삭제 실패:', delReqErr.message);

            console.log('🧹 테스트 데이터 정리 완료');
        }
    }
}

run().catch(err => {
    console.error('❌ 스크립트 오류:', err);
    process.exit(1);
});
