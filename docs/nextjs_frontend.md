# HiddenPro — 프론트엔드 아키텍처 및 UI 규칙

> **문서 위치**: `docs/nextjs_frontend.md`
> **적용 대상**: 안티그래비티(실행 에이전트) 및 아키텍츠(설계 에이전트) 모두
> **최종 업데이트**: 2026-03-22
> **규모 기준**: 100만 MAU / 10만 CCU
> **목적**: Next.js 프론트엔드 컴포넌트 구조, 라우팅, 상태 관리, 무관용 에러 처리 원칙 기록

---

## 1. 핵심 원칙 — 프론트엔드 우회 처리 전면 금지

> [!CAUTION]
> **프론트엔드 단에서 임시 Fallback, 더미 데이터, 하드코딩 예외 처리로 DB/백엔드 문제를 우회하는 것은 절대 금지한다.**
> 이를 위반할 경우 즉시 작업을 중단하고 디렉터님께 보고한다.

### 1.1 금지된 우회 패턴

```typescript
// ❌ 절대 금지 — 에러 시 더미 데이터로 Fallback
const loadData = async () => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      setUser({ name: 'Guest', role: 'CUSTOMER' }); // ← 하드코딩 Fallback 금지
    }
  } catch {
    setUser(defaultUser); // ← 예외 흡수 + 우회 처리 금지
  }
};

// ❌ 절대 금지 — DB 권한 문제를 클라이언트에서 무시
const { data } = await supabase.from('admin_data').select('*');
if (!data) return null; // ← RLS 차단을 조용히 무시

// ❌ 절대 금지 — 조건부 렌더링으로 DB 오류 숨김
{data?.credits ?? 0} Credits {/* DB에서 credits가 null로 오면 0으로 보이는 착각 유발 */}
```

### 1.2 올바른 에러 처리 원칙

```typescript
// ✅ 올바른 방법 — 에러를 명시적으로 노출하고 사용자에게 안내
const loadData = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("id, display_name, role");

  if (error) {
    // 1. 에러 로그 기록 (Sentry 등)
    console.error("[loadData] Supabase error:", error);
    // 2. 사용자에게 Toast로 명확히 안내
    showToast(
      "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      "error",
    );
    // 3. 로딩 상태만 종료 — 빈 데이터가 있는 것처럼 속이지 않음
    return;
  }

  setUser(data);
};

// ✅ 올바른 방법 — RLS 차단 시 명시적 처리
const { data, error } = await supabase.from("match_requests").select("...");
if (error?.code === "PGRST116") {
  // RLS 정책에 의한 차단 → 권한 없음 UI 표시
  showToast("접근 권한이 없습니다.", "error");
  router.push("/");
  return;
}
```

### 1.3 에러 디버깅 순서 준수

프론트엔드에서 데이터 이상이 발생하면 **반드시 아래 순서로 추적**:

```
1. DB/RLS  →  2. 백엔드 JOIN/RPC  →  3. 캐시/상태  →  4. 프론트엔드 렌더링
```

프론트엔드를 먼저 수정하려는 시도는 근본 원인을 숨기는 행위이므로 금지.

---

## 2. 프로젝트 디렉터리 구조

> **중요**: `middleware.ts`는 절대 임의 수정 금지.

```
frontend/src/
├── middleware.ts                              ← 절대 수정 금지 (RBAC 라우팅 보호)
├── app/                                       ← Next.js App Router
│   ├── page.tsx                               ← 랜딩 겸 통합 메인 (로그인/가입)
│   ├── admin/
│   │   └── page.tsx                           ← 관리자 대시보드
│   ├── auth/
│   │   ├── callback/route.ts                  ← 소셜 로그인 콜백 처리
│   │   └── complete/page.tsx                  ← 가입 완료 + 역할 설정
│   ├── chat/
│   │   ├── page.tsx                           ← 채팅 목록
│   │   └── [room_id]/page.tsx                 ← 채팅방 (Realtime)
│   ├── customer/
│   │   └── my-reviews/page.tsx                ← 고객 리뷰 내역
│   ├── legal/
│   │   └── [type]/page.tsx                    ← 법무 문서 (Terms/Privacy)
│   ├── notifications/page.tsx                 ← 알림 목록
│   ├── pro/
│   │   ├── requests/page.tsx                  ← 고수 요청서 목록
│   │   ├── requests/ProRequestListClient.tsx  ← 요청서 목록 클라이언트 컴포넌트
│   │   ├── requests/[id]/page.tsx             ← 요청서 상세
│   │   ├── reviews/page.tsx                   ← 고수 리뷰 내역
│   │   └── wallet/page.tsx                    ← 지갑/Credits
│   ├── profile/page.tsx                       ← 고객/고수 공용 프로필
│   ├── referral/page.tsx                      ← 추천인 페이지 (Invite & Earn)
│   ├── quotes/
│   │   ├── received/page.tsx                  ← 고객 받은 견적 목록
│   │   ├── received/CustomerQuotesClient.tsx  ← 고객 견적 목록 클라이언트
│   │   └── requests/request/page.tsx          ← 견적 요청서 작성
│   └── support/
│       ├── business-info/page.tsx             ← 사업자 정보 안내
│       ├── inquiry/page.tsx                   ← 1:1 문의
│       └── [category]/[slug]/page.tsx         ← 고객센터 아티클
├── components/
│   ├── BadgeCleaner.tsx                       ← 배지 카운트 초기화 유틸
│   ├── common/                                ← 전역 공통 컴포넌트
│   │   ├── BrandSidePanel.tsx
│   │   ├── ChatRoom.tsx                       ← 채팅 UI (공용, Realtime)
│   │   ├── GlobalFooter.tsx
│   │   └── PCTopNav.tsx                       ← PC 상단 GNB
│   ├── admin/
│   │   └── AdminReferralTab.tsx               ← 관리자 추천인 탭 (별도 컴포넌트)
│   ├── customer/
│   │   ├── DynamicRequestForm.tsx             ← 동적 견적 요청 폼
│   │   ├── ProProfileDetailModal.tsx
│   │   └── QuoteDetailModal.tsx
│   ├── pro/
│   │   └── ProBiddingDetail.tsx
│   └── ui/
│       └── Toast.tsx                          ← 전역 Toast 알림
├── context/
│   └── NavStateContext.tsx                    ← 전역 네비게이션 상태
├── lib/
│   ├── constants.ts                           ← 전역 상수
│   ├── mockAuth.ts
│   └── supabase.ts                            ← createBrowserClient 사용 (createClient 금지)
└── utils/
    └── imageOptimizer.ts                      ← 이미지 WebP 최적화 유틸
```

---

## 3. 라우팅 및 미들웨어 규칙

### 3.1 미들웨어 수정 금지

```
middleware.ts 는 절대 임의 수정 금지.
역할 기반 접근 제어(RBAC), 인증 상태 체크, 리다이렉트 로직이 모두 이 파일에 집중되어 있음.
수정이 필요한 경우 반드시 디렉터님(→ 아키텍츠)과 먼저 상의 후 진행.
```

### 3.2 라우팅 보호 규칙

| 경로 패턴      | 접근 허용 역할                             | 미처리 시 리다이렉트 |
| -------------- | ------------------------------------------ | -------------------- |
| `/admin/**`    | `ADMIN`, `ADMIN_OPERATION`, `ADMIN_VIEWER` | `/`                  |
| `/pro/**`      | `PRO`                                      | `/`                  |
| `/customer/**` | `CUSTOMER`                                 | `/`                  |
| `/chat/**`     | 인증된 모든 사용자                         | 로그인 모달          |
| `/quotes/**`   | 인증된 모든 사용자                         | 로그인 모달          |

> **보안 원칙**: 미들웨어의 리다이렉트 + DB RLS 정책을 이중으로 적용하여 방어.
> 프론트엔드 버튼 숨김/조건부 렌더링만으로 권한 통제를 대신하는 것은 **보안 취약점**이므로 금지.

### 3.3 역할 동기화 3-Point 원칙

역할(role) 변경 시 반드시 아래 3곳을 **동시에** 업데이트해야 한다:

```
1. DB: public.users.role
2. JWT user_metadata
3. JWT app_metadata
```

하나라도 누락되면 미들웨어 세션 불일치 버그 발생.

### 3.4 인증 클라이언트 강제 규칙

```typescript
// ✅ 필수 — @supabase/ssr의 createBrowserClient (SSR 쿠키 세션 보장)
import { createBrowserClient } from "@supabase/ssr";
const supabase = createBrowserClient(url, anonKey);

// ❌ 절대 금지 — createClient (레거시, 세션 동기화 불가)
import { createClient } from "@supabase/supabase-js";

// ✅ 세션 검증 — getUser() 사용 (서버에서 토큰 실제 검증)
const {
  data: { user },
} = await supabase.auth.getUser();

// ❌ 금지 — getSession()만 사용 (로컬 캐시 반환, 위변조 가능)
const {
  data: { session },
} = await supabase.auth.getSession();
```

### 3.5 AUP 규정 준수 (Acceptable Use Policy)

1. **금융/결제 로직 수정 시**: 방어적 백엔드 아키텍처(RLS, 권한 분리)를 최우선으로 적용.
   - 프론트엔드에서 직접 `UPDATE cash_ledger` 또는 `UPDATE users SET available_credits` 절대 금지
   - 반드시 SECURITY DEFINER RPC 함수로만 처리

2. **AI 기능 구현 시**: 챗봇/에이전트 등 사용자 상호작용 UI에는 반드시 **'AI 고지(Disclosure)' UI**를 포함
   ```typescript
   // 예시: AI 생성 응답 하단에 표시
   <p className="ai-disclosure">이 내용은 AI가 생성했습니다.</p>
   ```

---

## 4. 컴포넌트 설계 원칙

### 4.1 Server Component vs Client Component 구분

```typescript
// 서버 컴포넌트 (기본) — page.tsx
// - 초기 데이터 패칭 (SSR)
// - SEO가 필요한 콘텐츠
// - 번들 사이즈 최소화

export default async function Page() {
  const t = await getTranslations('PageName'); // 서버 측 번역
  const data = await fetchInitialData();       // 서버 측 데이터 패칭
  return <ClientComponent initialData={data} />;
}

// 클라이언트 컴포넌트 ('use client' 선언 필수)
// - 사용자 이벤트 처리 (onClick, onChange)
// - Realtime 구독 (supabase.channel)
// - useState, useEffect 사용
// - useTranslations 훅 사용
'use client';
```

### 4.2 공통 컴포넌트 수정 주의 사항

아래 컴포넌트는 전체 앱에서 사용되므로 수정 시 **사이드이펙트 영향 범위를 반드시 분석**:

| 컴포넌트                 | 영향 범위             | 수정 주의 사항                 |
| ------------------------ | --------------------- | ------------------------------ |
| `ChatRoom.tsx`           | 모든 채팅방           | Realtime 구독, 확정 로직 포함  |
| `PCTopNav.tsx`           | 모든 페이지 상단      | 배지(Badge) 업데이트 로직 포함 |
| `Toast.tsx`              | 전체 앱 알림          | 에러 표시 시간(10초) 정책 포함 |
| `GlobalFooter.tsx`       | 모든 페이지 하단      | i18n 연동                      |
| `DynamicRequestForm.tsx` | 견적 요청 전체 플로우 | 카테고리별 동적 질문 포함      |

**규칙**: 공통 컴포넌트 수정 시 반드시 해당 컴포넌트가 사용되는 모든 페이지에서의 동작을 검토한다.

### 4.3 Props 설계 원칙

```typescript
// ✅ 올바른 Props 설계 — null-safe + 타입 명시
interface QuoteCardProps {
  quoteId: string;
  price: number; // undefined 아닌 number 강제
  proName: string;
  avatarUrl: string | null; // null 가능한 경우 명시
  status: "PENDING" | "ACCEPTED" | "REJECTED"; // ENUM 명시
  onSelect: (quoteId: string) => void;
}

// ❌ 금지 — any 타입 사용
interface BadProps {
  data: any; // 금지
  callback: any; // 금지
}
```

---

## 5. 전역 상태 관리 및 캐싱 원칙

### 5.1 불필요한 네트워크 호출 방지

```typescript
// ❌ 금지 — 컴포넌트 마운트마다 반복 호출
useEffect(() => {
  fetchUserProfile(); // 매 렌더링마다 호출
}, []); // 의존성 배열이 빈 배열이어도 StrictMode에서 2번 호출

// ✅ 올바른 방법 — 상위에서 1번만 패칭 후 Context로 전달
// NavStateContext.tsx 에서 최상단 1회 패칭 → 하위 컴포넌트는 Context 소비
const { user } = useNavState();
```

### 5.2 전역 상태 사용 원칙 (NavStateContext)

`NavStateContext.tsx`는 아래 데이터만 전역 관리한다:

- 현재 로그인 사용자 정보 (`user`, `role`)
- 배지(Badge) 카운트 (미읽음 알림, 미읽음 채팅)
- 네비게이션 상태 (활성 탭)

```typescript
// 전역 상태 소비 — Context 사용
const { user, unreadCount, refreshBadge } = useNavState();

// 지역 상태는 해당 컴포넌트 내 useState로만 관리
const [localData, setLocalData] = useState(null);
```

### 5.3 Realtime 구독 관리

```typescript
// ✅ 올바른 Realtime 구독 — cleanup 필수
useEffect(() => {
  const channel = supabase
    .channel(`chat-${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      setMessages(prev => [...prev, payload.new as ChatMessage]);
    })
    .subscribe();

  // ✅ cleanup — 컴포넌트 언마운트 시 반드시 구독 해제
  return () => {
    supabase.removeChannel(channel);
  };
}, [roomId]);

// ❌ 금지 — cleanup 없는 구독 (메모리 누수 + 중복 이벤트)
useEffect(() => {
  supabase.channel('chat').on(...).subscribe();
  // return 없음 → 구독 누적
}, []);
```

### 5.4 중복 API 호출 방지 패턴

```typescript
// ✅ 로딩 상태 + 데이터 캐싱으로 중복 호출 방지
const [data, setData] = useState<Data | null>(null);
const [loading, setLoading] = useState(false);
const [loaded, setLoaded] = useState(false); // 한 번 로드 완료 표시

useEffect(() => {
  if (loaded) return; // 이미 로드된 경우 재호출 방지
  if (loading) return; // 현재 로딩 중이면 중복 호출 방지

  setLoading(true);
  fetchData()
    .then((result) => {
      setData(result);
      setLoaded(true);
    })
    .finally(() => setLoading(false));
}, [loaded, loading]);
```

---

## 6. i18n 적용 규칙 (빠른 참조)

> **전체 i18n 규칙은 `docs/system_architecture.md` 섹션 2 참조.**

```typescript
// 클라이언트 컴포넌트
'use client';
import { useTranslations } from 'next-intl';
const t = useTranslations('ComponentName');

// 서버 컴포넌트
import { getTranslations } from 'next-intl/server';
const t = await getTranslations('PageName');

// 절대 금지 — 하드코딩 문자열
<button>Submit</button>        // ❌
<button>{t('submit')}</button> // ✅
```

---

## 7. 이미지 업로드 및 최적화

### 7.1 필수 사용 — imageOptimizer

```typescript
import { optimizeImage } from "@/utils/imageOptimizer";

// 업로드 전 반드시 최적화 적용 (WebP 변환 + 용량 압축)
const optimized = await optimizeImage(file, { maxWidth: 1080, quality: 0.85 });
const { data, error } = await supabase.storage
  .from("quote_images") // Supabase Storage 버킷 사용 (Cloudflare R2도 병행 가능)
  .upload(`${userId}/${Date.now()}_${file.name}`, optimized);
```

### 7.2 이미지 URL 처리

```typescript
// Supabase Storage Public URL 생성
const { data: { publicUrl } } = supabase.storage
  .from('quote_images')
  .getPublicUrl(path);

// next/image 사용 (자동 최적화)
import Image from 'next/image';
<Image src={publicUrl} alt="..." width={400} height={300} />
```

---

## 8. 보안 및 인증 연동

### 8.1 Supabase 클라이언트 초기화

```typescript
// lib/supabase.ts — 반드시 이 패턴만 사용
import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

### 8.2 사용자 세션 확인

```typescript
// ✅ 올바른 세션 확인 방법 — getUser() 사용 (토큰 검증 서버 확인)
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

// ❌ 금지 — getSession()만 사용 (로컬 캐시에서 반환, 보안 취약)
const {
  data: { session },
} = await supabase.auth.getSession(); // 검증 없음

// ✅ 세션 갱신이 필요한 경우
const { error } = await supabase.auth.refreshSession();
```

### 8.3 AI 기능 구현 시

```typescript
// AI 챗봇/에이전트 UI 구현 시 반드시 'AI 고지(Disclosure)' UI 포함
// 예시: 응답 하단에 "이 답변은 AI가 생성했습니다." 표시
// AUP(Acceptable Use Policy) 준수 의무
```

---

## 9. 신규 페이지/컴포넌트 작성 체크리스트

작업 완료 전 아래 항목을 반드시 확인한다:

- [ ] `'use client'` 또는 서버 컴포넌트 구분이 올바른지 확인
- [ ] 하드코딩 UI 문자열이 없는지 확인 → `useTranslations` 사용
- [ ] `en.json` / `ko.json` 번역 키 동시 추가 완료
- [ ] N+1 쿼리 패턴이 없는지 확인
- [ ] Realtime 구독이 있다면 cleanup(return) 포함 여부 확인
- [ ] 에러 발생 시 Fallback 대신 Toast + 명시적 에러 안내 처리
- [ ] 프론트엔드 버튼 권한 제어만으로 보안 처리하지 않았는지 확인
- [ ] 이미지 업로드 시 `imageOptimizer` + `Supabase Storage` 또는 `Cloudflare R2` 사용 여부 확인
- [ ] `SELECT *` 대신 필요한 컬럼만 명시 여부 확인
- [ ] Supabase 클라이언트가 `createBrowserClient`(`@supabase/ssr`) 사용인지 확인 (`createClient` 금지)
- [ ] 세션 확인 시 `getUser()` 사용 여부 확인 (`getSession()`만 사용 금지)
- [ ] 역할 변경 시 DB + JWT user_metadata + app_metadata 3곳 동시 동기화 확인
- [ ] AI 기능 구현 시 'AI 고지(Disclosure)' UI 포함 여부 확인

---

## 10. MVP 기획 핵심 정책 통합 (프론트엔드 UI 규칙)

### 10.1 통합 앱 환경 (Role-based 하이브리드)

고객용 앱과 고수용 앱을 분리하지 않고, 하나의 플랫폼(앱)에서 권한(Role)에 따라 하이브리드로 화면을 렌더링하도록 라우팅 및 컴포넌트를 설계합니다.

### 10.2 GNB 최적화 및 탭 간소화

초기 트래픽 분산을 막기 위해 커뮤니티, 마켓, 고수찾기 탭을 전면 삭제합니다. GNB에는 권한별 필수 탭만 노출합니다:

- **고객**: 견적요청, 받은견적 등
- **고수**: 받은요청, C아이콘(Credits), 알림 등

## 10. 핵심 UI/UX 화면 설계 및 전환율(CVR) 최적화 규칙

이 섹션은 비즈니스 수익 창출과 직결된 프론트엔드 화면 명세이다. 컴포넌트 개발 시 아래의 '버튼 위치', '데이터 노출 방식', '유저 행동 유도(CTA)' 규칙을 100% 준수해야 한다.

### 10.1 [고객] 동적 챗봇 요청서 (Dynamic Request Form)

고객 이탈 방지 및 끝까지 완료 유도를 위한 설계:

- **상단 프로그레스 바**: 진행 중인 카테고리명과 함께 시각적 진행률 고정 노출.
- **중앙 챗봇 영역**: 1화면(말풍선) 1질문 원칙. 스크롤이 긴 설문지 형태 절대 금지 (`dynamic_answers` JSON 스키마 기반 렌더링).
- **후(後) 로그인 (가장 중요)**: 모든 질문 완료 전까지 로그인 창 호출 절대 금지. 마지막 답변 직후 **[견적 받을 고수 매칭하기]** 강력한 CTA 버튼 노출 → 클릭 시에만 소셜 로그인/가입 BottomSheet 호출.

### 10.2 [고수] 받은 요청 리스트 및 견적 발송 (Pro Quote Bidding)

결제 조급증(FOMO) 자극 및 과금 유도를 위한 설계:

- **리스트 FOMO UI**: 고객 요청서 카드 우측 상단에 입찰 현황(예: `💡 2명 / 5명 견적 발송 완료`) 및 48시간 남은 타이머(빨간색 텍스트) 강조 배치.
- **상세 열람**: 고객이 작성한 JSON 응답 데이터를 파싱하여 가독성 높은 리스트로 렌더링.
- **견적 발송 버튼 (과금 트리거)**: 화면 우측 하단에 **[OOO 캐시로 견적 보내기]** 버튼을 플로팅(Floating)으로 화면에 항상 고정. 스크롤 시에도 절대 사라지지 않도록 CSS 처리하며, 클릭 시 즉시 `cash_ledger` 차감 API(RPC) 연동.

### 10.3 [공통] 실시간 채팅 및 리뷰 (Chat & Review)

플랫폼 내 거래 증명 및 우회 거래 방지:

- **채팅방 상단 고정 패널**: 상대방 프로필 정보 및 고수의 '견적 금액' 상단 고정.
- **매칭 확정 스위치**: 상단 중앙 **[매칭 확정하기]** 스위치 배치 (고수/고객 모두 클릭 가능).
- **1방향 리뷰 트리거**: 방 상태가 'MATCHED'로 변환된 경우에 한해, 고객 화면 하단에 **[이 고수에게 리뷰 남기기]** 버튼 생성 (어뷰징 방지 룰과 연동).
- **빈 상태(Empty State) 유도**: 생성된 방이 없을 경우 빈 화면 대신 강력한 CTA 노출 (고객: `[새로운 견적 요청하기]`, 고수: `[받은 요청 보러가기]`).
