-- =====================================================================
-- 3-15-0 어뷰징 추적 시스템: DB 스키마 + 자동 집계 트리거
--
-- 고객별 행위 통계를 실시간 추적하여 윈도우 쇼퍼를 자동 판별합니다.
-- 3-15-0 룰: 연속 3회 노쇼 AND 열람 견적 15건↑ AND 매칭률 0%
--
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================================

-- ═══════════════════════════════════════════════════════════════
-- Step 1: user_penalty_stats 집계 테이블 생성 (멱등)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_penalty_stats (
    customer_id UUID PRIMARY KEY REFERENCES users(user_id),
    consecutive_noshow INT NOT NULL DEFAULT 0,       -- 연속 노쇼 횟수 (매칭 시 0 리셋)
    total_read_quotes INT NOT NULL DEFAULT 0,        -- 누적 열람 견적 수
    total_requests INT NOT NULL DEFAULT 0,           -- 누적 요청 수
    total_matched INT NOT NULL DEFAULT 0,            -- 누적 매칭 수
    is_flagged BOOLEAN NOT NULL DEFAULT false,       -- 3-15-0 적발 여부
    flagged_at TIMESTAMPTZ,                          -- 최초 적발 시각
    unflagged_by UUID REFERENCES users(user_id),     -- 관리자 해제자 ID
    unflagged_at TIMESTAMPTZ,                        -- 해제 시각
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Step 2: 헬퍼 함수 — 3-15-0 조건 자동 검사 및 플래그 설정
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION check_and_flag_abuser(p_customer_id UUID)
RETURNS VOID AS $$
DECLARE
    v_stats RECORD;
BEGIN
    SELECT * INTO v_stats
    FROM user_penalty_stats
    WHERE customer_id = p_customer_id;

    IF v_stats IS NULL THEN RETURN; END IF;
    -- 이미 적발된 상태면 스킵
    IF v_stats.is_flagged THEN RETURN; END IF;

    -- 3-15-0 AND 조건: 연속 3회 노쇼 + 열람 15건↑ + 매칭률 0%
    IF v_stats.consecutive_noshow >= 3
       AND v_stats.total_read_quotes >= 15
       AND v_stats.total_matched = 0
       AND v_stats.total_requests > 0 THEN
        UPDATE user_penalty_stats
        SET is_flagged = true,
            flagged_at = NOW(),
            updated_at = NOW()
        WHERE customer_id = p_customer_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- Step 3: 트리거 1 — 요청 상태 변경 시 노쇼/매칭 추적
-- (CANCELED/EXPIRED → 노쇼++, MATCHED → 노쇼 리셋 + 매칭++)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION track_noshow_on_request_close()
RETURNS TRIGGER AS $$
BEGIN
    -- OPEN 상태에서 변경된 경우에만 처리
    IF OLD.status != 'OPEN' THEN RETURN NEW; END IF;

    -- 통계 행이 없으면 생성 (UPSERT)
    INSERT INTO user_penalty_stats (customer_id, total_requests)
    VALUES (NEW.customer_id, 1)
    ON CONFLICT (customer_id) DO UPDATE
    SET total_requests = user_penalty_stats.total_requests + 1,
        updated_at = NOW();

    IF NEW.status IN ('CANCELED', 'EXPIRED', 'CLOSED') THEN
        -- 노쇼: 매칭 없이 종료
        UPDATE user_penalty_stats
        SET consecutive_noshow = consecutive_noshow + 1,
            updated_at = NOW()
        WHERE customer_id = NEW.customer_id;
    ELSIF NEW.status = 'MATCHED' THEN
        -- 매칭 성공: 연속 노쇼 리셋 + 매칭 수 증가
        UPDATE user_penalty_stats
        SET consecutive_noshow = 0,
            total_matched = total_matched + 1,
            updated_at = NOW()
        WHERE customer_id = NEW.customer_id;
    END IF;

    -- 3-15-0 자동 검사
    PERFORM check_and_flag_abuser(NEW.customer_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_noshow ON match_requests;
CREATE TRIGGER trg_track_noshow
    AFTER UPDATE OF status ON match_requests
    FOR EACH ROW
    EXECUTE FUNCTION track_noshow_on_request_close();

-- ═══════════════════════════════════════════════════════════════
-- Step 4: 트리거 2 — 견적 열람 시 total_read_quotes 증가
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION track_read_on_quote_read()
RETURNS TRIGGER AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- is_read가 false → true로 변경된 경우에만
    IF OLD.is_read = true OR NEW.is_read = false THEN
        RETURN NEW;
    END IF;

    -- 해당 요청의 고객 ID 조회
    SELECT customer_id INTO v_customer_id
    FROM match_requests
    WHERE request_id = NEW.request_id;

    IF v_customer_id IS NULL THEN RETURN NEW; END IF;

    -- 통계 행 UPSERT + 열람 수 증가
    INSERT INTO user_penalty_stats (customer_id, total_read_quotes)
    VALUES (v_customer_id, 1)
    ON CONFLICT (customer_id) DO UPDATE
    SET total_read_quotes = user_penalty_stats.total_read_quotes + 1,
        updated_at = NOW();

    -- 3-15-0 자동 검사
    PERFORM check_and_flag_abuser(v_customer_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_quote_read ON match_quotes;
CREATE TRIGGER trg_track_quote_read
    AFTER UPDATE OF is_read ON match_quotes
    FOR EACH ROW
    EXECUTE FUNCTION track_read_on_quote_read();

-- ═══════════════════════════════════════════════════════════════
-- Step 5: 관리자 패널티 해제 RPC
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION admin_unflag_abuser(
    p_admin_id UUID,
    p_customer_id UUID
) RETURNS JSONB AS $$
BEGIN
    UPDATE user_penalty_stats
    SET is_flagged = false,
        consecutive_noshow = 0,
        unflagged_by = p_admin_id,
        unflagged_at = NOW(),
        updated_at = NOW()
    WHERE customer_id = p_customer_id;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- Step 6: 배포 검증 쿼리
-- ═══════════════════════════════════════════════════════════════
SELECT trigger_name, event_object_table, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name IN ('trg_track_noshow', 'trg_track_quote_read')
ORDER BY trigger_name;
