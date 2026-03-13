# HiddenPro MVP 핵심 API 명세 (05_API_Specification)

## 📌 설계 원칙
- **Stateless Auth:** 모든 요청은 헤더의 `Authorization: Bearer <Token>`을 통해 유저를 식별합니다.
- **Role-Based Access Control (RBAC):** 고수(PRO) 전용 기능은 `role` 값이 'PRO'인 경우에만 호출 가능합니다.

---

### 🔐 1. 계정 및 권한 (Auth & User)
- `POST /api/v1/auth/social-login`: 소셜 로그인 및 유저 생성. (선 작성 후 로그인 매핑 포함)
- `PATCH /api/v1/user/upgrade-to-pro`: 일반 고객에서 고수로 권한 전환 (신분증/사업자 데이터 수신).
- `GET /api/v1/user/profile`: 내 프로필 및 권한 정보 조회.

### 💰 2. 캐시 및 지갑 (Wallet - Ledger 기반)
- `GET /api/v1/wallet/balance`: 현재 보유 캐시 잔액 조회.
- `GET /api/v1/wallet/history`: 캐시 충전/차감 원장 내역 조회.
- `POST /api/v1/wallet/charge`: GCash/Maya 등을 통한 캐시 충전 요청.

### 📝 3. 매칭 및 견적 (Matching & Quotes)
- `POST /api/v1/match/request`: 고객의 동적 요청서 제출 (JSON 데이터 저장).
- `GET /api/v1/match/pro/available`: 고수용 - 내 카테고리/지역의 대기 중인 요청서 리스트 조회.
- **`POST /api/v1/match/pro/quote`**: 고수의 견적 발송. (호출 시 즉시 `Cash_Ledger`에서 캐시 차감 로직 실행)
- `GET /api/v1/match/customer/quotes`: 고객용 - 내가 받은 견적 리스트 조회.

### 💬 4. 채팅 및 리뷰 (Communication & Review)
- `GET /api/v1/chat/rooms`: 내 채팅방 리스트 조회.
- `POST /api/v1/chat/match-confirm`: [매칭 확정하기]. (채팅방 상태를 'MATCHED'로 변경)
- `POST /api/v1/chat/review`: 리뷰 작성. (채팅방 상태가 'MATCHED'인 경우에만 허용)