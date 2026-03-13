require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedReviews() {
    try {
        console.log('Fetching customers...');
        const { data: customers } = await supabase.from('users').select('user_id').eq('role', 'CUSTOMER').limit(3);

        console.log('Fetching pros...');
        const { data: pros } = await supabase.from('users').select('user_id').eq('role', 'PRO').limit(3);

        if (!customers || customers.length === 0 || !pros || pros.length === 0) {
            console.log('Not enough users to create reviews.');
            return;
        }

        const dummyReviews = [
            {
                service: "에어컨 청소",
                comment: "처음 이용해보는데 고수님이 너무 친절하게 설명해주시고 작업도 정말 깔끔하게 마무리해주셨습니다. 다음에도 무조건 이분께 맡기고 싶어요! 강력 추천합니다.",
                rating: 5
            },
            {
                service: "포장이사",
                comment: "이사가 한두 푼 드는게 아니라 걱정 많았는데 합리적인 가격에 파손 하나 없이 완벽하게 이사했습니다. 아침 일찍부터 고생 많으셨습니다.",
                rating: 5
            },
            {
                service: "인테리어 시공",
                comment: "제가 원하는 스타일을 정확히 캐치하셔서 결과물이 너무 만족스럽습니다. 마감 처리도 꼼꼼하고 커뮤니케이션도 원활해서 진행 내내 안심이 되었습니다.",
                rating: 4
            }
        ];

        for (let i = 0; i < dummyReviews.length; i++) {
            const customer = customers[i % customers.length];
            const pro = pros[i % pros.length];
            const reviewData = dummyReviews[i];

            // Create a dummy match request for the review
            const { data: request, error: reqError } = await supabase.from('match_requests').insert({
                customer_id: customer.user_id,
                category_id: 1, // dummy category
                region_id: 1, // dummy region
                service_type: reviewData.service,
                region: 'Metro Manila',
                status: 'CLOSED',
                dynamic_answers: {}
            }).select('request_id').single();

            if (reqError) {
                console.error('Error creating request:', reqError);
                continue;
            }

            // Create a dummy chat room
            const { data: room, error: roomError } = await supabase.from('chat_rooms').insert({
                request_id: request.request_id,
                customer_id: customer.user_id,
                pro_id: pro.user_id,
                status: 'MATCHED'
            }).select('room_id').single();

            if (roomError) {
                console.error('Error creating chat room:', roomError);
                continue;
            }

            // Create the review
            const { error: revError } = await supabase.from('reviews').insert({
                room_id: room.room_id,
                customer_id: customer.user_id,
                pro_id: pro.user_id,
                rating: reviewData.rating,
                comment: reviewData.comment
            });

            if (revError) {
                console.error('Error creating review:', revError);
            } else {
                console.log(`Review created for service: ${reviewData.service}`);
            }
        }
        console.log('Seeding completed successfully.');
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

seedReviews();
