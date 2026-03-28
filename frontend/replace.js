const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/app/admin/page.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Instead of simple return alert, let's substitute carefully.
// return alert(...) -> { await showAlert(...); return; }
content = content.replace(
  /\breturn alert\((.*?)\);/g,
  "{ await showAlert($1); return; }",
);

// simple alert -> await showAlert
content = content.replace(/\balert\((.*?)\)/g, "await showAlert($1)");

// return await showAlert(...) -> { await showAlert(...); return; } if it produced "await await" somehow, but we only replaced "alert"
// Actually, if we replaced `return alert(...)` with `{ await showAlert(...); return; }`,
// wait, `alert` might have been replaced by the second rule if it doesn't have a semicolon.

// Let's refine the order:
// First, redo from original because it might be safer.
content = fs.readFileSync(filePath, "utf8");

// 1. window.alert
content = content.replace(/\bwindow\.alert\(/g, "alert(");

// 2. return alert
// if (err) return alert(...);
// we replace "return alert(XYZ);" with "{ await showAlert(XYZ); return; }"
content = content.replace(
  /\breturn alert\(([^)]*(\([^)]*\)[^)]*)*)\);?/g,
  "{ await showAlert($1); return; }",
);

// 3. remaining alert
content = content.replace(
  /\balert\(([^)]*(\([^)]*\)[^)]*)*)\);?/g,
  "await showAlert($1);",
);

// 4. window.confirm -> showConfirm
// if (!window.confirm(...)) return;
content = content.replace(
  /if \(\!window\.confirm\(([^)]*(\([^)]*\)[^)]*)*)\)\) return;/g,
  "if (!await showConfirm($1)) return;",
);

content = content.replace(
  /\bwindow\.confirm\(([^)]*(\([^)]*\)[^)]*)*)\)/g,
  "await showConfirm($1)",
);

// 5. window.prompt -> showPrompt
content = content.replace(
  /\bwindow\.prompt\(([^)]*(\([^)]*\)[^)]*)*)\)/g,
  "await showPrompt($1)",
);

// 6. Manual overrides (destructive flags & titles)
content = content.replace(
  /await showConfirm\('이 리뷰를 영구 삭제하겠습니까\? 이 작업은 되돌릴 수 없습니다\.'\)/g,
  "showConfirm('이 리뷰를 영구 삭제하겠습니까? 이 작업은 되돌릴 수 없습니다.', { destructive: true })",
);
content = content.replace(
  /await showConfirm\('⚠️ 이 사용자를 삭제 처리하시겠습니까\?\\n\(소프트 삭제: 데이터는 보존되며, status가 DELETED로 변경됩니다\)'\)/g,
  "showConfirm('⚠️ 이 사용자를 삭제 처리하시겠습니까?\\n(소프트 삭제: 데이터는 보존되며, status가 DELETED로 변경됩니다)', { destructive: true })",
);
content = content.replace(
  /await showConfirm\("정말로 이 매칭을 강제 취소하시겠습니까\?\\n이 작업은 'CANCELED_BY_ADMIN' 상태로 기록되며 복구할 수 없습니다\."\)/g,
  "showConfirm(\"정말로 이 매칭을 강제 취소하시겠습니까?\\n이 작업은 'CANCELED_BY_ADMIN' 상태로 기록되며 복구할 수 없습니다.\", { destructive: true })",
);

// Success titles
content = content.replace(
  /await showAlert\(`계정이 \$\{nextStatus === 'SUSPENDED' \? '정지' : '활성화'\} 되었습니다\.`\);/g,
  "await showAlert(`계정이 ${nextStatus === 'SUSPENDED' ? '정지' : '활성화'} 되었습니다.`, '처리 완료');",
);

// Payout Confirm Custom Title
content = content.replace(
  /await showConfirm\(\s*`예금주 \[\$\{payoutItem\.account_holder\}\] 명의가 가입자 명의와 일치하는지 확인하셨습니까\?\\n\\n확인 후 승인 버튼을 눌러주세요\.`\s*\)/g,
  "showConfirm(`예금주 [${payoutItem.account_holder}] 명의가 가입자 명의와 일치하는지 확인하셨습니까?\\n\\n확인 후 승인 버튼을 눌러주세요.`, { title: '명의 확인', confirmLabel: '승인 진행' })",
);

// Provide 'async' to inline handlers
// E.g. onClick={() => { ... await ... }}
content = content.replace(
  /onClick=\{\(\) => (\{[^}]*(?:await show)[^}]*\})\}/g,
  "onClick={async () => $1}",
);
// E.g. onClick={() => await ... }
content = content.replace(
  /onClick=\{\(\) => (await show.*?)\}/g,
  "onClick={async () => $1}",
);

fs.writeFileSync(filePath, content, "utf8");
console.log("Replacement complete.");
