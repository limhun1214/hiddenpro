-- 홈 페이지 배너 (이미지/비디오)
CREATE TABLE IF NOT EXISTS cms_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_url TEXT NOT NULL,
    media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 홈 페이지 하단 대분류 카테고리
CREATE TABLE IF NOT EXISTS cms_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),  -- 이모지 또는 아이콘 클래스
    link_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 및 권한 설정
ALTER TABLE cms_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cms_banners" ON cms_banners FOR SELECT USING (true);
CREATE POLICY "Admins can manage cms_banners" ON cms_banners FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
);

CREATE POLICY "Anyone can read cms_categories" ON cms_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage cms_categories" ON cms_categories FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
);

-- 초기 데이터 삽입 (기존 하드코딩 대체)
INSERT INTO cms_banners (media_url, media_type, sort_order)
SELECT 'https://placehold.co/800x600/e2e8f0/64748b?text=Professional+Services', 'IMAGE', 1
WHERE NOT EXISTS (SELECT 1 FROM cms_banners);

INSERT INTO cms_categories (title, description, icon, link_url, sort_order)
SELECT '이사/청소', '포장이사, 입주청소', '🧹', '/request?categoryId=이사/청소', 1 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '이사/청소')
UNION ALL
SELECT '설치/수리', '에어컨, 배관, 수리', '🛠️', '/request?categoryId=설치/수리', 2 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '설치/수리')
UNION ALL
SELECT '인테리어/시공', '리모델링, 부분시공', '🏠', '/request?categoryId=인테리어/시공', 3 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '인테리어/시공')
UNION ALL
SELECT '비즈니스/외주', '번역, 디자인 외주', '💼', '/request?categoryId=비즈니스/외주', 4 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '비즈니스/외주')
UNION ALL
SELECT '이벤트/파티', '행사 기획, 케이터링', '🎉', '/request?categoryId=이벤트/파티', 5 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '이벤트/파티')
UNION ALL
SELECT '레슨/튜터링', '어학, 예체능 레슨', '📚', '/request?categoryId=레슨/튜터링', 6 WHERE NOT EXISTS (SELECT 1 FROM cms_categories WHERE title = '레슨/튜터링');
