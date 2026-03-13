-- [System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
-- [Tech Debt Removal: 스키마 정규화] 파편화된 컬럼명 단일 진실 공급원(SSOT) 통일

ALTER TABLE public.reviews RENAME COLUMN writer_id TO customer_id;
ALTER TABLE public.reviews RENAME COLUMN content TO comment;
