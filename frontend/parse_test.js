const fs = require('fs');
const content = fs.readFileSync('src/app/admin/page.tsx', 'utf-8');
const lines = content.split('\n');

let tagStack = [];
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 심플한 정규식으로 시작 태그와 종료 태그 찾기
    // 주석 제외
    if (line.trim().startsWith('//') || line.trim().startsWith('{/*')) continue;

    // <div...> 찾기
    const openDivs = (line.match(/<div[^>]*>/g) || []).length;
    for (let j = 0; j < openDivs; j++) tagStack.push({ tag: 'div', line: i + 1 });

    // </div> 찾기
    const closeDivs = (line.match(/<\/div>/g) || []).length;
    for (let j = 0; j < closeDivs; j++) {
        if (tagStack.length === 0) {
            console.log(`ERROR: 닫는 </div>가 있는데 열린게 없음. at line ${i + 1}`);
        } else {
            // 가장 최근의 div를 찾아서 pop 한다.
            let foundIdx = -1;
            for (let k = tagStack.length - 1; k >= 0; k--) {
                if (tagStack[k].tag === 'div') {
                    foundIdx = k;
                    break;
                }
            }
            if (foundIdx !== -1) {
                tagStack.splice(foundIdx, 1);
            } else {
                console.log(`ERROR: Mismatch at line ${i + 1}. Expected div but no open div found`);
            }
        }
    }

    // <> 찾기
    const openFrags = (line.match(/<>/g) || []).length;
    for (let j = 0; j < openFrags; j++) tagStack.push({ tag: 'fragment', line: i + 1 });

    // </> 찾기
    const closeFrags = (line.match(/<\/>/g) || []).length;
    for (let j = 0; j < closeFrags; j++) {
        if (tagStack.length === 0) {
            console.log(`ERROR: 닫는 </>가 있는데 열린게 없음. at line ${i + 1}`);
        } else {
            let foundIdx = -1;
            for (let k = tagStack.length - 1; k >= 0; k--) {
                if (tagStack[k].tag === 'fragment') {
                    foundIdx = k;
                    break;
                }
            }
            if (foundIdx !== -1) {
                tagStack.splice(foundIdx, 1);
            } else {
                console.log(`ERROR: Mismatch at line ${i + 1}. Expected fragment but no open fragment found`);
            }
        }
    }
}

console.log("Remaining stack items:");
for (let item of tagStack) {
    if (item.line > 1180) {
        console.log(`Line ${item.line} opened ${item.tag} but never closed`);
    }
}
