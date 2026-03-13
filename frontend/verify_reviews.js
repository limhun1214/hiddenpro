const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_URL')).split('=')[1].trim();
const key = env.split('\n').find(l => l.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY')).split('=')[1].trim();
const supabase = createClient(url, key);

async function testReviewSystem() {
    console.log('--- Starting Review System Verification ---');

    // 1. Get an existing room, pro, and customer
    const { data: room, error: roomErr } = await supabase.from('chat_rooms').select('room_id, pro_id, customer_id').limit(1).single();
    if (roomErr || !room) {
        console.log('No chat room found to test with. Aborting test.', roomErr);
        return;
    }

    const { room_id, pro_id, customer_id } = room;
    console.log(`Testing with Room: ${room_id}, Pro: ${pro_id}, Customer: ${customer_id}`);

    // Clean up any existing review for this room
    await supabase.from('reviews').delete().eq('room_id', room_id);

    // Get initial pro profile
    const { data: initialProfile } = await supabase.from('pro_profiles').select('average_rating, review_count').eq('pro_id', pro_id).single();
    console.log(`Initial Profile -> Rating: ${initialProfile.average_rating}, Count: ${initialProfile.review_count}`);

    // 2. Insert first review
    console.log('Inserting first review (rating: 5)...');
    const { error: insertErr } = await supabase.from('reviews').insert({
        room_id,
        pro_id,
        customer_id,
        rating: 5,
        comment: 'Great service!'
    });
    if (insertErr) console.error('Insert Failed:', insertErr);

    // 3. Verify Trigger updated the pro profile
    const { data: updatedProfile1 } = await supabase.from('pro_profiles').select('average_rating, review_count').eq('pro_id', pro_id).single();
    console.log(`Profile after 1st review -> Rating: ${updatedProfile1.average_rating}, Count: ${updatedProfile1.review_count}`);

    // 4. Test Duplicate constraints
    console.log('Attempting to insert a duplicate review for the same room...');
    const { error: duplicateErr } = await supabase.from('reviews').insert({
        room_id,
        pro_id,
        customer_id,
        rating: 1,
        comment: 'Duplicate attempt'
    });

    if (duplicateErr) {
        console.log(`Duplicate blocked successfully: [${duplicateErr.code}] ${duplicateErr.message}`);
    } else {
        console.log('FAIL: Duplicate review was inserted!');
    }

    // 5. Clean up
    console.log('Cleaning up test review...');
    await supabase.from('reviews').delete().eq('room_id', room_id);

    const { data: finalProfile } = await supabase.from('pro_profiles').select('average_rating, review_count').eq('pro_id', pro_id).single();
    console.log(`Final Profile after cleanup -> Rating: ${finalProfile.average_rating}, Count: ${finalProfile.review_count}`);

    console.log('--- Verification Complete ---');
}

testReviewSystem();
