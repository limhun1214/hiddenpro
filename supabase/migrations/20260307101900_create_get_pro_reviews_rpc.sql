-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

-- [O(1) N+1 방어형 리뷰 반환 RPC]
-- 작성자 이름을 마스킹(고객 보호) 처리하여 개인정보를 보호하며 단일 JOIN으로 쿼리 최적화
CREATE OR REPLACE FUNCTION public.get_pro_reviews(p_pro_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'review_id', r.review_id,
                'rating', r.rating,
                'comment', r.comment,
                'created_at', r.created_at,
                -- 약식 [이름 마스킹 알고리즘] 적용
                -- 이름이 2글자면 뒤 1글자 마스킹(홍*), 3글자 이상이면 중간 글자 마스킹(홍*동, 없으면 '고객'
                'reviewer_name', COALESCE(
                    CASE 
                        WHEN length(u.name) <= 2 THEN rpad(left(u.name, 1), length(u.name), '*')
                        WHEN length(u.name) > 2 THEN 
                            left(u.name, 1) || lpad('*', length(u.name)-2, '*') || right(u.name, 1)
                    END,
                    '고객'
                )
            ) ORDER BY r.created_at DESC
        ), 
        '[]'::jsonb
    )
    INTO v_result
    FROM public.reviews r
    JOIN public.users u ON r.customer_id = u.user_id
    WHERE r.pro_id = p_pro_id;

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN '[]'::jsonb;
END;
$$;
