-- ═══════════════════════════════════════════════════════
-- Users.role 컬럼 업데이트 방지 트리거
-- ═══════════════════════════════════════════════════════
-- [주의] 이 트리거는 Admin의 역할 변경도 차단합니다.
-- 필요 시 트리거 내부에 admin 예외 로직을 추가하세요.
-- Supabase SQL Editor에서 실행하십시오.

CREATE OR REPLACE FUNCTION prevent_role_update()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS NOT NULL AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION '역할 변경 불가: 최초 가입 시 설정된 역할(%)은 변경할 수 없습니다.', OLD.role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trg_prevent_role_update ON users;

CREATE TRIGGER trg_prevent_role_update
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_update();
