-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

-- [Zero-Trust O(1) 제재 액션 RPC]
-- 클라이언트에서 IDOR 기법 우회를 방지하기 위해, 오직 토큰(auth.jwt()) 내에 'ADMIN' 롤이 박혀있는지
-- 이중으로 검증하는 강력한 SECURITY DEFINER 트랜잭션 함수. 
-- 정지 처리 시 기존 데이터(채팅/견적)는 CASCADE 삭제되지 않으며 상태값만 업데이트됨.

CREATE OR REPLACE FUNCTION public.process_report_and_suspend(
    p_report_id UUID,
    p_action VARCHAR -- 'DISMISS' (기각) or 'SUSPEND' (정지)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_user_id UUID;
    v_target_type VARCHAR;
BEGIN
    -- 1. [보안(IDOR 방어)] 호출자의 JWT 토큰 메타데이터에서 Role 검증
    -- 미들웨어가 뚫리더라도 DB 계층에서 다시 한 번 ADMIN 권한을 증명함
    IF (auth.jwt() -> 'user_metadata' ->> 'role') IS DISTINCT FROM 'ADMIN' THEN
        RETURN jsonb_build_object('success', false, 'message', '권한이 없습니다. (ADMIN Role 필수)');
    END IF;

    -- 2. 해당 신고 내역이 존재하는지 확인하고 타겟 정보를 로드
    SELECT target_id, target_type
    INTO v_target_user_id, v_target_type
    FROM public.reports 
    WHERE report_id = p_report_id AND status = 'PENDING'
    FOR UPDATE; -- 동시 처리 방어 Lock

    IF v_target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '유효하지 않거나 이미 처리된 신고 내역입니다.');
    END IF;

    -- 3. 액션 분기 처리
    IF p_action = 'DISMISS' THEN
        -- 기각: 신고 내역만 기각 상태로 업데이트
        UPDATE public.reports SET status = 'DISMISSED' WHERE report_id = p_report_id;
        RETURN jsonb_build_object('success', true, 'message', '신고가 기각되었습니다.');
        
    ELSIF p_action = 'SUSPEND' THEN
        -- 정지: 타겟의 유형이 'USER', 'REVIEW' 등에 따라 실제 유저 ID를 찾아야 함
        IF v_target_type = 'USER' THEN
            -- v_target_user_id 가 곧 user_id 임
            NULL;
        ELSIF v_target_type = 'REVIEW' THEN
            -- [1차 방어] 리뷰의 경우 리뷰 객체의 소유자(customer_id) 타겟 ID로 변환
            BEGIN
                -- 리뷰 테이블에서 해당 리뷰 등록자의 user_id (customer_id) 추출
                SELECT customer_id INTO v_target_user_id FROM public.reviews WHERE review_id = v_target_user_id;
            EXCEPTION WHEN OTHERS THEN
                -- Fallback: If review not found or customer_id is null, keep original target_id
                -- This might happen if the review was deleted or invalid.
                -- In this specific context, v_target_user_id already holds the target_id from reports,
                -- so if the SELECT fails, it retains its original value.
                NULL; 
            END;
        ELSE
            -- CHAT 등의 경우 상황에 맞춘 로직 확장이 필요하나, 현재는 기본 UUID 로직
            NULL;
        END IF;

        -- 3-1. public.users 상태 업데이트 (비파괴적 상태 변경)
        UPDATE public.users 
        SET status = 'SUSPENDED' 
        WHERE user_id = v_target_user_id;

        -- 3-2. [핵심: 엣지 미들웨어 즉각 차단 연동]
        -- auth.users 의 raw_app_meta_data 에 suspended = true 플래그 주입
        UPDATE auth.users 
        SET raw_app_meta_data = raw_app_meta_data || '{"suspended": true, "role": "SUSPENDED"}'::jsonb,
            updated_at = NOW()
        WHERE id = v_target_user_id;

        -- 3-3. 신고 내역 해결 처리
        UPDATE public.reports SET status = 'RESOLVED' WHERE report_id = p_report_id;

        RETURN jsonb_build_object('success', true, 'message', '해당 유저가 즉각 정지되었습니다.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', '알 수 없는 액션입니다.');
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', '처리 중 오류가 발생했습니다: ' || SQLERRM);
END;
$$;
