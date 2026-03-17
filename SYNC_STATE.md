[System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

# HiddenPro - CLAUDE Sync State & SSOT

이 문서는 HiddenPro 프로젝트(100만 MAU, 10만 CCU 규모)의 컨텍스트 유지 및 토큰 최적화를 위한 핵심 상태 파일입니다. 
전체 작업 히스토리 파악이 필수적인 경우에만 `CLAUDE_HISTORY.md`를 참조하십시오.

## 1. [Business & Architecture Core]
* **비즈니스**: 필리핀 기반 전문가-고객 매칭 서비스 (HiddenPro).
* **과금 모델**: 견적 발송 시 포인트 즉시 차감 (에스크로/후정산 금지).
* **아키텍처**: 10만 CCU 방어 (PgBouncer/Supavisor 커넥션 풀링). 엣지 캐싱 및 페이로드 최소화.
* **데이터베이스**: Supabase 기반, N+1 방지를 위한 백엔드 JOIN 및 RLS 적용.

## 2. [Strict Rules & Auth]
* **우회/임시 조치 금지**: 프론트엔드 레벨 Fallback 절대 금지.
* **무중단 마이그레이션**: DB 스키마 변경 시 [새 컬럼 추가 → 이중 쓰기 → 데이터 마이그레이션 → 구 컬럼 접근 차단] 준수.
* **에러 디버깅 파이프라인**: 1.DB/RLS → 2.백엔드 쿼리 → 3.캐시 → 4.프론트엔드
* **인증 및 미들웨어 (중요)**: `middleware.ts` 임의 수정 엄금. 역할 변경 시 DB(`public.users.role`)와 JWT(`user_metadata`, `app_metadata`) 3곳 동시 동기화 필수. Supabase 프론트엔드 클라이언트는 반드시 `@supabase/ssr`의 `createBrowserClient` 사용 (`createClient` 금지).

## 3. [Current Workflow]


## 4. [Go-Live Pending Checklist] (런칭 전 필수 보류 - 현재 절대 활성화 금지)
1. Sentry 에러 트래킹 전면 연결 및 Key 주입
2. Supabase Rate Limit 전면 활성화 (DDoS 방어)
3. 이메일 가입 2FA (Confirm Email) 기능 ON

## 5. [State Transition Spec — 견적/매칭 상태 전환 규칙]

### 고객화면 (match_requests 상태 → 탭 분류)
| 상태 / 조건 | 올바른 탭 |
|---|---|
| OPEN (견적 0개 / 대기 중) | 진행 중인 견적 |
| OPEN + 견적 있음 | 진행 중인 견적 |
| 견적 최대 개수 도달 (현재 5개 설정) | 진행 중인 견적 |
| MATCHED (확정 완료) | 진행 중인 견적 |
| 리뷰 작성 완료 | 마감된 견적 |
| MATCHED 확정 후 30일 경과 (리뷰 미작성 시 자동 마감) | 마감된 견적 |
| CANCELED (삭제 활성) | 마감된 견적 |
| 48시간 만료 (견적 요청 후 48시간 내 미매칭/미결정 시 자동 타임아웃) | 마감된 견적 |

### 고수화면 (match_quotes 상태 → 탭 분류)
| 상태 / 조건 | 올바른 탭 (위치) | 동작 기준 |
|---|---|---|
| 요청서 발생 (내 견적 미발송) | 새로운 요청 | 견적을 발송하는 순간 이 리스트에서 사라짐 |
| 견적 발송 완료 (대기 중) | 보낸 견적 > 진행중 | 발송 즉시 대기 상태로 '진행중' 탭에 들어감 |
| 내가 낙찰됨 (ACCEPTED) | 보낸 견적 > 진행중 | 매칭 성공 시 실제 작업 수행을 위해 '진행중'에 유지됨 |
| 고객의 리뷰 작성 완료 | 보낸 견적 > 보관함 | 고객이 최종 리뷰를 남기면 서비스가 완료된 것으로 간주하여 보관함으로 이동 |
| 낙찰(ACCEPTED) 후 30일 경과 | 보낸 견적 > 보관함 | 리뷰 미작성 건의 무한 적재를 막기 위해 확정 후 30일 경과 시 자동 이동 |
| 다른 고수 낙찰 (나는 탈락) | 보낸 견적 > 보관함 | 다른 고수가 낙찰(MATCHED)되고 나는 탈락(IACCEPTED)한 경우 보관함으로 이동 |
| 고객 무응답 48시간 만료 (추가됨) | 보낸 견적 > 보관함 | 견적 발송 후 고객이 48시간 내에 아무도 낙찰하지 않아 만료된 경우 보관함으로 이동 |
| 고객이 요청서 취소 / 낙찰 후 취소 (CANCELED - 삭제 활성) | 보낸 견적 > 보관함 | 낙찰 전/후 관계없이 요청이 취소된 경우 보관함으로 이동 (고객 정책과 동일하게 삭제 처리) |
| 보관함 이동 후 7일 경과 | 숨김 처리 (화면 노출 안 됨) | 기준 시각(updated_at) 7일 경과 시 DB 쿼리 레벨 필터링 + 프론트엔드 이중 방어로 화면에서 숨김 |

## 6. [i18n 인프라 현황]
- 방식: next-intl, 쿠키 기반 locale (URL 구조 변경 없음)
- 지원 언어: EN / KO
- 설정 파일: `frontend/src/i18n.ts`, `frontend/next.config.js`
- 번역 파일: `frontend/messages/en.json`, `frontend/messages/ko.json`
- 전환 컴포넌트: `frontend/src/components/common/LanguageSwitcher.tsx`
- 완료된 파일: 23개 (i18n 완료 보고서 참조)
- 미완료: `admin/page.tsx`, 모바일 GNB LanguageSwitcher