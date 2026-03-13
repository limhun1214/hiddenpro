-- 마이그레이션: reset_test_transaction_data SECURITY INVOKER 재정의
-- 문제1: SECURITY DEFINER 설정 시 auth.uid()가 NULL 반환 → ADMIN 검증 항상 실패
-- 문제2: WHERE 조건 없는 DELETE 문이 Supabase 보안 정책에 의해 차단됨 ("DELETE requires a WHERE clause")
-- 해결: SECURITY INVOKER + 모든 DELETE/UPDATE에 WHERE 1=1 조건 추가
-- 적용 방법: Supabase SQL Editor에서 이 파일 전체 내용을 실행하세요.

CREATE OR REPLACE FUNCTION reset_test_transaction_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    caller_role text;
    deleted_counts jsonb := '{}'::jsonb;
    cnt bigint;
BEGIN
    caller_role := get_user_role(auth.uid());
    IF caller_role IS NULL OR upper(caller_role) != 'ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: ADMIN role required (current: %)', coalesce(caller_role, 'NULL');
    END IF;

    DELETE FROM chat_messages WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('chat_messages', cnt);

    DELETE FROM chat_rooms WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('chat_rooms', cnt);

    DELETE FROM match_quotes WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('match_quotes', cnt);

    DELETE FROM match_requests WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('match_requests', cnt);

    DELETE FROM reviews WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('reviews', cnt);

    DELETE FROM cash_ledger WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('cash_ledger', cnt);

    DELETE FROM notifications WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('notifications', cnt);

    BEGIN
        DELETE FROM user_penalty_stats WHERE 1=1;
        GET DIAGNOSTICS cnt = ROW_COUNT;
        deleted_counts := deleted_counts || jsonb_build_object('user_penalty_stats', cnt);
    EXCEPTION WHEN undefined_table THEN
        deleted_counts := deleted_counts || jsonb_build_object('user_penalty_stats', 'table_not_found');
    END;

    BEGIN
        DELETE FROM inquiries WHERE 1=1;
        GET DIAGNOSTICS cnt = ROW_COUNT;
        deleted_counts := deleted_counts || jsonb_build_object('inquiries', cnt);
    EXCEPTION WHEN undefined_table THEN
        deleted_counts := deleted_counts || jsonb_build_object('inquiries', 'table_not_found');
    END;

    BEGIN
        DELETE FROM search_fail_logs WHERE 1=1;
        GET DIAGNOSTICS cnt = ROW_COUNT;
        deleted_counts := deleted_counts || jsonb_build_object('search_fail_logs', cnt);
    EXCEPTION WHEN undefined_table THEN
        deleted_counts := deleted_counts || jsonb_build_object('search_fail_logs', 'table_not_found');
    END;

    UPDATE pro_profiles SET current_cash = 0, bonus_cash = 0 WHERE 1=1;
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('pro_profiles_cash_reset', cnt);

    UPDATE users SET status = 'ACTIVE', suspension_reason = NULL
    WHERE status = 'SUSPENDED';
    GET DIAGNOSTICS cnt = ROW_COUNT;
    deleted_counts := deleted_counts || jsonb_build_object('users_unsuspended', cnt);

    RETURN jsonb_build_object(
        'success', true,
        'deleted', deleted_counts,
        'reset_at', now()
    );
END;
$$;
