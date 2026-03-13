-- 기존 테이블 백업 또는 삭제 (개발 단계이므로 삭제 방식을 사용)
DROP TABLE IF EXISTS public.cms_pages CASCADE;

-- 1. 고객 지원 카테고리 (대분류)
CREATE TABLE IF NOT EXISTS public.support_categories (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,       -- e.g., 'intro', 'customer', 'pro', 'faq'
    title VARCHAR(100) NOT NULL,            -- e.g., '플랫폼 소개', '고객 안내', '고수 안내', 'FAQ'
    sort_order INTEGER NOT NULL DEFAULT 0,  -- 메뉴 순서
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 고객 지원 문서 (소분류 / 페이지)
CREATE TABLE IF NOT EXISTS public.support_pages (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES public.support_categories(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL,             -- e.g., 'company', 'business', 'guide'
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(category_id, slug) -- 동일 카테고리 내에서는 slug 중복 불가
);

-- 3. 법적 고지 문서 (버전 관리형)
CREATE TABLE IF NOT EXISTS public.legal_documents (
    id SERIAL PRIMARY KEY,
    document_type VARCHAR(50) NOT NULL,     -- 'TERMS' 또는 'PRIVACY'
    version VARCHAR(20) NOT NULL,           -- e.g., 'v1.0', 'v2.0'
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    effective_date DATE NOT NULL,           -- 효력 발생 시기
    is_active BOOLEAN NOT NULL DEFAULT false, -- 활성(퍼블리시) 된 버전인지 여부
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(document_type, version) -- 동일 타입 문서 내 버전 중복 불가
);

-- 업데이트 트리거 설정
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_support_pages_update ON public.support_pages;
CREATE TRIGGER trg_support_pages_update
BEFORE UPDATE ON public.support_pages
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

DROP TRIGGER IF EXISTS trg_legal_documents_update ON public.legal_documents;
CREATE TRIGGER trg_legal_documents_update
BEFORE UPDATE ON public.legal_documents
FOR EACH ROW EXECUTE PROCEDURE update_timestamp();

-- [ 초기 데이터셋 생성 ]

-- 카테고리
INSERT INTO public.support_categories (slug, title, sort_order) VALUES
('intro', '플랫폼 소개', 10),
('customer', '고객 안내', 20),
('pro', '고수 안내', 30),
('faq', 'FAQ', 40)
ON CONFLICT (slug) DO NOTHING;

-- 임시 변수용 카테고리 ID
DO $$
DECLARE
    intro_id INT;
    cust_id INT;
    pro_id INT;
    faq_id INT;
BEGIN
    SELECT id INTO intro_id FROM public.support_categories WHERE slug = 'intro';
    SELECT id INTO cust_id FROM public.support_categories WHERE slug = 'customer';
    SELECT id INTO pro_id FROM public.support_categories WHERE slug = 'pro';
    SELECT id INTO faq_id FROM public.support_categories WHERE slug = 'faq';

    -- 고객 지원 페이지 (플랫폼 소개)
    INSERT INTO public.support_pages (category_id, slug, title, content, sort_order) VALUES
    (intro_id, 'company', '회사 소개', '<div class="space-y-4"><h3 class="text-xl font-bold">안전하고 신뢰할 수 있는 매칭</h3><p>히든프로는 필리핀 내의 한인들을 위한 전문가 매칭 플랫폼입니다.</p></div>', 10),
    (intro_id, 'business', '사업자 정보 (Footer)', '<div class="space-y-2 text-sm"><p><strong>상호명:</strong> 카모스타(KAMUSTA)</p><p><strong>대표자:</strong> 홍길동</p><p><strong>사업자등록번호:</strong> 123-45-67890</p><p><strong>주소:</strong> 필리핀 마닐라 메트로 마닐라</p></div>', 20)
    ON CONFLICT (category_id, slug) DO NOTHING;

    -- 고객 지원 페이지 (고객 안내)
    INSERT INTO public.support_pages (category_id, slug, title, content, sort_order) VALUES
    (cust_id, 'guide', '서비스 이용 방법', '<p>원하는 서비스를 선택하고 견적을 요청해보세요.</p>', 10),
    (cust_id, 'trust', '신뢰 및 안전 정책', '<p>모든 전문가는 신원 검증 프로세스를 거칩니다.</p>', 20),
    (cust_id, 'refund', '결제/환불 규정', '<p>매칭 전까지는 100% 환불이 보장됩니다.</p>', 30)
    ON CONFLICT (category_id, slug) DO NOTHING;

    -- 고객 지원 페이지 (고수 안내)
    INSERT INTO public.support_pages (category_id, slug, title, content, sort_order) VALUES
    (pro_id, 'guide', '고수 이용 가이드', '<p>매칭 확률을 높이는 프로필 작성법을 확인하세요.</p>', 10),
    (pro_id, 'verification', '고수 신원 인증 안내', '<p>신원 인증은 프로필의 신뢰도를 높여줍니다.</p>', 20)
    ON CONFLICT (category_id, slug) DO NOTHING;

    -- 고객 지원 페이지 (FAQ)
    INSERT INTO public.support_pages (category_id, slug, title, content, sort_order) VALUES
    (faq_id, 'general', '자주 묻는 질문', '<ul class="list-disc pl-5"><li><strong>Q. 비용은 어떻게 되나요?</strong><br/>A. 견적은 무료입니다! 매칭 비용은 고수님의 제시액에 따라 달라집니다.</li></ul>', 10)
    ON CONFLICT (category_id, slug) DO NOTHING;
END $$;

-- 법적 고지 페이지 (버전 v1.0)
INSERT INTO public.legal_documents (document_type, version, title, content, effective_date, is_active) VALUES
('TERMS', 'v1.0', '히든프로 이용약관', '<div class="space-y-4"><h3 class="text-xl font-bold text-gray-900">제1조 (목적)</h3><p>본 약관은 히든프로 플랫폼이 제공하는 모든 서비스의 이용 조건 및 절차를 규정합니다.</p></div>', '2026-03-01', true),
('PRIVACY', 'v1.0', '개인정보 보호방침', '<div class="space-y-4"><h3 class="text-xl font-bold text-gray-900">1. 개인정보의 수집 및 이용 목적</h3><p>회원 식별 및 최적화된 매칭 서비스 제공을 위해 최소한의 개인정보를 수집합니다.</p></div>', '2026-03-01', true)
ON CONFLICT (document_type, version) DO NOTHING;
