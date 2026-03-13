-- =====================================================
-- 관리자 제재 이력 로그 테이블 (Append-only Audit Log)
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- Step 1: admin_action_logs 테이블 생성
CREATE TABLE IF NOT EXISTS admin_action_logs (
    id BIGSERIAL PRIMARY KEY,
    target_user_id UUID NOT NULL REFERENCES users(user_id),
    admin_id UUID REFERENCES users(user_id),
    action_type TEXT NOT NULL CHECK (action_type IN ('SUSPEND', 'UNSUSPEND', 'FLAG', 'UNFLAG')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: 인덱스 (유저별 이력 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_aal_target_user
    ON admin_action_logs (target_user_id, created_at DESC);

-- Step 3: RLS 정책 (Admin만 접근)
ALTER TABLE admin_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_full_access_action_logs" ON admin_action_logs;
CREATE POLICY "admin_full_access_action_logs" ON admin_action_logs
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM users WHERE user_id = auth.uid() AND role = 'ADMIN')
    );

-- Step 4: 검증
SELECT tablename FROM pg_tables WHERE tablename = 'admin_action_logs';
