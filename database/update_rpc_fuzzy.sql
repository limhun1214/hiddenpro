CREATE OR REPLACE FUNCTION public.search_services(search_keyword TEXT, max_results INT DEFAULT 10)
RETURNS TABLE (
    service_id UUID,
    category_title VARCHAR,
    service_name VARCHAR,
    search_tags TEXT[],
    relevance_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.service_id,
        d.category_title,
        d.service_name,
        d.search_tags,
        -- 퍼지 매칭 점수 계산 (service_name과의 유사도를 대표값으로 반환)
        similarity(d.service_name, search_keyword)::FLOAT AS relevance_score
    FROM public.detailed_services d
    WHERE 
        -- 1. 서비스 이름에 포함되는 경우 (ILIKE)
        d.service_name ILIKE '%' || search_keyword || '%' OR
        -- 2. 서비스 이름에 겹치는 오타 보정 퍼지 매칭 조건 (유사도 0.2 이상)
        similarity(d.service_name, search_keyword) >= 0.2 OR
        -- 3. 카테고리 타이틀
        d.category_title ILIKE '%' || search_keyword || '%' OR
        -- 4. 카테고리 타이틀 퍼지 매칭 (유사도 0.2 이상)
        similarity(d.category_title, search_keyword) >= 0.2 OR
        -- 5. Tagging 배열 중 하나라도 ILIKE 로 매치되거나, 유사도 0.2 이상인지 개별 검사
        EXISTS (
            SELECT 1 
            FROM unnest(d.search_tags) as tag 
            WHERE tag ILIKE '%' || search_keyword || '%' 
               OR similarity(tag, search_keyword) >= 0.2
        )
    ORDER BY 
        -- ILIKE 완전 일치를 최우선으로, 그 다음 유사도 점수 순으로 정렬
        (d.service_name ILIKE '%' || search_keyword || '%') DESC,
        relevance_score DESC
    LIMIT max_results;
END;
$$;
