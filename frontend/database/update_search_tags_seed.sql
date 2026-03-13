-- 카테고리별 글로벌/현지어 동의어 매핑 업데이트 (배열 요소 중복 제거 병합)

-- 1. Moving & Cleaning -> 이사/청소
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['cleaning', 'maid', 'housekeeper', 'deep cleaning', 'laundry', 'pest control', 'lipat bahay', 'kasambahay', 'linis', 'labada', 'yaya', 'yaya cleaning']
    )
)
WHERE category_title = '이사/청소';

-- 2. Installation & Repair -> 설치/수리
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['plumber', 'electrician', 'aircon cleaning', 'ac repair', 'handyman', 'carpenter', 'mechanic', 'tubero', 'kuryente', 'karpintero', 'talyer', 'sirang aircon', 'gawa bahay']
    )
)
WHERE category_title = '설치/수리';

-- 3. Interior & Construction -> 인테리어/시공
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['painting', 'renovation', 'contractor', 'roofing', 'flooring', 'interior design', 'pintor', 'kontratista', 'gawa bubong', 'palitada']
    )
)
WHERE category_title = '인테리어/시공';

-- 4. Business & BPO -> 비즈니스/외주
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['virtual assistant', 'VA', 'translator', 'graphic designer', 'video editor', 'accountant', 'tagasalin', 'taga edit', 'taga kwenta', 'freelancer', 'bpo']
    )
)
WHERE category_title = '비즈니스/외주';

-- 5. Event & Party -> 이벤트/파티
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['catering', 'photographer', 'wedding planner', 'dj', 'host', 'makeup artist', 'events', 'handaan', 'binyag', 'kasal', 'litratista', 'tagapagsalita', 'make up']
    )
)
WHERE category_title = '이벤트/파티';

-- 6. Lessons & Tutoring -> 레슨/튜터링
UPDATE public.detailed_services
SET search_tags = ARRAY(
    SELECT DISTINCT unnest(
        search_tags || 
        ARRAY['tutor', 'english lesson', 'driving lesson', 'piano', 'swimming', 'fitness coach', 'guro', 'titser', 'magmaneho', 'paglangoy', 'tagapagturo']
    )
)
WHERE category_title = '레슨/튜터링';
