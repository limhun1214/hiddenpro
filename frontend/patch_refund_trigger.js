const { Client } = require('pg');

async function checkAndFixRealtime() {
    const client = new Client({
        connectionString: 'postgresql://postgres.sjhemxejhyztbsctkqvb:Wkaqls191214@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres'
    });

    try {
        await client.connect();
        console.log('✅ DB 연결 성공');

        // 1. 현재 publication에 포함된 테이블 확인
        const { rows: pubTables } = await client.query(`
      SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    `);
        console.log('\n📋 현재 supabase_realtime publication에 등록된 테이블:');
        pubTables.forEach(r => console.log('  -', r.tablename));

        const hasMatchRequests = pubTables.some(r => r.tablename === 'match_requests');
        console.log('\n🔍 match_requests 포함 여부:', hasMatchRequests ? '✅ YES' : '❌ NO');

        // 2. 누락된 경우 추가
        if (!hasMatchRequests) {
            console.log('\n🔧 match_requests를 supabase_realtime publication에 추가합니다...');
            await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE match_requests`);
            console.log('✅ match_requests 추가 완료!');
        }

        // 3. replica identity 확인
        const { rows: riRows } = await client.query(`
      SELECT relreplident FROM pg_class WHERE relname = 'match_requests'
    `);
        const ri = riRows[0]?.relreplident;
        console.log('\n🔍 match_requests REPLICA IDENTITY:', ri === 'f' ? 'FULL' : ri === 'd' ? 'DEFAULT' : ri);

        if (ri !== 'f') {
            console.log('🔧 REPLICA IDENTITY를 FULL로 변경합니다 (UPDATE 이벤트에 old/new 모두 전송)...');
            await client.query(`ALTER TABLE match_requests REPLICA IDENTITY FULL`);
            console.log('✅ REPLICA IDENTITY FULL 설정 완료!');
        }

        // 4. 최종 확인
        const { rows: finalTables } = await client.query(`
      SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
    `);
        console.log('\n📋 최종 supabase_realtime 테이블 목록:');
        finalTables.forEach(r => console.log('  -', r.tablename));

    } catch (err) {
        console.error('❌ 에러:', err.message);
    } finally {
        await client.end();
    }
}

checkAndFixRealtime();
