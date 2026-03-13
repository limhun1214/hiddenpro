-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
-- 100만 MAU 스케일 테스트를 위한 안전한 O(1) Bulk Insert 배치 스크립트
-- 프론트엔드의 N+1 무한 루프 호출을 방지하고 DB 커넥션 1회로 모든 더미 데이터를 생성합니다.

DO $$
DECLARE
    v_customer_id UUID;
    v_pro_id UUID;
    v_room_id UUID;
    v_category_id UUID;
    i INT;
    j INT;
    v_phone VARCHAR(20);
    v_dummy_password_hash VARCHAR;
BEGIN
    -- 1. 더미 비밀번호 해시 세팅 (Bcrypt) -> 'password123'
    v_dummy_password_hash := '$2a$10$wN1Q/X60pB4U8K89gG7M/uI8P0Qp8O0oA0e8m./9hE9l8B1M602.y';

    -- 1.5. 카테고리 참조 값 확보
    SELECT id INTO v_category_id FROM public.categories LIMIT 1;
    IF v_category_id IS NULL THEN
        v_category_id := gen_random_uuid();
        INSERT INTO public.categories (id, name, depth1, depth2, is_active, base_price)
        VALUES (v_category_id, '더미 카테고리', '대분류', '중분류', true, 10000);
    END IF;

    -- 2. 테스트 리뷰 작성을 위한 마스터 더미 고객(CUSTOMER) 1명 생성
    SELECT id INTO v_customer_id FROM auth.users WHERE email = 'master_tester@hiddenpro.com' LIMIT 1;
    
    IF v_customer_id IS NULL THEN
        v_customer_id := gen_random_uuid();
        
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, encrypted_password)
        VALUES (
            v_customer_id, 
            'master_tester@hiddenpro.com', 
            '{"role":"CUSTOMER", "provider":"email"}'::jsonb, 
            '{"name":"마스터테스터"}'::jsonb, 
            now(), now(), 'authenticated', v_dummy_password_hash
        );
        
        -- 트리거가 이미 public.users 레코드를 만들었을 것이므로 UPDATE 사용
        UPDATE public.users 
        SET phone = '010-0000-0000', nickname = '슈퍼고객', role = 'CUSTOMER', status = 'ACTIVE'
        WHERE user_id = v_customer_id;
    END IF;

    -- 3. 가짜 상위 1% 고수 100명 및 관련된 더미 리뷰 500개 (1인당 5개) 순차 생성
    FOR i IN 201..300 LOOP
        v_pro_id := gen_random_uuid();
        
        -- 전화번호 정규식 (010-XXXX-XXXX) 무결성 보장
        v_phone := '010-7777-' || LPAD(i::text, 4, '0');
        
        -- 3-1. auth.users (Supabase 인증 시스템) - 이메일 중복 방어
        SELECT id INTO v_pro_id FROM auth.users WHERE email = 'dummy_pro_' || i || '@hiddenpro.com' LIMIT 1;
        
        IF v_pro_id IS NULL THEN
            v_pro_id := gen_random_uuid();
            INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, encrypted_password)
            VALUES (
                v_pro_id, 'dummy_pro_' || i || '@hiddenpro.com', '{"role":"PRO", "provider":"email"}'::jsonb, 
                ('{"name":"전문가_' || i || '"}')::jsonb, now(), now(), 'authenticated', v_dummy_password_hash
            );
        END IF;
        
        -- 3-2. public.users (비즈니스 유저 시스템) - 트리거 중복 방지
        UPDATE public.users 
        SET phone = v_phone, nickname = '테스트고수' || i, role = 'PRO', status = 'ACTIVE'
        WHERE user_id = v_pro_id;
        
        -- 3-3. public.pro_profiles (실제 DB 스키마 기준 작성)
        INSERT INTO public.pro_profiles (
            pro_id, nickname, phone, region, intro, current_cash, review_count, average_rating
        )
        VALUES (
            v_pro_id, '테스트고수' || i, v_phone, '서울 용산구', i || '년차 숨은 고수입니다. 최선을 다하겠습니다.', 10000, 5, 4.8
        ) ON CONFLICT (pro_id) DO NOTHING;
        
        -- 3-4. public.reviews (리뷰 5개씩 생성, 총 100 * 5 = 500개)
        FOR j IN 1..5 LOOP
            v_room_id := gen_random_uuid(); 
            DECLARE
                v_request_id UUID := gen_random_uuid();
            BEGIN
                -- FK 참조 무결성을 위해 가짜 요청서(match_requests) 생성
                INSERT INTO public.match_requests (
                    request_id, customer_id, status, category_id, region_id, service_type, dynamic_answers, created_at
                )
                VALUES (
                    v_request_id, 
                    v_customer_id, 
                    'MATCHED', 
                    v_category_id, 
                    '1', -- varchar
                    '더미 서비스', 
                    '{}'::jsonb,
                    now()
                );

                -- FK 참조 무결성을 위해 가짜 채팅방(chat_rooms) 생성
                INSERT INTO public.chat_rooms (room_id, request_id, customer_id, pro_id, status)
                VALUES (v_room_id, v_request_id, v_customer_id, v_pro_id, 'CLOSED');

                -- 완전히 정규화된 컬럼 기준으로 완벽하게 단일 INSERT
                INSERT INTO public.reviews (pro_id, customer_id, room_id, rating, comment, created_at)
                VALUES (
                    v_pro_id, 
                    v_customer_id, 
                    v_room_id, 
                    floor(random() * 3 + 3)::int,
                    '서비스가 만족스럽습니다. 다음에도 또 이용할게요! (자동 생성 리뷰 #' || j || ')',
                    now() - (random() * interval '30 days')
                );
            END;
        END LOOP;
    END LOOP;
END $$;
