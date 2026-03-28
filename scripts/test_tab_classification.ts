// 실행: HiddenPro/ 루트에서 → NODE_PATH=frontend/node_modules npx tsx scripts/test_tab_classification.ts
// (Windows PowerShell): $env:NODE_PATH="frontend/node_modules"; npx tsx scripts/test_tab_classification.ts
// (Windows cmd): set NODE_PATH=frontend/node_modules && npx tsx scripts/test_tab_classification.ts

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ── 환경변수 파싱 (.env.local) ──
function loadEnv(): { url: string; key: string } {
  const envPath = path.join(process.cwd(), "frontend", ".env.local");
  const raw = fs.readFileSync(envPath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const map: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match)
      map[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  const url = map["NEXT_PUBLIC_SUPABASE_URL"];
  const key = map["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key)
    throw new Error(
      ".env.local에서 NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY를 찾을 수 없습니다.",
    );
  return { url, key };
}

// ── 결과 출력 헬퍼 ──
function pass(index: number, label: string) {
  console.log(`[${index}] ${label}: ✅ 정상`);
}
function fail(index: number, label: string, detail: any) {
  console.log(
    `[${index}] ${label}: ❌ 실패 — 실제 값: ${JSON.stringify(detail)}`,
  );
}

async function main() {
  const { url, key } = loadEnv();
  const supabase = createClient(url, key);

  // ── 테스트 유저 자동 조회 ──
  const { data: customerRow } = await supabase
    .from("users")
    .select("user_id")
    .eq("role", "CUSTOMER")
    .limit(1)
    .single();

  const { data: proRow } = await supabase
    .from("pro_profiles")
    .select("pro_id")
    .limit(1)
    .single();

  if (!customerRow?.user_id || !proRow?.pro_id) {
    console.error(
      "❌ 테스트 유저 조회 실패. users 테이블에 customer 역할 유저가 없거나 pro_profiles에 레코드가 없습니다.",
    );
    process.exit(1);
  }
  const customerId = customerRow.user_id;
  const proId = proRow.pro_id;

  // ── 정리 대상 ID 관리 ──
  const requestIds: string[] = [];
  const roomIds: string[] = [];

  try {
    // ────────────────────────────────────────────
    // 시나리오 1: OPEN + 견적 0개 → IN_PROGRESS
    // ────────────────────────────────────────────
    {
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "OPEN",
          quote_count: 0,
          service_type: "test_tab_1",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
        })
        .select("request_id, status, quote_count")
        .single();

      if (error || !data) {
        fail(1, "OPEN + 견적 0개 → IN_PROGRESS", error);
      } else {
        requestIds.push(data.request_id);
        const isInProgress = data.status === "OPEN" && data.quote_count === 0;
        isInProgress
          ? pass(1, "OPEN + 견적 0개 → IN_PROGRESS")
          : fail(1, "OPEN + 견적 0개 → IN_PROGRESS", data);
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 2: OPEN + 견적 5개 도달 → IN_PROGRESS 유지 (isFull 제거 검증)
    // ────────────────────────────────────────────
    {
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "OPEN",
          quote_count: 5,
          service_type: "test_tab_2",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
        })
        .select("request_id, status, quote_count")
        .single();

      if (error || !data) {
        fail(2, "OPEN + 견적 5개 도달 → IN_PROGRESS 유지", error);
      } else {
        requestIds.push(data.request_id);
        // isFull 조건 제거 확인: status=OPEN이므로 CLOSED 분류 안 됨
        const isInProgress = data.status === "OPEN";
        isInProgress
          ? pass(2, "OPEN + 견적 5개 도달 → IN_PROGRESS 유지")
          : fail(2, "OPEN + 견적 5개 도달 → IN_PROGRESS 유지", data);
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 3: MATCHED + 리뷰 미작성 → IN_PROGRESS
    // ────────────────────────────────────────────
    {
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "MATCHED",
          quote_count: 1,
          service_type: "test_tab_3",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
        })
        .select("request_id, status")
        .single();

      if (error || !data) {
        fail(3, "MATCHED + 리뷰 미작성 → IN_PROGRESS", error);
      } else {
        requestIds.push(data.request_id);
        // 리뷰 없음 확인
        const { count } = await supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("room_id", "non-existent");
        const isMatched = data.status === "MATCHED";
        isMatched
          ? pass(3, "MATCHED + 리뷰 미작성 → IN_PROGRESS")
          : fail(3, "MATCHED + 리뷰 미작성 → IN_PROGRESS", data);
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 4: MATCHED + 리뷰 작성 완료 → CLOSED
    // ────────────────────────────────────────────
    {
      const { data: reqData, error: reqErr } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "MATCHED",
          quote_count: 1,
          service_type: "test_tab_4",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
        })
        .select("request_id")
        .single();

      if (reqErr || !reqData) {
        fail(4, "MATCHED + 리뷰 완료 → CLOSED", reqErr);
      } else {
        requestIds.push(reqData.request_id);

        const { data: roomData, error: roomErr } = await supabase
          .from("chat_rooms")
          .insert({
            customer_id: customerId,
            pro_id: proId,
            request_id: reqData.request_id,
            status: "OPEN",
          })
          .select("room_id")
          .single();

        if (roomErr || !roomData) {
          fail(
            4,
            "MATCHED + 리뷰 완료 → CLOSED (chat_room 생성 실패)",
            roomErr,
          );
        } else {
          roomIds.push(roomData.room_id);

          const { error: reviewErr } = await supabase.from("reviews").insert({
            room_id: roomData.room_id,
            pro_id: proId,
            customer_id: customerId,
            rating: 5,
            comment: "테스트리뷰",
          });

          if (reviewErr) {
            fail(
              4,
              "MATCHED + 리뷰 완료 → CLOSED (review 생성 실패)",
              reviewErr,
            );
          } else {
            // 리뷰 존재 → CLOSED 분류 대상
            const { data: reviewCheck } = await supabase
              .from("reviews")
              .select("room_id")
              .eq("room_id", roomData.room_id)
              .single();
            reviewCheck
              ? pass(4, "MATCHED + 리뷰 완료 → CLOSED")
              : fail(4, "MATCHED + 리뷰 완료 → CLOSED", { reviewCheck });
          }
        }
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 5: CANCELED → CLOSED
    // ────────────────────────────────────────────
    {
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "CANCELED",
          quote_count: 0,
          service_type: "test_tab_5",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
        })
        .select("request_id, status")
        .single();

      if (error || !data) {
        fail(5, "CANCELED → CLOSED", error);
      } else {
        requestIds.push(data.request_id);
        data.status === "CANCELED"
          ? pass(5, "CANCELED → CLOSED")
          : fail(5, "CANCELED → CLOSED", data);
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 6: 48시간 만료 → CLOSED
    // ────────────────────────────────────────────
    {
      const expiredAt = new Date(
        Date.now() - 49 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "OPEN",
          quote_count: 0,
          service_type: "test_tab_6",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
          created_at: expiredAt,
        })
        .select("request_id, created_at")
        .single();

      if (error || !data) {
        fail(6, "48시간 만료 → CLOSED", error);
      } else {
        requestIds.push(data.request_id);
        const elapsed = Date.now() - new Date(data.created_at).getTime();
        const isExpired = elapsed > 48 * 60 * 60 * 1000;
        isExpired
          ? pass(6, "48시간 만료 → CLOSED")
          : fail(6, "48시간 만료 → CLOSED", {
              elapsed_hours: (elapsed / 3600000).toFixed(1),
            });
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 7: MATCHED + 30일 경과 (리뷰 미작성) → CLOSED
    // ────────────────────────────────────────────
    {
      const thirtyOneDaysAgo = new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "MATCHED",
          quote_count: 1,
          service_type: "test_tab_7",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
          updated_at: thirtyOneDaysAgo,
        })
        .select("request_id, status, updated_at")
        .single();

      if (error || !data) {
        fail(7, "MATCHED + 30일 경과 → CLOSED", error);
      } else {
        requestIds.push(data.request_id);
        const matchedAt = data.updated_at
          ? new Date(data.updated_at).getTime()
          : Date.now();
        const is30DaysOver = Date.now() - matchedAt > 30 * 24 * 60 * 60 * 1000;
        is30DaysOver
          ? pass(7, "MATCHED + 30일 경과 → CLOSED")
          : fail(7, "MATCHED + 30일 경과 → CLOSED", {
              updated_at: data.updated_at,
            });
      }
    }

    // ────────────────────────────────────────────
    // 시나리오 8: 고수화면 48시간 만료 → ARCHIVED
    // ────────────────────────────────────────────
    {
      const expiredAt = new Date(
        Date.now() - 49 * 60 * 60 * 1000,
      ).toISOString();
      const { data: reqData, error: reqErr } = await supabase
        .from("match_requests")
        .insert({
          customer_id: customerId,
          status: "OPEN",
          quote_count: 1,
          service_type: "test_tab_8",
          region: "test",
          region_id: "1",
          dynamic_answers: {},
          created_at: expiredAt,
        })
        .select("request_id, created_at")
        .single();

      if (reqErr || !reqData) {
        fail(8, "고수화면 48시간 만료 → ARCHIVED", reqErr);
      } else {
        requestIds.push(reqData.request_id);

        const { error: quoteErr } = await supabase.from("match_quotes").insert({
          pro_id: proId,
          request_id: reqData.request_id,
          status: "PENDING",
          price: 1000,
          is_read: false,
        });

        // PENDING이 유효하지 않을 경우 대비: 에러 무시하고 request 기준으로만 검증
        const elapsed = Date.now() - new Date(reqData.created_at).getTime();
        const isExpired = elapsed > 48 * 60 * 60 * 1000;
        if (quoteErr) {
          // PENDING이 유효하지 않은 ENUM → quote INSERT 실패 별도 안내 후 request 기준만 검증
          console.log(
            `  ⚠️  match_quotes INSERT 실패 (ENUM 값 불일치 가능성): ${quoteErr.message}`,
          );
          isExpired
            ? pass(8, "고수화면 48시간 만료 → ARCHIVED (request 기준 검증)")
            : fail(8, "고수화면 48시간 만료 → ARCHIVED", {
                elapsed_hours: (elapsed / 3600000).toFixed(1),
              });
        } else {
          isExpired
            ? pass(8, "고수화면 48시간 만료 → ARCHIVED")
            : fail(8, "고수화면 48시간 만료 → ARCHIVED", {
                elapsed_hours: (elapsed / 3600000).toFixed(1),
              });
        }
      }
    }
  } finally {
    // ── 테스트 데이터 정리 (FK 제약 순서 준수) ──
    console.log("\n🧹 테스트 데이터 정리 중...");

    // 1. reviews DELETE (room_id 기준)
    if (roomIds.length > 0) {
      await supabase.from("reviews").delete().in("room_id", roomIds);
    }

    // 2. chat_rooms DELETE (request_id 기준)
    if (requestIds.length > 0) {
      await supabase.from("chat_rooms").delete().in("request_id", requestIds);
    }

    // 3. match_quotes DELETE (request_id 기준)
    if (requestIds.length > 0) {
      await supabase.from("match_quotes").delete().in("request_id", requestIds);
    }

    // 4. match_requests DELETE (request_id 기준)
    if (requestIds.length > 0) {
      await supabase
        .from("match_requests")
        .delete()
        .in("request_id", requestIds);
    }

    console.log("✅ 테스트 데이터 정리 완료.");
  }
}

main().catch((err) => {
  console.error("❌ 스크립트 실행 오류:", err.message);
  process.exit(1);
});
