const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')).split('=')[1].trim();
const supabase = createClient(url, key);

async function test() {
    // 1. Get an open request
    const { data: request } = await supabase.from('match_requests').select('*').eq('status', 'OPEN').order('created_at', { ascending: false }).limit(1).single();
    if (!request) return console.log('No open requests for test');

    // 2. Get two pros
    const { data: pros } = await supabase.from('users').select('*').eq('role', 'PRO').limit(2);
    if (!pros || pros.length < 2) return console.log('Need at least 2 pros');

    const pro1Id = pros[0].id;
    const pro2Id = pros[1].id;
    const reqId = request.request_id;

    console.log('Inserting mock quotes for request:', reqId);

    // Insert quotes
    const quote1Info = { request_id: reqId, pro_id: pro1Id, price: 10000, content: 'Pro 1 quote' };
    const quote2Info = { request_id: reqId, pro_id: pro2Id, price: 20000, content: 'Pro 2 quote' };

    const { data: q1, error: e1 } = await supabase.from('match_quotes').insert(quote1Info).select().single();
    const { data: q2, error: e2 } = await supabase.from('match_quotes').insert(quote2Info).select().single();

    if (e1 && e1.code !== '23505') console.error('q1 error', e1);
    if (e2 && e2.code !== '23505') console.error('q2 error', e2);

    const quotes = await supabase.from('match_quotes').select('*').eq('request_id', reqId);
    if (quotes.data.length < 2) return console.log('Failed to setup 2 quotes');
    const winningQuote = quotes.data[0];
    const losingQuote = quotes.data[1];

    console.log('Simulating handleAcceptQuote execution on quote:', winningQuote.quote_id);

    // Run transaction
    await supabase.from('match_requests').update({ status: 'MATCHED' }).eq('request_id', reqId);
    await supabase.from('match_quotes').update({ status: 'ACCEPTED' }).eq('quote_id', winningQuote.quote_id);
    await supabase.from('match_quotes').update({ status: 'REJECTED' }).eq('request_id', reqId).neq('quote_id', winningQuote.quote_id);

    // Verify
    const { data: verReq } = await supabase.from('match_requests').select('status').eq('request_id', reqId).single();
    const { data: verWin } = await supabase.from('match_quotes').select('status').eq('quote_id', winningQuote.quote_id).single();
    const { data: verLose } = await supabase.from('match_quotes').select('status').eq('quote_id', losingQuote.quote_id).single();

    console.log(`Request status: ${verReq.status}`);
    console.log(`Winning Quote status: ${verWin.status}`);
    console.log(`Losing Quote status: ${verLose.status}`);

    if (verReq.status === 'MATCHED' && verWin.status === 'ACCEPTED' && verLose.status === 'REJECTED') {
        console.log('SUCCESS: Match confirmation transaction is perfect.');
    } else {
        console.log('FAIL: Transaction states incorrect');
    }
}

test();
