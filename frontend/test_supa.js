require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
    const customerId = '00000000-0000-0000-0000-000000000000'; // dummy
    const proRequestIds = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];

    const query = supabase.from('match_requests').select('request_id');
    const queryStr = `customer_id.eq.${customerId},request_id.in.(${proRequestIds.join(',')})`;
    console.log("OR String:", queryStr);

    const { data, error } = await query.or(queryStr);
    console.log("Error:", error);
}
test();
