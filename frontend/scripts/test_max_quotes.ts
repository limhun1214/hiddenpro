// 실행: npx tsx scripts/test_max_quotes.ts
//
// 목적: 관리자 설정 "최대 견적 수신 수" 변경 시 견적 발송 제한 로직에 즉시 반영되는지 검증
// 검증 대상: platform_settings.max_quotes_per_request 변경 → send_quote_and_deduct_cash RPC 반영 여부
// 주의: RPC가 v_max_quotes 를 하드코딩하면 COUNT ≠ 3 → ❌ 설정값 미반영 으로 판정

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
  console.error(
    "   (Supabase 대시보드 → Project Settings → API → service_role 키)",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SETTING_KEY = "max_quotes_per_request";
const TEST_LIMIT = 3; // 변경할 테스트 설정값
const CONCURRENCY = 5; // 동시 발송 고수 수

async function run() {
  let testRequestId: string | null = null;
  let originalValue: number | null = null;

  try {
    // ── STEP 1: 현재 설정값 조회 ──
    const { data: settingData, error: settingErr } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .single();

    if (settingErr || !settingData) {
      console.error(
        "❌ platform_settings 에서 max_quotes_per_request 를 찾을 수 없습니다:",
        settingErr?.message,
      );
      process.exit(1);
    }
    originalValue = Number(settingData.value);
    console.log(`📊 현재 설정값: ${originalValue}`);

    // ── STEP 2: 설정값을 TEST_LIMIT(3)으로 변경 ──
    const { error: updateErr } = await supabase.rpc("update_platform_setting", {
      p_key: SETTING_KEY,
      p_value: TEST_LIMIT,
    });
    if (updateErr) {
      console.error("❌ 설정값 변경 실패:", updateErr.message);
      process.exit(1);
    }
    console.log(`🔧 설정값 → ${TEST_LIMIT} 으로 변경 완료`);

    // ── STEP 3: 테스트용 customer_id + category_id 조회 (N+1 방지: 2건 동시 조회) ──
    const [custResult, catResult] = await Promise.all([
      supabase
        .from("users")
        .select("user_id")
        .eq("role", "CUSTOMER")
        .eq("status", "ACTIVE")
        .limit(1)
        .single(),
      supabase.from("categories").select("id").limit(1).single(),
    ]);

    if (custResult.error || !custResult.data) {
      console.error(
        "❌ 활성 고객 계정을 찾을 수 없습니다:",
        custResult.error?.message,
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
    const testCustomerId: string = custResult.data.user_id;
    const testCategoryId: string = catResult.data.id;

    // ── STEP 3b: 테스트용 match_request INSERT ──
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: reqData, error: reqErr } = await supabase
      .from("match_requests")
      .insert({
        customer_id: testCustomerId,
        category_id: testCategoryId, // UUID
        region_id: 1, // INT
        service_type: "[TEST] 최대견적수_동적설정_테스트",
        region: "Test Region",
        dynamic_answers: { test: true },
        status: "OPEN",
        expires_at: expiresAt,
      })
      .select("request_id")
      .single();

    if (reqErr || !reqData) {
      console.error("❌ 테스트 요청서 생성 실패:", reqErr?.message);
      process.exit(1);
    }
    testRequestId = reqData.request_id;
    console.log(`✅ 테스트 요청서 생성: ${testRequestId}`);

    // ── STEP 4: 활성 고수 5명 조회 ──
    const { data: prosData, error: prosErr } = await supabase
      .from("pro_profiles")
      .select("pro_id")
      .eq("is_accepting_requests", true)
      .limit(CONCURRENCY);

    if (prosErr) {
      console.error("❌ 고수 조회 실패:", prosErr.message);
      process.exit(1);
    }
    if (!prosData || prosData.length < CONCURRENCY) {
      console.error(
        `❌ 활성 고수 계정 부족 (필요: ${CONCURRENCY}명, 확인: ${prosData?.length ?? 0}명)`,
      );
      process.exit(1);
    }
    console.log(`\n👥 활성 고수 ${prosData.length}명 확인`);
    console.log(`🚀 동시 견적 발송 시작 (${CONCURRENCY}명 동시 호출)...\n`);

    // ── STEP 5: CONCURRENCY개 동시 RPC 호출 ──
    const results = await Promise.all(
      prosData.map(async (pro, idx) => {
        try {
          const { data, error } = await supabase.rpc(
            "send_quote_and_deduct_cash",
            {
              p_pro_id: pro.pro_id,
              p_request_id: testRequestId,
              p_deduct_amount: 0,
              p_price: 100,
              p_description: `[TEST] 최대견적수 테스트 #${idx + 1}`,
              p_image_url: null,
            },
          );
          if (error) {
            console.log(
              `  [${idx + 1}] ❌ 실패 - ${pro.pro_id.slice(0, 8)}... : ${error.message}`,
            );
            return { success: false };
          }
          console.log(
            `  [${idx + 1}] ✅ 성공 - ${pro.pro_id.slice(0, 8)}... : quote_id=${String(data).slice(0, 8)}...`,
          );
          return { success: true };
        } catch (e: any) {
          console.log(
            `  [${idx + 1}] ❌ 예외 - ${pro.pro_id.slice(0, 8)}... : ${e.message}`,
          );
          return { success: false };
        }
      }),
    );

    const successCount = results.filter((r) => r.success).length;
    console.log(
      `\n📊 RPC 결과: 성공 ${successCount}건 / 실패 ${results.length - successCount}건`,
    );

    // ── STEP 6: 500ms 대기 후 DB COUNT 검증 ──
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { count, error: countErr } = await supabase
      .from("match_quotes")
      .select("*", { count: "exact", head: true })
      .eq("request_id", testRequestId);

    if (countErr) {
      console.error("❌ COUNT 조회 실패:", countErr.message);
    } else if (count === TEST_LIMIT) {
      console.log(
        `\n✅ 동적 설정 반영 정상 — DB COUNT: ${count} (설정값 ${TEST_LIMIT} 즉시 반영 확인)`,
      );
    } else {
      console.log(`\n❌ 설정값 미반영 — COUNT: ${count} (예상: ${TEST_LIMIT})`);
      if (count === originalValue) {
        console.log(
          `   → RPC 내부에 v_max_quotes 가 하드코딩(${originalValue})되어 있어 platform_settings 변경이 적용되지 않는 것으로 판단됩니다.`,
        );
        console.log(
          `   → 수정 방법: send_quote_and_deduct_cash RPC 에서 platform_settings 테이블의 max_quotes_per_request 값을 동적으로 읽도록 수정 필요.`,
        );
      }
    }
  } finally {
    // ── STEP 7: 정리 (설정값 복구 → 데이터 삭제) ──
    console.log("\n🧹 테스트 데이터 정리 및 설정값 복구 중...");

    // 설정값 원래대로 복구
    if (originalValue !== null) {
      const { error: restoreErr } = await supabase.rpc(
        "update_platform_setting",
        {
          p_key: SETTING_KEY,
          p_value: originalValue,
        },
      );
      if (restoreErr) console.error("  설정값 복구 실패:", restoreErr.message);
      else console.log(`  설정값 → ${originalValue} 복구 완료`);
    }

    // 테스트 견적 데이터 삭제
    if (testRequestId) {
      const { error: delQuotesErr } = await supabase
        .from("match_quotes")
        .delete()
        .eq("request_id", testRequestId);
      if (delQuotesErr)
        console.error("  match_quotes 삭제 실패:", delQuotesErr.message);

      const { error: delLedgerErr } = await supabase
        .from("cash_ledger")
        .delete()
        .eq("reference_id", testRequestId)
        .eq("tx_type", "DEDUCT_QUOTE");
      if (delLedgerErr)
        console.error("  cash_ledger 삭제 실패:", delLedgerErr.message);

      const { error: delReqErr } = await supabase
        .from("match_requests")
        .delete()
        .eq("request_id", testRequestId);
      if (delReqErr)
        console.error("  match_requests 삭제 실패:", delReqErr.message);
    }

    console.log("🧹 테스트 데이터 정리 및 설정값 복구 완료");
  }
}

run().catch((err) => {
  console.error("❌ 스크립트 오류:", err);
  process.exit(1);
});
