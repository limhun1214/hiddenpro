-- ================================================================
-- get_my_referrals RPC
-- 추천인 기준으로 피추천인 목록 조회 (가입 즉시 표시)
-- SECURITY DEFINER: auth.users 이메일 접근을 위해 RLS 우회
-- ================================================================

CREATE OR REPLACE FUNCTION get_my_referrals(p_referrer_id UUID)
RETURNS TABLE (
  referred_user_id  UUID,
  email             TEXT,
  referred_role     TEXT,
  signed_up_at      TIMESTAMPTZ,
  reward_status     TEXT,
  referrer_reward_type   TEXT,
  referrer_reward_amount INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.user_id                   AS referred_user_id,
    au.email::TEXT              AS email,
    u.role::TEXT                AS referred_role,
    u.created_at                AS signed_up_at,
    rr.status::TEXT             AS reward_status,
    rr.reward_type::TEXT        AS referrer_reward_type,
    rr.amount                   AS referrer_reward_amount
  FROM users u
  LEFT JOIN auth.users au
    ON au.id = u.user_id
  LEFT JOIN referral_rewards rr
    ON rr.referred_user_id = u.user_id
   AND rr.referrer_id = p_referrer_id
  WHERE u.referred_by = p_referrer_id
  ORDER BY u.created_at DESC;
END;
$$;

-- RPC 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_my_referrals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_referrals(UUID) TO anon;
