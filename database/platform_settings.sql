-- 플랫폼 과금 설정 테이블 생성
-- 관리자 대시보드에서 실시간으로 변경 가능한 핵심 비즈니스 파라미터
CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(100) PRIMARY KEY,
    value DECIMAL NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 기본값 삽입
INSERT INTO platform_settings (key, value, description) VALUES
    ('quote_cost', 500, '고수가 견적 1건 발송 시 차감되는 캐시'),
    ('max_quotes_per_request', 5, '요청 1건당 최대 수신 견적 수'),
    ('signup_bonus', 0, '고수 신규 가입 시 자동 지급 캐시')
ON CONFLICT (key) DO NOTHING;

-- RLS 비활성화 (관리자 전용 테이블이므로 Supabase RPC로만 접근)
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기 가능 (견적 비용 표시 등)
CREATE POLICY "Anyone can read platform_settings" ON platform_settings
    FOR SELECT USING (true);

-- 관리자만 수정 가능 RPC 함수
CREATE OR REPLACE FUNCTION update_platform_setting(
    p_key VARCHAR,
    p_value DECIMAL
) RETURNS VOID AS $$
BEGIN
    UPDATE platform_settings
    SET value = p_value, updated_at = NOW()
    WHERE key = p_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
