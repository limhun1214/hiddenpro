# HiddenPro — Cloudflare Native 아키텍처 및 i18n 규칙

> **문서 위치**: `docs/system_architecture.md`
> **적용 대상**: 안티그래비티(실행 에이전트) 및 아키텍츠(설계 에이전트) 모두
> **최종 업데이트**: 2026-03-27
> **목적**: Cloudflare Native 인프라 확정 아키텍처 및 다국어 UI 일관성 보장

---

## 1. Cloudflare Native 아키텍처 (확정)

### 1.1 배경 및 목표

HiddenPro는 **Cloudflare 생태계를 핵심 인프라로 채택**한다. (2026-03-27 디렉터 공식 승인)
Vercel 이전 계획은 **전면 폐기**되었으며, Cloudflare D1 / R2 / KV / Workers를 시스템의 핵심 구성 요소로 확정한다.

> **규모 기준**: 100만 MAU, 10만 CCU 환경에서도 이 아키텍처가 유지되어야 한다.

---

### 1.2 권장 Cloudflare 엣지 리소스

아래 리소스는 적극적으로 활용이 승인된 항목이다.

| 리소스                              | 용도                      | 비고                                          |
| ----------------------------------- | ------------------------- | --------------------------------------------- |
| `Cloudflare Workers`                | 서버리스 엣지 함수        | 표준 Web API (`fetch`, `Request`, `Response`) |
| `Cloudflare Pages`                  | Next.js 프론트엔드 호스팅 | GitHub 연동 자동 배포                         |
| `Cloudflare D1` (Edge SQL)          | 엣지 경량 SQL DB (옵션)   | 주 DB는 Supabase Postgres 유지                |
| `Cloudflare R2` (오브젝트 스토리지) | 이미지/파일 저장          | Supabase Storage와 병행 사용 가능             |
| `Cloudflare KV` (키-값 캐시)        | 엣지 캐시, 세션 보조 저장 | Supabase / Upstash Redis와 병행 사용 가능     |
| `@cloudflare/*` 패키지              | Workers 바인딩            | Workers 환경에서 사용 허용                    |

---

### 1.3 인프라 레이어 구성

```
[프론트엔드 호스팅]        [백엔드 부품]
Cloudflare Pages     ──→   Supabase Postgres  (주 DB — 고정)
                     ──→   Supabase Storage   (파일 저장 — 기본)
                     ──→   Cloudflare R2      (파일 저장 — 옵션/병행)
                     ──→   Supabase Auth      (인증 — 고정)
                     ──→   Cloudflare KV      (엣지 캐시 — 옵션)
                     ──→   Upstash Redis      (캐시 — 옵션)
```

#### 1.3.1 데이터베이스 (DB)

- **필수**: Supabase Postgres (PgBouncer/Supavisor 커넥션 풀링 적용)

**PgBouncer / Supavisor 풀링 모드 상세**:

| 풀링 모드            | 적합한 용도                 | 주의 사항                                  |
| -------------------- | --------------------------- | ------------------------------------------ |
| **Session Mode**     | 장기 연결(채팅 Realtime 등) | 연결 수 제한 → CCU 높을 때 주의            |
| **Transaction Mode** | 일반 API 요청 (권장)        | SET/LISTEN 등 세션 레벨 명령 불가          |
| **Statement Mode**   | 단일 쿼리 최적화            | 트랜잭션 불가 — 금융 로직에 절대 사용 금지 |

> **10만 CCU 기준**: 일반 API는 **Transaction Mode** 사용. `cash_ledger` 등 트랜잭션이 필요한 금융 로직은 SECURITY DEFINER RPC 함수로 래핑하여 처리.

- **클라이언트**: 프론트엔드는 반드시 `@supabase/ssr`의 `createBrowserClient` 사용
  - `createClient` (legacy) 사용 **절대 금지**
- **쿼리 설계**: N+1 방지를 위해 백엔드 JOIN 우선. 프론트엔드 루프 내 개별 쿼리 금지.

```typescript
// ✅ 올바른 예시
const { data } = await supabase
  .from("match_requests")
  .select("*, match_quotes(*, users(display_name, avatar_url))")
  .eq("customer_id", userId);

// ❌ 금지 — N+1 패턴
for (const request of requests) {
  const quote = await supabase
    .from("match_quotes")
    .select("*")
    .eq("request_id", request.id);
}
```

#### 1.3.2 파일 스토리지

- **기본**: Supabase Storage
- **옵션**: Cloudflare R2 (presigned URL, Worker 기반 업로드 허용)
- 업로드 경로 패턴: `{bucket}/{userId}/{timestamp}_{filename}`

#### 1.3.3 캐시

- **1순위**: Supabase (DB 뷰, Materialized View)
- **2순위**: Cloudflare KV (엣지 캐시가 필요한 경우)
- **3순위**: Upstash Redis (외부 캐시가 필요한 경우)

---

### 1.4 환경 변수 관리 원칙

```
# .env.local (로컬 개발 전용 — 절대 Git 커밋 금지)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # 서버 사이드 전용

# Cloudflare Pages 대시보드 환경 변수에 동일한 키-값 복사
```

**규칙**:

1. 모든 연결 정보(URL, Key, Secret)는 환경 변수로만 관리.
2. `process.env.XXX`를 사용하되, 클라이언트에 노출되는 키는 반드시 `NEXT_PUBLIC_` 접두사 사용.
3. `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트 번들에 포함되지 않도록 서버 사이드 코드에서만 사용.

---

## 2. i18n 컴플라이언스 규칙

### 2.1 개요

- **라이브러리**: `next-intl`
- **Locale 전환 방식**: 쿠키 기반 (URL 구조 변경 없음 — `/en/`, `/ko/` 경로 접두사 사용 안 함)
- **지원 언어**: `en` (영어, 기본값) / `ko` (한국어)
- **규모 기준**: 100만 MAU, 필리핀 기반 다국어 사용자 환경

---

### 2.2 UI 문자열 하드코딩 절대 금지

```typescript
// ❌ 절대 금지 — 하드코딩
<h1>Welcome to HiddenPro</h1>
<button>Submit Request</button>

// ✅ 필수 — useTranslations 훅 사용
const t = useTranslations('HomePage');
<h1>{t('welcome')}</h1>
<button>{t('submitRequest')}</button>
```

**위반 감지 시 행동 수칙**:

- 하드코딩 문자열 발견 즉시 `useTranslations` 패턴으로 리팩토링 후 번역 키 추가.
- 작업 범위가 아닌 기존 파일에서 발견한 경우, 별도로 디렉터님께 보고한다.

---

### 2.3 번역 키 동시 추가 규칙

번역 키는 반드시 `en.json`과 `ko.json` **두 파일에 동시에** 추가한다. 어느 한 파일만 추가하는 것은 금지.

**파일 위치**:

```
frontend/messages/en.json    ← 영어 번역 (기본값)
frontend/messages/ko.json    ← 한국어 번역
```

**번역 키 네이밍 규칙**:

- 네임스페이스는 페이지/컴포넌트 단위로 구분: `PageName.keyName`
- camelCase 사용: `submitRequest`, `availableCredits`
- 의미가 명확한 영어 키 이름 사용 (약어 금지)

**예시**:

```json
// en.json
{
  "QuotesPage": {
    "title": "My Quotes",
    "submitRequest": "Submit Request",
    "availableCredits": "Available Credits"
  }
}

// ko.json
{
  "QuotesPage": {
    "title": "내 견적",
    "submitRequest": "요청 제출",
    "availableCredits": "보유 크레딧"
  }
}
```

---

### 2.4 useTranslations 사용 패턴

```typescript
// 서버 컴포넌트 (page.tsx)
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('QuotesPage');
  return <h1>{t('title')}</h1>;
}

// 클라이언트 컴포넌트 ('use client')
'use client';
import { useTranslations } from 'next-intl';

export function QuotesClient() {
  const t = useTranslations('QuotesPage');
  return <button>{t('submitRequest')}</button>;
}
```

---

### 2.5 i18n 현황 (2026-03-22 기준)

| 항목                 | 상태                                                     |
| -------------------- | -------------------------------------------------------- |
| 설정 파일            | `frontend/src/i18n.ts`, `frontend/next.config.js`        |
| 번역 파일            | `frontend/messages/en.json`, `frontend/messages/ko.json` |
| Locale 전환 컴포넌트 | `frontend/src/components/common/LanguageSwitcher.tsx`    |
| i18n 완료 파일 수    | 23개                                                     |
| 미완료 파일          | `admin/page.tsx`, 모바일 GNB `LanguageSwitcher`          |

---

### 2.6 신규 파일 작성 시 i18n 체크리스트

- [ ] `useTranslations` 또는 `getTranslations` 임포트 확인
- [ ] 하드코딩 문자열이 단 하나도 없는지 확인
- [ ] `en.json`에 번역 키 추가
- [ ] `ko.json`에 동일 키로 한국어 번역 추가
- [ ] 키 네임스페이스가 파일명/컴포넌트명과 일치하는지 확인

---

## 3. i18n 인프라 현황 (2026-03-22 기준)

### 3.1 인프라 구성

| 항목                 | 값                                                       |
| -------------------- | -------------------------------------------------------- |
| 방식                 | `next-intl`, 쿠키 기반 locale (URL 구조 변경 없음)       |
| 지원 언어            | `en` (영어, 기본값) / `ko` (한국어)                      |
| 설정 파일            | `frontend/src/i18n.ts`, `frontend/next.config.js`        |
| 번역 파일            | `frontend/messages/en.json`, `frontend/messages/ko.json` |
| Locale 전환 컴포넌트 | `frontend/src/components/common/LanguageSwitcher.tsx`    |

### 3.2 i18n 완료 현황

| 상태      | 내용                                            |
| --------- | ----------------------------------------------- |
| ✅ 완료   | 23개 파일 (i18n 완료 보고서 참조)               |
| ⚠️ 미완료 | `admin/page.tsx`, 모바일 GNB `LanguageSwitcher` |

> **신규 페이지 작성 시**: 위 미완료 파일과 같이 i18n 없이 배포하지 말 것. 반드시 작업 전에 i18n 적용 여부를 확인한다.

### 3.3 i18n 네임스페이스 목록 (중복 생성 금지)

아래 네임스페이스는 이미 `en.json` / `ko.json`에 존재한다. **신규 작업 시 중복 생성 금지**, 기존 네임스페이스를 재사용할 것.

```
common, legal, businessInfo, inquiry, notifications, myReviews, proReviews,
profile, wallet, proRequestList, customerQuotes, footer, brandPanel, chatRoom,
requestForm, proProfileModal, quoteModal, proBidding, toast, chatList,
authComplete, landing, pcTopNav
```

**네임스페이스 명명 규칙**: 파일 경로 기반 camelCase

```
앱 라우트 경로             네임스페이스
pro/wallet/page.tsx    →  proWallet
admin/page.tsx         →  adminDashboard
chat/page.tsx          →  chatList
```

### 3.4 신규 언어 추가 방법 (타갈로그 등)

신규 언어(예: `tl` 타갈로그) 추가 시 **필수 3단계** 순서대로 진행:

**Step 1**: 번역 파일 생성

```bash
# en.json을 복사하여 신규 locale 번역 파일 생성
cp frontend/messages/en.json frontend/messages/tl.json
# tl.json 내의 모든 값을 타갈로그어로 번역
```

**Step 2**: `i18n.ts` validLocales 배열에 추가

```typescript
// frontend/src/i18n.ts
export const validLocales = ["en", "ko", "tl"]; // 'tl' 추가
```

**Step 3**: `LanguageSwitcher.tsx` LOCALES 배열에 추가

```typescript
// frontend/src/components/common/LanguageSwitcher.tsx
const LOCALES = [
  { code: "en", label: "EN" },
  { code: "ko", label: "KO" },
  { code: "tl", label: "TL" }, // 추가
];
```

---

## 4. MVP 기획 핵심 정책 통합 (시스템 및 인프라)

### 4.1 트래픽 방어 대원칙

프론트엔드 기기 리소스 폭주를 막기 위해 O(N) 이상의 반복문 처리 및 대규모 배열 필터링을 클라이언트 단에서 전면 금지합니다.

### 4.2 WebSocket 브로드캐스팅 통제

실시간 통신 시 전체 브로드캐스팅을 원천 차단하고, 반드시 `receiver_id` 기반의 수신자 서버단 필터를 적용하여 트래픽 비용을 시스템적으로 격리합니다.

### 4.3 알림 채널 정책

**어뷰징 방지 및 신뢰도 확보**를 최우선 가치로 두어 SMS OTP 본인인증을 필수로 도입한다. (2026-03-27 디렉터 승인)

- **SMS OTP**: 가입 완료 전 전화번호 SMS OTP 검증 필수 (계정 중복 생성 방지)
- **앱 푸시 및 이메일**: 서비스 알림의 기본 채널로 허용
- **SMS 알림**: OTP 인증 외 추가 알림 채널 확장은 별도 비용 정책 수립 후 결정

#### SMS OTP 연동 설계

```
[가입 플로우]
전화번호 입력
  → SMS OTP 발송 (외부 SMS 공급자: Twilio / Vonage / Supabase Phone Auth)
  → OTP 검증 완료
  → users 테이블 phone_verified = true 업데이트
  → 가입 완료

[추천 어뷰징 방지]
동일 전화번호로 중복 계정 생성 불가
  → users.phone UNIQUE 제약 + phone_verified 조건부 허용
```

## 5. 핵심 API 및 통신 인터페이스 (API Specifications)

> **설계 원칙**:
>
> - **Stateless Auth**: 모든 요청은 쿠키 기반 세션(`@supabase/ssr`) 또는 헤더의 `Authorization: Bearer <Token>`을 통해 유저를 식별한다.
> - **Role-Based Access Control (RBAC)**: 고수(PRO) 전용 기능은 `role` 값이 'PRO'인 경우에만 호출 가능하며, 프론트엔드 미들웨어(`middleware.ts`)와 DB RLS로 이중 차단한다.
> - **구현 방식**: Next.js App Router 환경에 맞게 API Routes (`app/api/...`), Server Actions, 또는 Supabase RPC/Client 직접 호출 방식으로 구현된다.

### 5.1 계정 및 권한 (Auth & User)

- `POST /auth/social-login`: 소셜 로그인 및 유저 생성 (선 작성 후 로그인 매핑 포함)
- `POST /auth/phone-otp`: SMS OTP 발송 및 검증 (가입 전 전화번호 인증 필수)
- `PATCH /user/upgrade-to-pro`: 일반 고객에서 고수로 권한 전환 (신분증/사업자 데이터 수신)
- `GET /user/profile`: 내 프로필 및 권한 정보 조회

### 5.2 캐시 및 지갑 (Wallet - Ledger 기반)

- `GET /wallet/balance`: 현재 보유 캐시 잔액 조회 (`users.available_credits`)
- `GET /wallet/history`: 캐시 충전/차감 원장 내역 조회 (`cash_ledger` 테이블)
- `POST /wallet/charge`: GCash/Maya 등을 통한 캐시 충전 요청

### 5.3 매칭 및 견적 (Matching & Quotes)

- `POST /match/request`: 고객의 동적 요청서 제출 (JSON 데이터 저장)
- `GET /match/pro/available`: 고수용 - 내 카테고리/지역의 대기 중인 요청서 리스트 조회
- **`POST /match/pro/quote`**: 고수의 견적 발송 (호출 시 즉시 `cash_ledger`에서 캐시 차감 로직 실행 → `send_quote_and_deduct_cash` RPC 연동 필수)
- `GET /match/customer/quotes`: 고객용 - 내가 받은 견적 리스트 조회

### 5.4 채팅 및 리뷰 (Communication & Review)

- `GET /chat/rooms`: 내 채팅방 리스트 조회
- `POST /chat/match-confirm`: [매칭 확정하기] (채팅방 상태를 'MATCHED'로 원자적 변경)
- `POST /chat/review`: 리뷰 작성 (채팅방 상태가 'MATCHED'인 경우에만 허용, RLS 체크 필수)
