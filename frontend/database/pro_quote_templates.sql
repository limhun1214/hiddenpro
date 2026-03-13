-- =====================================================
-- 고수 견적 템플릿 테이블 (pro_quote_templates)
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

CREATE TABLE IF NOT EXISTS pro_quote_templates (
    id BIGSERIAL PRIMARY KEY,
    pro_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,              -- 템플릿 이름 (예: "기본 인사말")
    content TEXT NOT NULL,            -- 견적 설명 본문
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스: 고수별 템플릿 조회 최적화
CREATE INDEX IF NOT EXISTS idx_pqt_pro_id
    ON pro_quote_templates (pro_id, created_at DESC);

-- RLS: 본인 템플릿만 CRUD 가능
ALTER TABLE pro_quote_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_own_templates" ON pro_quote_templates;
CREATE POLICY "pro_own_templates" ON pro_quote_templates
    FOR ALL
    USING (pro_id = auth.uid())
    WITH CHECK (pro_id = auth.uid());

-- 검증
SELECT tablename FROM pg_tables WHERE tablename = 'pro_quote_templates';
