-- ==========================================
-- 고객 지원 CMS 전용 테이블 신설 Script
-- ==========================================

CREATE TABLE IF NOT EXISTS public.cms_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(50) UNIQUE NOT NULL, -- 예: 'intro', 'guide', 'pro-guide', 'faq'
    title VARCHAR(200) NOT NULL,
    content TEXT, -- HTML 또는 마크다운 에디터 콘텐츠
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 기본 데이터 삽입 (존재하지 않을 경우에만)
INSERT INTO public.cms_pages (slug, title, content)
VALUES 
    ('intro', '플랫폼 소개 (HiddenPro 소개)', '<div class="space-y-4"><h1 class="text-2xl font-bold">HiddenPro에 오신 것을 환영합니다!</h1><p>필리핀 최고의 홈서비스 및 전문가 매칭 플랫폼입니다.</p></div>'),
    ('guide', '고객 이용 방법 안내', '<div class="space-y-4"><h1 class="text-2xl font-bold">서비스 이용 가이드</h1><p>원하시는 서비스를 검색하고, 견적을 먼저 받아보세요. 100% 검증된 전문가들과 안전하게 매칭됩니다.</p></div>'),
    ('pro-guide', '고수(전문가) 가이드라인', '<div class="space-y-4"><h1 class="text-2xl font-bold">고수 활동 가이드라인</h1><p>신뢰와 안전을 우선시합니다. 매너 있는 응대와 성실한 서비스 제공을 부탁드립니다.</p></div>'),
    ('faq', '자주 묻는 질문 (FAQ)', '<div class="space-y-4"><h1 class="text-2xl font-bold">자주 묻는 질문</h1><ul><li><strong>결제 방식은 어떻게 배나요?</strong><br> - 전문가와 직접 협의하여 결제합니다.</li></ul></div>')
ON CONFLICT (slug) DO NOTHING;

-- 누구나 읽을 수 있고 관리자만 수정할 수 있도록 RLS 설정 (필요시)
-- MVP 단계라 RLS 우회하거나 별도로 권한 처리 가능. 여기선 테이블 생성 집중.
