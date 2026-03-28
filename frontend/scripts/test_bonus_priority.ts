// 실행: npx tsx scripts/test_bonus_priority.ts
//
// 목적: send_quote_and_deduct_cash RPC 보너스 캐시 우선 차감 로직 검증
// 주의: Supabase SQL Editor에서 migration 파일(20260309000001_fix_send_quote_bonus_priority.sql)
//       내용 실행 후 이 스크립트를 실행하세요.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ── .env.local 파싱 ──
const envPath = path.resolve(__dirname, "../.env.local");
const envFile = fs.readFileSync(envPath, "utf8");
let supabaseUrl = "";
let serviceRoleKey = "";

const SERVICE_ROLE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
];

envFile.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (trimmed.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) {
    supabaseUrl = trimmed.split("=").slice(1).join("=").replace(/^"|"$/g, "");
  }
  for (const keyName of SERVICE_ROLE_KEY_NAMES) {
    if (trimmed.startsWith(`${keyName}=`)) {
      serviceRoleKey = trimmed
        .split("=")
        .slice(1)
        .join("=")
        .replace(/^"|"$/g, "");
      break;
    }
  }
});

if (!supabaseUrl) {
  console.error(
    "❌ .env.local 에서 NEXT_PUBLIC_SUPABASE_URL 을 찾을 수 없습니다.",
  );
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error("❌ .env.local 에서 Service Role Key 를 찾을 수 없습니다.");
  SERVICE_ROLE_KEY_NAMES.forEach((k) =>
    console.error(`   ${k}=<your-service-role-key>`),
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface TestCase {
  label: string;
  bonusBefore: number;
  realBefore: number;
  deductAmount: number;
  expectedBonus: number;
  expectedReal: number;
  expectedLedgerCount: number;
  expectedLedgerTypes: string[];
}

const TEST_CASES: TestCase[] = [
  {
    label: "케이스 1: bonus 300 + real 500, 차감 400",
    bonusBefore: 300,
    realBefore: 500,
    deductAmount: 400,
    expectedBonus: 0,
    expectedReal: 400,
    expectedLedgerCount: 2,
    expectedLedgerTypes: ["DEDUCT_BONUS_QUOTE", "DEDUCT_QUOTE"],
  },
  {
    label: "케이스 2: bonus 500 + real 0, 차감 400",
    bonusBefore: 500,
    realBefore: 0,
    deductAmount: 400,
    expectedBonus: 100,
    expectedReal: 0,
    expectedLedgerCount: 1,
    expectedLedgerTypes: ["DEDUCT_BONUS_QUOTE"],
  },
  {
    label: "케이스 3: bonus 0 + real 500, 차감 400",
    bonusBefore: 0,
    realBefore: 500,
    deductAmount: 400,
    expectedBonus: 0,
    expectedReal: 100,
    expectedLedgerCount: 1,
    expectedLedgerTypes: ["DEDUCT_QUOTE"],
  },
];

async function run() {
  // ── 사전 준비: 활성 고수 1명 + 카테고리 조회 ──
  const [proResult, catResult] = await Promise.all([
    supabase
      .from("pro_profiles")
      .select("pro_id, current_cash, bonus_cash")
      .eq("is_accepting_requests", true)
      .limit(1)
      .single(),
    supabase.from("categories").select("id").limit(1).single(),
  ]);

  if (proResult.error || !proResult.data) {
    console.error(
      "❌ 활성 고수 계정을 찾을 수 없습니다:",
      proResult.error?.message,
    );
    process.exit(1);
  }
  if (catResult.error || !catResult.data) {
    console.error(
      "❌ categories 테이블에서 카테고리를 찾을 수 없습니다:",
      catResult.error?.message,
    );
    process.exit(1);
  }

  const testProId: string = proResult.data.pro_id;
  const testCategoryId: string = catResult.data.id;
  const originalCash = {
    bonus: proResult.data.bonus_cash ?? 0,
    real: proResult.data.current_cash ?? 0,
  };

  // 고객 ID 조회
  const { data: custData, error: custErr } = await supabase
    .from("users")
    .select("user_id")
    .eq("role", "CUSTOMER")
    .eq("status", "ACTIVE")
    .limit(1)
    .single();
  if (custErr || !custData) {
    console.error("❌ 활성 고객 계정을 찾을 수 없습니다:", custErr?.message);
    process.exit(1);
  }
  const testCustomerId: string = custData.user_id;

  console.log(
    `\n🎯 테스트 고수: ${testProId.slice(0, 8)}... (원래 캐시: bonus=${originalCash.bonus}, real=${originalCash.real})\n`,
  );

  let allPassed = true;

  for (const tc of TEST_CASES) {
    let testRequestId: string | null = null;
    console.log(`\n─────────────────────────────────────`);
    console.log(`▶ ${tc.label}`);
    console.log(
      `  입력: bonus=${tc.bonusBefore}, real=${tc.realBefore}, 차감=${tc.deductAmount}`,
    );
    console.log(
      `  예상: bonus=${tc.expectedBonus}, real=${tc.expectedReal}, ledger ${tc.expectedLedgerCount}건 ${tc.expectedLedgerTypes.join("+")}`,
    );

    try {
      // STEP 1: 캐시 강제 설정
      const { error: setErr } = await supabase
        .from("pro_profiles")
        .update({ bonus_cash: tc.bonusBefore, current_cash: tc.realBefore })
        .eq("pro_id", testProId);
      if (setErr) {
        console.log(`  ❌ 캐시 강제 설정 실패: ${setErr.message}`);
        allPassed = false;
        continue;
      }

      // STEP 2: 테스트 요청서 생성
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: reqData, error: reqErr } = await supabase
        .from("match_requests")
        .insert({
          customer_id: testCustomerId,
          category_id: testCategoryId,
          region_id: 1,
          service_type: `[TEST] 보너스우선차감_${tc.label}`,
          region: "Test Region",
          dynamic_answers: { test: true },
          status: "OPEN",
          expires_at: expiresAt,
        })
        .select("request_id")
        .single();
      if (reqErr || !reqData) {
        console.log(`  ❌ 요청서 생성 실패: ${reqErr?.message}`);
        allPassed = false;
        continue;
      }
      testRequestId = reqData.request_id;

      // STEP 3: RPC 호출
      const { error: rpcErr } = await supabase.rpc(
        "send_quote_and_deduct_cash",
        {
          p_pro_id: testProId,
          p_request_id: testRequestId,
          p_deduct_amount: tc.deductAmount,
          p_price: 100,
          p_description: `[TEST] ${tc.label}`,
          p_image_url: null,
        },
      );
      if (rpcErr) {
        console.log(`  ❌ RPC 실패: ${rpcErr.message}`);
        allPassed = false;
        continue;
      }

      // STEP 4: DB 결과 조회 (N+1 방지: 동시 조회)
      const [proAfter, ledgerAfter] = await Promise.all([
        supabase
          .from("pro_profiles")
          .select("current_cash, bonus_cash")
          .eq("pro_id", testProId)
          .single(),
        supabase
          .from("cash_ledger")
          .select("tx_type, amount")
          .eq("reference_id", testRequestId)
          .order("created_at", { ascending: true }),
      ]);

      const actualBonus = proAfter.data?.bonus_cash ?? -1;
      const actualReal = proAfter.data?.current_cash ?? -1;
      const actualLedger = ledgerAfter.data || [];

      const bonusOk = actualBonus === tc.expectedBonus;
      const realOk = actualReal === tc.expectedReal;
      const ledgerCountOk = actualLedger.length === tc.expectedLedgerCount;
      const ledgerTypesOk = tc.expectedLedgerTypes.every((t) =>
        actualLedger.some((r: any) => r.tx_type === t),
      );
      const passed = bonusOk && realOk && ledgerCountOk && ledgerTypesOk;

      if (!passed) allPassed = false;

      console.log(
        `  결과: bonus=${actualBonus} ${bonusOk ? "✅" : `❌(예상 ${tc.expectedBonus})`}, real=${actualReal} ${realOk ? "✅" : `❌(예상 ${tc.expectedReal})`}`,
      );
      console.log(
        `  원장: ${actualLedger.length}건 ${actualLedger.map((r: any) => `${r.tx_type}(${r.amount})`).join(", ")} ${ledgerCountOk && ledgerTypesOk ? "✅" : "❌"}`,
      );
      console.log(passed ? `  ✅ PASS` : `  ❌ FAIL`);
    } finally {
      // STEP 5: 테스트 데이터 정리
      if (testRequestId) {
        await supabase
          .from("cash_ledger")
          .delete()
          .eq("reference_id", testRequestId);
        await supabase
          .from("match_quotes")
          .delete()
          .eq("request_id", testRequestId);
        await supabase
          .from("match_requests")
          .delete()
          .eq("request_id", testRequestId);
      }
    }
  }

  // 최종: 고수 캐시 원복
  console.log(`\n─────────────────────────────────────`);
  console.log(
    `🧹 고수 캐시 원복 중... (bonus=${originalCash.bonus}, real=${originalCash.real})`,
  );
  await supabase
    .from("pro_profiles")
    .update({ bonus_cash: originalCash.bonus, current_cash: originalCash.real })
    .eq("pro_id", testProId);
  console.log(`🧹 원복 완료`);

  console.log(`\n═════════════════════════════════════`);
  console.log(
    allPassed
      ? `✅ 전체 테스트 통과 — 보너스 우선 차감 로직 정상 동작`
      : `❌ 일부 테스트 실패 — 결과 확인 필요`,
  );
  console.log(`═════════════════════════════════════\n`);
}

run().catch((err) => {
  console.error("❌ 스크립트 오류:", err);
  process.exit(1);
});
