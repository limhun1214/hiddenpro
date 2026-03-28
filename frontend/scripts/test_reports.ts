// 실행: npx tsx scripts/test_reports.ts
// 목적: 신고 관리 기능 전체 플로우 검증
// 검증 항목:
//   1. 신고 INSERT → reports 테이블 정상 저장
//   2. 제재 처리 → users.status/suspension_type/suspended_until 정상 업데이트
//   3. 신고 상태 → reviewed 업데이트 + admin_note 저장
//   4. 알림 발송 → notifications 테이블 정상 INSERT (신고자/피신고자 각 1건)
//   5. 채팅방 CLOSED → chat_rooms.status 정상 업데이트

import * as fs from "fs";
import * as path from "path";

// .env.local 파싱
const envPath = path.resolve(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed
    .slice(eqIdx + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
  env[key] = val;
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL 또는 SERVICE_ROLE_KEY 누락");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  Prefer: "return=representation",
};

async function query(path: string, method = "GET", body?: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: body ? headers : { ...headers, Prefer: "" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    data: text ? JSON.parse(text) : null,
  };
}

// 테스트 데이터 ID 추적 (cleanup용)
const cleanup = {
  reportId: "",
  roomId: "",
  reporterNotifId: "",
  reportedNotifId: "",
  testReporterId: "",
  testReportedId: "",
  testRoomId: "",
};

let pass = 0;
let fail = 0;

function ok(label: string) {
  console.log(`  ✅ ${label}`);
  pass++;
}

function ng(label: string, detail?: any) {
  console.log(`  ❌ ${label}`, detail || "");
  fail++;
}

async function main() {
  console.log("\n🧪 신고 관리 기능 테스트 시작\n");

  // ── 테스트용 유저 조회 (신고자: CUSTOMER, 피신고자: PRO) ──
  const { data: customers } = await query(
    "users?role=eq.CUSTOMER&limit=1&select=user_id,nickname,name,status",
  );
  const { data: proUsers } = await query(
    "users?role=eq.PRO&limit=1&select=user_id,nickname,name,status",
  );
  if (!customers || customers.length < 1) {
    console.error("❌ 테스트용 CUSTOMER 유저 부족. 테스트 중단.");
    process.exit(1);
  }
  if (!proUsers || proUsers.length < 1) {
    console.error("❌ 테스트용 PRO 유저 부족. 테스트 중단.");
    process.exit(1);
  }
  const reporter = customers[0];
  const reported = proUsers[0];
  cleanup.testReporterId = reporter.user_id;
  cleanup.testReportedId = reported.user_id;
  console.log(`👤 신고자 (CUSTOMER): ${reporter.nickname || reporter.name}`);
  console.log(`👤 피신고자 (PRO): ${reported.nickname || reported.name}\n`);

  // ── 테스트용 채팅방 생성 ──
  const { data: roomData } = await query("chat_rooms", "POST", {
    customer_id: reporter.user_id,
    pro_id: reported.user_id,
    status: "OPEN",
  });
  if (!roomData?.[0]?.room_id) {
    console.error("❌ 테스트용 채팅방 생성 실패:", JSON.stringify(roomData));
    process.exit(1);
  }
  cleanup.testRoomId = roomData[0].room_id;
  cleanup.roomId = roomData[0].room_id;
  console.log(`💬 테스트 채팅방 생성: ${cleanup.roomId}\n`);

  try {
    // ── STEP 1: 신고 INSERT ──
    console.log("STEP 1: 신고 INSERT");
    const { ok: rOk, data: rData } = await query("reports", "POST", {
      room_id: cleanup.roomId,
      reporter_id: reporter.user_id,
      reported_user_id: reported.user_id,
      reason: "[테스트] 부적절한 언행",
      status: "pending",
    });
    if (rOk && rData?.[0]?.id) {
      cleanup.reportId = rData[0].id;
      ok(`reports INSERT 성공 (id: ${cleanup.reportId})`);
    } else {
      ng("reports INSERT 실패", rData);
    }

    // ── STEP 2: 제재 처리 (임시정지 3일) ──
    console.log("\nSTEP 2: 제재 처리 (임시정지 3일)");
    const suspendedUntil = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { ok: uOk, data: uData } = await query(
      `users?user_id=eq.${reported.user_id}`,
      "PATCH",
      {
        status: "SUSPENDED",
        suspension_type: "temporary",
        suspension_reason: "[테스트] 신고 제재",
        suspended_until: suspendedUntil,
      },
    );
    if (uOk) {
      ok("users.status SUSPENDED 업데이트 성공");
    } else {
      ng("users 제재 업데이트 실패", uData);
    }

    // 제재 결과 검증
    const { data: verifyUser } = await query(
      `users?user_id=eq.${reported.user_id}&select=status,suspension_type,suspended_until`,
    );
    if (
      verifyUser?.[0]?.status === "SUSPENDED" &&
      verifyUser[0].suspension_type === "temporary"
    ) {
      ok("제재 상태 DB 반영 확인 (SUSPENDED / temporary)");
    } else {
      ng("제재 상태 DB 반영 실패", verifyUser?.[0]);
    }

    // ── STEP 3: 신고 상태 reviewed 업데이트 ──
    console.log("\nSTEP 3: 신고 상태 reviewed 업데이트");
    if (cleanup.reportId) {
      const { ok: rvOk } = await query(
        `reports?id=eq.${cleanup.reportId}`,
        "PATCH",
        {
          status: "reviewed",
          admin_note: "[테스트] 신고 처리 완료",
          reviewed_at: new Date().toISOString(),
        },
      );
      if (rvOk) {
        ok("reports.status reviewed 업데이트 성공");
      } else {
        ng("reports.status reviewed 업데이트 실패");
      }

      // 검증
      const { data: verifyReport } = await query(
        `reports?id=eq.${cleanup.reportId}&select=status,admin_note`,
      );
      if (
        verifyReport?.[0]?.status === "reviewed" &&
        verifyReport[0].admin_note
      ) {
        ok("신고 reviewed 상태 DB 반영 확인");
      } else {
        ng("신고 reviewed 상태 DB 반영 실패", verifyReport?.[0]);
      }
    }

    // ── STEP 4: 알림 발송 (피신고자 + 신고자) ──
    console.log("\nSTEP 4: 알림 발송");
    const { ok: n1Ok, data: n1Data } = await query("notifications", "POST", {
      user_id: reported.user_id,
      type: "SYSTEM",
      message: "[테스트] 귀하의 계정에 3일 임시정지 처리가 되었습니다.",
      reference_id: cleanup.reportId || undefined,
    });
    if (n1Ok && n1Data?.[0]?.id) {
      cleanup.reportedNotifId = n1Data[0].id;
      ok("피신고자 알림 INSERT 성공");
    } else {
      ng("피신고자 알림 INSERT 실패", n1Data);
    }

    const { ok: n2Ok, data: n2Data } = await query("notifications", "POST", {
      user_id: reporter.user_id,
      type: "SYSTEM",
      message: "[테스트] 신고하신 내용이 검토되어 처리 완료되었습니다.",
      reference_id: cleanup.reportId || undefined,
    });
    if (n2Ok && n2Data?.[0]?.id) {
      cleanup.reporterNotifId = n2Data[0].id;
      ok("신고자 알림 INSERT 성공");
    } else {
      ng("신고자 알림 INSERT 실패", n2Data);
    }

    // ── STEP 5: 채팅방 CLOSED 처리 ──
    console.log("\nSTEP 5: 채팅방 CLOSED 처리");
    const { ok: cOk } = await query(
      `chat_rooms?room_id=eq.${cleanup.roomId}`,
      "PATCH",
      { status: "CLOSED" },
    );
    if (cOk) {
      ok("chat_rooms.status CLOSED 업데이트 성공");
    } else {
      ng("chat_rooms.status CLOSED 업데이트 실패");
    }

    // 검증
    const { data: verifyRoom } = await query(
      `chat_rooms?room_id=eq.${cleanup.roomId}&select=status`,
    );
    if (verifyRoom?.[0]?.status === "CLOSED") {
      ok("채팅방 CLOSED DB 반영 확인");
    } else {
      ng("채팅방 CLOSED DB 반영 실패", verifyRoom?.[0]);
    }
  } finally {
    // ── 테스트 데이터 정리 ──
    console.log("\n🧹 테스트 데이터 정리 중...");

    if (cleanup.reporterNotifId)
      await query(`notifications?id=eq.${cleanup.reporterNotifId}`, "DELETE");
    if (cleanup.reportedNotifId)
      await query(`notifications?id=eq.${cleanup.reportedNotifId}`, "DELETE");
    if (cleanup.reportId)
      await query(`reports?id=eq.${cleanup.reportId}`, "DELETE");
    if (cleanup.testRoomId)
      await query(`chat_rooms?room_id=eq.${cleanup.testRoomId}`, "DELETE");

    // 피신고자 제재 원복
    await query(`users?user_id=eq.${cleanup.testReportedId}`, "PATCH", {
      status: reported.status || "ACTIVE",
      suspension_type: null,
      suspension_reason: null,
      suspended_until: null,
    });

    console.log("🧹 정리 완료\n");

    // ── 최종 결과 ──
    console.log("─────────────────────────────");
    console.log(`결과: ✅ ${pass}개 통과 / ❌ ${fail}개 실패`);
    if (fail === 0) {
      console.log("✅ 신고 관리 기능 전체 플로우 정상 작동 확인\n");
    } else {
      console.log("❌ 일부 항목 실패 — 위 로그 확인 필요\n");
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error("❌ 테스트 중 예외 발생:", e);
  process.exit(1);
});
