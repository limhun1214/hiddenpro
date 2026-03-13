CREATE OR REPLACE FUNCTION send_quote_and_deduct_cash(
  p_pro_id UUID,
  p_request_id UUID,
  p_deduct_amount DECIMAL,
  p_price DECIMAL DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_current_cash DECIMAL;
  v_new_cash DECIMAL;
  v_quote_id UUID;
  v_quote_count INT;
  v_max_quotes INT := 5; -- MVP 기획상 1:N 제한 (예: 5명)
  v_created_at TIMESTAMPTZ;
  v_status VARCHAR;
BEGIN
  -- 0. 중복 발송 검증
  IF EXISTS (
    SELECT 1 FROM Match_Quotes
    WHERE request_id = p_request_id AND pro_id = p_pro_id
  ) THEN
    RAISE EXCEPTION '이미 견적을 발송한 요청입니다.';
  END IF;

  -- 1. 고수 캐시 잔액 조회 (동시성 문제를 방지하기 위한 FOR UPDATE 락)
  SELECT current_cash INTO v_current_cash
  FROM Pro_Profiles
  WHERE pro_id = p_pro_id
  FOR UPDATE;

  -- 2. 잔액 부족 검증
  IF v_current_cash < p_deduct_amount THEN
    RAISE EXCEPTION '잔액이 부족합니다.';
  END IF;

  v_new_cash := v_current_cash - p_deduct_amount;

  -- 3. 해당 요청서의 현재 견적 수, 생성일, 상태 확인 (FOR UPDATE 락)
  SELECT quote_count, created_at, status INTO v_quote_count, v_created_at, v_status
  FROM Match_Requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  -- 4. 기한 및 제한 수 검증
  IF v_created_at + INTERVAL '48 hours' <= NOW() THEN
     RAISE EXCEPTION '시간이 초과되어 마감된 견적입니다.';
  END IF;

  IF v_quote_count >= v_max_quotes THEN
     RAISE EXCEPTION '이미 5명 정원이 마감된 요청입니다.';
  END IF;

  IF v_status != 'OPEN' THEN
     RAISE EXCEPTION '이미 마감된 견적입니다.';
  END IF;

  -- 5. 고수 보유 캐시 차감 업데이트
  UPDATE Pro_Profiles
  SET current_cash = v_new_cash
  WHERE pro_id = p_pro_id;

  -- 6. 캐시 원장(Cash_Ledger)에 거래 내역 기록
  INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
  VALUES (p_pro_id, 'DEDUCT_QUOTE', -p_deduct_amount, v_new_cash, p_request_id);

  -- 7. 견적서(Match_Quotes) 생성
  INSERT INTO Match_Quotes (request_id, pro_id, cost_deducted, is_read, is_matched, price, description, image_url)
  VALUES (p_request_id, p_pro_id, p_deduct_amount, false, false, p_price, p_description, p_image_url)
  RETURNING quote_id INTO v_quote_id;

  -- 8. 요청서(Match_Requests)의 참여한 고수 수(quote_count) 증가
  UPDATE Match_Requests
  SET quote_count = quote_count + 1
  WHERE request_id = p_request_id;

  -- 생성된 견적서 ID 반환
  RETURN v_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
