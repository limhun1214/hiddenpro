-- Migration: send_quote_and_deduct_cash RPC 보너스 캐시 우선 차감 로직 구현
-- 적용 방법: Supabase SQL Editor에서 이 파일 전체 내용을 실행하세요.
--
-- 변경 내용:
--   - bonus_cash → current_cash 순으로 우선 차감
--   - 잔액 부족 판정: bonus_cash + current_cash < p_deduct_amount
--   - Cash_Ledger 기록: 보너스 차감분은 DEDUCT_BONUS_QUOTE, 실제 차감분은 DEDUCT_QUOTE 로 분리 INSERT
--   - balance_snapshot = 차감 후 bonus_cash + current_cash 합산값

DROP FUNCTION IF EXISTS send_quote_and_deduct_cash(UUID, UUID, DECIMAL, DECIMAL, TEXT, TEXT);

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
  v_bonus_cash   DECIMAL;
  v_bonus_deduct DECIMAL;
  v_real_deduct  DECIMAL;
  v_quote_id     UUID;
  v_quote_count  INT;
  v_request_status TEXT;
  v_max_quotes   INT;
  v_balance_snapshot DECIMAL;
BEGIN
  -- platform_settings 테이블에서 최대 견적 수 동적 조회
  SELECT value::int INTO v_max_quotes
  FROM platform_settings
  WHERE key = 'max_quotes_per_request';

  -- 1. 고수 캐시 잔액 조회 (동시성 방지 FOR UPDATE 락)
  SELECT current_cash, COALESCE(bonus_cash, 0)
  INTO v_current_cash, v_bonus_cash
  FROM Pro_Profiles
  WHERE pro_id = p_pro_id
  FOR UPDATE;

  -- 2. 총 잔액 부족 검증 (보너스 + 실제 합산)
  IF (v_bonus_cash + v_current_cash) < p_deduct_amount THEN
    RAISE EXCEPTION '잔액이 부족합니다.';
  END IF;

  -- 3. 보너스 우선 차감 계산
  v_bonus_deduct := LEAST(v_bonus_cash, p_deduct_amount);
  v_real_deduct  := p_deduct_amount - v_bonus_deduct;

  -- 4. 해당 요청서의 현재 견적 수 및 상태 확인 (FOR UPDATE 락)
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

  -- 5. 고수 보유 캐시 차감 업데이트 (보너스 + 실제 동시 차감)
  UPDATE Pro_Profiles
  SET bonus_cash   = v_bonus_cash   - v_bonus_deduct,
      current_cash = v_current_cash - v_real_deduct
  WHERE pro_id = p_pro_id;

  -- balance_snapshot = 차감 후 bonus_cash + current_cash 합산값
  v_balance_snapshot := (v_bonus_cash - v_bonus_deduct) + (v_current_cash - v_real_deduct);

  -- 6. Cash_Ledger 원장 기록 (보너스 차감분 / 실제 차감분 분리 INSERT)
  IF v_bonus_deduct > 0 THEN
    INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
    VALUES (p_pro_id, 'DEDUCT_BONUS_QUOTE', -v_bonus_deduct, v_balance_snapshot, p_request_id);
  END IF;

  IF v_real_deduct > 0 THEN
    INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id)
    VALUES (p_pro_id, 'DEDUCT_QUOTE', -v_real_deduct, v_balance_snapshot, p_request_id);
  END IF;

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
