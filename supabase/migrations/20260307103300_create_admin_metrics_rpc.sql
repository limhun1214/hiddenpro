-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

-- 1. 대규모 집계(Roll-up) 방어용 읽기 전용 인덱스 확보
-- (기존에 없을 경우에만 생성하여 비파괴 원칙 준수)
CREATE INDEX IF NOT EXISTS idx_payments_status_amount ON public.payments(status, amount);
CREATE INDEX IF NOT EXISTS idx_match_quotes_status ON public.match_quotes(status);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status);

-- 2. 관리자 전용 대시보드 지표 추출 RPC
-- N+1 및 다중 커넥션 고갈을 막기 위해 단일 DB 트랜잭션에서 모든 통계를 JSON으로 묶어 반환
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_revenue BIGINT;
    v_total_quotes BIGINT;
    v_total_matches BIGINT;
    v_active_pros BIGINT;
    v_active_customers BIGINT;
BEGIN
    -- [보안(IDOR 방어)] 호출자의 JWT 롤 이중 검증 (Zero-Trust)
    IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'ADMIN' THEN
        RETURN jsonb_build_object('success', false, 'message', '권한이 없습니다. (ADMIN Role 필수)');
    END IF;

    -- [집계 1] 누적 매출 (충전된 포인트 = PAID 상태 결제 총액)
    -- 향후 데이터가 1000만 건 이상 커지면 이 쿼리는 타임아웃 뇌관(Tech Debt)이 되므로,
    -- pg_cron을 이용한 일일 물리 배치(Batch) 테이블 설계로 전환해야 함을 문서에 명시함.
    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_revenue
    FROM public.payments
    WHERE status = 'PAID';

    -- [집계 2] 누적 견적 발송 건수 (고수가 비용을 소진하여 보낸 Lead)
    SELECT COUNT(*)
    INTO v_total_quotes
    FROM public.match_quotes;

    -- [집계 3] 고객 매칭 확정 수 (거래 성사)
    SELECT COUNT(*)
    INTO v_total_matches
    FROM public.match_quotes
    WHERE status = 'ACCEPTED';

    -- [집계 4] 활성 전문가 수
    SELECT COUNT(*)
    INTO v_active_pros
    FROM public.users
    WHERE role = 'PRO' AND status = 'ACTIVE';

    -- [집계 5] 활성 고객 수
    SELECT COUNT(*)
    INTO v_active_customers
    FROM public.users
    WHERE role = 'CUSTOMER' AND status = 'ACTIVE';

    RETURN jsonb_build_object(
        'success', true,
        'metrics', jsonb_build_object(
            'total_revenue', v_total_revenue,
            'total_quotes', v_total_quotes,
            'total_matches', v_total_matches,
            'active_pros', v_active_pros,
            'active_customers', v_active_customers
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', '통계 집계 중 오류 발생: ' || SQLERRM);
END;
$$;
