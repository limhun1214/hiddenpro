-- ═══════════════════════════════════════════════════════════════════════
-- 미열람 견적 보너스 캐시 환불 시스템 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────
-- 1. pro_profiles에 bonus_cash 컬럼 추가
-- ───────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pro_profiles' AND column_name = 'bonus_cash'
    ) THEN
        ALTER TABLE pro_profiles ADD COLUMN bonus_cash INTEGER DEFAULT 0;
    END IF;
END $$;

-- ───────────────────────────────────────
-- 2. send_quote_and_deduct_cash RPC 수정
--    보너스 캐시 우선 차감 → 부족분만 실제 캐시에서 차감
-- ───────────────────────────────────────
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
  v_bonus_cash DECIMAL;
  v_bonus_used DECIMAL := 0;
  v_real_used DECIMAL := 0;
  v_new_cash DECIMAL;
  v_new_bonus DECIMAL;
  v_quote_id UUID;
  v_quote_count INT;
  v_request_status TEXT;
  v_max_quotes INT := 5;
BEGIN
  -- 1. 고수 캐시 잔액 조회 (행 잠금)
  SELECT current_cash, COALESCE(bonus_cash, 0) INTO v_current_cash, v_bonus_cash
  FROM Pro_Profiles
  WHERE pro_id = p_pro_id
  FOR UPDATE;

  -- 2. 총 잔액(실제+보너스) 검증
  IF (v_current_cash + v_bonus_cash) < p_deduct_amount THEN
    RAISE EXCEPTION '잔액이 부족합니다. (실제: %, 보너스: %, 필요: %)', v_current_cash, v_bonus_cash, p_deduct_amount;
  END IF;

  -- 3. 보너스 우선 차감 계산
  IF v_bonus_cash >= p_deduct_amount THEN
    v_bonus_used := p_deduct_amount;
    v_real_used := 0;
  ELSE
    v_bonus_used := v_bonus_cash;
    v_real_used := p_deduct_amount - v_bonus_cash;
  END IF;

  v_new_cash := v_current_cash - v_real_used;
  v_new_bonus := v_bonus_cash - v_bonus_used;

  -- 4. 해당 요청서 상태 확인 (행 잠금)
  SELECT quote_count, status INTO v_quote_count, v_request_status
  FROM Match_Requests
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF v_request_status IS DISTINCT FROM 'OPEN' THEN
    RAISE EXCEPTION '정원이 마감된 요청서입니다. (상태: %)', v_request_status;
  END IF;

  IF v_quote_count >= v_max_quotes THEN
     RAISE EXCEPTION '이미 초과된 견적 요청건입니다.';
  END IF;

  -- 5. 캐시 차감 업데이트
  UPDATE Pro_Profiles
  SET current_cash = v_new_cash,
      bonus_cash = v_new_bonus
  WHERE pro_id = p_pro_id;

  -- 6. 원장 기록
  INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id, description)
  VALUES (p_pro_id, 'DEDUCT_QUOTE', -p_deduct_amount, v_new_cash + v_new_bonus, p_request_id,
    CASE WHEN v_bonus_used > 0 AND v_real_used > 0 THEN
      '견적 발송 (보너스 ' || v_bonus_used || ' + 실제 ' || v_real_used || ')'
    WHEN v_bonus_used > 0 THEN
      '견적 발송 (보너스 캐시 사용)'
    ELSE
      '견적 발송'
    END
  );

  -- 7. 견적서 생성
  INSERT INTO Match_Quotes (request_id, pro_id, cost_deducted, is_read, is_matched, price, description, image_url)
  VALUES (p_request_id, p_pro_id, p_deduct_amount, false, false, p_price, p_description, p_image_url)
  RETURNING quote_id INTO v_quote_id;

  -- 8. 견적 카운트 증가
  UPDATE Match_Requests
  SET quote_count = quote_count + 1
  WHERE request_id = p_request_id;

  RETURN v_quote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────
-- 3. 미열람 견적 보너스 환불 RPC
-- ───────────────────────────────────────
CREATE OR REPLACE FUNCTION refund_unread_quotes(p_request_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_quote RECORD;
  v_refund_count INTEGER := 0;
  v_current_bonus DECIMAL;
  v_new_bonus DECIMAL;
BEGIN
  -- 해당 요청에 보낸 견적 중 미열람(is_read=false) 건만 순회
  FOR v_quote IN
    SELECT quote_id, pro_id, cost_deducted
    FROM Match_Quotes
    WHERE request_id = p_request_id
      AND is_read = false
      AND cost_deducted > 0
  LOOP
    -- 고수 보너스 캐시에 환급 (행 잠금)
    SELECT COALESCE(bonus_cash, 0) INTO v_current_bonus
    FROM Pro_Profiles
    WHERE pro_id = v_quote.pro_id
    FOR UPDATE;

    v_new_bonus := v_current_bonus + v_quote.cost_deducted;

    UPDATE Pro_Profiles
    SET bonus_cash = v_new_bonus
    WHERE pro_id = v_quote.pro_id;

    -- 원장 기록
    INSERT INTO Cash_Ledger (pro_id, tx_type, amount, balance_snapshot, reference_id, description)
    VALUES (
      v_quote.pro_id,
      'BONUS_REFUND',
      v_quote.cost_deducted,
      (SELECT current_cash FROM Pro_Profiles WHERE pro_id = v_quote.pro_id) + v_new_bonus,
      p_request_id,
      '미열람 마감 보상 (+' || v_quote.cost_deducted || ' 보너스 캐시)'
    );

    v_refund_count := v_refund_count + 1;
  END LOOP;

  RETURN v_refund_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ───────────────────────────────────────
-- 4. 자동 트리거: 요청 상태 변경 시 미열람 환불
-- ───────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_refund_on_request_close()
RETURNS TRIGGER AS $$
BEGIN
  -- 상태가 OPEN → MATCHED/CLOSED/EXPIRED/CANCELED로 변경될 때만 실행
  IF OLD.status = 'OPEN' AND NEW.status IN ('MATCHED', 'CLOSED', 'EXPIRED', 'CANCELED') THEN
    PERFORM refund_unread_quotes(NEW.request_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거가 있으면 삭제 후 재생성
DROP TRIGGER IF EXISTS trg_refund_unread_on_close ON Match_Requests;
CREATE TRIGGER trg_refund_unread_on_close
  AFTER UPDATE OF status ON Match_Requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refund_on_request_close();
