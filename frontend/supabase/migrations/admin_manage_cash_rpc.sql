-- ═══════════════════════════════════════════════════════
-- 1. 관리자 전용 캐시 제어 RPC (원자적 트랜잭션)
-- ═══════════════════════════════════════════════════════
-- Supabase SQL Editor에서 실행하십시오.

CREATE OR REPLACE FUNCTION admin_manage_cash(
    p_admin_id UUID,
    p_target_pro_id UUID,
    p_amount INTEGER,
    p_tx_type TEXT,
    p_description TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
    v_current_cash INTEGER;
    v_new_balance INTEGER;
    v_result JSONB;
BEGIN
    -- ── 1단계: 관리자 권한 검증 ──
    SELECT role INTO v_admin_role
    FROM users
    WHERE user_id = p_admin_id;

    IF v_admin_role IS NULL OR UPPER(v_admin_role) != 'ADMIN' THEN
        RAISE EXCEPTION '권한 없음: ADMIN 역할만 이 함수를 실행할 수 있습니다. (role: %)', COALESCE(v_admin_role, 'NULL');
    END IF;

    -- ── 2단계: tx_type 유효성 검증 ──
    IF p_tx_type NOT IN ('ADMIN_CHARGE', 'ADMIN_REFUND') THEN
        RAISE EXCEPTION '유효하지 않은 트랜잭션 유형: %. ADMIN_CHARGE 또는 ADMIN_REFUND만 허용됩니다.', p_tx_type;
    END IF;

    -- ── 3단계: 금액 유효성 검증 ──
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '금액은 0보다 커야 합니다. (입력값: %)', p_amount;
    END IF;

    -- ── 4단계: 대상 고수 현재 잔액 조회 (행 잠금) ──
    SELECT current_cash INTO v_current_cash
    FROM pro_profiles
    WHERE pro_id = p_target_pro_id
    FOR UPDATE;

    IF v_current_cash IS NULL THEN
        RAISE EXCEPTION '대상 고수를 찾을 수 없습니다. (pro_id: %)', p_target_pro_id;
    END IF;

    -- ── 5단계: 새 잔액 계산 ──
    IF p_tx_type = 'ADMIN_CHARGE' THEN
        v_new_balance := v_current_cash + p_amount;
    ELSE
        v_new_balance := v_current_cash - p_amount;
    END IF;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION '차감 후 잔액이 0 미만이 됩니다. (현재: %, 차감: %, 결과: %)', v_current_cash, p_amount, v_new_balance;
    END IF;

    -- ── 6단계: Pro_Profiles 캐시 업데이트 ──
    UPDATE pro_profiles
    SET current_cash = v_new_balance
    WHERE pro_id = p_target_pro_id;

    -- ── 7단계: Cash_Ledger 원장 기록 ──
    INSERT INTO cash_ledger (pro_id, tx_type, amount, balance_snapshot, description)
    VALUES (
        p_target_pro_id,
        p_tx_type,
        CASE WHEN p_tx_type = 'ADMIN_CHARGE' THEN p_amount ELSE -p_amount END,
        v_new_balance,
        COALESCE(NULLIF(p_description, ''),
            CASE WHEN p_tx_type = 'ADMIN_CHARGE' THEN '관리자 수동 충전' ELSE '관리자 수동 환불/차감' END
        )
    );

    -- ── 8단계: 결과 반환 ──
    v_result := jsonb_build_object(
        'success', true,
        'pro_id', p_target_pro_id,
        'tx_type', p_tx_type,
        'amount', p_amount,
        'previous_balance', v_current_cash,
        'new_balance', v_new_balance,
        'description', p_description
    );

    RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════
-- 2. 리뷰 블라인드 스키마 마이그레이션
-- ═══════════════════════════════════════════════════════

-- reviews 테이블에 is_hidden 컬럼 추가 (이미 존재하면 무시)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reviews' AND column_name = 'is_hidden'
    ) THEN
        ALTER TABLE reviews ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 인덱스 추가 (조회 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_is_hidden ON reviews (is_hidden);
