-- 1. pg_trgm 확장 모듈 활성화 (오타 보정 및 퍼지 검색용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 상세 카테고리 (detailed_services) 테이블 생성
CREATE TABLE IF NOT EXISTS public.detailed_services (
    service_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_title VARCHAR(100) NOT NULL,
    service_name VARCHAR(150) NOT NULL,
    search_tags TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_title, service_name)
);

-- RLS 활성화
ALTER TABLE public.detailed_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read detailed_services" ON public.detailed_services FOR SELECT USING (true);
CREATE POLICY "Admins can manage detailed_services" ON public.detailed_services FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
);

-- 퍼지 검색 및 배열 검색을 위한 GIN 인덱스 생성
CREATE INDEX IF NOT EXISTS trgm_idx_service_name ON public.detailed_services USING gin (service_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_service_search_tags ON public.detailed_services USING gin (search_tags);

-- 3. 이탈 검색어 로그 (search_fail_logs) 테이블 생성 (Insert Only 최적화)
CREATE TABLE IF NOT EXISTS public.search_fail_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화 (누구나 insert 가능하도록 허용)
ALTER TABLE public.search_fail_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert search_fail_logs" ON public.search_fail_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read search_fail_logs" ON public.search_fail_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE users.user_id = auth.uid() AND users.role = 'ADMIN')
);

-- 4. 초기 하드코딩 데이터 마이그레이션 (프론트엔드 SERVICE_CATEGORIES 병합)
-- 충돌 방지를 위해 ON CONFLICT 사용
INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('이사/청소', '파트타임 가사도우미', ARRAY['maid', 'housekeeper', 'tulong', '가정부', '파출부']),
('이사/청소', '요리 도우미', ARRAY['cook', 'chef', 'meal prep']),
('이사/청소', '육아/베이비시터', ARRAY['nanny', 'babysitter', 'yaya', '돌보미', '아이돌보미']),
('이사/청소', '거주/정기 청소', ARRAY['regular cleaning', 'house cleaning', 'home cleaning']),
('이사/청소', '이사/입주 딥클리닝', ARRAY['deep cleaning', 'move-in cleaning', 'move-out cleaning', '입주청소', '이사청소']),
('이사/청소', '콘도/수영장 유지보수 청소', ARRAY['pool maintenance', 'condo cleaning']),
('이사/청소', '소파/매트리스 딥클리닝', ARRAY['sofa cleaning', 'mattress cleaning', 'upholstery']),
('이사/청소', '창문형 에어컨 딥클리닝', ARRAY['window aircon cleaning', 'ac cleaning', 'air conditioner', '에어컨청소']),
('이사/청소', '스플릿/벽걸이형 에어컨 딥클리닝', ARRAY['split aircon cleaning', 'wall mounted ac cleaning', '에어컨']),
('이사/청소', '상업용/시스템 에어컨 청소', ARRAY['commercial ac cleaning', 'system aircon cleaning', '천장형에어컨']),
('이사/청소', '흰개미 퇴치', ARRAY['termite control', 'anay control', '방역', '소독']),
('이사/청소', '일반 해충 방역', ARRAY['pest control', 'bug control', 'insect control']),
('이사/청소', '곰팡이/악취 제거', ARRAY['mold removal', 'odor removal', 'smell']),
('이사/청소', '용달/화물 운송', ARRAY['lipat bahay', 'truck rental', 'moving van', 'freight']),
('이사/청소', '가정이사', ARRAY['house moving', 'relocation']),
('이사/청소', '사무실/상업공간 이사', ARRAY['office moving', 'commercial relocation']),
('이사/청소', '대형 폐기물 수거 및 처리', ARRAY['waste disposal', 'junk removal', 'trash collection', '쓰레기버리기'])
ON CONFLICT (category_title, service_name) DO NOTHING;

INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('설치/수리', '(긴급) 누수 및 수도관 수리', ARRAY['plumbing', 'plumber', 'pipe leak', 'water leak', 'tubero', '배관공']),
('설치/수리', '워터펌프 및 압력탱크 수리', ARRAY['water pump', 'pressure tank']),
('설치/수리', '변기/하수구 막힘 뚫기', ARRAY['clogged toilet', 'drain cleaning', '하수구뚫기']),
('설치/수리', '온수기 설치 및 수리', ARRAY['water heater', 'shower heater', '보일러']),
('설치/수리', '(긴급) 전기 누전/단락 수리', ARRAY['electrician', 'electrical repair', 'short circuit', 'power outage', '전기공', '누전']),
('설치/수리', '발전기 설치 및 수리', ARRAY['generator installation', 'generator repair']),
('설치/수리', '전등/조명/배선 공사', ARRAY['lighting installation', 'wiring', '조명공사']),
('설치/수리', '태양광 패널 설치 및 유지보수', ARRAY['solar panel', 'solar energy']),
('설치/수리', '에어컨 고장 수리 및 프리온 충전', ARRAY['ac repair', 'freon recharge', 'aircon freon', '에어컨수리']),
('설치/수리', '냉장고/세탁기 수리', ARRAY['appliance repair', 'refrigerator repair', 'washing machine repair']),
('설치/수리', 'TV 설치 (벽걸이 등)', ARRAY['tv mounting', 'wall mount tv']),
('설치/수리', 'CCTV 및 보안기기 설치', ARRAY['cctv installation', 'security camera']),
('설치/수리', '방충망 맞춤 제작 및 시공', ARRAY['insect screen', 'mosquito net', '방충망설치']),
('설치/수리', '열쇠/도어락 수리 및 교체', ARRAY['locksmith', 'door lock', '도어락설치']),
('설치/수리', '가구 조립 및 배치', ARRAY['furniture assembly', 'ikea assembly']),
('설치/수리', 'LPG 가스 배달 및 라인 점검', ARRAY['lpg delivery', 'gas line checking'])
ON CONFLICT (category_title, service_name) DO NOTHING;

INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('인테리어/시공', '주택 리모델링 및 증축', ARRAY['home remodeling', 'house renovation', 'extension', '집수리']),
('인테리어/시공', '콘도/아파트 인테리어', ARRAY['condo interior', 'apartment interior design']),
('인테리어/시공', '상업공간/매장 인테리어', ARRAY['commercial interior', 'shop fit out']),
('인테리어/시공', '타일 및 바닥재 시공', ARRAY['tiling', 'flooring', '타일공사']),
('인테리어/시공', '페인트 시공 (실내/외벽)', ARRAY['painting', 'painter', '도장공사']),
('인테리어/시공', '목공 및 맞춤 가구 제작', ARRAY['carpentry', 'carpenter', 'custom furniture', '목수']),
('인테리어/시공', '가벽/석고보드 시공', ARRAY['drywall', 'partition', 'gypsum board']),
('인테리어/시공', '지붕 공사 및 방수 시공', ARRAY['roofing', 'waterproofing', '지붕수리', '누수방수']),
('인테리어/시공', '조경 및 정원 관리', ARRAY['landscaping', 'gardening', 'lawn care', '정원사']),
('인테리어/시공', '간판 제작 및 설치', ARRAY['signage', 'signboard maker']),
('인테리어/시공', '데크 및 펜스 시공', ARRAY['decking', 'fencing'])
ON CONFLICT (category_title, service_name) DO NOTHING;

INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('비즈니스/외주', '가상 비서', ARRAY['virtual assistant', 'va', '비서']),
('비즈니스/외주', 'CS/콜센터 아웃소싱', ARRAY['customer service', 'call center', 'bpo', '콜센터']),
('비즈니스/외주', '텔레마케팅/영업 대행', ARRAY['telemarketing', 'sales outsourcing']),
('비즈니스/외주', 'SEC/DTI 법인 및 사업자 등록 대행', ARRAY['business registration', 'sec registration', 'dti', '법인설립']),
('비즈니스/외주', 'BIR 세무 기장 및 세금 신고', ARRAY['tax filing', 'bookkeeping', 'bir', '세무사', '회계']),
('비즈니스/외주', '비자/이민 서류 처리 대행', ARRAY['visa processing', 'immigration', '비자연장']),
('비즈니스/외주', '각종 인허가 대행', ARRAY['permits', 'business permit', 'mayor permit']),
('비즈니스/외주', '타갈로그어 통번역', ARRAY['tagalog translation', 'tagalog interpreter', '필리핀어']),
('비즈니스/외주', '비사야어 통번역', ARRAY['bisaya translation', 'cebuano interpreter']),
('비즈니스/외주', '영어 통번역', ARRAY['english translation', 'english interpreter']),
('비즈니스/외주', '기타 다국어 통번역', ARRAY['multilingual translation']),
('비즈니스/외주', '로고/그래픽 디자인', ARRAY['logo design', 'graphic design']),
('비즈니스/외주', '웹/앱 기획 및 개발', ARRAY['web development', 'app development', 'programmer', '웹사이트']),
('비즈니스/외주', '영상 편집', ARRAY['video editing', 'video production']),
('비즈니스/외주', 'SNS 마케팅 및 페이지 관리', ARRAY['social media marketing', 'smm', 'facebook marketing'])
ON CONFLICT (category_title, service_name) DO NOTHING;

INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('이벤트/파티', '데뷰 기획 및 스타일링', ARRAY['debut planning', '18th birthday']),
('이벤트/파티', '세례식 기획', ARRAY['christening', 'baptism']),
('이벤트/파티', '생일/기념일 파티 기획', ARRAY['birthday party planner', 'anniversary']),
('이벤트/파티', '웨딩 플래닝', ARRAY['wedding planner', 'wedding coordination', '결혼식']),
('이벤트/파티', '기업 행사/코퍼레이트 파티', ARRAY['corporate event', 'company party']),
('이벤트/파티', '통돼지구이 배달 및 케이터링', ARRAY['lechon delivery', '레촌']),
('이벤트/파티', '파티 뷔페/음식 케이터링', ARRAY['party catering', 'food catering', 'buffet', '출장뷔페']),
('이벤트/파티', '푸드 카트 렌탈', ARRAY['food cart rental']),
('이벤트/파티', '맞춤 디자인 케이크 제작', ARRAY['customized cake', 'birthday cake', '주문제작케이크']),
('이벤트/파티', '비디오케 및 사운드 시스템 대여', ARRAY['videoke rental', 'sound system rental', '노래방기계']),
('이벤트/파티', '텐트/테이블/의자 대여', ARRAY['tent rental', 'table and chair rental']),
('이벤트/파티', '파티 소품/포토부스 대여', ARRAY['party supplies', 'photo booth rental']),
('이벤트/파티', '스냅 사진 및 영상 촬영', ARRAY['photography', 'videography', 'photo coverage', '사진촬영']),
('이벤트/파티', '행사 진행자 섭외', ARRAY['event host', 'emcee', 'mc']),
('이벤트/파티', '라이브 밴드/DJ/가수 섭외', ARRAY['live band', 'dj', 'singer']),
('이벤트/파티', '헤어 및 메이크업', ARRAY['hair and makeup', 'hmua'])
ON CONFLICT (category_title, service_name) DO NOTHING;

INSERT INTO public.detailed_services (category_title, service_name, search_tags) VALUES 
('레슨/튜터링', '외국인 대상 영어 회화', ARRAY['esl', 'english conversation', 'english tutor', '영어과외', '원어민영어']),
('레슨/튜터링', '기초 타갈로그어/비사야어 레슨', ARRAY['tagalog lesson', 'bisaya lesson', '따갈로그어과외']),
('레슨/튜터링', '비즈니스 영어 튜터링', ARRAY['business english']),
('레슨/튜터링', 'BPO/콜센터 취업 준비', ARRAY['bpo training', 'call center training']),
('레슨/튜터링', '가상 비서 실무 교육', ARRAY['va training', 'virtual assistant course']),
('레슨/튜터링', '프로그래밍/코딩 레슨', ARRAY['programming lesson', 'coding tutor', '코딩과외']),
('레슨/튜터링', 'IELTS / OET / TOEFL 준비', ARRAY['ielts review', 'oet review', 'toefl', '아이엘츠']),
('레슨/튜터링', 'PRC 보드 시험 준비', ARRAY['prc board exam review']),
('레슨/튜터링', '수영 레슨', ARRAY['swimming lesson', '수영과외']),
('레슨/튜터링', '댄스/줌바 레슨', ARRAY['dance lesson', 'zumba instructor']),
('레슨/튜터링', '요리/베이킹 레슨', ARRAY['cooking class', 'baking lesson']),
('레슨/튜터링', '피아노/기타/보컬 레슨', ARRAY['piano lesson', 'guitar lesson', 'voice lesson', '음악학원'])
ON CONFLICT (category_title, service_name) DO NOTHING;

-- 5. 프론트엔드 연동용 RPC (Fuzzy Search & search_tags 매칭 결합 함수)
CREATE OR REPLACE FUNCTION public.search_services(search_keyword TEXT, max_results INT DEFAULT 10)
RETURNS TABLE (
    service_id UUID,
    category_title VARCHAR,
    service_name VARCHAR,
    search_tags TEXT[],
    relevance_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.service_id,
        d.category_title,
        d.service_name,
        d.search_tags,
        -- 퍼지 매칭 점수 계산 (service_name과의 유사도)
        similarity(d.service_name, search_keyword)::FLOAT AS relevance_score
    FROM public.detailed_services d
    WHERE 
        -- 1. 서비스 이름에 포함되는 경우 (ILIKE)
        d.service_name ILIKE '%' || search_keyword || '%' OR
        -- 2. 서비스 이름에 겹치는 오타 보정 퍼지 매칭 조건 (유사도 0.2 이상)
        similarity(d.service_name, search_keyword) > 0.2 OR
        -- 3. 카테고리 타이틀
        d.category_title ILIKE '%' || search_keyword || '%' OR
        -- 4. Tagging 배열 중 하나라도 ILIKE 로 매치되는지 확인
        EXISTS (
            SELECT 1 
            FROM unnest(d.search_tags) as tag 
            WHERE tag ILIKE '%' || search_keyword || '%'
        )
    ORDER BY 
        -- ILIKE 완전 일치를 최우선으로, 그 다음 유사도 점수 순으로 정렬
        (d.service_name ILIKE '%' || search_keyword || '%') DESC,
        relevance_score DESC
    LIMIT max_results;
END;
$$;
