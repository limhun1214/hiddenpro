-- =====================================================================
-- DB 클렌징 마이그레이션: CANCELED 요청 종속 유령 알림 일괄 정비
-- 실행 대상: Supabase SQL Editor (1회성 마이그레이션)
-- 설명: 이미 CANCELED 상태인 match_requests에 종속된
--       match_quotes 및 notifications의 is_read=false 레코드를
--       is_read=true로 일괄 정비하여 GNB 배지 오염을 해소한다.
-- =====================================================================

-- 1. CANCELED 요청의 미읽음 견적(match_quotes) 일괄 정비
UPDATE match_quotes
SET is_read = true
WHERE is_read = false
  AND request_id IN (
    SELECT request_id
    FROM match_requests
    WHERE status = 'CANCELED'
  );

-- 2. CANCELED 요청에 종속된 미읽음 알림(notifications) 일괄 정비
UPDATE notifications
SET is_read = true
WHERE is_read = false
  AND type IN ('QUOTE', 'MATCH')
  AND reference_id IN (
    SELECT request_id
    FROM match_requests
    WHERE status = 'CANCELED'
  );
