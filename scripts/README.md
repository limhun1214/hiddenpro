# HiddenPro — 테스트 자동화 스크립트 작성 규칙

> **문서 위치**: `scripts/README.md`
> **적용 대상**: 안티그래비티(실행 에이전트) 및 아키텍츠(설계 에이전트) 모두
> **최종 업데이트**: 2026-03-22
> **목적**: HiddenPro 기능 검증을 위한 테스트 스크립트 표준화 및 자동화 규칙 정의

---

## 1. 스크립트 파일 네이밍 규칙

모든 테스트 스크립트는 아래 포맷을 **엄격히** 준수한다.

```
scripts/test_[기능명].ts
```

**예시**:

- `scripts/test_tab_classification.ts` — 탭 분류 로직 검증
- `scripts/test_send_quote.ts` — 견적 발송 + Credits 차감 검증
- `scripts/test_referral_reward.ts` — 추천 보상 지급 검증
- `scripts/test_refund_logic.ts` — 미낙찰 Credits 환불 검증

**네이밍 금지 패턴**:

- `test.ts` (기능명 없음) ❌
- `test-send-quote.ts` (하이픈 사용) ❌
- `testSendQuote.ts` (camelCase) ❌
- `scripts/feature/test_send_quote.ts` (중첩 디렉터리) ❌

---

## 2. 테스트 플로우 강제 순서

모든 테스트 스크립트는 아래 4단계 순서를 **반드시** 따른다.

```
[STEP 1] 테스트용 데이터 생성 (Setup)
    │
    ▼
[STEP 2] 실제 비즈니스 로직 테스트 실행 (Execute)
    │
    ▼
[STEP 3] 결과 판정 및 콘솔 출력 (Assert)
    │       ✅ PASS / ❌ FAIL
    ▼
[STEP 4] 테스트 데이터 자동 정리 (Cleanup — try/finally 보장)
```

> `try/finally` 구조를 통해 테스트가 실패하더라도 **Cleanup은 반드시 실행**된다.

---

## 3. 스크립트 표준 템플릿

```typescript
// 실행: npx tsx scripts/test_[기능명].ts
// 목적: [이 스크립트가 검증하는 기능 설명]

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────
// 환경 변수 로드 (.env.local 파싱)
// ─────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const content = fs.readFileSync(envPath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    env[key.trim()] = valueParts.join("=").trim();
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]; // RLS 우회

// Service Role 클라이언트 (RLS 우회 — 서버 사이드 전용)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─────────────────────────────────────────────
// 테스트 실행
// ─────────────────────────────────────────────
async function runTest() {
  // ── 테스트 데이터 준비
  let testDataId: string | null = null;

  try {
    // [STEP 1] 테스트용 데이터 생성
    console.log("📦 [STEP 1] 테스트 데이터 생성 중...");
    // TODO: 실제 DB 컬럼 구조 확인 후 INSERT
    // const { data: testRow, error: insertError } = await supabase
    //   .from('테이블명')
    //   .insert({ ... })
    //   .select()
    //   .single();
    // if (insertError) throw insertError;
    // testDataId = testRow.id;
    console.log("✅ [STEP 1] 테스트 데이터 생성 완료");

    // [STEP 2] 실제 비즈니스 로직 실행
    console.log("🔄 [STEP 2] 비즈니스 로직 테스트 실행 중...");
    // TODO: RPC 호출 또는 API 호출
    // const { data: result, error: rpcError } = await supabase
    //   .rpc('rpc_function_name', { param1: value1 });
    // if (rpcError) throw rpcError;
    console.log("✅ [STEP 2] 로직 실행 완료");

    // [STEP 3] 결과 판정
    console.log("🔍 [STEP 3] 결과 판정 중...");
    let passed = true;

    // TODO: 실제 검증 조건 작성
    // if (result.credits !== expectedCredits) {
    //   console.error(`❌ Credits 불일치: 기대값=${expectedCredits}, 실제값=${result.credits}`);
    //   passed = false;
    // }

    if (passed) {
      console.log("✅ 테스트 통과 (PASS)");
    } else {
      console.error("❌ 테스트 실패 (FAIL)");
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ 테스트 중 오류 발생:", err);
    process.exit(1);
  } finally {
    // [STEP 4] 테스트 데이터 자동 정리 (실패 여부와 무관하게 반드시 실행)
    console.log("🧹 [STEP 4] 테스트 데이터 정리 중...");
    if (testDataId) {
      await supabase.from("테이블명").delete().eq("id", testDataId);
    }
    console.log("✅ [STEP 4] 정리 완료");
  }
}

runTest();
```

---

## 4. 환경 변수 로드 규칙

### 4.1 필수 규칙

1. 테스트 스크립트는 반드시 **`.env.local`에서 환경 변수를 파싱**한다.
2. Supabase 클라이언트 초기화 시 **`SUPABASE_SERVICE_ROLE_KEY`를 사용**한다.
   - Service Role Key는 RLS(Row Level Security)를 우회하여 테스트 데이터를 자유롭게 INSERT/DELETE 가능.
   - **프로덕션 코드에 절대 사용 금지** — 테스트 스크립트 전용.
3. `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 스크립트가 즉시 오류를 출력하고 종료한다.

### 4.2 환경 변수 키 목록

| 변수 키                         | 용도                                       |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 일반 클라이언트 키 (RLS 적용)              |
| `SUPABASE_SERVICE_ROLE_KEY`     | **테스트 전용** — RLS 우회 Service Role 키 |

---

## 5. 테스트 데이터 설계 규칙

### 5.1 데이터 생성 전 컬럼 구조 확인 의무

테스트 데이터를 INSERT하기 전, 반드시 대상 테이블의 실제 컬럼 구조를 확인한다.

```typescript
// 컬럼 구조 확인 방법 (스크립트 실행 전 별도 확인)
// Supabase 대시보드 → Table Editor → 대상 테이블
// 또는 docs/supabase_schema.md 참조
```

**위반 케이스 (하지 말 것)**:

- 컬럼 구조를 추정하여 INSERT → 실제 컬럼명 불일치 → 오류 발생

### 5.2 테스트 데이터 격리

- 테스트 데이터는 실제 운영 데이터와 구분 가능하도록 식별자를 포함한다.
  - 예: `display_name: '[TEST] 자동화 테스트 계정'`
  - 예: `email: 'test_automation_@hidpro.test'`
- `try/finally` 블록에서 반드시 정리하여 DB를 클린 상태로 복원한다.

### 5.3 N+1 쿼리 금지

```typescript
// ❌ 금지 — N+1 패턴
for (const userId of userIds) {
  const { data } = await supabase.from("users").select("*").eq("id", userId);
}

// ✅ 올바른 예시 — 단일 쿼리로 처리
const { data } = await supabase.from("users").select("*").in("id", userIds);
```

---

## 6. 스크립트 실행 방법

```bash
# 실행 명령어 (scripts/ 폴더에서 또는 프로젝트 루트에서)
npx tsx scripts/test_[기능명].ts

# 예시
npx tsx scripts/test_tab_classification.ts
npx tsx scripts/test_send_quote.ts
```

**전제 조건**:

- `tsx` 패키지 설치: `npm install -D tsx` (또는 프로젝트에 이미 포함)
- `.env.local` 파일이 프로젝트 루트에 존재해야 함

---

## 7. 기존 스크립트 목록

| 파일명                       | 목적                                            |
| ---------------------------- | ----------------------------------------------- |
| `test_tab_classification.ts` | 견적/요청서 탭 분류 로직 검증                   |
| `backup_db.js`               | DB 백업 유틸 (테스트 스크립트 아님 — 운영 도구) |
| `backup_db_legacy.js`        | DB 백업 레거시 버전 (사용 중지 예정)            |
| `db_backup.js`               | DB 백업 유틸 변형 (운영 도구)                   |

---

## 8. 주의 사항 및 금지 항목

| 금지 항목                                          | 이유                   |
| -------------------------------------------------- | ---------------------- |
| 프로덕션 DB에서 테스트 데이터 정리 없이 종료       | 데이터 오염 위험       |
| `SUPABASE_SERVICE_ROLE_KEY`를 프로덕션 코드에 사용 | 심각한 보안 취약점     |
| 테스트 스크립트에서 N+1 쿼리 패턴 사용             | 성능 측정 왜곡         |
| `try/finally` 없이 데이터 정리 코드 작성           | 테스트 실패 시 DB 오염 |
| 스크립트 상단에 `// 실행: ...` 주석 누락           | 다른 개발자 혼란       |
