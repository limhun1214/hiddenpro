-- Admin용: RLS를 우회하여 모든 pro_profiles를 조회하는 RPC 함수
-- SECURITY DEFINER로 실행되어 RLS 정책과 무관하게 전체 데이터를 반환합니다.
CREATE OR REPLACE FUNCTION get_all_pro_profiles()
RETURNS SETOF pro_profiles AS $$
BEGIN
  RETURN QUERY SELECT * FROM pro_profiles;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
