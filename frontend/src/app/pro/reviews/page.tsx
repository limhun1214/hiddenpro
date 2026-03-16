'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import QuoteDetailModal from '@/components/customer/QuoteDetailModal';
import { useTranslations } from 'next-intl';

function ProReviewCard({ review, customerProfile, onClickViewQuote, t }: { review: any; customerProfile?: { name: string, avatar: string | null }; onClickViewQuote: (review: any) => void; t: any }) {
    const [expanded, setExpanded] = useState(false);
    const comment = review.comment || t('proReviews.noComment');

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex justify-between items-center w-full">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                        {customerProfile?.avatar ? (
                            <img src={customerProfile.avatar} alt="Customer Profile" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                        )}
                    </div>
                    <span className="font-bold text-gray-800 text-sm">{customerProfile?.name || t('proReviews.unknownCustomer')}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={`text-lg ${s <= review.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                ))}
                <span className="text-sm font-bold text-gray-600 ml-1">{Number(review.rating).toFixed(1)}</span>
            </div>
            <div
                onClick={() => setExpanded(!expanded)}
                className={`text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100 cursor-pointer transition-all ${!expanded ? 'line-clamp-2' : ''}`}
                style={!expanded ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}}
            >
                {comment}
            </div>
            {comment.length > 50 && (
                <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-500 font-medium hover:underline">
                    {expanded ? t('proReviews.collapse') : t('proReviews.expand')}
                </button>
            )}

            {review.request && review.quote && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex w-full sm:justify-end">
                    <button
                        onClick={() => onClickViewQuote(review)}
                        className="w-full sm:w-auto justify-center text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                    >
                        <span>📋</span> {t('proReviews.viewQuote')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function ProReviewsPage() {
    const t = useTranslations();
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [customerProfiles, setCustomerProfiles] = useState<Record<string, { name: string, avatar: string | null }>>({});
    const [avgRating, setAvgRating] = useState(0);
    const [reviewCount, setReviewCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [quoteDetailModal, setQuoteDetailModal] = useState<{ quote: any; requestId: string; request?: any } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) { router.replace('/'); return; }

            const proId = authData.user.id;

            // 1. 프로필 평점 정보
            const { data: profile } = await supabase
                .from('pro_profiles')
                .select('average_rating, review_count')
                .eq('pro_id', proId)
                .single();

            if (profile) {
                setAvgRating(Number(profile.average_rating) || 0);
                setReviewCount(profile.review_count || 0);
            }

            // 2. 리뷰 목록 순수 Fetch (안전한 방식)
            const { data: rawReviews, error: reviewError } = await supabase
                .from('reviews')
                .select('review_id, rating, comment, created_at, customer_id, room_id, pro_id')
                .eq('pro_id', proId)
                .eq('is_hidden', false)
                .order('created_at', { ascending: false });

            if (!reviewError && rawReviews) {
                const customerIds = Array.from(new Set(rawReviews.map((r: any) => r.customer_id).filter(Boolean)));
                if (customerIds.length > 0) {
                    const { data: customerData } = await supabase
                        .from('users')
                        .select('user_id, name, nickname, avatar_url')
                        .in('user_id', customerIds);

                    if (customerData) {
                        const cMap: Record<string, { name: string, avatar: string | null }> = {};
                        customerData.forEach(c => {
                            cMap[c.user_id] = {
                                name: (c.nickname && c.nickname.trim() !== '') ? c.nickname : (c.name || t('proReviews.unknownCustomer')),
                                avatar: c.avatar_url || null
                            };
                        });
                        setCustomerProfiles(cMap);
                    }
                }

                let enrichedReviews = rawReviews;

                try {
                    const roomIds = rawReviews.map(r => r.room_id).filter(Boolean);
                    if (roomIds.length > 0) {
                        const { data: chatRooms } = await supabase
                            .from('chat_rooms')
                            .select('room_id, request_id')
                            .in('room_id', roomIds);

                        if (chatRooms && chatRooms.length > 0) {
                            const requestIds = chatRooms.map(r => r.request_id).filter(Boolean);
                            if (requestIds.length > 0) {
                                const { data: requestsData } = await supabase
                                    .from('match_requests')
                                    .select(`
                                        *,
                                        match_quotes (
                                            *,
                                            pro_profiles (
                                                *,
                                                users (name, nickname, avatar_url)
                                            )
                                        )
                                    `)
                                    .in('request_id', requestIds);

                                if (requestsData) {
                                    enrichedReviews = rawReviews.map(review => {
                                        const room = chatRooms.find(r => r.room_id === review.room_id);
                                        if (!room) return review;

                                        const request = requestsData.find(req => req.request_id === room.request_id);
                                        if (!request) return review;

                                        let quote = null;
                                        if (request.match_quotes) {
                                            const quotes = Array.isArray(request.match_quotes) ? request.match_quotes : [request.match_quotes];
                                            quote = quotes.find((q: any) => q.pro_id === review.pro_id);
                                        }

                                        return { ...review, request, quote };
                                    });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn(t('proReviews.fetchWarning'), e);
                }

                setReviews(enrichedReviews);
            } else {
                setReviews([]);
            }
            setLoading(false);
        };
        fetchData();
    }, [router]);

    if (loading) return <div className="p-10 text-center text-gray-500">{t('proReviews.loading')}</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 text-xl font-bold">←</button>
                <h1 className="text-xl font-bold text-gray-800">{t('proReviews.title')}</h1>
            </div>

            {/* 평점 대시보드 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center space-y-3">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">{t('proReviews.avgRating')}</span>
                <div className="flex items-center gap-2">
                    <div className="flex">
                        {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} className={`text-3xl ${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                        ))}
                    </div>
                    <span className="text-3xl font-black text-gray-800">{avgRating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500 font-medium"><strong className="text-blue-600">{reviewCount}</strong> {t('proReviews.totalReviews')}</span>
            </div>

            {/* 리뷰 목록 */}
            {reviews.length === 0 ? (
                <div className="text-center p-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-gray-500 font-medium">{t('proReviews.noReviews')}</p>
                    <p className="text-xs text-gray-400 mt-2">{t('proReviews.noReviewsSub')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">{t('proReviews.reviewList')}</h2>
                    {reviews.map((review: any) => (
                        <ProReviewCard
                            key={review.review_id}
                            review={review}
                            customerProfile={customerProfiles[review.customer_id]} // 추가된 줄
                            onClickViewQuote={(r) => {
                                setQuoteDetailModal({
                                    quote: r.quote,
                                    requestId: r.request?.request_id || '',
                                    request: r.request
                                });
                            }}
                            t={t}
                        />
                    ))}
                </div>
            )}

            {/* 견적 상세 모달 */}
            {quoteDetailModal && (
                <QuoteDetailModal
                    quote={quoteDetailModal.quote}
                    requestId={quoteDetailModal.requestId}
                    request={quoteDetailModal.request}
                    isReadOnly={true}
                    onClose={() => setQuoteDetailModal(null)}
                    onStartChat={() => {
                        setQuoteDetailModal(null);
                        // 고수는 리뷰 모달에서 채팅으로 가는 액션이 덜 중요하지만, 
                        // room_id가 있으므로 원하면 채팅방 이동 가능
                    }}
                />
            )}
        </div>
    );
}
