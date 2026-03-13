-- =====================================================================
-- 환불 트리거 배포 확인 및 안전 재배포 (멱등성 보장)
--
-- bonus_cash_migration.sql의 환불 트리거가 DB에 존재하는지 확인하고,
-- 없으면 재생성합니다. 이미 존재해도 안전하게 교체됩니다.
--
-- Supabase SQL Editor에서 실행하세요.
-- =====================================================================

-- ─── Step 1: tx_type ENUM에 BONUS_REFUND 추가 (없으면) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'BONUS_REFUND'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tx_type')
  ) THEN
    ALTER TYPE tx_type ADD VALUE 'BONUS_REFUND';
  END IF;
END $$;

-- ─── Step 2: pro_profiles에 bonus_cash 컬럼 추가 (없으면) ───
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pro_profiles' AND column_name = 'bonus_cash'
  ) THEN
    ALTER TABLE pro_profiles ADD COLUMN bonus_cash INTEGER DEFAULT 0;
  END IF;
END $$;

-- ─── Step 3: 미열람 견적 환불 RPC 함수 (CREATE OR REPLACE = 안전) ───
CREATE OR REPLACE FUNCTION refund_unread_quotes(p_request_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_quote RECORD;
  v_refund_count INTEGER := 0;
  v_current_bonus DECIMAL;
  v_new_bonus DECIMAL;
BEGIN
  FOR v_quote IN
    SELECT quote_id, pro_id, cost_deducted
    FROM Match_Quotes
    WHERE request_id = p_request_id
      AND is_read = false
      AND cost_deducted > 0
  LOOP
    SELECT COALESCE(bonus_cash, 0) INTO v_current_bonus
    FROM Pro_Profiles
    WHERE pro_id = v_quote.pro_id
    FOR UPDATE;

    v_new_bonus := v_current_bonus + v_quote.cost_deducted;

    UPDATE Pro_Profiles
    SET bonus_cash = v_new_bonus
    WHERE pro_id = v_quote.pro_id;

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

-- ─── Step 4: 자동 환불 트리거 재생성 (멱등성 보장) ───
CREATE OR REPLACE FUNCTION trigger_refund_on_request_close()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'OPEN' AND NEW.status IN ('MATCHED', 'CLOSED', 'EXPIRED', 'CANCELED') THEN
    PERFORM refund_unread_quotes(NEW.request_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_refund_unread_on_close ON Match_Requests;
CREATE TRIGGER trg_refund_unread_on_close
  AFTER UPDATE OF status ON Match_Requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refund_on_request_close();

-- ─── Step 5: 배포 검증 쿼리 ───
-- 아래 쿼리 결과에 trg_refund_unread_on_close와 trg_prevent_request_edit가
-- 모두 표시되면 정상 배포 완료입니다.
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'match_requests'
ORDER BY trigger_name;
