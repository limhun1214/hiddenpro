-- =====================================================================
-- 원클릭 테스트 데이터 초기화 RPC (백업 + 트리거 제어 + FK 역순 삭제)
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================================

CREATE OR REPLACE FUNCTION reset_test_transaction_data()
RETURNS JSONB AS $$
DECLARE
    v_deleted_counts JSONB := '{}'::JSONB;
    v_cnt BIGINT;
BEGIN
    -- ═══════════════════════════════════════════════════
    -- Phase 0: 백업 스냅샷 생성 (롤백 보장)
    -- 기존 백업 테이블 존재 시 DROP 후 재생성
    -- ═══════════════════════════════════════════════════
    DROP TABLE IF EXISTS backup_reviews_temp;
    CREATE TABLE backup_reviews_temp AS SELECT * FROM reviews;

    DROP TABLE IF EXISTS backup_chat_messages_temp;
    CREATE TABLE backup_chat_messages_temp AS SELECT * FROM chat_messages;

    DROP TABLE IF EXISTS backup_chat_rooms_temp;
    CREATE TABLE backup_chat_rooms_temp AS SELECT * FROM chat_rooms;

    DROP TABLE IF EXISTS backup_match_quotes_temp;
    CREATE TABLE backup_match_quotes_temp AS SELECT * FROM match_quotes;

    DROP TABLE IF EXISTS backup_notifications_temp;
    CREATE TABLE backup_notifications_temp AS SELECT * FROM notifications;

    DROP TABLE IF EXISTS backup_cash_ledger_temp;
    CREATE TABLE backup_cash_ledger_temp AS SELECT * FROM cash_ledger;

    DROP TABLE IF EXISTS backup_match_requests_temp;
    CREATE TABLE backup_match_requests_temp AS SELECT * FROM match_requests;

    DROP TABLE IF EXISTS backup_admin_action_logs_temp;
    CREATE TABLE backup_admin_action_logs_temp AS SELECT * FROM admin_action_logs;

    DROP TABLE IF EXISTS backup_inquiries_temp;
    CREATE TABLE backup_inquiries_temp AS SELECT * FROM inquiries;

    DROP TABLE IF EXISTS backup_pro_quote_templates_temp;
    CREATE TABLE backup_pro_quote_templates_temp AS SELECT * FROM pro_quote_templates;

    -- pro_profiles 캐시 상태 백업
    DROP TABLE IF EXISTS backup_pro_profiles_cash_temp;
    CREATE TABLE backup_pro_profiles_cash_temp AS
        SELECT pro_id, current_cash, bonus_cash FROM pro_profiles;

    -- user_penalty_stats 상태 백업
    DROP TABLE IF EXISTS backup_user_penalty_stats_temp;
    CREATE TABLE backup_user_penalty_stats_temp AS SELECT * FROM user_penalty_stats;

    -- ═══════════════════════════════════════════════════
    -- Phase 1: 트리거 일시 정지 (DELETE 시 연쇄 반응 방지)
    -- ═══════════════════════════════════════════════════
    ALTER TABLE match_requests DISABLE TRIGGER ALL;
    ALTER TABLE match_quotes DISABLE TRIGGER ALL;

    -- ═══════════════════════════════════════════════════
    -- Phase 2: FK 역순 안전 삭제 (자식 → 부모)
    -- ═══════════════════════════════════════════════════

    -- ① reviews (→ chat_rooms, users)
    DELETE FROM reviews;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('reviews', v_cnt);

    -- ② chat_messages (→ chat_rooms, users)
    DELETE FROM chat_messages;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('chat_messages', v_cnt);

    -- ③ chat_rooms (→ match_requests, users)
    DELETE FROM chat_rooms;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('chat_rooms', v_cnt);

    -- ④ match_quotes (→ match_requests, users)
    DELETE FROM match_quotes;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('match_quotes', v_cnt);

    -- ⑤ notifications
    DELETE FROM notifications;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('notifications', v_cnt);

    -- ⑥ cash_ledger (→ pro_profiles)
    DELETE FROM cash_ledger;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('cash_ledger', v_cnt);

    -- ⑦ match_requests (→ users)
    DELETE FROM match_requests;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('match_requests', v_cnt);

    -- ⑧ admin_action_logs (→ users)
    DELETE FROM admin_action_logs;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('admin_action_logs', v_cnt);

    -- ⑨ inquiries (→ auth.users)
    DELETE FROM inquiries;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('inquiries', v_cnt);

    -- ⑩ pro_quote_templates (→ users)
    DELETE FROM pro_quote_templates;
    GET DIAGNOSTICS v_cnt = ROW_COUNT;
    v_deleted_counts := v_deleted_counts || jsonb_build_object('pro_quote_templates', v_cnt);

    -- ═══════════════════════════════════════════════════
    -- Phase 3: 상태 초기화 (행 보존, 값만 리셋)
    -- ═══════════════════════════════════════════════════

    -- 고수 캐시 잔액 0으로 리셋
    UPDATE pro_profiles SET current_cash = 0, bonus_cash = 0;

    -- 어뷰징 통계 전면 초기화
    UPDATE user_penalty_stats SET
        consecutive_noshow = 0,
        total_read_quotes = 0,
        total_requests = 0,
        total_matched = 0,
        is_flagged = false,
        flagged_at = NULL,
        unflagged_by = NULL,
        unflagged_at = NULL,
        updated_at = NOW();

    -- 유저 계정 상태 정상화 (정지 해제)
    UPDATE users SET
        status = 'ACTIVE',
        suspension_reason = NULL
    WHERE status != 'ACTIVE';

    -- ═══════════════════════════════════════════════════
    -- Phase 4: 트리거 정상 복구
    -- ═══════════════════════════════════════════════════
    ALTER TABLE match_requests ENABLE TRIGGER ALL;
    ALTER TABLE match_quotes ENABLE TRIGGER ALL;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_counts', v_deleted_counts,
        'message', '모든 활동 데이터가 초기화되었습니다. 백업 테이블(backup_*_temp)에 스냅샷이 보존되어 있습니다.'
    );

EXCEPTION WHEN OTHERS THEN
    -- 에러 발생 시 트리거 반드시 복구
    ALTER TABLE match_requests ENABLE TRIGGER ALL;
    ALTER TABLE match_quotes ENABLE TRIGGER ALL;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
