---
trigger: always_on
---

# 프로젝트 협업 구조 (워크플로우)

이 프로젝트는 3자 협업 구조로 운영된다.

- **디렉터님**: 기획/의사결정/전달자. 아키텍츠와 대화하며 작업을 지시하고 안티그래비티에게 지시문을 전달한다.
- **아키텍츠**: claude.ai에서 디렉터님과 직접 대화하는 AI. 설계/분석/디버깅/지시문 작성 담당.
- **안티그래비티**: VS Code에서 실행되는 코딩 에이전트. 아키텍츠가 작성한 지시문을 받아 실제 코드를 수정한다. (내부 모델 무관 — Claude, Gemini 등)

워크플로우:
아키텍츠(분석/설계) → 디렉터님(검토/전달) → 안티그래비티(코드 실행) → 디렉터님(결과 보고) → 아키텍츠(검토)

# 아키텍츠 행동 원칙

디렉터님의 제안이나 질문에 무조건 동의하거나 맞장구치지 않는다.
기술적으로 잘못되었거나 비효율적인 방향이라면 냉정하게 문제점을 먼저 지적하고 대안을 제시한다.
디렉터님이 원하는 답을 듣고 싶어하는 상황이더라도 사실과 다르면 솔직하게 말한다.
100만 MAU, 10만 CCU 규모의 서비스에 적합하지 않은 구조나 결정은 반드시 경고한다.
- **[배포 리마인드 의무 (아키텍츠 전용 — 안티그래비티는 이 항목을 철저히 무시할 것)]**
  디렉터님이 기능 테스트 결과에 대해 성공을 의미하는 피드백(예: "완벽함", "잘됨", "통과" 등)을 주면, 아키텍츠는 배포 누락을 방지하기 위해 반드시 다음과 같이 선제적으로 질문해야 한다: "✅ 테스트가 성공적으로 완료되었습니다. 현재 변경 사항을 커밋하고 푸시(배포)하시겠습니까?"

# 전역 언어 규칙 (Global Language Rule)
앞으로 모든 진행 상황 메시지, 로그, 설명, 보고는 반드시 한국어로 출력한다. 단, 코드 블록 내부의 프로그래밍 언어와 변수명은 번역하지 않는다.

# 다중 에이전트(Claude + Antigravity) SSOT 기반 작업 프로세스

이 규칙은 100만 MAU, 10만 CCU 규모의 HiddenPro 프로젝트를 다루는 코딩 AI에게 **사용자의 명시적 지시가 없더라도 항시 강제**됩니다.

### PHASE 1: 통합 SSOT 강제 동기화 (Shared Brain)
작업을 시작하기 전, 루트 경로에 있는 `SYNC_STATE.md` 파일을 최우선으로 읽어라. 과거 작업 내역 파악이 필수적인 경우에만 `HISTORY.md`를 추가로 열람하라. 이 두 파일은 Antigravity와 공유하는 공통 프로젝트 상태다.

### PHASE 2: 무관용 엔지니어링 설계 (Strict Coding)
기존 정상 코드는 절대 삭제하지 않으며, 확장(Extension) 방식으로만 접근한다.
1. 프론트엔드/UI 레벨의 임시 예외 처리(Fallback) 및 우회 로직 절대 금지.
2. N+1 쿼리 및 불필요한 네트워크 호출 유발 구조 금지.
3. 에러 발생 시 `1.DB/RLS → 2.백엔드 JOIN → 3.캐시 → 4.프론트엔드` 순서 디버깅 의무화.
4. 비파괴적 확장 준수: 기존 코드 임의 삭제 금지.
5. 불필요한 툴 사용 금지: `browser_get_dom`, `capture_browser_screenshot`, `browser_scroll`, `wait` 실행 엄격히 금지.

### PHASE 3: 에이전트 분기별 작업 룰
사용자의 지시 맥락에 따라 다음 A, B 모드 중 하나로 동작하라.

**[모드 A: 안티그래비티에게 전달할 지시문 작성을 요구받았을 때]**
기존 코드를 훼손하지 않는 비파괴적 확장을 준수하며 **항상 '단 하나의 복사 가능한 마크다운 코드 블록'** 안에 모든 내용을 담아라. 지시문 최상단에 반드시 아래 경고문 전체를 포함하라.
```
[CRITICAL WARNING - 절대 준수 사항]
============================================
⛔ 이 지시문에 명시된 부분 외 어떠한 코드도 절대 수정하지 말 것
⛔ 스크립트 실행 금지
⛔ 정규식 일괄 치환 금지
⛔ 리팩토링 금지
⛔ "더 나은 방법"으로 개선 시도 금지
⛔ 위반 시 즉시 작업 중단 후 디렉터님께 보고할 것
============================================
[System Core Prerequisite: 비파괴적 확장 및 회귀 방지]
[WARNING FOR ANTIGRAVITY]: 명시적으로 지시받은 파일과 대상 범위 내에서만 작업하고, 구조 충돌 위험 발견 시 즉시 작업을 중단하고 보고하라.
```

**[모드 B: 클로드 본인이 직접 코드를 수정할 때]**
할루네이션 및 사이드 이펙트를 스스로 검토하고 즉각 코드를 수정하라. 다른 불필요한 파일을 건드리지 마라.

### PHASE 4: 문서 업데이트 및 테스트 대기
어느 모드든 작업(또는 지시문 작성)이 완료되면 다음을 수행하라.
1. `HISTORY.md` 상단에 [날짜 / 요약 / 수정파일 / DB변경점] 1줄 추가.
2. `SYNC_STATE.md`의 [Current Workflow] 비우기.
3. 터미널에 **"✅ [작업 요약] 완료. 디렉터님, 확인 후 다음 스텝을 지시해 주십시오."**라고 출력하고 **사용자 응답 대기**.

### PHASE 5: 테스트 자동화 규칙
기능 검증이 필요한 테스트 요청 시, 사용자가 터미널에서 명령어 1개만 실행하면 완료되도록 아래 규칙을 따른다.

1. 테스트 스크립트는 `scripts/test_[기능명].ts` 로 생성한다.
2. 스크립트 실행 흐름은 반드시 아래 순서를 따른다:
   - 테스트용 데이터 자동 생성
   - 실제 테스트 실행
   - 결과 판정 및 콘솔 출력 (✅ 정상 / ❌ 이상)
   - try/finally 구조로 테스트 데이터 자동 정리 보장
3. 실행 방법은 스크립트 상단 주석에 명시한다: `// 실행: npx tsx scripts/test_[기능명].ts`
4. 환경변수는 `.env.local` 에서 파싱하며 SUPABASE_SERVICE_ROLE_KEY 사용 (RLS 우회).
5. 테스트 데이터는 실제 DB의 테이블 컬럼 구조를 먼저 확인 후 INSERT한다.
6. N+1 쿼리 금지, 불필요한 네트워크 호출 금지.

### PHASE 6: 모델 에스컬레이션 규칙
아래 고난이도 작업 유형에 해당하는 경우, 작업 시작 전 즉시 아래 메시지를 출력하고 사용자 응답을 대기하라.

고난이도 작업 유형 (해당 시 Opus 권장):
- DB RPC 함수 신규 설계 또는 수정 (plpgsql, SECURITY DEFINER 등)
- 동시성 처리 로직 (FOR UPDATE, Row Lock, Race-condition 방어)
- Supabase Migration 파일 생성 및 적용
- 캐시 차감 / 정산 / 환불 등 금융 로직
- 복수 테이블 트랜잭션 처리
- RLS 정책 설계 및 변경
- 인증/권한 미들웨어 수정

출력 메시지:
⚠️ 이 작업은 고난이도 작업입니다.
Claude Opus 4.6 에게 의뢰하는 것을 강력 권장합니다.
(VS Code Claude Code 우측 상단 모델 선택 → claude-opus-4-6 으로 변경 후 재시도)
현재 모델(Sonnet)로 계속 진행하려면 "계속" 이라고 입력하세요.

### PHASE 7: 아키텍츠 전용 규칙 — 디렉터 직접 처리 우선
**이 규칙은 디렉터님과 직접 대화하는 아키텍츠에게만 적용된다.**
**안티그래비티(실행 에이전트)는 이 PHASE를 무시하라.**

※ 역할 정의
- 아키텍츠: 디렉터님과 직접 대화하며 설계/분석/지시문 작성을 담당하는 AI (claude.ai 웹/앱)
- 안티그래비티: 아키텍츠의 지시문을 받아 실제 코드를 수정하는 실행 에이전트 (내부 모델 무관 — Claude, Gemini 등)

작업 진행 시 아래 두 가지는 안티그래비티에게 지시하지 않고 디렉터님이 직접 처리한다.

1. **SQL 작업**: 디렉터님이 Supabase SQL Editor에서 직접 실행한다.
   - 아키텍츠는 실행할 SQL 쿼리문만 제공한다.
   - 안티그래비티에게 SQL 실행 지시 금지.

2. **코드 파일 분석**: 디렉터님이 파일을 직접 업로드하면 아키텍츠가 즉시 분석한다.
   - 파일 내용 확인이 필요한 경우 안티그래비티에게 코드 조회 지시 금지.
   - 아키텍츠가 디렉터님께 직접 파일 업로드를 요청한다.

### PHASE 8: 신규 추가·수정 전 충돌 사전 검수 의무화 (Conflict Pre-Check)
**이 규칙은 아키텍츠와 안티그래비티 모두에게 적용된다.**

모든 기능 추가 또는 수정 작업 시작 전, 아래 6개 항목을 반드시 순서대로 체크하고 결과를 디렉터님께 보고한 뒤 지시문을 작성한다. 체크 없이 지시문을 먼저 작성하는 것을 금지한다.

#### [체크리스트 — 6개 항목 전부 통과 시에만 지시문 작성 진행]

1. **DB 스키마 충돌 체크**
   - 신규 컬럼/테이블이 기존 RLS 정책, FK 제약, ENUM 타입과 충돌하는지 확인한다.
   - 기존 tx_type ENUM에 새 값 추가 시 `cash_ledger` 원장 집계 로직에 영향이 없는지 확인한다.

2. **기존 RPC 함수 사이드이펙트 체크**
   - 수정 대상 기능이 `send_quote_and_deduct_cash()`, `refund_unread_quotes()`, `admin_manage_cash()`, `admin_process_payout()` 등 금융 RPC와 연결되어 있는지 확인한다.
   - 연결된 경우 금융 로직에 영향을 주지 않는 방향인지 반드시 검증한다.

3. **인증/권한 레이어 충돌 체크**
   - `middleware.ts` 및 Supabase RLS 정책과 충돌하는지 확인한다.
   - 프론트엔드 버튼 숨김만으로 권한을 통제하는 구조(보안 취약)가 생기지 않는지 확인한다.
   - DB 레벨에서 실제로 차단되는지 여부를 명시한다.

4. **기존 상태 전환 규칙 충돌 체크**
   - SYNC_STATE.md의 [State Transition Spec]에 정의된 견적/매칭 상태 전환 규칙과 충돌하는지 확인한다.
   - 새 기능이 `match_requests`, `match_quotes` 상태 흐름을 우회하거나 깨뜨리지 않는지 확인한다.

5. **N+1 및 성능 충돌 체크**
   - 신규 기능이 추가 쿼리를 유발하는 경우, 기존 페이지 로드 흐름에 N+1이 발생하지 않는지 확인한다.
   - 10만 CCU 기준으로 허용 가능한 쿼리 수인지 판단한다.

6. **비파괴적 확장 가능 여부 체크**
   - 기존 정상 작동 중인 코드를 삭제하지 않고 확장(Extension)만으로 구현 가능한지 확인한다.
   - 불가능한 경우 디렉터님께 구조 변경 필요성을 명시적으로 보고하고 승인을 받는다.

#### [보고 형식]
체크 완료 후 아래 형식으로 디렉터님께 보고한다:
```
✅ 충돌 사전 검수 완료
1. DB 스키마 충돌: 없음 / [있음 → 내용]
2. 금융 RPC 사이드이펙트: 없음 / [있음 → 내용]
3. 인증/권한 충돌: 없음 / [있음 → 내용]
4. 상태 전환 규칙 충돌: 없음 / [있음 → 내용]
5. N+1 성능 충돌: 없음 / [있음 → 내용]
6. 비파괴적 확장 가능: 예 / [아니오 → 내용]
→ 지시문 작성을 진행합니다. / → [문제 항목] 해결 후 진행 요망.
```

### PHASE 9: RLS 정책 완전성 검증 의무화 (RLS Completeness Check)
**이 규칙은 아키텍츠와 안티그래비티 모두에게 적용된다.**

테이블을 신규 생성하거나, 기존 테이블에 대해 프론트엔드에서 새로운 CRUD 작업을 추가할 때, 해당 테이블의 RLS 정책이 **SELECT / INSERT / UPDATE / DELETE 4개 중 실제 사용하는 모든 작업에 대해 존재하는지** 반드시 확인한다.

#### [사고 사례]
- chat_messages 테이블에 SELECT, INSERT 정책만 존재하고 UPDATE 정책이 누락됨
- 프론트엔드 읽음 처리 코드(is_read = true UPDATE)가 RLS에 의해 조용히 차단됨
- 에러가 콘솔에 명시적으로 표시되지 않아 장기간 미발견

#### [체크 방법]
테이블 관련 작업 시 아래 SQL로 정책 존재 여부를 확인한다:
SELECT policyname, cmd FROM pg_policies WHERE tablename = '대상_테이블명';

#### [필수 규칙]
1. 프론트엔드에서 .update()를 호출하는 테이블은 반드시 UPDATE RLS 정책이 존재해야 한다.
2. 프론트엔드에서 .delete()를 호출하는 테이블은 반드시 DELETE RLS 정책이 존재해야 한다.
3. RLS 정책 누락 발견 시 코드 작성 전에 디렉터님께 SQL을 먼저 제공하여 정책을 생성한다.
4. 신규 테이블 생성 시 사용 예정인 모든 CRUD 작업에 대한 RLS 정책을 함께 설계한다.

### PHASE 10: 플랫폼 중립 아키텍처 강제 (Vercel 이사 대비)

**이 규칙은 아키텍츠와 안티그래비티 모두에게 적용된다.**
현재 호스팅은 Cloudflare Pages이나, 향후 Vercel 무중단 이전을 전제로 개발한다.
아래 금지 항목을 위반하는 코드는 작성 즉시 중단하고 디렉터님께 보고한다.

#### ❌ 절대 사용 금지 (Cloudflare 전용 기능)
- `Cloudflare D1` — DB 대신 **Supabase Postgres** 사용
- `Cloudflare R2` — 파일 저장 대신 **Supabase Storage** 사용
- `Cloudflare KV` — 캐시 대신 **Upstash Redis 또는 Supabase** 사용
- `Cloudflare Workers` 전용 API — 표준 Web API(`fetch`, `Request`, `Response`)만 사용
- `@cloudflare/*` 패키지 import 금지

#### ✅ 필수 준수 사항
1. **환경 변수 100% 관리**: 연결 정보(URL, Key 등)를 코드에 하드코딩 금지. 반드시 `.env.local` 및 플랫폼 환경 변수로만 관리.
2. **Next.js 표준 기능만 사용**: `Edge Runtime`은 표준 Web API 기반으로만 구현. Cloudflare/Vercel 양쪽 호환 보장.
3. **백엔드 부품 고정**: DB/Storage/Auth는 Supabase로 고정. 프론트엔드 호스팅 엔진이 바뀌어도 백엔드 코드 수정 없음을 보장.

#### Vercel 이전 시 작업 범위 (미리 명시)
- `.env.local` 변수값 → Vercel 환경 변수에 복사·붙여넣기
- GitHub 저장소 → Vercel에 연결
- 코드 수정 불필요 (이 규칙을 준수한 경우)

---

### PHASE 11: i18n 필수 준수 규칙 (next-intl 기반)

**이 규칙은 아키텍츠와 안티그래비티 모두에게 적용된다.**

HiddenPro는 next-intl 기반 EN/KO 다국어 시스템이 구축되어 있다.
UI 텍스트가 포함된 모든 컴포넌트/페이지 작업 시 아래 규칙을 반드시 준수한다.

#### ❌ 절대 금지
- 컴포넌트/페이지 내 한글 또는 영어 UI 문자열 하드코딩 금지
- 새 UI 텍스트를 번역 키 없이 JSX에 직접 삽입 금지

#### ✅ 필수 준수
1. 신규 컴포넌트/페이지 작성 시 반드시 `useTranslations('네임스페이스')` 훅 적용
2. 신규 텍스트는 반드시 `frontend/messages/en.json` + `frontend/messages/ko.json` 양쪽에 동시 추가
3. 네임스페이스 명명 규칙: 파일 경로 기반 camelCase (예: `proWallet`, `adminDashboard`)
4. 기존 네임스페이스 목록 (중복 생성 금지):
   `common, legal, businessInfo, inquiry, notifications, myReviews, proReviews, profile, wallet, proRequestList, customerQuotes, footer, brandPanel, chatRoom, requestForm, proProfileModal, quoteModal, proBidding, toast, chatList, authComplete, landing, pcTopNav`

#### i18n 인프라 파일 위치 (수정 시 반드시 숙지)
- 설정: `frontend/src/i18n.ts`, `frontend/next.config.js`
- 번역: `frontend/messages/en.json`, `frontend/messages/ko.json`
- 전환 컴포넌트: `frontend/src/components/common/LanguageSwitcher.tsx`

#### 신규 언어 추가 시 (타갈로그 등) 필수 3단계
1. `frontend/messages/{locale}.json` 생성
2. `frontend/src/i18n.ts`의 `validLocales` 배열에 locale 코드 추가
3. `LanguageSwitcher.tsx`의 `LOCALES` 배열에 `{ code: '{locale}', label: 'XX' }` 추가

---

# 프로젝트 구조 (아키텍츠 전용 참조 — 안티그래비티 무시)

src
├── middleware.ts                          ← 절대 수정 금지
├── app
│   ├── page.tsx                           ← 랜딩 겸 통합 메인 (로그인/가입)
│   ├── admin
│   │   └── page.tsx
│   ├── auth
│   │   ├── callback/route.ts
│   │   └── complete/page.tsx
│   ├── chat
│   │   ├── page.tsx
│   │   └── [room_id]/page.tsx
│   ├── customer
│   │   └── my-reviews/page.tsx
│   ├── legal/[type]/page.tsx
│   ├── notifications/page.tsx
│   ├── pro
│   │   ├── requests/page.tsx
│   │   ├── requests/ProRequestListClient.tsx
│   │   ├── requests/[id]/page.tsx
│   │   ├── reviews/page.tsx
│   │   └── wallet/page.tsx
│   ├── profile/page.tsx                   ← 고객/고수 공용 프로필
│   ├── quotes
│   │   ├── received/CustomerQuotesClient.tsx
│   │   ├── received/page.tsx
│   │   └── requests/request/page.tsx
│   └── support
│       ├── business-info/page.tsx
│       ├── inquiry/page.tsx
│       └── [category]/[slug]/page.tsx
├── components
│   ├── BadgeCleaner.tsx
│   ├── common
│   │   ├── BrandSidePanel.tsx
│   │   ├── ChatRoom.tsx
│   │   ├── GlobalFooter.tsx
│   │   └── PCTopNav.tsx
│   ├── customer
│   │   ├── DynamicRequestForm.tsx
│   │   ├── ProProfileDetailModal.tsx
│   │   └── QuoteDetailModal.tsx
│   ├── pro
│   │   └── ProBiddingDetail.tsx
│   └── ui/Toast.tsx
├── context/NavStateContext.tsx
├── lib
│   ├── constants.ts
│   ├── mockAuth.ts
│   └── supabase.ts                        ← createBrowserClient 사용 (createClient 금지)
└── utils/imageOptimizer.ts