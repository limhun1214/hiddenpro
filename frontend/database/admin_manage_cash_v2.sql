-- ═══════════════════════════════════════════════════════════════════════
-- admin_manage_cash RPC 고도화: 보너스 캐시 제어 지원
-- 기존 함수를 DROP 후 p_cash_type 파라미터를 추가하여 재생성합니다.
-- Supabase SQL Editor에서 실행하세요.
-- ═══════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS admin_manage_cash(UUID, UUID, INTEGER, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_manage_cash(
    p_admin_id UUID,
    p_target_pro_id UUID,
    p_amount INTEGER,
    p_tx_type TEXT,
    p_description TEXT DEFAULT '',
    p_cash_type TEXT DEFAULT 'REAL'   -- 'REAL' 또는 'BONUS'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_admin_role TEXT;
    v_current_cash INTEGER;
    v_bonus_cash INTEGER;
    v_new_balance INTEGER;
    v_target_column TEXT;
    v_final_tx_type TEXT;
    v_final_desc TEXT;
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

    -- ── 2-1단계: cash_type 유효성 검증 ──
    IF p_cash_type NOT IN ('REAL', 'BONUS') THEN
        RAISE EXCEPTION '유효하지 않은 캐시 유형: %. REAL 또는 BONUS만 허용됩니다.', p_cash_type;
    END IF;

    -- ── 3단계: 금액 유효성 검증 ──
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '금액은 0보다 커야 합니다. (입력값: %)', p_amount;
    END IF;

    -- ── 4단계: 대상 고수 현재 잔액 조회 (행 잠금) ──
    SELECT current_cash, COALESCE(bonus_cash, 0)
    INTO v_current_cash, v_bonus_cash
    FROM pro_profiles
    WHERE pro_id = p_target_pro_id
    FOR UPDATE;

    IF v_current_cash IS NULL THEN
        RAISE EXCEPTION '대상 고수를 찾을 수 없습니다. (pro_id: %)', p_target_pro_id;
    END IF;

    -- ── 5단계: 캐시 유형에 따른 분기 처리 ──
    IF p_cash_type = 'BONUS' THEN
        -- 보너스 캐시 제어
        IF p_tx_type = 'ADMIN_CHARGE' THEN
            v_new_balance := v_bonus_cash + p_amount;
            v_final_tx_type := 'ADMIN_BONUS_CHARGE';
        ELSE
            v_new_balance := v_bonus_cash - p_amount;
            v_final_tx_type := 'ADMIN_BONUS_REFUND';
        END IF;

        IF v_new_balance < 0 THEN
            RAISE EXCEPTION '차감 후 보너스 잔액이 0 미만이 됩니다. (현재: %, 차감: %, 결과: %)', v_bonus_cash, p_amount, v_new_balance;
        END IF;

        UPDATE pro_profiles
        SET bonus_cash = v_new_balance
        WHERE pro_id = p_target_pro_id;
    ELSE
        -- 실제 캐시 제어 (기존 로직 보존)
        IF p_tx_type = 'ADMIN_CHARGE' THEN
            v_new_balance := v_current_cash + p_amount;
            v_final_tx_type := 'ADMIN_CHARGE';
        ELSE
            v_new_balance := v_current_cash - p_amount;
            v_final_tx_type := 'ADMIN_REFUND';
        END IF;

        IF v_new_balance < 0 THEN
            RAISE EXCEPTION '차감 후 잔액이 0 미만이 됩니다. (현재: %, 차감: %, 결과: %)', v_current_cash, p_amount, v_new_balance;
        END IF;

        UPDATE pro_profiles
        SET current_cash = v_new_balance
        WHERE pro_id = p_target_pro_id;
    END IF;

    -- ── 6단계: description 결정 ──
    v_final_desc := COALESCE(NULLIF(p_description, ''),
        CASE
            WHEN v_final_tx_type = 'ADMIN_CHARGE' THEN '관리자 수동 충전'
            WHEN v_final_tx_type = 'ADMIN_REFUND' THEN '관리자 수동 환불/차감'
            WHEN v_final_tx_type = 'ADMIN_BONUS_CHARGE' THEN '관리자 보너스 캐시 지급'
            WHEN v_final_tx_type = 'ADMIN_BONUS_REFUND' THEN '관리자 보너스 캐시 차감'
        END
    );

    -- ── 7단계: Cash_Ledger 원장 기록 ──
    INSERT INTO cash_ledger (pro_id, tx_type, amount, balance_snapshot, description)
    VALUES (
        p_target_pro_id,
        v_final_tx_type,
        CASE WHEN p_tx_type = 'ADMIN_CHARGE' THEN p_amount ELSE -p_amount END,
        CASE WHEN p_cash_type = 'BONUS' THEN v_current_cash + v_new_balance ELSE v_new_balance + v_bonus_cash END,
        v_final_desc
    );

    -- ── 8단계: 결과 반환 ──
    v_result := jsonb_build_object(
        'success', true,
        'pro_id', p_target_pro_id,
        'tx_type', v_final_tx_type,
        'cash_type', p_cash_type,
        'amount', p_amount,
        'previous_balance', CASE WHEN p_cash_type = 'BONUS' THEN v_bonus_cash ELSE v_current_cash END,
        'new_balance', v_new_balance,
        'description', v_final_desc
    );

    RETURN v_result;
END;
$$;
