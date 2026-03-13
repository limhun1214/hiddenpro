-- 1:1 고객 문의(CS 티켓팅) 시스템을 위한 inquiries 테이블 생성 스크립트

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('CUSTOMER', 'PRO')),
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
    admin_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. updated_at 트리거 설정 (없는 경우 생성)
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_inquiries_modtime ON public.inquiries;
CREATE TRIGGER update_inquiries_modtime
    BEFORE UPDATE ON public.inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 3. Row Level Security (RLS) 활성화
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성

-- 일반 사용자: 자신의 문의만 조회 가능
CREATE POLICY "Users can view their own inquiries"
    ON public.inquiries FOR SELECT
    USING (auth.uid() = user_id);

-- 일반 사용자: 자신의 문의 등록 가능
CREATE POLICY "Users can insert their own inquiries"
    ON public.inquiries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 일반 사용자: 자신의 문의 수정 불가 (필요시 추가, 현재는 수정 불가 전제)
-- 일반 사용자: 자신의 문의 삭제 불가

-- [중요] 관리자(ADMIN) 권한: 모든 접근 허용
-- users 테이블과 조인하여 role이 ADMIN인지 확인

CREATE POLICY "Admins can view all inquiries"
    ON public.inquiries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.user_id = auth.uid() AND users.role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can insert inquiries"
    ON public.inquiries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.user_id = auth.uid() AND users.role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can update all inquiries"
    ON public.inquiries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.user_id = auth.uid() AND users.role = 'ADMIN'
        )
    );

CREATE POLICY "Admins can delete all inquiries"
    ON public.inquiries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.user_id = auth.uid() AND users.role = 'ADMIN'
        )
    );

-- 5. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON public.inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at);
