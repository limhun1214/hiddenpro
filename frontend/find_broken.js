const fs = require('fs');
const content = fs.readFileSync('src/app/admin/page.tsx', 'utf8').split('\n');

for (let i = 0; i < content.length; i++) {
  const line = content[i];
  if (line.includes('await showAlert(') || line.includes('await showConfirm(')) {
    // Check if it has a weird semicolon or unclosed quote
    if (line.includes(');:') || line.includes(');}')) {
      console.log(`[BROKEN] Line ${i + 1}: ${line.trim()}`);
    } else if ((line.match(/'/g) || []).length % 2 !== 0) {
      console.log(`[QUOTE ODD] Line ${i + 1}: ${line.trim()}`);
    } else if ((line.match(/`/g) || []).length % 2 !== 0) {
      console.log(`[TICK ODD] Line ${i + 1}: ${line.trim()}`);
    }
  }
}
