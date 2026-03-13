-- 마이그레이션: DEDUCT_BONUS_QUOTE ENUM 값 추가
-- 이미 존재하는 경우 안전하게 스킵

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DEDUCT_BONUS_QUOTE'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'tx_type')
  ) THEN
    ALTER TYPE tx_type ADD VALUE 'DEDUCT_BONUS_QUOTE';
  END IF;
END $$;
