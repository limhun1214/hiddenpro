-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
-- 퍼블릭용 프로필 리스트 조회 RPC (N+1 및 권한 블로킹 해결)
CREATE OR REPLACE FUNCTION get_public_pro_list(p_category_slug TEXT DEFAULT 'all')
RETURNS TABLE (
    pro_id UUID,
    nickname TEXT,
    avatar_url TEXT,
    is_phone_verified BOOLEAN,
    review_count INT,
    average_rating NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pp.pro_id,
        pp.nickname,
        pp.avatar_url,
        pp.is_phone_verified,
        COALESCE(pp.review_count, 0) AS review_count,
        COALESCE(pp.average_rating, 0.0) AS average_rating
    FROM public.pro_profiles pp
    WHERE pp.is_accepting_requests = true
    -- 추후 category 로직 연동 가능
    ORDER BY pp.review_count DESC NULLS LAST, pp.average_rating DESC NULLS LAST
    LIMIT 100;
END;
$$;
