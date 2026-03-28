# 캐시 시스템 메커니즘 딥다이브 리포트 (CASH_SYSTEM_REPORT)

## 1. 차감 로직 (견적 발송 시)

현재 `send_quote_and_deduct_cash` DB 함수(RPC) 에 따르면, 견적 발송 시 '보너스 캐시'를 최우선으로 차감하고, 부족한 금액만큼 '실제 캐시'에서 차감하는 순서로 동작합니다.

- **비율/순서**: `bonus_cash` 전액 소진 후 `current_cash` 차감.
- **원장 기록(Cash_Ledger)**: 보너스와 실제 캐시 차감액을 분리하여 `DEDUCT_BONUS_QUOTE` 및 `DEDUCT_QUOTE` 두 건의 트랜잭션으로 기록합니다.
- **견적서 기록(Match_Quotes)**: 하지만 생성되는 견적서 항목에는 `cost_deducted` (총 차감액) 하나만 저장되며 유상/무상 차감 비율은 원장(Ledger)에만 남습니다.

## 2. 자동 환불 로직 (취소/만료 시)

현재 데이터베이스의 `trigger_refund_on_request_close` 트리거 및 `refund_unread_quotes` 함수에 의해 환불이 처리됩니다.

- **속성 추적 여부 (캐시 세탁 방지)**: **아니오, 현재 캐시 세탁 방지 로직이 없습니다.**
- **동작 방식**: 기존 차감 시 유상/무상(실제/보너스)을 섞어서 결제했더라도, 취소/만료 시에는 `cost_deducted` 금액 전체를 무조건 `bonus_cash`로 환불합니다.
- **원장 기록**: `BONUS_REFUND` (미열람 마감 보상) 단일 타입으로 저장됩니다.

## 3. 수동 통제 로직 (관리자 UI)

프론트엔드(`admin/page.tsx`) 내포된 수동 캐시 부여/차감 기능은 DB의 `admin_manage_cash` RPC를 직접 호출합니다.

- **전달 데이터**: 어드민 ID, 대상 고수 ID, 금액, 트랜잭션 타입(`ADMIN_CHARGE` 또는 `ADMIN_REFUND`), 코멘트, 그리고 **캐시 속성(`p_cash_type`: 'REAL' 또는 'BONUS')**.
- **백엔드 처리**: `admin_manage_cash`는 넘어온 `p_cash_type`에 따라 `current_cash` 또는 `bonus_cash` 중 어느 컬럼을 갱신할지 결정하며 원장에도 상세 타입(`ADMIN_BONUS_CHARGE`, `ADMIN_REFUND` 등)을 명확히 분류하여 기록합니다. 관리자는 UI 상에서 유상/무상의 구분을 완벽하게 통제할 수 있습니다.
