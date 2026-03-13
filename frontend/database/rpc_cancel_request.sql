-- =====================================================================
-- RPC: 요청 취소 및 종속 알림 무효화 (단일 트랜잭션, SECURITY DEFINER)
-- 
-- 프론트엔드에서 조작할 수 없도록 DB 내부에서 원자적(Atomic)으로 실행.
-- SECURITY DEFINER를 사용하여 RLS를 우회하고, 고객이 소유하지 않은
-- match_quotes(고수 소유)와 notifications(시스템)도 안전하게 수정한다.
--
-- 반환값: 해당 고객의 잔여 미읽음 견적 수 + 잔여 미읽음 알림 수
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_request_and_invalidate(
  p_request_id UUID,
  p_customer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_owner_id UUID;
  v_remaining_quotes BIGINT;
  v_remaining_notifs BIGINT;
BEGIN
  -- 1. 요청서 소유권 및 상태 검증 (FOR UPDATE 락)
  SELECT status, customer_id INTO v_current_status, v_owner_id
  FROM match_requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION '존재하지 않는 요청서입니다.';
  END IF;

  IF v_owner_id != p_customer_id THEN
    RAISE EXCEPTION '본인의 요청서만 취소할 수 있습니다.';
  END IF;

  IF v_current_status != 'OPEN' THEN
    RAISE EXCEPTION '이미 처리된 요청서입니다. (상태: %)', v_current_status;
  END IF;

  -- 2. 요청서 상태를 CANCELED로 변경
  UPDATE match_requests
  SET status = 'CANCELED'
  WHERE request_id = p_request_id;

  -- 3. 종속 견적(match_quotes)의 미읽음 알림 일괄 무효화
  UPDATE match_quotes
  SET is_read = true
  WHERE request_id = p_request_id
    AND is_read = false;

  -- 4. 종속 알림(notifications)의 미읽음 알림 일괄 무효화
  UPDATE notifications
  SET is_read = true
  WHERE reference_id = p_request_id
    AND type IN ('QUOTE', 'MATCH')
    AND user_id = p_customer_id
    AND is_read = false;

  -- 5. 해당 고객의 잔여 미읽음 카운트 조회 (프론트엔드 즉시 반영용)
  SELECT COUNT(*) INTO v_remaining_quotes
  FROM match_quotes mq
  JOIN match_requests mr ON mr.request_id = mq.request_id
  WHERE mr.customer_id = p_customer_id
    AND mq.is_read = false;

  SELECT COUNT(*) INTO v_remaining_notifs
  FROM notifications
  WHERE user_id = p_customer_id
    AND is_read = false
    AND type NOT IN ('CHAT', 'MATCH', 'QUOTE');

  -- 6. 결과 반환
  RETURN jsonb_build_object(
    'success', true,
    'remaining_unread_quotes', v_remaining_quotes,
    'remaining_unread_notifs', v_remaining_notifs
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
