# HiddenPro — 배포 전 필수 체크리스트 (DEPLOY_CHECKLIST.md)

> **문서 위치**: `DEPLOY_CHECKLIST.md` (프로젝트 루트)
> **최종 업데이트**: 2026-03-22
> **목적**: 런칭(Go-Live) 전 반드시 완료해야 하는 항목들을 추적. 현재 **절대 활성화 금지** 항목 포함.

> [!CAUTION]
> 아래 항목들은 **런칭 전까지 절대 활성화 금지**. 프로덕션 배포 시 아래 모든 항목을 완료 후 활성화해야 한다.

---

## 🚀 Go-Live Pending Checklist

### 보안 / 모니터링

- [ ] **Sentry 에러 트래킹 전면 연결 및 Key 주입**
  - `SENTRY_DSN` 환경 변수를 `.env.local` 및 Cloudflare/Vercel 대시보드에 설정
  - 에러 발생 시 Slack/이메일 알림 연동 확인

- [ ] **Supabase Rate Limit 전면 활성화 (DDoS 방어)**
  - Supabase 대시보드 → Auth → Rate Limits 설정 활성화
  - API 요청 Rate Limit 정책 적용 확인

- [ ] **이메일 가입 2FA (Confirm Email) 기능 ON**
  - Supabase 대시보드 → Auth → Email Confirmations → Enable 설정
  - 가입 플로우에서 이메일 인증 완료 전 서비스 접근 차단 확인

---

### 결제 / 정산 연동

- [ ] **PG 결제 연동 시 1:1 문의 폼에 "Transaction ID" 입력 필드 연동 확인**
  - `support/inquiry/page.tsx` — Transaction ID 입력 필드 추가
  - 결제 관련 문의 시 거래 ID 필수 입력 처리

- [ ] **PG 결제 연동 시 "Request Withdrawal" 버튼 복원**
  - 파일: `frontend/src/app/pro/wallet/page.tsx`
  - 현재 코드: `{false && (...)}` → `{true && (...)}` 또는 조건 제거
  - 출금 신청 플로우 전체 테스트 필수

---

### 배치 / 자동화

- [ ] **쿠폰 만료 자동 처리 배치 구축**
  - pg_cron 또는 Supabase Edge Function으로 구현:
    ```sql
    UPDATE coupons
    SET status = 'EXPIRED'
    WHERE status = 'ACTIVE'
      AND expires_at < NOW();
    ```
  - 실행 주기: 매일 00:00 UTC 권장
  - 처리 결과 로깅 확인

---

### 법무 / 정책

- [ ] **이용약관(Terms of Service)에 추천 프로그램 참여 조항 추가**
  - 파일: `frontend/src/app/legal/[type]/page.tsx` (또는 해당 경로)
  - 추천 보상 지급 조건, 어뷰징 시 보상 회수 정책 명시

- [ ] **DTI 허가번호 실제 번호로 교체**
  - 현재 값: `FTEB-XXXXX` (플레이스홀더)
  - 교체 대상: 이용약관 및 관련 모든 법무 문서
  - DTI(Department of Trade and Industry) 허가 취득 후 실제 번호 기입

---

## 📋 Pre-Launch 진행 순서 (권장)

```
1단계: 보안 기반 강화
   → Sentry 연결 → Rate Limit → 이메일 2FA

2단계: 결제 시스템 연동
   → PG사 결제 연동 → Transaction ID 필드 → 출금 버튼 복원

3단계: 자동화 배치
   → 쿠폰 만료 배치 → pg_cron 등록 → 테스트 확인

4단계: 법무 정책 완료
   → 이용약관 업데이트 → DTI 번호 교체
   → 법무팀 최종 검토

5단계: 스테이징 → 프로덕션 배포
   → 전체 기능 회귀 테스트 → 모니터링 대시보드 확인
```

---

## ✅ 완료 시 체크 기준

각 항목 완료 후 아래 형식으로 이 파일에 기록:

```
- [x] 항목명 — 완료일: YYYY-MM-DD / 담당자: 디렉터님 / 확인: ___
```

---

## 📌 관련 문서

- [`SYNC_STATE.md`](./SYNC_STATE.md) — 현재 프로젝트 상태 및 워크플로우
- [`docs/supabase_schema.md`](./docs/supabase_schema.md) — DB 스키마 및 RLS 정책
- [`docs/abuse_prevention.md`](./docs/abuse_prevention.md) — 어뷰징 방지 및 쿠폰 정책

---

## [Pending] 식별된 기술 부채 및 보안 취약점 (추후 작업)

- [ ] [Security: 치명적] `src/app/admin/page.tsx`, `src/app/referral/page.tsx`, `src/app/support/inquiry/page.tsx` 내의 레거시 `getSession()` 호출을 `getUser()` 기반의 서버 측 토큰 검증 로직으로 전면 교체 (※ `src/middleware.ts`의 로컬 파싱 로직은 CCU 방어 목적으로 유지할 것)
- [ ] [Tech Debt: 높음] UI 컴포넌트 내 약 1,400여 건의 한국어 하드코딩 문자열을 `useTranslations` 훅과 언어 파일(en.json/ko.json)로 교체하는 도메인 분할 리팩토링 진행
- [ ] [Performance: 검사 중] 백엔드/프론트엔드 내 `Promise.all` 루프 호출 등 잠재적인 N+1 쿼리 유발 로직 정밀 추적 및 JOIN/RPC 구조로의 최적화 전환
- [ ] [Security: 치명적] `src/app/admin/page.tsx`, `src/app/referral/page.tsx`, `src/app/support/inquiry/page.tsx` 내 레거시 `getSession()` 호출을 `getUser()` 기반 서버 측 토큰 검증 로직으로 전면 교체 (단, `src/middleware.ts`는 로컬 파싱 목적이므로 유지)
- [ ] [Architecture: 높음] `api/admin/promote/route.ts` 및 테스트 스크립트 등에 잔존하는 레거시 `@supabase/supabase-js`의 `createClient` 호출을 `@supabase/ssr` 기반 클라이언트로 마이그레이션
- [ ] [Tech Debt: 높음] 약 1,400여 건의 UI 텍스트 하드코딩을 `useTranslations` 훅과 언어 파일(en.json/ko.json)로 교체하는 도메인 분할 i18n 리팩토링 진행
- [ ] [Backend/DB: 정밀 검증] 1방향 리뷰 작성 권한이 프론트엔드 UI뿐만 아니라, DB RLS 정책 상에서도 채팅방 상태가 `MATCHED`일 때만 가능하도록 완벽히 닫혀 있는지 백엔드 교차 검증 및 보완
- [ ] [Backend/DB: 정밀 검증] 3-15-0 규칙(요청서당 최대 견적 5개 제한)이 DB RPC 함수(`send_quote_and_deduct_cash` 등) 내부에서 `COUNT(*)` 및 트랜잭션으로 원자적 차단되고 있는지 백엔드 교차 검증 및 보완
