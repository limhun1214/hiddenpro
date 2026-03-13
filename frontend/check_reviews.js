const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')).split('=')[1].trim();
const supabase = createClient(url, key);

async function check() {
    const { data, error } = await supabase.from('reviews').select('*').limit(1);
    console.log('reviews table exists:', !error);
    if (!error && data) {
        console.log('Columns sample (if data exists):', data.length > 0 ? Object.keys(data[0]) : 'empty table');
    } else {
        console.log('Error detail:', error);
    }
}

check();
