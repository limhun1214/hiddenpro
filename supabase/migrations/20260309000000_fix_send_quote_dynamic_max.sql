-- Migration: send_quote_and_deduct_cash RPC 내 v_max_quotes 하드코딩 버그 수정
-- 변경 내용: v_max_quotes INT := 5 (하드코딩) → platform_settings 테이블에서 동적으로 읽도록 수정
-- 적용 후: 관리자가 platform_settings.max_quotes_per_request 값을 변경하면 즉시 반영됨

CREATE OR REPLACE FUNCTION send_quote_and_deduct_cash(
  p_pro_id UUID,
  p_request_id UUID,
  p_deduct_amount DECIMAL,
  p_price DECIMAL,
  p_description TEXT,
  p_image_url TEXT
) RETURNS UUID AS $$
DECLARE
  v_current_cash DECIMAL;
  v_new_cash DECIMAL;
  v_quote_id UUID;
  v_quote_count INT;
  v_request_status TEXT;
  v_max_quotes INT;
BEGIN
  -- platform_settings 테이블에서 최대 견적 수 동적 조회
  SELECT value::int INTO v_max_quotes
  FROM platform_settings
  WHERE key = 'max_quotes_per_request';

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

  -- 3. 해당 요청서의 현재 견적 수 및 상태 확인 (FOR UPDATE 락)
  SELECT quote_count, status INTO v_quote_count, v_request_status
  FROM Match_Requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  -- 요청서가 이미 마감(MATCHED/EXPIRED/CLOSED)된 경우 차단
  IF v_request_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION '정원이 마감된 요청서입니다. (상태: %)', v_request_status;
  END IF;

  -- 견적 제한 수 초과 검증
  IF v_quote_count >= v_max_quotes THEN
     RAISE EXCEPTION '이미 초과된 견적 요청건입니다.';
  END IF;

  -- 4. 고수 보유 캐시 차감 업데이트
  UPDATE Pro_Profiles
  SET current_cash = v_new_cash
  WHERE pro_id = p_pro_id;

  -- 5. 캐시 원장(Cash_Ledger)에 거래 내역 기록 (절대 수정/삭제 불가)
  INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
  VALUES (p_pro_id, 'DEDUCT_QUOTE', -p_deduct_amount, v_new_cash, p_request_id);

  -- 6. 견적서(Match_Quotes) 생성
  INSERT INTO Match_Quotes (request_id, pro_id, cost_deducted, is_read, is_matched, price, description, image_url)
  VALUES (p_request_id, p_pro_id, p_deduct_amount, false, false, p_price, p_description, p_image_url)
  RETURNING quote_id INTO v_quote_id;

  -- 7. 요청서(Match_Requests)의 참여한 고수 수(quote_count) 증가
  UPDATE Match_Requests
  SET quote_count = quote_count + 1
  WHERE request_id = p_request_id;

  -- 생성된 견적서 ID 반환
  RETURN v_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
