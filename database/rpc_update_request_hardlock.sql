-- =====================================================================
-- DB 방어벽: 견적이 도착한 요청서 수정 원천 차단 (Hard Lock)
--
-- quote_count > 0인 요청서의 dynamic_answers, service_type, region,
-- category_id 등 핵심 필드 수정을 어떤 경로(프론트/API/SQL)로든 차단.
-- 
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================================

-- 1. 트리거 함수 생성
CREATE OR REPLACE FUNCTION prevent_request_edit_after_quote()
RETURNS TRIGGER AS $$
BEGIN
  -- 견적이 1건이라도 도착한 경우, 핵심 요청 정보 변경 차단
  IF OLD.quote_count > 0 THEN
    -- dynamic_answers 수정 차단
    IF NEW.dynamic_answers IS DISTINCT FROM OLD.dynamic_answers THEN
      RAISE EXCEPTION '견적이 도착한 요청서는 수정할 수 없습니다. (현재 견적 수: %)', OLD.quote_count;
    END IF;

    -- category_id 수정 차단
    IF NEW.category_id IS DISTINCT FROM OLD.category_id THEN
      RAISE EXCEPTION '견적이 도착한 요청서의 카테고리는 변경할 수 없습니다.';
    END IF;

    -- region / region_id 수정 차단
    IF NEW.region_id IS DISTINCT FROM OLD.region_id THEN
      RAISE EXCEPTION '견적이 도착한 요청서의 지역은 변경할 수 없습니다.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 기존 트리거 안전 제거 후 재생성 (멱등성 보장)
DROP TRIGGER IF EXISTS trg_prevent_request_edit ON Match_Requests;
CREATE TRIGGER trg_prevent_request_edit
  BEFORE UPDATE ON Match_Requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_request_edit_after_quote();
