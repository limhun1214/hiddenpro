-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

-- 1. 어뷰징 방어형 신고 내역 테이블 신설
CREATE TABLE IF NOT EXISTS public.reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('USER', 'REVIEW', 'CHAT')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- ── [스팸 도배 원천 차단] ──
    -- 동일 유저가 동일 대상을 중복 신고할 수 없도록 DB 레벨 복합키 강제
    CONSTRAINT unique_active_report UNIQUE (reporter_id, target_type, target_id)
);

-- 인덱스 추가 (어드민 대시보드 조회 및 스팸 차단 쿼리 튜닝)
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);

-- 2. 강력한 RLS 보안 적용 (Zero-Trust)
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 2-1. 고객/고수는 자신의 신고만 'INSERT' 가능 (SELECT 불가: 타인 신고 내역 은닉)
CREATE POLICY "Users can insert own reports" 
    ON public.reports FOR INSERT 
    WITH CHECK (auth.uid() = reporter_id);

-- 2-2. ADMIN 역할만 조회 / 상태 변경(UPDATE) 가능
CREATE POLICY "Admins can view all reports" 
    ON public.reports FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update reports" 
    ON public.reports FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE user_id = auth.uid() AND role = 'ADMIN'
        )
    );

-- 3. 프론트엔드 직접 Insert 격리 및 중복 에러 우아한 반환(Graceful)을 위한 RPC
CREATE OR REPLACE FUNCTION public.submit_report(
    p_target_type VARCHAR,
    p_target_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reporter_id UUID;
BEGIN
    v_reporter_id := auth.uid();
    
    IF v_reporter_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '인증이 필요합니다.');
    END IF;

    -- INSERT 시도 (UNIQUE 제약 조건 위배 시 EXCEPTION 발생)
    INSERT INTO public.reports (reporter_id, target_type, target_id, reason)
    VALUES (v_reporter_id, p_target_type, p_target_id, p_reason);

    RETURN jsonb_build_object('success', true, 'message', '신고가 정상 접수되었습니다.');

EXCEPTION 
    WHEN unique_violation THEN
        -- DB 에러(500) 대신 클라이언트가 예쁘게 처리할 수 있는 성공 응답 포맷으로 거절 메시지 전달
        RETURN jsonb_build_object('success', false, 'message', '이미 접수된 대상입니다.');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', '신고 처리 중 오류가 발생했습니다.');
END;
$$;
