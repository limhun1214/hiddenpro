# ⛔ 절대 접근 금지 구역

아래 폴더들은 에이전트의 **인지 범위 밖**으로 선언된 공간입니다.
읽기(Read), 검색(Grep/Glob), 수정, 이동, 삭제 등 **일체의 접근을 절대 금지**합니다.

- `_개인메모/` — 사용자 개인 전용 공간
- `_backups/` — 과거 백업 저장소 (프로젝트 유물)

에이전트는 오직 **현재의 소스 코드(`frontend/`)와 공식 문서(`docs/`)** 에만 집중한다.

---

# PHASE 1: 설계 우선 원칙

- 보고·메시지는 **한국어** 출력 (코드/변수명 제외)
- `browser_get_dom`, `capture_browser_screenshot`, `browser_scroll`, `wait` **절대 금지**
- 코딩 전 순서: **사전 구축 확인 → 5대 충돌 검수 → 디렉터 승인 대기**
  - 5대 검수: DB 스키마(RLS/FK/ENUM) / 금융 RPC 사이드이펙트 / 인증 우회 / 상태 전환 / N+1·CCU 성능
  - 이상 없을 때만: `❓ 위 계획대로 진행할까요? "OK"를 입력하시면 코딩을 시작합니다.`
- 승인(OK) 직후: `docs/system/SYNC_STATE.md`의 [Current Workflow] **먼저 업데이트** → 그 후 실제 파일 수정 허용

# PHASE 2: 도메인별 문서 참조

- 시스템/인프라 작업 전 → `docs/system_architecture.md` 참조
- DB 작업 전 → `docs/supabase_schema.md` 참조
- 비즈니스/운영 작업 전 → `docs/abuse_prevention.md` 참조
- UI/프론트엔드 작업 전 → `docs/nextjs_frontend.md` 참조
- 테스트/자동화 작업 전 → `scripts/README.md` 참조

# PHASE 3: SSOT 동기화

작업 시작 전 필수 열람:

- `docs/system/SYNC_STATE.md` — 현재 작업 맥락
- `docs/system/LESSONS.md` — 전역 규칙 및 함정/해결책
- `docs/history_archive/HISTORY.md` — 과거 진척도 (필요 시만)

# PHASE 4: 무관용 엔지니어링

- 기존 정상 코드 절대 삭제 금지, **확장(Extension) 방식**으로만 접근
- 에러 디버깅 순서: `1.DB/RLS → 2.백엔드 JOIN → 3.캐시 → 4.프론트엔드`

# PHASE 5: 작업 완료 절차

1. 도메인 설계 변경 시 관련 `docs/*.md` 즉시 업데이트
2. `docs/history_archive/HISTORY.md` 상단에 [날짜/요약/수정파일/DB변경점] 1줄 추가 후, 터미널에서 `npm run archive:history` 실행하여 로그 자동 롤링 아카이빙
3. 함정·해결책 발생 시: `lessons/` 하위 상세 파일 생성 + `docs/system/LESSONS.md`에 링크·요약 추가
4. `docs/system/SYNC_STATE.md`의 [Current Workflow] 비우기
5. `docs/system/DEPLOY_CHECKLIST.md`: 신규 항목 추가만 허용, 완료 시 `- [ ]` → `- [x]`
6. 완료 출력 후 대기: `✅ [작업 요약] 완료. 디렉터님, 확인 후 다음 스텝을 지시해 주십시오.`
   - 큰 기능 완성·방향 전환 시 추가: `⚠️ 큰 기능이 완성되었거나 작업 방향이 전환되는 시점입니다. 기억 공간 최적화(토큰 절약)를 위해 /compact 입력을 통해 컨텍스트를 정리하는 것을 권장합니다.`

# PHASE 6: 테스트 주도권

- AI는 테스트 스크립트를 자율 생성하지 않음. 디렉터가 직접 테스트 수행
- 디렉터가 명시적으로 요청 시에만 `scripts/test_[기능명].ts` 작성 (`.env.local` + `SUPABASE_SERVICE_ROLE_KEY` 활용)

## MCP 도구 활용 원칙

상세 가이드 → `docs/system/mcp_guidelines.md` 참조

- `supabase-postgres`: 읽기 전용(SELECT)으로만 사용 — 스키마 조회·교차 검증 목적. DDL/DML 실행이 필요한 경우 SQL문을 작성하여 디렉터에게 전달하고, 디렉터가 Supabase SQL Editor에서 직접 실행한다.
- `cloudflare`: 도메인·Workers/Pages·D1/KV/R2 인프라 제어 (전면 사용 승인됨)
- `git`: 브랜치 상태, 커밋 이력, Diff 확인 및 푸시
- `memory`: 핵심 아키텍처·비즈니스 규칙 등 세션 초월 컨텍스트 기록·조회
- `stitch`: UI 컴포넌트·디자인 시스템 기반 화면 생성

## MCP 활성화 정책

| 작업 도메인      | 활성 MCP               | 비활성 MCP                                    |
| ---------------- | ---------------------- | --------------------------------------------- |
| DB/백엔드 작업   | supabase-postgres, git | cloudflare, stitch, memory                    |
| UI/프론트 작업   | stitch, git            | supabase-postgres, cloudflare, memory         |
| 배포/인프라 작업 | cloudflare, git        | supabase-postgres, stitch, memory             |
| 일반 코딩        | git                    | cloudflare, supabase-postgres, stitch, memory |

> 동시에 활성화하는 MCP는 최대 2~3개로 제한한다. memory MCP는 ECC 세션 훅이 대체하므로 기본 비활성화한다.

## Token Economy Rules

1. MCP는 현재 작업 도메인에 필요한 것만 활성화한다 (최대 3개).
2. /compact는 마일스톤 완료, 디버깅 완료, 방향 전환 시 즉시 실행한다.
3. 구현 중간에는 /compact 하지 않는다.
4. 복잡한 아키텍처 결정 시에만 /model opus로 전환하고, 완료 후 즉시 /model sonnet으로 복귀한다.
5. 파일 탐색 시 grep/glob으로 먼저 범위를 좁힌 뒤 파일을 읽는다. 전체 파일을 무조건 읽지 않는다.
6. 대규모 수정 시 subagent(Task 도구)를 사용한다. Agent Teams는 병렬 작업이 명확할 때만 사용한다.
