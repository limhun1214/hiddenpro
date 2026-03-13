const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const { data: usersData } = await supabase.from('users').select('user_id, nickname').eq('nickname', '고수 106이재명');
    const { data: proData } = await supabase.from('pro_profiles').select('pro_id, nickname').eq('nickname', '고수 106이재명');
    console.log("users:", usersData);
    console.log("pro_profiles:", proData);
}
run();
