import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function injectMockNotification() {
    // 하드코딩된 테스트 고객 ID (또는 현재 테스트중인 고수 ID: 00000000-0000-0000-0000-000000000002)
    const testUserId = '00000000-0000-0000-0000-000000000002'; // Pro ID for testing

    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: testUserId,
            type: 'SYSTEM',
            message: '테스트 알림 데이터가 연동되었습니다.',
            is_read: false
        })
        .select();

    if (error) {
        console.error("Insert error:", error);
    } else {
        console.log("Mock notification inserted!", data);
    }
}

injectMockNotification();
