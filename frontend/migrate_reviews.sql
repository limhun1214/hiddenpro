-- 1. pro_profiles 테이블에 평점 및 리뷰 개수 컬럼 추가
ALTER TABLE pro_profiles 
ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

-- 2. reviews 테이블에 매칭 1건당 1개의 리뷰만 달릴 수 있도록 UNIQUE 제약 조건 추가
ALTER TABLE reviews
ADD CONSTRAINT unique_room_id UNIQUE (room_id);

-- 3. 리뷰 작성/수정/삭제 시 pro_profiles의 평점과 리뷰 개수를 갱신하는 함수
CREATE OR REPLACE FUNCTION update_pro_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_pro_id UUID;
BEGIN
    -- 삭제 시에는 OLD.pro_id, 추가/수정 시에는 NEW.pro_id 사용
    IF TG_OP = 'DELETE' THEN
        target_pro_id := OLD.pro_id;
    ELSE
        target_pro_id := NEW.pro_id;
    END IF;

    -- 평균 별점과 리뷰 개수 계산하여 pro_profiles 업데이트
    UPDATE pro_profiles
    SET 
        average_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE pro_id = target_pro_id), 0.0),
        review_count = COALESCE((SELECT COUNT(*) FROM reviews WHERE pro_id = target_pro_id), 0)
    WHERE pro_id = target_pro_id;

    RETURN NULL; -- AFTER 트리거이므로 NULL 반환해도 무방
END;
$$ LANGUAGE plpgsql;

-- 4. 트리거 생성
DROP TRIGGER IF EXISTS tr_update_pro_rating ON reviews;
CREATE TRIGGER tr_update_pro_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_pro_rating();
