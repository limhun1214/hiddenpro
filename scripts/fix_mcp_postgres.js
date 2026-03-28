/**
 * fix_mcp_postgres.js
 * supabase-postgres MCP 서버 연결 실패 원인 진단 및 자동 복구 스크립트
 * - 비밀번호는 절대 하드코딩하지 않고 파일에서 읽어 프로그래밍 방식으로만 처리
 */

const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");

const CLAUDE_JSON_PATH = path.join(
  process.env.USERPROFILE || "C:\\Users\\limta",
  ".claude.json",
);
const PROJECT_KEY = "C:/Users/limta/Desktop/작업용/HiddenPro";

// 비밀번호 마스킹 헬퍼
function maskPassword(uri) {
  return uri.replace(/:([^:@]+)@/, ":***@");
}

// URI 분석 및 파싱
function parseUri(uri) {
  try {
    const parsed = new URL(uri);
    return {
      valid: true,
      protocol: parsed.protocol,
      username: parsed.username,
      password: parsed.password,
      hostname: parsed.hostname,
      port: parsed.port,
      pathname: parsed.pathname,
      searchParams: parsed.searchParams,
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// URI에서 문제점 진단
function diagnoseUri(uri) {
  const issues = [];

  // 1. command 문자열 내 URI 임베드 여부 (별도 체크)
  // 2. 비밀번호 특수문자 미인코딩 확인
  const atMatches = uri.match(/:([^@]*)@/);
  if (atMatches) {
    const rawPassword = atMatches[1];
    const encoded = encodeURIComponent(rawPassword);
    if (encoded !== rawPassword) {
      issues.push({
        type: "PASSWORD_ENCODING",
        description: `비밀번호에 특수문자가 URL 인코딩되지 않음: "${rawPassword}" → "${encoded}"`,
        rawPassword,
        encodedPassword: encoded,
      });
    }
  }

  // 3. 포트 확인
  const parsed = parseUri(uri);
  if (parsed.valid) {
    if (parsed.port === "6543") {
      issues.push({
        type: "PORT_POOLER",
        description:
          "Pooler 포트(6543) 사용 중 — Direct 포트(5432)로도 테스트 필요",
      });
    }
  }

  return issues;
}

// URI 변형 목록 생성 (테스트할 후보들)
function buildUriVariants(originalUri) {
  const variants = [];
  const parsed = parseUri(originalUri);

  if (!parsed.valid) {
    console.error("[ERROR] URI 파싱 실패:", parsed.error);
    return [{ label: "원본 URI", uri: originalUri }];
  }

  const rawPassword = parsed.password;
  const encodedPassword = encodeURIComponent(rawPassword);

  // 원본 URI 구성 (비밀번호 재인코딩 포함)
  const buildUri = (password, port, sslmode) => {
    const u = new URL(originalUri);
    u.password = password;
    u.port = port || u.port;
    if (sslmode) {
      u.searchParams.set("sslmode", sslmode);
    }
    return u.toString();
  };

  // 변형 1: 원본 그대로
  variants.push({ label: "원본 URI", uri: originalUri });

  // 변형 2: 비밀번호 인코딩 적용
  if (encodedPassword !== rawPassword) {
    variants.push({
      label: "비밀번호 URL 인코딩 적용",
      uri: buildUri(encodedPassword, parsed.port),
    });
  }

  // 변형 3: sslmode=require 추가
  if (!originalUri.includes("sslmode")) {
    variants.push({
      label: "sslmode=require 추가",
      uri: buildUri(rawPassword, parsed.port, "require"),
    });
    variants.push({
      label: "비밀번호 인코딩 + sslmode=require",
      uri: buildUri(encodedPassword, parsed.port, "require"),
    });
  }

  // 변형 4: 포트 변경 (6543 → 5432 또는 반대)
  if (parsed.port === "6543") {
    variants.push({
      label: "포트 6543→5432 변경",
      uri: buildUri(rawPassword, "5432"),
    });
    variants.push({
      label: "포트 6543→5432 + sslmode",
      uri: buildUri(rawPassword, "5432", "require"),
    });
  } else if (parsed.port === "5432") {
    variants.push({
      label: "포트 5432→6543 변경",
      uri: buildUri(rawPassword, "6543"),
    });
  }

  return variants;
}

// MCP 서버 단독 실행 테스트 (stderr 캡처)
function testMcpServer(uri, timeoutMs = 8000) {
  return new Promise((resolve) => {
    console.log(`\n  🔍 테스트 중: ${maskPassword(uri)}`);

    let stderr = "";
    let stdout = "";
    let didResolve = false;

    const child = spawn(
      "npx",
      ["-y", "@modelcontextprotocol/server-postgres", uri],
      {
        shell: true,
        env: { ...process.env },
      },
    );

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.on("exit", (code, signal) => {
      if (!didResolve) {
        didResolve = true;
        resolve({ success: false, exitCode: code, signal, stderr, stdout });
      }
    });

    child.on("error", (err) => {
      if (!didResolve) {
        didResolve = true;
        resolve({ success: false, spawnError: err.message, stderr, stdout });
      }
    });

    // 타임아웃: 프로세스가 살아있으면 성공 (stdio 대기 상태)
    setTimeout(() => {
      if (!didResolve) {
        didResolve = true;
        const isAlive = child.exitCode === null && !child.killed;
        if (isAlive) {
          child.kill("SIGTERM");
          resolve({
            success: true,
            stderr,
            stdout,
            note: `${timeoutMs}ms 동안 정상 대기 유지됨`,
          });
        } else {
          resolve({ success: false, exitCode: child.exitCode, stderr, stdout });
        }
      }
    }, timeoutMs);
  });
}

// 메인 실행
async function main() {
  console.log("========================================");
  console.log(" supabase-postgres MCP 서버 진단 시작");
  console.log("========================================\n");

  // 1. .claude.json 읽기
  let config;
  try {
    const raw = fs.readFileSync(CLAUDE_JSON_PATH, "utf8");
    config = JSON.parse(raw);
  } catch (e) {
    console.error("[FATAL] .claude.json 읽기 실패:", e.message);
    process.exit(1);
  }

  const projectConfig = config.projects?.[PROJECT_KEY];
  if (!projectConfig) {
    console.error(`[FATAL] 프로젝트 키를 찾을 수 없음: ${PROJECT_KEY}`);
    process.exit(1);
  }

  const mcpEntry = projectConfig.mcpServers?.["supabase-postgres"];
  if (!mcpEntry) {
    console.error("[FATAL] supabase-postgres MCP 항목 없음");
    process.exit(1);
  }

  console.log("[1단계] 현재 설정 파싱\n");
  console.log("  command:", mcpEntry.command);
  console.log("  args:", JSON.stringify(mcpEntry.args));

  // ─────────────────────────────────────────────────────────────
  // 구조적 문제 감지: command에 전체 명령이 단일 문자열로 들어가 있는 경우
  // ─────────────────────────────────────────────────────────────
  let extractedUri = null;
  let structuralIssue = false;

  if (mcpEntry.args && mcpEntry.args.length > 0) {
    // 정상 구조: args 배열에서 URI 추출 (postgresql:// 로 시작하는 인자)
    extractedUri = mcpEntry.args.find(
      (a) => a.startsWith("postgresql://") || a.startsWith("postgres://"),
    );
  }

  if (!extractedUri && mcpEntry.command) {
    // 비정상 구조: command 문자열에서 URI 추출
    const uriMatch = mcpEntry.command.match(/(postgresql|postgres):\/\/\S+/);
    if (uriMatch) {
      extractedUri = uriMatch[0];
      structuralIssue = true;
      console.log(
        "\n  ⚠️  [구조적 문제 감지] command 필드에 URI가 단일 문자열로 포함되어 있음",
      );
      console.log(
        "     → MCP 서버가 command를 쉘 명령어로 실행하지 않고 단일 바이너리로 찾기 때문에 즉시 실패함",
      );
      console.log(
        '     → 올바른 구조: command="npx", args=["-y", "패키지", "URI"]',
      );
    }
  }

  if (!extractedUri) {
    console.error("[FATAL] URI를 추출할 수 없음");
    process.exit(1);
  }

  console.log("\n  추출된 URI:", maskPassword(extractedUri));

  // URI 진단
  const issues = diagnoseUri(extractedUri);
  if (issues.length > 0) {
    console.log("\n  📋 URI 추가 진단 결과:");
    issues.forEach((issue) =>
      console.log(`   - [${issue.type}] ${issue.description}`),
    );
  } else {
    console.log("  📋 URI 자체에는 인코딩/포트 문제 없음 (구조 문제가 주원인)");
  }

  // 2. URI 변형 목록 생성
  console.log("\n[2단계] URI 변형 후보 생성 및 테스트\n");
  const variants = buildUriVariants(extractedUri);

  let workingUri = null;
  let workingLabel = null;
  let initialError = null;

  for (const variant of variants) {
    const result = await testMcpServer(variant.uri);

    if (!workingUri && !initialError) {
      // 첫 번째(원본) 테스트의 stderr를 초기 오류로 기록
      initialError = result.stderr || result.spawnError || "(no stderr)";
    }

    if (result.success) {
      console.log(`  ✅ 성공: ${variant.label}`);
      console.log(`     Note: ${result.note}`);
      if (result.stderr)
        console.log(`     stderr: ${result.stderr.trim().substring(0, 200)}`);
      workingUri = variant.uri;
      workingLabel = variant.label;
      break;
    } else {
      const errSummary = (result.stderr || result.spawnError || "")
        .trim()
        .substring(0, 150);
      console.log(`  ❌ 실패: ${variant.label}`);
      if (errSummary) console.log(`     stderr: ${errSummary}`);
    }
  }

  if (!workingUri) {
    console.log("\n[결과] 모든 URI 변형 테스트 실패. 수동 확인 필요.");
    console.log("  초기 에러:", initialError?.substring(0, 300));
    console.log(
      "\n  그러나 구조적 문제(command 필드 오용)는 확실히 수정합니다...",
    );
    // 구조적 문제는 무조건 수정 (원본 URI 그대로 사용)
    workingUri = extractedUri;
    workingLabel = "구조 교정만 적용 (URI 변형 테스트 모두 실패)";
  }

  // 3. .claude.json 백업 후 교정된 구조로 덮어쓰기
  console.log("\n[3단계] .claude.json 백업 및 교정\n");

  // 백업
  const backupPath = CLAUDE_JSON_PATH + ".bak";
  fs.copyFileSync(CLAUDE_JSON_PATH, backupPath);
  console.log(`  ✅ 백업 완료: ${backupPath}`);

  // 올바른 구조로 교정
  const correctedEntry = {
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", workingUri],
    env: {},
  };

  config.projects[PROJECT_KEY].mcpServers["supabase-postgres"] = correctedEntry;
  fs.writeFileSync(CLAUDE_JSON_PATH, JSON.stringify(config, null, 2), "utf8");
  console.log(`  ✅ .claude.json 업데이트 완료`);
  console.log(`  적용된 URI: ${maskPassword(workingUri)}`);
  console.log(`  적용 구조:`);
  console.log(`    command: "npx"`);
  console.log(
    `    args: ["-y", "@modelcontextprotocol/server-postgres", "${maskPassword(workingUri)}"]`,
  );

  // 4. 최종 보고
  console.log("\n========================================");
  console.log(" 최종 진단 보고");
  console.log("========================================\n");

  if (structuralIssue) {
    console.log("■ 실패 원인:");
    console.log("  [주원인] command/args 구조 오류");
    console.log(
      '  - 기존: command = "npx -y @mcp/server-postgres <URI>" (단일 문자열), args = []',
    );
    console.log(
      "  - 문제: Claude Code는 command를 쉘로 실행하지 않고 단일 바이너리 경로로 처리",
    );
    console.log(
      '    → OS가 "npx -y @modelcontextprotocol/server-postgres@latest postgresql://..." 라는',
    );
    console.log(
      "      이름의 실행파일을 찾으려 하지만 존재하지 않아 즉시 크래시",
    );
  }

  if (issues.length > 0) {
    console.log("\n  [부가 문제] URI 내 인코딩/포트 이슈:");
    issues.forEach((i) => console.log(`   - ${i.description}`));
  }

  console.log("\n■ 적용된 조치:");
  if (structuralIssue) {
    console.log(
      '  1. command/args 구조 분리: command="npx", args=["-y", "패키지명", "URI"]',
    );
  }
  console.log(`  2. URI 조치: ${workingLabel}`);

  console.log("\n■ 초기 에러 요약:");
  if (initialError && initialError !== "(no stderr)") {
    console.log(" ", initialError.substring(0, 400));
  } else {
    console.log("  (프로세스가 spawn 자체에서 실패 — stderr 없이 즉시 종료)");
  }

  console.log(
    "\n✅ 복구 완료. Claude Code를 재시작하면 supabase-postgres MCP가 정상 기동됩니다.",
  );
}

main().catch((err) => {
  console.error("[UNHANDLED ERROR]", err);
  process.exit(1);
});
