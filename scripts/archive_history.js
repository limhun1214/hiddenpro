#!/usr/bin/env node
/**
 * archive_history.js
 * HISTORY.md 롤링 아카이브 스크립트
 *
 * 동작 원리:
 * 1. HISTORY.md에서 [System Core Prerequisite...] 이하 고정 섹션을 분리
 * 2. 로그 라인 중 현재일 기준 3일 초과 OR 최신 도메인과 무관한 것을 아카이브
 * 3. docs/history_archive/YYYY-MM_history.md 로 연월별 append 이동
 * 4. HISTORY.md는 최근 로그 + 고정 섹션만 유지
 */

const fs = require("fs");
const path = require("path");

// ── 경로 설정 ──────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const HISTORY_PATH = path.join(ROOT, "docs", "history_archive", "HISTORY.md");
const ARCHIVE_DIR = path.join(ROOT, "docs", "history_archive");

// ── 날짜 파싱 ──────────────────────────────────────────────────────────────
const DATE_PATTERN = /\[(\d{4}-\d{2}-\d{2})/;

function parseDate(line) {
  const match = line.match(DATE_PATTERN);
  if (!match) return null;
  return new Date(match[1] + "T00:00:00Z");
}

function getYearMonth(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ── 보존 기준 ──────────────────────────────────────────────────────────────
// "현재 날짜" = task.md의 컨텍스트 기준 2026-03-27 (시스템 날짜 우선)
const TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const THREE_DAYS_AGO = new Date(TODAY);
THREE_DAYS_AGO.setUTCDate(THREE_DAYS_AGO.getUTCDate() - 3);

console.log(`📅 기준일: ${TODAY.toISOString().slice(0, 10)}`);
console.log(`📅 보존 기준: ${THREE_DAYS_AGO.toISOString().slice(0, 10)} 이후`);

// ── HISTORY.md 읽기 ────────────────────────────────────────────────────────
if (!fs.existsSync(HISTORY_PATH)) {
  console.error("❌ HISTORY.md 파일을 찾을 수 없습니다.");
  process.exit(1);
}

const raw = fs.readFileSync(HISTORY_PATH, "utf-8");
const allLines = raw.split("\n");

// ── 고정 섹션 분리 ─────────────────────────────────────────────────────────
const FIXED_MARKER = "[System Core Prerequisite";
let fixedSectionStart = -1;
for (let i = 0; i < allLines.length; i++) {
  if (allLines[i].includes(FIXED_MARKER)) {
    fixedSectionStart = i;
    break;
  }
}

const logLines =
  fixedSectionStart >= 0 ? allLines.slice(0, fixedSectionStart) : allLines;
const fixedLines =
  fixedSectionStart >= 0 ? allLines.slice(fixedSectionStart) : [];

// ── 최신 로그 도메인 추출 (첫 번째 날짜 있는 줄의 날짜) ───────────────────
let latestDate = null;
for (const line of logLines) {
  const d = parseDate(line);
  if (d) {
    latestDate = d;
    break;
  }
}

// ── 로그 분류 ──────────────────────────────────────────────────────────────
const keepLines = [];
const archiveMap = {}; // { "YYYY-MM": [lines] }

for (const line of logLines) {
  // 빈 줄은 keep 유지 (로그 사이 구분용)
  if (line.trim() === "") {
    keepLines.push(line);
    continue;
  }

  const lineDate = parseDate(line);

  if (!lineDate) {
    // 날짜 없는 라인 (헤더, 공백 등)은 유지
    keepLines.push(line);
    continue;
  }

  // 보존 조건: 3일 이내 OR 최신 날짜와 동일한 날짜
  const isRecent = lineDate >= THREE_DAYS_AGO;
  const isSameLatestDay =
    latestDate &&
    lineDate.toISOString().slice(0, 10) ===
      latestDate.toISOString().slice(0, 10);

  if (isRecent || isSameLatestDay) {
    keepLines.push(line);
  } else {
    // 아카이브 대상
    const ym = getYearMonth(lineDate);
    if (!archiveMap[ym]) archiveMap[ym] = [];
    archiveMap[ym].push(line);
  }
}

// ── 연속 빈줄 정리 (3개 이상 → 1개로) ──────────────────────────────────────
function deduplicateBlankLines(lines) {
  const result = [];
  let blankCount = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blankCount++;
      if (blankCount <= 1) result.push(line);
    } else {
      blankCount = 0;
      result.push(line);
    }
  }
  return result;
}

const cleanedKeepLines = deduplicateBlankLines(keepLines);

// ── 아카이브 파일 작성 ─────────────────────────────────────────────────────
if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  console.log(`📁 디렉토리 생성: docs/history_archive/`);
}

let totalArchived = 0;
for (const [ym, lines] of Object.entries(archiveMap)) {
  const archivePath = path.join(ARCHIVE_DIR, `${ym}_history.md`);
  const content = lines.join("\n") + "\n";

  if (fs.existsSync(archivePath)) {
    // 기존 파일에 append
    fs.appendFileSync(archivePath, "\n" + content, "utf-8");
    console.log(
      `📝 아카이브 append: docs/history_archive/${ym}_history.md (+${lines.length}줄)`,
    );
  } else {
    // 신규 파일 생성
    const header = `# HiddenPro - History Archive (${ym})\n\n`;
    fs.writeFileSync(archivePath, header + content, "utf-8");
    console.log(
      `📝 아카이브 생성: docs/history_archive/${ym}_history.md (${lines.length}줄)`,
    );
  }
  totalArchived += lines.length;
}

// ── HISTORY.md 재작성 ──────────────────────────────────────────────────────
const newContent =
  cleanedKeepLines.join("\n") +
  (fixedLines.length > 0 ? "\n" + fixedLines.join("\n") : "");

fs.writeFileSync(HISTORY_PATH, newContent, "utf-8");

// ── 결과 출력 ──────────────────────────────────────────────────────────────
console.log("\n✅ 아카이브 완료!");
console.log(
  `   보존된 로그: ${cleanedKeepLines.filter((l) => parseDate(l)).length}줄`,
);
console.log(`   아카이브된 로그: ${totalArchived}줄`);
console.log(`   고정 섹션: ${fixedLines.length}줄 유지`);
