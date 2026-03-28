const { Client } = require("pg");

const connectionString =
  process.env.DIRECT_URL ||
  "postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

async function runResetAndVerify() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to the database. Starting reset transaction...");

    const resetSql = `
      BEGIN;

      -- 2단계: 자식 -> 부모 순으로 데이터 완전 삭제 (Users, Pro_Profiles 유지)
      DELETE FROM notifications;
      DELETE FROM reviews;
      DELETE FROM chat_messages;
      DELETE FROM chat_rooms;
      DELETE FROM match_quotes;
      DELETE FROM match_requests;
      DELETE FROM cash_ledger;

      -- 4단계: 원장 무결성 동기화 리셋 (Pro_Profiles 일괄 업데이트)
      UPDATE Pro_Profiles SET current_cash = 10000;

      -- 5단계: 업데이트된 고수 목록을 기반으로 Cash_Ledger 초기 내역 Bulk Insert
      INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id, created_at)
      SELECT pro_id, 'BONUS'::tx_type, 10000, 10000, NULL, NOW()
      FROM Pro_Profiles;

      COMMIT;
    `;

    await client.query(resetSql);
    console.log("Transaction Committed Successfully.");

    console.log("\n=== 시작: 무결성 자가 검증 ===");

    // 검증 A: 각 테이블의 Row Count가 '0'인지 확인
    const tablesToCheck = [
      "notifications",
      "reviews",
      "chat_messages",
      "chat_rooms",
      "match_quotes",
      "match_requests",
    ];

    console.log("[검증 A: 삭제된 테이블의 Row Count 0 확인]");
    for (const table of tablesToCheck) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`- ${table}: ${res.rows[0].count} rows`);
    }

    // 검증 B: Pro_Profiles current_cash 총합과 Cash_Ledger BONUS amount 총합 비교
    console.log(
      "\n[검증 B: 원장 정합성 (Pro_Profiles vs Cash_Ledger 총합 대조)]",
    );

    const profilesRes = await client.query(
      "SELECT SUM(current_cash) as total_cash FROM Pro_Profiles",
    );
    const totalCash = profilesRes.rows[0].total_cash || 0;

    const ledgerRes = await client.query(
      "SELECT SUM(amount) as total_bonus FROM Cash_Ledger WHERE tx_type = 'BONUS'",
    );
    const totalBonus = ledgerRes.rows[0].total_bonus || 0;

    console.log(`- Pro_Profiles 총 current_cash: ${totalCash}`);
    console.log(`- Cash_Ledger 총 tx_type='BONUS' amount: ${totalBonus}`);

    if (totalCash === totalBonus) {
      console.log(
        "✅ 검증 B 통과: Pro_Profiles와 Cash_Ledger의 총합이 1:1로 일치합니다.",
      );
    } else {
      console.log("❌ 검증 B 실패: 총합이 일치하지 않습니다!");
    }

    console.log(
      "\n=== 완료: 모든 초기화 스크립트 및 검증이 완료되었습니다. ===",
    );
  } catch (error) {
    console.error("Error executing script:", error);
    // 롤백을 시도 (BEGIN 블록 내에서 실패한 경우 대비)
    try {
      await client.query("ROLLBACK;");
      console.log("Transaction Rolled Back.");
    } catch (e) {
      console.error("Rollback failed:", e);
    }
  } finally {
    await client.end();
  }
}

runResetAndVerify();
