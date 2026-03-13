-- reviews 테이블에 메인 페이지 노출 여부를 결정하는 컬럼 추가
ALTER TABLE IF EXISTS public.reviews
ADD COLUMN IF NOT EXISTS is_featured_on_main BOOLEAN DEFAULT false;

-- 기본 설명선언
COMMENT ON COLUMN public.reviews.is_featured_on_main IS '메인 페이지 프론트엔드 노출 여부를 관리자(게이트키퍼)가 결정하는 플래그';
