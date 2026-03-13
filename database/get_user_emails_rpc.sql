-- ═══════════════════════════════════════════════════════
-- auth.users에서 실제 이메일을 조회하는 관리자 전용 RPC
-- ═══════════════════════════════════════════════════════
-- Supabase SQL Editor에서 실행하십시오.

CREATE OR REPLACE FUNCTION get_user_emails(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT au.id AS user_id, au.email::TEXT AS email
    FROM auth.users au
    WHERE au.id = ANY(p_user_ids);
END;
$$;
