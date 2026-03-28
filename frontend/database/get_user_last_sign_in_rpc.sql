-- ═══════════════════════════════════════════════════════
-- auth.users에서 last_sign_in_at을 조회하는 관리자 전용 RPC
-- last_sign_in_at이 NULL인 경우 updated_at을 fallback으로 사용
-- ═══════════════════════════════════════════════════════
-- Supabase SQL Editor에서 실행하십시오.

CREATE OR REPLACE FUNCTION get_user_last_sign_in(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, last_sign_in_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT au.id AS user_id,
           COALESCE(au.last_sign_in_at, au.updated_at) AS last_sign_in_at
    FROM auth.users au
    WHERE au.id = ANY(p_user_ids);
END;
$$;
