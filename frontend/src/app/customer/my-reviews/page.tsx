'use client';
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import QuoteDetailModal from '@/components/customer/QuoteDetailModal';
import { useTranslations } from 'next-intl';

function ReviewCard({ review, proName, proAvatar, onClickViewQuote, t }: { review: any; proName: string; proAvatar: string | null; onClickViewQuote: (review: any) => void; t: any }) {
    const [expanded, setExpanded] = useState(false);
    const comment = review.comment || t('myReviews.noComment');

    return (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                        {proAvatar ? (
                            <img src={proAvatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                        )}
                    </div>
                    <span className="font-bold text-gray-800">{proName}{t('myReviews.reviewFor')}</span>
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
                    {expanded ? t('myReviews.collapse') : t('myReviews.expand')}
                </button>
            )}

            {review.request && review.quote && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex w-full sm:justify-end">
                    <button
                        onClick={() => onClickViewQuote(review)}
                        className="w-full sm:w-auto justify-center text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                    >
                        <span>📋</span> {t('myReviews.viewQuote')}
                    </button>
                </div>
            )}
        </div>
    );
}

export default function CustomerMyReviewsPage() {
    const t = useTranslations();
    const router = useRouter();
    const [reviews, setReviews] = useState<any[]>([]);
    const [proNames, setProNames] = useState<Record<string, string>>({});
    const [proAvatars, setProAvatars] = useState<Record<string, string | null>>({});
    const [loading, setLoading] = useState(true);
    const [quoteDetailModal, setQuoteDetailModal] = useState<{ quote: any; requestId: string; request?: any } | null>(null);

    useEffect(() => {
        const fetchReviews = async () => {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) { router.replace('/'); return; }

            // 1단계: 리뷰 데이터 순수 Fetch (안전한 방식)
            const { data: rawReviews, error: reviewError } = await supabase
                .from('reviews')
                .select('review_id, rating, comment, created_at, pro_id, room_id, customer_id')
                .eq('customer_id', authData.user.id)
                .eq('is_hidden', false)
                .order('created_at', { ascending: false });

            if (!reviewError && rawReviews) {
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
                    console.warn(t('myReviews.fetchWarning'), e);
                }

                setReviews(enrichedReviews);

                // 2단계: 고수 이름 별도 조회
                const proIds = Array.from(new Set(rawReviews.map((r: any) => r.pro_id)));
                const nameMap: Record<string, string> = {};
                const avatarMap: Record<string, string | null> = {};
                for (const pid of proIds) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('name, nickname, avatar_url')
                        .eq('user_id', pid)
                        .single();
                    nameMap[pid] = userData?.nickname || userData?.name || t('myReviews.unknownPro');
                    avatarMap[pid] = userData?.avatar_url || null;
                }
                setProNames(nameMap);
                setProAvatars(avatarMap);
            } else {
                setReviews([]);
            }
            setLoading(false);
        };
        fetchReviews();
    }, [router]);

    if (loading) return <div className="p-10 text-center text-gray-500">{t('myReviews.loading')}</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
            <div className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 text-xl font-bold">←</button>
                <h1 className="text-xl font-bold text-gray-800">{t('myReviews.title')}</h1>
            </div>

            {reviews.length === 0 ? (
                <div className="text-center p-16 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="text-4xl mb-4">📝</div>
                    <p className="text-gray-500 font-medium">{t('myReviews.noReviews')}</p>
                    <p className="text-xs text-gray-400 mt-2">{t('myReviews.noReviewsSub')}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reviews.map((review: any) => (
                        <ReviewCard
                            key={review.review_id}
                            review={review}
                            proName={proNames[review.pro_id] || t('myReviews.unknownPro')}
                            proAvatar={proAvatars[review.pro_id] || null} // 추가된 줄
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
                        // 이미 리뷰 페이지이므로, 해당 채팅방으로 이동 로직 (선택적)
                        // 방 ID(room_id)가 리뷰 객체에 있으므로 라우팅 가능
                        // 필요한 경우 이 모달의 콜백을 활용하여 라우팅 추가 가능
                    }}
                />
            )}
        </div>
    );
}
