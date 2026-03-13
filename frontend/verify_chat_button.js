const fs = require('fs');
const content = fs.readFileSync('src/app/quotes/received/page.tsx', 'utf-8');

if (content.includes('<span>💬</span> 채팅방으로 이동')) {
    console.log('SUCCESS: Chat button restored successfully for ACCEPTED quotes in closed tab.');
} else {
    console.log('FAIL: Could not find the chat button string.');
}
