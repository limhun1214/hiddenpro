-- 1. Index for faster aggregation
CREATE INDEX IF NOT EXISTS idx_search_fail_logs_keyword ON public.search_fail_logs(keyword);

-- 2. get_search_fail_stats RPC
CREATE OR REPLACE FUNCTION public.get_search_fail_stats(limit_val INT DEFAULT 50)
RETURNS TABLE (
    keyword VARCHAR,
    fail_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT keyword, COUNT(*) as fail_count
    FROM public.search_fail_logs
    GROUP BY keyword
    ORDER BY fail_count DESC
    LIMIT limit_val;
$$;

-- 3. map_search_tag_to_category RPC
CREATE OR REPLACE FUNCTION public.map_search_tag_to_category(target_keyword VARCHAR, target_category VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 선택된 카테고리의 모든 서비스에 새 키워드를 동의어로 추가 (중복 방지)
    UPDATE public.detailed_services
    SET search_tags = ARRAY(
        SELECT DISTINCT unnest(search_tags || ARRAY[target_keyword]::TEXT[])
    )
    WHERE category_title = target_category;

    -- 처리 완료된 키워드를 로그에서 일괄 삭제
    DELETE FROM public.search_fail_logs WHERE keyword = target_keyword;
END;
$$;

-- 4. ignore_search_fail_keyword RPC
CREATE OR REPLACE FUNCTION public.ignore_search_fail_keyword(target_keyword VARCHAR)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 해당 키워드 완전히 삭제
    DELETE FROM public.search_fail_logs WHERE keyword = target_keyword;
END;
$$;
