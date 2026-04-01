# HiddenPro — 데이터베이스 스키마 및 RLS 정책

> **문서 위치**: `docs/supabase_schema.md`
> **적용 대상**: 안티그래비티(실행 에이전트) 및 아키텍츠(설계 에이전트) 모두
> **최종 업데이트**: 2026-03-22
> **규모 기준**: 100만 MAU / 10만 CCU
> **목적**: Supabase Postgres 기반 DB 스키마 설계 기준, RLS 보안 원칙, 쿼리 최적화 규칙 기록

> [!IMPORTANT]
> DB 관련 작업(RPC 설계, Migration, RLS 수정)은 **PHASE 6 에스컬레이션** 대상입니다.
> 고난이도 작업 시작 전 반드시 Claude Opus를 사용할 것을 강력 권장합니다.

---

## 1. 설계 핵심 원칙 (10만 CCU 기준)

### 1.1 커넥션 풀링 필수

```
Supabase PgBouncer / Supavisor 커넥션 풀링 반드시 활성화
→ 10만 CCU 동시 접속 시 Postgres 직접 연결 한계(약 300~500) 초과 방지
→ 프론트엔드 클라이언트는 Session Mode 또는 Transaction Mode 풀링 사용
```

**Supabase 클라이언트 초기화 필수 패턴**:

```typescript
// ✅ 필수 — @supabase/ssr의 createBrowserClient 사용 (SSR + 쿠키 세션 보장)
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(url, anonKey);

// ❌ 절대 금지 — createClient (레거시, 세션 동기화 불가)
import { createClient } from "@supabase/supabase-js";
```

### 1.2 페이로드 최소화 원칙

- `SELECT *` 절대 금지 → 필요한 컬럼 명시적 선택
- 리스트 API: 페이지네이션 필수 (`limit`, `offset` 또는 커서 기반)
- 대용량 텍스트(JSONB 등): 리스트에서는 제외, 상세 조회 시에만 포함

```typescript
// ❌ 금지
const { data } = await supabase.from("match_requests").select("*");

// ✅ 올바른 예시 — 필요한 컬럼만 선택 + 페이지네이션
const { data } = await supabase
  .from("match_requests")
  .select("id, status, created_at, expires_at, category_id")
  .eq("customer_id", userId)
  .order("created_at", { ascending: false })
  .range(0, 19); // 20개씩 커서 기반
```

### 1.3 Insert-Only Ledger 원칙

- `cash_ledger` 테이블은 **INSERT ONLY** — UPDATE/DELETE 절대 금지
- 모든 Credits 변동은 반드시 이 테이블에 기록
- 잔액은 `users.available_credits` 컬럼에 캐싱 (원장 집계는 감사 목적으로만 사용)
- **재무 정합성 보장:** 삭제/수정이 불가능한 원장 형태로 100% 재무 무결성을 보장합니다.

---

## 2. 핵심 테이블 스키마

> 이 문서는 운영 기준의 물리적 테이블 명세, 확장 정책 및 인덱스/RLS 규칙을 다룹니다.

### 2.1 통합 계정 및 권한 분리 (Users & Auth)

#### Table: `users`

고객과 고수를 하나의 테이블에서 관리하며, `role` 값으로 권한을 스위칭합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `user_id`) | UUID (PK) | N | 유저 고유 식별자 |
| `social_provider` | VARCHAR | Y | 소셜 가입 출처 (Google, Apple, FB 등) |
| `social_id` | VARCHAR | Y | 소셜 고유 ID (선 작성 후 로그인 매핑용) |
| `role` | ENUM | N | 'CUSTOMER', 'PRO', 'ADMIN' |
| `display_name` | VARCHAR | N | 유저 닉네임 또는 이름 |
| `device_token` | VARCHAR | Y | [MVP] 앱 푸시(FCM) 발송용 기기 토큰 |
| `sns_messenger_id` | VARCHAR | Y | **[V2 대비] 추후 외부 메신저 알림용 빈 공간** |
| `status` | ENUM | N | 'ACTIVE', 'SUSPENDED'(어뷰징 정지), 'DELETED' |
| `created_at` | TIMESTAMP | N | 가입 일시 |

#### Table: `pro_profiles`

`users` 테이블과 1:1 관계. 고수 권한('PRO')을 가진 유저의 추가 정보만 저장합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `pro_id` | UUID (PK) | N | 고수 프로필 고유 식별자 |
| `user_id` | UUID (FK) | N | `users` 테이블 연동 (UNIQUE) |
| `biz_reg_number` | VARCHAR | Y | 사업자 등록 번호 |
| `is_verified` | BOOLEAN | N | 신분/사업자 인증 완료 여부 (기본값: false) |
| `service_region_id`| INT (Index) | N | 주요 활동 지역 코드 (빠른 검색 인덱싱) |
| `current_cash` | DECIMAL | N | 현재 보유 캐시 잔액 (원장 캐싱 데이터) |
| `portfolio_urls` | JSONB | Y | 전/후 사진 등 포트폴리오 이미지 링크 배열 |

### 2.2 캐시 원장 시스템 (Cash Ledger)

#### Table: `cash_ledger`

에스크로 정산을 배제하고, 오직 플랫폼 내 캐시의 흐름만 기록하는 단방향 재무 테이블입니다. (UPDATE/DELETE 절대 금지)
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `transaction_id` | UUID (PK) | N | 거래 고유 식별자 |
| `pro_id` | UUID (FK) | N | 거래 발생 고수 ID (`pro_profiles` 연동) |
| `tx_type` | ENUM | N | 'CHARGE'(충전), 'DEDUCT_QUOTE'(견적차감), 'REFUND'(환불), 'BONUS'(웰컴캐시) |
| `amount` | DECIMAL | N | 변동 금액 (충전/환불은 +, 차감은 -) |
| `balance_snapshot` | DECIMAL | N | 거래 직후의 잔액 (환불/어뷰징 추적용 핵심 데이터) |
| `reference_id` | UUID | Y | 연관 데이터 ID (요청서 ID 또는 PG사 결제 고유번호) |
| `created_at` | TIMESTAMP | N | 거래 발생 일시 (수정 불가) |

### 2.3 핵심 매칭 시스템 (Core Matching & 1:N Bidding)

#### Table: `match_requests`

서버 마비 방지를 위해 핵심 검색 조건(카테고리, 지역)은 인덱싱 컬럼으로 빼고, 세부 질문만 JSONB로 저장합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `request_id`)| UUID (PK) | N | 매칭 요청서 고유 식별자 |
| `customer_id` | UUID (FK) | N | 요청자 ID (`users` 연동) |
| `category_id` | INT (Index) | N | 서비스 카테고리 (검색 속도 최적화용 핵심 컬럼) |
| `region_id` | INT (Index) | N | 서비스 요청 지역 (검색 속도 최적화용 핵심 컬럼) |
| `dynamic_answers`| JSONB | N | 카테고리별 세부 챗봇 응답 데이터 (무한 확장) |
| `status` | ENUM | N | 'OPEN', 'CLOSED'(마감/매칭완료), 'CANCELED' |
| `quote_count` | INT | N | 현재 입찰한 고수 수 (1:N 제한 검증용, 기본값: 0) |
| `expires_at` | TIMESTAMP | N | 48시간 자동 마감 타이머 (생성 시점 + 48h) |
| `created_at` | TIMESTAMP | N | 작성 일시 |

#### Table: `match_quotes`

고수가 고객의 요청서에 캐시를 소모하여 견적을 보낸 내역입니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `quote_id`) | UUID (PK) | N | 견적 발송 고유 식별자 |
| `request_id` | UUID (FK) | N | 연관된 요청서 ID (`match_requests` 연동) |
| `pro_id` | UUID (FK) | N | 견적을 보낸 고수 ID |
| `cost_deducted` | DECIMAL | N | 이 견적 발송에 소모된 캐시 비용 |
| `is_read` | BOOLEAN | N | 고객의 견적 열람 여부 (48시간 미열람 자동 환불 체크용) |
| `is_matched` | BOOLEAN | N | 최종 거래 성사 여부 (1방향 리뷰 작성 권한 트리거) |
| `created_at` | TIMESTAMP | N | 견적 발송 일시 |

### 2.4 실시간 소통 및 검증 리뷰 시스템 (Communication & Review)

#### Table: `chat_rooms`

고객과 고수 간의 1:1 채팅방입니다. 견적이 발송되면 생성되며, [매칭 확정하기] 스위치 작동 시 상태가 변경됩니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `room_id`) | UUID (PK) | N | 채팅방 고유 식별자 |
| `request_id` | UUID (FK) | N | 연관된 요청서 ID (`match_requests` 연동) |
| `customer_id` | UUID (FK) | N | 방을 개설한(요청한) 고객 ID |
| `pro_id` | UUID (FK) | N | 견적을 보낸 고수 ID |
| `status` | ENUM | N | 'OPEN'(대화중), 'MATCHED'(거래성사/리뷰가능), 'CLOSED'(종료) |
| `created_at` | TIMESTAMP | N | 채팅방 생성 일시 |

#### Table: `chat_messages`

WebSocket 서버와 통신하여 텍스트 및 이미지를 저장합니다. V2 보이스콜(WebRTC) 확장을 위한 뼈대가 포함되어 있습니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `message_id`)| UUID (PK) | N | 메시지 고유 식별자 |
| `room_id` | UUID (FK) | N | 소속 채팅방 ID (`chat_rooms` 연동) |
| `sender_id` | UUID (FK) | N | 메시지 발송자 ID (`users` 연동) |
| `message_type` | ENUM | N | 'TEXT', 'IMAGE', **'CALL_LOG' (V2 보이스콜 통화 기록 확장용 뼈대)** |
| `content` | TEXT | Y | 텍스트 내용, 이미지 URL, 또는 통화 기록 메타데이터 |
| `is_read` | BOOLEAN | N | 상대방 읽음 여부 (안 읽음 탭 구현용) |
| `created_at` | TIMESTAMP | N | 메시지 전송 일시 |

#### Table: `reviews`

어뷰징 방지를 위해 `chat_rooms`의 상태가 'MATCHED'인 경우에만 고객이 작성할 수 있는 1방향 검증 리뷰 테이블입니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `id` (또는 `review_id`)| UUID (PK) | N | 리뷰 고유 식별자 |
| `room_id` | UUID (FK) | N | 매칭이 성사된 채팅방 ID (1방향 검증용 필수 키, UNIQUE) |
| `pro_id` | UUID (FK) | N | 평가를 받는 고수 ID |
| `customer_id` | UUID (FK) | N | 평가를 작성하는 고객 ID |
| `rating` | DECIMAL | N | 평점 (1.0 ~ 5.0) |
| `comment` | TEXT | Y | 텍스트 리뷰 내용 |
| `created_at` | TIMESTAMP | N | 리뷰 작성 일시 |

### 2.5 인덱스 필수 컬럼 목록

10만 CCU 동시 조회 시 Full Table Scan을 방지하기 위해 아래 컬럼에 반드시 인덱스를 설정한다.

| 테이블           | 인덱스 대상 컬럼                                                  | 이유                    |
| ---------------- | ----------------------------------------------------------------- | ----------------------- |
| `users`          | `role`, `status`, `referred_by`                                   | 역할/상태 필터링 빈번   |
| `match_requests` | `customer_id`, `category_id`, `region_id`, `status`, `expires_at` | 매칭 목록 조회 핵심     |
| `match_quotes`   | `request_id`, `pro_id`, `status`, `is_read`                       | 견적 목록 + 읽음 처리   |
| `cash_ledger`    | `user_id`, `tx_type`, `created_at`                                | 원장 집계 및 내역 조회  |
| `chat_rooms`     | `customer_id`, `pro_id`, `request_id`, `status`                   | 채팅방 목록 조회        |
| `chat_messages`  | `room_id`, `is_read`, `created_at`                                | 커서 기반 페이지네이션  |
| `notifications`  | `user_id`, `is_read`, `created_at`                                | 알림 목록 조회          |
| `reviews`        | `pro_id`, `customer_id`, `room_id`                                | 리뷰 리스트 + 중복 방지 |

**복합 인덱스 필수 항목**:

```sql
-- match_quotes: 고수 견적 목록 (가장 빈번한 조회 패턴)
CREATE INDEX idx_match_quotes_pro_status ON match_quotes(pro_id, status);

-- chat_messages: 커서 기반 페이지네이션
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at DESC);

-- match_requests: 고객 요청서 목록
CREATE INDEX idx_match_requests_customer_status ON match_requests(customer_id, status);
```

### 2.6 JSONB 컬럼 GIN 인덱스

동적 폼 데이터(`dynamic_answers`)에 대해 JSON 내부 키 검색이 필요한 경우:

```sql
-- 전체 JSONB GIN 인덱스 (JSON 키 존재 여부 검색)
CREATE INDEX idx_match_requests_answers_gin ON match_requests USING GIN (dynamic_answers);

-- 특정 키 경로 검색 최적화 (자주 검색하는 키가 있는 경우)
CREATE INDEX idx_match_requests_answers_path ON match_requests USING GIN (dynamic_answers jsonb_path_ops);
```

### 2.7 DB 스키마 변경 원칙 (무중단 마이그레이션)

```
1. 신규 컬럼 추가 (NULL 허용 또는 DEFAULT 값)
2. 이중 쓰기 — 기존 + 신규 컬럼 동시 업데이트
3. 데이터 마이그레이션 — 기존 데이터를 신규 컬럼으로 복사
4. 구 컬럼 접근 차단 (코드에서 참조 제거)
5. 구 컬럼 삭제 (안전함을 확인한 후)
```

> **❌ 절대 금지**: 기존 컬럼을 한 번에 DROP하거나 RENAME하는 방식 — Supabase는 마이그레이션 롤백이 불완전할 수 있음

---

## 3. RLS (Row Level Security) 정책 원칙

### 3.1 기본 원칙

```
모든 테이블은 RLS를 반드시 활성화한다.
RLS 없이 새 테이블을 생성하는 것은 절대 금지.
```

**RLS 활성화 필수**:

```sql
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
```

### 3.2 정책 설계 패턴

#### 고객(CUSTOMER) 전용 접근

```sql
-- 본인 데이터만 SELECT 가능
CREATE POLICY "customer_select_own" ON match_requests
  FOR SELECT USING (auth.uid() = customer_id);

-- 본인만 INSERT 가능
CREATE POLICY "customer_insert_own" ON match_requests
  FOR INSERT WITH CHECK (auth.uid() = customer_id);
```

#### 고수(PRO) 전용 접근

```sql
-- 고수는 OPEN 상태의 요청서 조회 가능
CREATE POLICY "pro_select_open_requests" ON match_requests
  FOR SELECT USING (
    status = 'OPEN'
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'PRO'
    )
  );
```

#### 관리자(ADMIN) 전용

```sql
-- 관리자는 전체 접근 가능
CREATE POLICY "admin_full_access" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role LIKE 'ADMIN%'
    )
  );
```

### 3.3 RLS 완전성 체크 의무 (PHASE 9 준수)

프론트엔드에서 사용하는 모든 CRUD 작업에 대해 RLS 정책이 존재해야 한다.

```sql
-- 정책 존재 여부 확인 쿼리 (새 테이블 또는 신규 CRUD 추가 시 반드시 실행)
SELECT policyname, cmd FROM pg_policies WHERE tablename = '대상_테이블명';
```

**체크리스트**:

- [ ] `SELECT` 정책 존재 여부 확인
- [ ] `INSERT` 정책 존재 여부 확인
- [ ] `UPDATE` 정책 존재 여부 확인 (프론트에서 `.update()` 호출 시 필수)
- [ ] `DELETE` 정책 존재 여부 확인 (프론트에서 `.delete()` 호출 시 필수)

> **사고 사례 (상세)**: PHASE 9 기준
>
> | 단계            | 내용                                                                                          |
> | --------------- | --------------------------------------------------------------------------------------------- |
> | **발단**        | `chat_messages` 테이블에 `SELECT`, `INSERT` 정책만 존재 — `UPDATE` 정책 누락                  |
> | **증상**        | 프론트엔드 읽음 처리 코드(`is_read = true` UPDATE)가 RLS에 의해 **조용히 차단**됨             |
> | **미발견 이유** | Supabase `.update()` 실패 시 에러가 콘솔에 명시적으로 표시되지 않음 — 응답이 빈 배열로 반환됨 |
> | **결과**        | 읽음 배지가 사라지지 않는 UI 버그로 장기간 미발견                                             |
> | **해결**        | DB에서 `UPDATE` RLS 정책 추가 + `mark_messages_as_read` RPC 함수 생성                         |

**재발 방지 규칙**:

1. 프론트엔드에서 `.update()`를 호출하는 테이블 → **반드시** UPDATE RLS 정책 존재 확인
2. 프론트엔드에서 `.delete()`를 호출하는 테이블 → **반드시** DELETE RLS 정책 존재 확인
3. RLS 정책 누락 발견 시 코드 작성 전에 디렉터님께 SQL을 먼저 제공하여 정책 생성
4. 신규 테이블 생성 시 사용 예정인 모든 CRUD 작업에 대한 RLS 정책을 함께 설계

### 3.4 Service Role Key 사용 원칙

| 사용 위치                | 허용 Key           | 이유                        |
| ------------------------ | ------------------ | --------------------------- |
| 프론트엔드 클라이언트    | `ANON_KEY`         | RLS 적용 — 사용자 권한 제한 |
| 서버 사이드 API Route    | `SERVICE_ROLE_KEY` | RLS 우회 — 관리자 작업만    |
| 테스트 스크립트          | `SERVICE_ROLE_KEY` | RLS 우회 — 자동 정리 보장   |
| 프로덕션 클라이언트 번들 | **절대 금지**      | 보안 치명적 취약점          |

---

## 4. N+1 쿼리 금지 원칙 (엄격 적용)

### 4.1 정의

**N+1 패턴**: 리스트 N개를 가져온 뒤, 각 항목에 대해 개별 추가 쿼리를 N번 실행하는 구조.
→ 10만 CCU 환경에서 DB 연결을 N배로 증폭시켜 서비스 전체를 마비시킬 수 있음.

### 4.2 금지 패턴과 대체 방법

#### ❌ 금지 — 루프 내 개별 쿼리

```typescript
// 심각한 N+1 패턴 — 절대 금지
const { data: requests } = await supabase
  .from("match_requests")
  .select("id, pro_id");

for (const req of requests) {
  // N번 추가 쿼리 발생 → DB 연결 N배 증폭
  const { data: pro } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", req.pro_id)
    .single();
}
```

#### ✅ 필수 — 백엔드 JOIN (단일 쿼리)

```typescript
// Supabase 내장 JOIN — 단일 쿼리로 처리
const { data } = await supabase
  .from("match_requests")
  .select(
    `
    id, status, created_at,
    match_quotes (
      id, price, status, is_read,
      users ( id, display_name, avatar_url )
    )
  `,
  )
  .eq("customer_id", userId)
  .order("created_at", { ascending: false });
```

#### ✅ 대안 — `IN` 쿼리 일괄 처리

```typescript
// 여러 ID를 한 번에 조회
const proIds = requests.map((r) => r.pro_id);
const { data: pros } = await supabase
  .from("users")
  .select("id, display_name, avatar_url")
  .in("id", proIds); // 단 1번의 쿼리

// 프론트엔드에서 Map으로 매핑
const proMap = new Map(pros.map((p) => [p.id, p]));
```

#### ✅ 최선 — RPC 함수로 복잡한 JOIN 캡슐화

```sql
-- 복잡한 다중 테이블 JOIN은 RPC 함수로 캡슐화
CREATE OR REPLACE FUNCTION get_customer_quote_list(p_customer_id UUID)
RETURNS TABLE (...) AS $$
BEGIN
  RETURN QUERY
  SELECT mr.id, mr.status, mq.price, u.display_name
  FROM match_requests mr
  LEFT JOIN match_quotes mq ON mq.request_id = mr.id
  LEFT JOIN users u ON u.id = mq.pro_id
  WHERE mr.customer_id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.3 Realtime 구독에서의 N+1 방지

```typescript
// ❌ 금지 — Realtime 이벤트마다 전체 재패치
supabase.channel('quotes').on('postgres_changes', { ... }, async () => {
  // 이벤트 발생 시마다 전체 목록 재조회 — N+1 유발
  const { data } = await supabase.from('match_quotes').select('*, users(*)');
  setQuotes(data);
});

// ✅ 올바른 방법 — 변경된 레코드만 부분 업데이트
supabase.channel('quotes').on('postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'match_quotes' },
  (payload) => {
    // 기존 state에 새 레코드만 추가 (재패치 없음)
    setQuotes(prev => [payload.new, ...prev]);
  }
);
```

---

## 5. RPC 함수 설계 원칙

### 5.1 금융 관련 RPC (SECURITY DEFINER 필수)

| RPC 함수                           | 역할                            | 주의사항                      |
| ---------------------------------- | ------------------------------- | ----------------------------- |
| `send_quote_and_deduct_cash()`     | 견적 발송 + Credits 원자적 차감 | `FOR UPDATE` 행 잠금 필수     |
| `refund_unread_quotes()`           | 미낙찰 견적 Credits 자동 환불   | 원장(`cash_ledger`) 기록 필수 |
| `admin_manage_cash()`              | 관리자 Credits 수동 조정        | 감사 로그 필수                |
| `admin_process_payout()`           | 고수 정산 처리                  | 복수 테이블 트랜잭션          |
| `confirm_match_and_close_others()` | 낙찰 확정 + 나머지 방 일괄 종료 | 원자적 상태 전환              |
| `process_referral_reward()`        | 추천 보상 지급                  | 중복 지급 방지 UNIQUE 제약    |

### 5.2 RPC 작성 필수 패턴

```sql
CREATE OR REPLACE FUNCTION function_name(...)
RETURNS ... AS $$
DECLARE
  v_result ...;
BEGIN
  -- 1. 행 잠금으로 Race Condition 방어 (금융 로직 필수)
  SELECT ... INTO v_result FROM table_name WHERE id = p_id FOR UPDATE;

  -- 2. 유효성 검증
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'RECORD_NOT_FOUND';
  END IF;

  -- 3. 비즈니스 로직 수행
  ...

  -- 4. 감사 로그 기록 (금융/권한 변경 시 필수)
  INSERT INTO admin_action_logs (...) VALUES (...);

  RETURN ...;
EXCEPTION
  WHEN OTHERS THEN
    -- 트랜잭션 자동 롤백 (Postgres 보장)
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 6. 에러 디버깅 순서 (DB 관련)

```
에러 발생 시 반드시 아래 순서로 디버깅:

1. DB/RLS 레이어
   → pg_policies 정책 존재 여부 확인
   → Supabase 대시보드 Error Logs 확인
   → RLS 정책이 올바른 auth.uid() 조건을 가지는지 확인

2. 백엔드 쿼리/RPC 레이어
   → RPC 함수 내 EXCEPTION 메시지 확인
   → JOIN 구조가 올바른지 확인
   → 인덱스가 실제로 사용되는지 EXPLAIN ANALYZE로 확인

3. 캐시 레이어
   → Realtime 구독 이벤트가 올바른 데이터를 전달하는지 확인
   → 클라이언트 state가 최신 DB 값과 동기화되는지 확인

4. 프론트엔드 레이어 (마지막)
   → 위 3단계가 모두 정상인 경우에만 UI 문제로 판단
```

> **절대 금지**: 1~3단계를 건너뛰고 프론트엔드 Fallback으로 우회 처리

---

## 7. 추천인 시스템 DB 스키마

### 7.1 관련 테이블

#### Table: `referral_rewards`

추천 보상 지급 이력. 중복 지급 방지를 위한 UNIQUE 제약 포함.

| 컬럼명             | 타입              | 설명                                 |
| ------------------ | ----------------- | ------------------------------------ |
| `id`               | UUID (PK)         | 보상 이력 고유 식별자                |
| `referrer_id`      | UUID (FK → users) | 추천인 ID                            |
| `referred_user_id` | UUID (FK → users) | 피추천인 ID                          |
| `reward_type`      | ENUM              | 보상 종류 (BONUS_CREDITS, COUPON 등) |
| `amount`           | INT               | 지급된 Credits 또는 쿠폰 금액        |
| `status`           | ENUM              | 'PENDING', 'PAID', 'REVOKED'         |
| `created_at`       | TIMESTAMP         | 보상 지급 일시                       |

**제약 조건**:

```sql
-- 중복 보상 방지
CREATE UNIQUE INDEX idx_referral_rewards_unique
  ON referral_rewards(referrer_id, referred_user_id);

-- 자기 추천 방지
ALTER TABLE users ADD CONSTRAINT chk_no_self_referral
  CHECK (referred_by != id);
```

#### Table: `coupons`

고객이 고수에게 제시하는 쿠폰. 고수가 등록 시 Bonus Credits로 전환.

| 컬럼명       | 타입               | 설명                            |
| ------------ | ------------------ | ------------------------------- |
| `id`         | UUID (PK)          | 쿠폰 고유 식별자                |
| `code`       | VARCHAR(16) UNIQUE | 쿠폰 코드                       |
| `issued_to`  | UUID (FK → users)  | 쿠폰 발급 대상 사용자           |
| `amount`     | INT                | 쿠폰 금액                       |
| `status`     | ENUM               | 'ACTIVE', 'REDEEMED', 'EXPIRED' |
| `expires_at` | TIMESTAMP          | 만료 일시 (기본 1년)            |
| `created_at` | TIMESTAMP          | 발급 일시                       |

> **만료 자동 처리**: pg_cron 또는 Supabase Edge Function — `UPDATE coupons SET status='EXPIRED' WHERE status='ACTIVE' AND expires_at < NOW()` (Go-Live 전 활성화 필요)

### 7.2 users 테이블 컬럼 확장 (추천인)

```sql
-- 추천인 시스템을 위해 users 테이블에 추가된 컬럼
ALTER TABLE users
  ADD COLUMN referral_code VARCHAR(8) UNIQUE,  -- 본인 추천 코드
  ADD COLUMN referred_by UUID REFERENCES users(id); -- 추천인 ID
```

### 7.3 추천인 관련 RPC 함수

| RPC 함수                                      | 역할                            | 주의사항                              |
| --------------------------------------------- | ------------------------------- | ------------------------------------- |
| `process_referral_reward(p_referred_user_id)` | 추천 보상 지급 처리             | 중복 지급 방지 UNIQUE 제약 + 트랜잭션 |
| `redeem_coupon(p_pro_id, p_coupon_code)`      | 고수의 쿠폰 등록 → Credits 전환 | 쿠폰 상태 검증 + 만료 체크            |

### 7.4 추천인 보상 매트릭스 (4-Way)

보상 트리거 시점: 피추천인의 **첫 번째 행동** 완료 시

| 추천인 역할 | 피추천인 역할 | 트리거 조건                    | 추천인 보상        | 피추천인 보상      |
| ----------- | ------------- | ------------------------------ | ------------------ | ------------------ |
| Pro         | Pro           | 피추천 Pro의 첫 견적서 발송    | +150 Bonus Credits | +150 Bonus Credits |
| Customer    | Pro           | 피추천 Pro의 첫 견적서 발송    | 할인 쿠폰          | +150 Bonus Credits |
| Customer    | Customer      | 피추천 Customer의 첫 견적 요청 | 할인 쿠폰          | 할인 쿠폰          |
| Pro         | Customer      | 피추천 Customer의 첫 견적 요청 | +150 Bonus Credits | 할인 쿠폰          |

**보상 종류**:

- `BONUS_CREDITS`: `pro_profiles.current_cash` 에 150 적립 (즉시 사용 가능한 캐시)
- `COUPON`: `coupons` 테이블에 발급 → 견적 요청 시 할인 적용

**`process_referral_reward` 호출 시점**:

- CUSTOMER 첫 견적 요청 후: `auth/complete/page.tsx` 내 `pendingRequestData` 처리 블록에서 fire-and-forget 호출
- PRO 첫 견적서 발송 후: 견적서 발송 API / RPC에서 호출 (별도 구현 필요)

```sql
-- process_referral_reward 핵심 로직 구조 (4-Way 보상 매트릭스 반영)
CREATE OR REPLACE FUNCTION process_referral_reward(p_referred_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_referrer_id   UUID;
  v_referrer_role TEXT;
  v_referred_role TEXT;
BEGIN
  -- 1. 피추천인·추천인 역할 확인
  SELECT role, referred_by INTO v_referred_role, v_referrer_id
    FROM users WHERE user_id = p_referred_user_id;
  IF v_referrer_id IS NULL THEN RETURN; END IF;

  SELECT role INTO v_referrer_role FROM users WHERE user_id = v_referrer_id;

  -- 2. 중복 보상 방지 (UNIQUE 제약: referrer_id + referred_user_id)
  -- 3. 4-Way 매트릭스 분기:
  --    Pro→Pro:       추천인 +150 Credits, 피추천인 +150 Credits
  --    Customer→Pro:  추천인 쿠폰 발급,   피추천인 +150 Credits
  --    Customer→Cust: 추천인 쿠폰 발급,   피추천인 쿠폰 발급
  --    Pro→Customer:  추천인 +150 Credits, 피추천인 쿠폰 발급
  -- 4. referral_rewards 테이블에 이력 기록
  -- 5. 알림 발송
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 8. MVP 기획 핵심 정책 통합 (DB 스키마)

### 8.1 하이브리드 동적 폼 데이터 구조

데이터 검색 및 매칭 성능 보장을 위해 핵심 데이터와 유연한 데이터를 분리하여 저장합니다:

- **검색 필수 조건**: 지역, 카테고리 ID, 예산 등 쿼리에 자주 사용되는 핵심 조건은 독립된 인덱싱 컬럼으로 분리합니다.
- **동적 세부 질문**: 그 외의 세부 질문 데이터는 `JSONB` 형태로 분리 저장하여 풀 스캔을 방지하고 무한 확장성을 확보합니다.

### 8.2 동적 폼 JSON 표준 스키마 (dynamic_answers)

**설계 목적 및 규칙**:

- **프론트엔드 UI 자동화**: 앱(Front-end)은 카테고리 수와 무관하게 이 JSON을 읽고 자동으로 챗봇형 질문 화면(UI)을 렌더링해야 합니다. (`DynamicRequestForm.tsx` 등에서 활용)
- **백엔드 파싱 최적화**: 모든 카테고리의 요청서 응답(Answers)은 예외 없이 아래의 규격을 준수하여 `match_requests.dynamic_answers` 컬럼에 저장되어야 합니다. 순서 보장을 위해 JSON 배열(Array) 형태를 사용합니다.

**DB 저장용 JSONB 페이로드 예시**:

```json
[
  {
    "question_id": "q_001",
    "question_type": "SINGLE_CHOICE",
    "question_text": "어떤 청소 서비스를 원하시나요?",
    "answer": "이사/입주 청소"
  },
  {
    "question_id": "q_002",
    "question_type": "MULTI_CHOICE",
    "question_text": "추가로 필요한 옵션이 있나요? (중복 선택 가능)",
    "answer": ["새집 증후군 시공", "냉장고 내부 청소"]
  },
  {
    "question_id": "q_003",
    "question_type": "TEXT_INPUT",
    "question_text": "고수님께 전달할 특이사항을 적어주세요.",
    "answer": "오후 2시 이후에 방문 부탁드립니다. 집에 강아지가 있습니다."
  },
  {
    "question_id": "q_004",
    "question_type": "DATE_PICKER",
    "question_text": "서비스 희망일을 선택해주세요.",
    "answer": "2026-03-15"
  }
]
```
