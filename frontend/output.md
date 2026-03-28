요청하신 CustomerQuotesClient.tsx와 ProBiddingDetail.tsx 원본 코드입니다.

### 1. CustomerQuotesClient.tsx

` sx
'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import BadgeCleaner from '@/components/BadgeCleaner';
import ProProfileDetailModal from '@/components/customer/ProProfileDetailModal';
import QuoteDetailModal from '@/components/customer/QuoteDetailModal';

export default function CustomerQuotesClient() {
const router = useRouter();
const searchParams = useSearchParams();
const [requests, setRequests] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [errorMsg, setErrorMsg] = useState<string | null>(null);
const [activeTab, setActiveTab] = useState<'IN_PROGRESS' | 'CLOSED'>(searchParams?.get('tab') === 'CLOSED' ? 'CLOSED' : 'IN_PROGRESS');
const [currentTime, setCurrentTime] = useState(Date.now());
const [refreshTrigger, setRefreshTrigger] = useState(0);
const [reviewedRoomIds, setReviewedRoomIds] = useState<Set<string>>(new Set());
const [quoteRoomMap, setQuoteRoomMap] = useState<Record<string, string>>({});

    // 고수 프로필 상세 모달 상태
    const [profileModal, setProfileModal] = useState<{ proId: string; requestId: string } | null>(null);

    // 견적 상세 모달 상태
    const [quoteDetailModal, setQuoteDetailModal] = useState<{ quote: any; requestId: string; request?: any } | null>(null);

    // 리뷰 모달 상태
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [reviewTarget, setReviewTarget] = useState<any>(null);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(Date.now());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchRequests = async () => {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (authError || !sessionUser) {
                router.replace('/');
                return;
            }

            const customerId = sessionUser.id;

            const { data: customerRequests, error } = await supabase
                .from('match_requests')
                .select(`
                    request_id, status, dynamic_answers, customer_id, quote_count, created_at,
                    match_quotes (
                        quote_id, pro_id, created_at, status, price, description, image_url,
                        pro_profiles (pro_id, average_rating, review_count, is_phone_verified, facebook_url, intro, detailed_intro, users (name))
                    )
                `)
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("요청서 패칭 에러:", error);
                setErrorMsg(error.message);
            } else if (customerRequests) {
                setRequests(customerRequests);
            }

            // 채팅방 매핑 조회: (request_id + pro_id) → room_id
            const { data: rooms } = await supabase
                .from('chat_rooms')
                .select('room_id, request_id, pro_id')
                .eq('customer_id', customerId);
            const roomMap: Record<string, string> = {};
            if (rooms) {
                rooms.forEach(r => { roomMap[`${r.request_id}|${r.pro_id}`] = r.room_id; });
                setQuoteRoomMap(roomMap);
            }

            // 이미 작성한 리뷰의 room_id 목록 조회 (개별 매칭 건 기준)
            const { data: myReviews } = await supabase
                .from('reviews')
                .select('room_id')
                .eq('customer_id', customerId);
            if (myReviews) {
                setReviewedRoomIds(new Set(myReviews.map(r => r.room_id)));
            }

            setLoading(false);
        };

        fetchRequests();
    }, [refreshTrigger]);

    useEffect(() => {
        const channel = supabase.channel('match_quotes_changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'match_quotes' },
                (payload) => {
                    console.log('새로운 견적이 도착했습니다!', payload);
                    setRefreshTrigger(prev => prev + 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleStartChat = async (quote: any) => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            const sessionUser = authData?.user;
            const currentCustomerId = sessionUser?.id;

            if (!currentCustomerId) throw new Error("고객 ID를 찾을 수 없습니다.");

            const { data: existingRoom, error: fetchError } = await supabase
                .from('chat_rooms')
                .select('room_id')
                .eq('request_id', quote.request_id)
                .eq('customer_id', currentCustomerId)
                .eq('pro_id', quote.pro_id)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (existingRoom) {
                router.push(`/chat/${existingRoom.room_id}`);
                return;
            }

            const { data: room, error: roomError } = await supabase
                .from('chat_rooms')
                .insert({
                    request_id: quote.request_id,
                    customer_id: currentCustomerId,
                    pro_id: quote.pro_id,
                    status: 'OPEN'
                })
                .select('room_id')
                .single();

            if (roomError) throw roomError;

            router.push(`/chat/${room.room_id}`);
        } catch (error: any) {
            console.error("채팅방 입장 에러:", error);
            alert("채팅 연결 중 오류가 발생했습니다: " + error.message);
        }
    };

    const openReviewModal = async (quote: any, request_id: string) => {
        const { data: room } = await supabase.from('chat_rooms').select('room_id').eq('request_id', request_id).eq('pro_id', quote.pro_id).single();
        if (!room) return alert("채팅방 정보를 찾을 수 없거나 아직 개설되지 않았습니다.");

        setReviewTarget({ request_id, pro_id: quote.pro_id, room_id: room.room_id });
        setReviewRating(5);
        setReviewComment('');
        setIsReviewModalOpen(true);
    };

    const handleReviewSubmit = async () => {
        if (!reviewTarget) return;
        if (!reviewComment.trim()) return alert("리뷰 내용을 입력해주세요.");

        const { data: authData } = await supabase.auth.getUser();

        const { error } = await supabase.from('reviews').insert({
            room_id: reviewTarget.room_id,
            pro_id: reviewTarget.pro_id,
            customer_id: authData?.user?.id,
            rating: reviewRating,
            comment: reviewComment
        });

        if (error) {
            if (error.code === '23505') {
                alert("이미 작성한 리뷰가 있습니다.");
            } else {
                alert("리뷰 등록 실패: " + error.message);
            }
        } else {
            alert("리뷰가 성공적으로 등록되었습니다.");
            setIsReviewModalOpen(false);
            setReviewedRoomIds(prev => new Set(prev).add(reviewTarget.room_id));
            setRefreshTrigger(prev => prev + 1);
        }
    };

    if (loading) return <div className="p-4 text-center mt-20 text-gray-500">요청 내역을 불러오는 중입니다...</div>;

    const categorizeRequest = (req: any) => {
        const isMatched = req?.status === 'MATCHED';
        const isFull = (req?.quote_count || 0) >= 5;
        const isExpired = req?.created_at ? new Date(req.created_at).getTime() + (48 * 60 * 60 * 1000) <= currentTime : false;

        return isMatched || isFull || isExpired ? 'CLOSED' : 'IN_PROGRESS';
    };

    const displayRequests = requests.filter(r => categorizeRequest(r) === activeTab);

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
            <BadgeCleaner type="quotes-read" />
            <h1 className="text-2xl font-bold bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between sticky top-0 z-10">
                요청 및 받은 견적함
            </h1>

            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                <button
                    onClick={() => setActiveTab('IN_PROGRESS')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'IN_PROGRESS' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    진행 중인 견적
                </button>
                <button
                    onClick={() => setActiveTab('CLOSED')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'CLOSED' ? 'bg-gray-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    마감된 견적
                </button>
            </div>

            {errorMsg && (
                <div className="text-red-500 font-bold mb-4 bg-red-50 p-4 rounded-xl border border-red-200">
                    데이터 조회 오류: {errorMsg}
                </div>
            )}

            {!errorMsg && displayRequests.length === 0 ? (
                <div className="text-center p-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
                    <p>{activeTab === 'IN_PROGRESS' ? '진행 중인 요청서가 없습니다.' : '마감된 요청서가 없습니다.'}</p>
                </div>
            ) : (
                displayRequests.map((request) => {
                    const isMatched = request?.status === 'MATCHED';
                    const isFull = (request?.quote_count || 0) >= 5;

                    const expirationTime = request?.created_at ? new Date(request.created_at).getTime() + (48 * 60 * 60 * 1000) : 0;
                    const timeRemainingMs = expirationTime - currentTime;
                    const isExpired = timeRemainingMs <= 0;

                    const hoursRemaining = Math.max(0, Math.floor(timeRemainingMs / (1000 * 60 * 60)));
                    const minutesRemaining = Math.max(0, Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60)));
                    const isHurry = hoursRemaining < 24 && !isExpired;

                    let statusLabel = '견적 모집 중';
                    let statusColor = 'bg-blue-50 text-blue-600';
                    if (isMatched) { statusLabel = '매칭 성사'; statusColor = 'bg-green-100 text-green-700'; }
                    else if (isFull || isExpired) { statusLabel = '마감됨'; statusColor = 'bg-gray-100 text-gray-500'; }

                    const reqQuotes = Array.isArray(request.match_quotes) ? request.match_quotes : [];

                    return (
                        <div key={request.request_id} className={`bg-white p-5 rounded-2xl shadow-sm border mt-4 ${activeTab === 'CLOSED' ? 'border-gray-200' : 'border-blue-100'}`}>
                            <div className="flex justify-between items-start mb-3 border-b pb-3 border-gray-100">
                                <div>
                                    <h2 className="text-sm font-bold text-gray-800">요청일: {new Date(request.created_at).toLocaleDateString()}</h2>
                                    <div className="mt-2 flex flex-col">
                                        <span className="text-xs font-bold text-gray-700">요청 내용:</span>
                                        <div
                                            className="text-xs text-gray-500 mt-1 break-all whitespace-normal line-clamp-2 overflow-hidden text-ellipsis"
                                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                                        >
                                            {request?.dynamic_answers?.q_001 || request?.dynamic_answers?.details || '자세한 내용 없음'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className={`${statusColor} font-bold px-2 py-1 rounded text-xs whitespace-nowrap`}>{statusLabel}</span>
                                    {activeTab === 'IN_PROGRESS' && (
                                        <div className={`text-xs mt-2 font-bold ${isHurry ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                                            ⏳ 마감까지 {hoursRemaining}시간 {minutesRemaining}분 남음
                                        </div>
                                    )}
                                </div>
                            </div>

                            {activeTab === 'IN_PROGRESS' && (
                                <div className="mb-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center justify-between">
                                    <span className="text-sm text-blue-800 font-medium">
                                        🚀 현재 <strong className="text-blue-600 text-base">{request.quote_count || 0} / 5</strong>명 견적 접수
                                    </span>
                                    {(request.quote_count || 0) === 0 && (
                                        <span className="text-xs text-blue-500 animate-pulse">고수들의 응답을 기다리는 중...</span>
                                    )}
                                </div>
                            )}

                            {reqQuotes.length > 0 ? (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">도착한 견적 ({reqQuotes.length}건)</h3>
                                    {reqQuotes.map((quote: any) => {
                                        const profilesArray = Array.isArray(quote.pro_profiles) ? quote.pro_profiles : [quote.pro_profiles];
                                        const proUser = profilesArray.find((p: any) => p?.user_id === quote.pro_id || p?.pro_id === quote.pro_id) || profilesArray[0];
                                        const proName = proUser?.users?.name || '전문가';
                                        const avgRating = proUser?.average_rating || 0.0;
                                        const reviewCount = proUser?.review_count || 0;

                                        return (
                                            <div key={quote.quote_id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col space-y-3">
                                                {/* 상단 터치 존: 전체 클릭 시 프로필 모달 오픈 */}
                                                <div
                                                    onClick={() => setProfileModal({ proId: quote.pro_id, requestId: request.request_id })}
                                                    className="cursor-pointer hover:bg-gray-100 -m-1 p-2 rounded-lg transition active:bg-gray-200 space-y-1.5"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center flex-wrap gap-1.5">
                                                            {/* 고수 아바타 아이콘 */}
                                                            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                                <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                            <span className="font-bold text-blue-600">{proName}님</span>
                                                            {proUser?.is_phone_verified && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap flex-shrink-0">✅ 전화번호 인증</span>
                                                            )}
                                                            {proUser?.facebook_url && (
                                                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap flex-shrink-0">🔵 Facebook 연동</span>
                                                            )}
                                                            <span className="text-xs font-bold text-yellow-500">⭐ {Number(avgRating).toFixed(1)}</span>
                                                            <span className="text-xs text-gray-400">({reviewCount}개)</span>
                                                        </div>
                                                        <span className="text-xs text-gray-400 flex-shrink-0">{new Date(quote.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 text-right">프로필 상세 보기 〉</p>
                                                </div>

                                                {activeTab === 'IN_PROGRESS' ? (
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setQuoteDetailModal({ quote: { ...quote }, requestId: request.request_id, request });
                                                            }}
                                                            className="flex-1 bg-white hover:bg-gray-50 text-blue-600 font-bold py-2.5 rounded-lg shadow-sm transition text-sm border border-blue-200"
                                                        >
                                                            📋 견적 확인하기
                                                        </button>
                                                        <button
                                                            onClick={() => handleStartChat({ ...quote, request_id: request.request_id })}
                                                            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2.5 rounded-lg shadow-sm transition text-sm"
                                                        >
                                                            상담 / 채팅하기
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="mt-2 text-center">
                                                        {quote.status === 'ACCEPTED' ? (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="bg-green-100 text-green-700 py-2 rounded-lg text-sm font-bold border border-green-200">
                                                                    ✅ 최종 매칭 고수
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setQuoteDetailModal({ quote: { ...quote }, requestId: request.request_id, request });
                                                                    }}
                                                                    className="w-full bg-white hover:bg-gray-50 text-blue-600 font-bold py-2.5 rounded-lg shadow-sm transition text-sm border border-blue-200 flex items-center justify-center gap-2"
                                                                >
                                                                    <span>📋</span> 견적 상세 보기
                                                                </button>
                                                                <button
                                                                    onClick={() => handleStartChat({ ...quote, request_id: request.request_id })}
                                                                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2"
                                                                >
                                                                    <span>💬</span> 채팅방으로 이동
                                                                </button>
                                                                {(() => {
                                                                    const roomId = quoteRoomMap[`${request.request_id}|${quote.pro_id}`];
                                                                    const isReviewed = roomId ? reviewedRoomIds.has(roomId) : false;
                                                                    return isReviewed ? (
                                                                        <button
                                                                            disabled
                                                                            className="w-full bg-gray-200 text-gray-500 font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-gray-300"
                                                                        >
                                                                            <span>✅</span> 리뷰 작성 완료
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => openReviewModal(quote, request.request_id)}
                                                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2"
                                                                        >
                                                                            <span>⭐</span> 이 고수에게 리뷰 남기기
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>
                                                        ) : (quote.status === 'REJECTED' || request.status === 'MATCHED') ? (
                                                            <div className="bg-gray-200 text-gray-500 py-2 rounded-lg text-sm font-bold border border-gray-300">
                                                                ❌ 매칭 실패
                                                            </div>
                                                        ) : (
                                                            <div className="bg-gray-200 text-gray-500 py-2 rounded-lg text-sm font-bold border border-gray-300">
                                                                🔒 마감됨
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed text-sm text-gray-400">
                                    아직 도착한 견적이 없습니다.
                                </div>
                            )}

                            {activeTab === 'CLOSED' && (
                                <button disabled className="w-full mt-4 bg-gray-100 text-gray-400 font-bold py-3 rounded-xl shadow-none cursor-not-allowed text-sm">
                                    마감된 요청서입니다
                                </button>
                            )}
                        </div>
                    );
                })
            )}

            {/* 리뷰 모달 */}
            {
                isReviewModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
                            <h2 className="text-lg font-bold text-center">리뷰 작성</h2>
                            <div className="flex flex-col items-center">
                                <span className="text-sm text-gray-500 mb-2">만족도를 평가해주세요</span>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => setReviewRating(star)}
                                            className={`text-3xl transition ${star <= reviewRating ? 'text-yellow-400' : 'text-gray-200'}`}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <textarea
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder="고수님과의 서비스 진행이 어떠셨나요?"
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => setIsReviewModalOpen(false)}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-xl transition text-sm"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleReviewSubmit}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition text-sm"
                                >
                                    리뷰 등록
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* 견적 상세 모달 */}
            {quoteDetailModal && (
                <QuoteDetailModal
                    quote={quoteDetailModal.quote}
                    requestId={quoteDetailModal.requestId}
                    request={quoteDetailModal.request}
                    onClose={() => setQuoteDetailModal(null)}
                    onStartChat={(q) => {
                        setQuoteDetailModal(null);
                        handleStartChat(q);
                    }}
                />
            )}

            {/* 고수 프로필 상세 모달 */}
            {profileModal && (
                <ProProfileDetailModal
                    proId={profileModal.proId}
                    requestId={profileModal.requestId}
                    onClose={() => setProfileModal(null)}
                    onStartChat={(q) => {
                        setProfileModal(null);
                        handleStartChat(q);
                    }}
                />
            )}
        </div>
    );

}

`

### 2. ProBiddingDetail.tsx

` sx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ProBiddingDetail({ requestId }: { requestId: string }) {
const router = useRouter();
const [request, setRequest] = useState<any>(null);
const [loading, setLoading] = useState(true);
const [isSubmitting, setIsSubmitting] = useState(false);
const [isSent, setIsSent] = useState(false);
const [submittedQuote, setSubmittedQuote] = useState<any>(null);
const [chatRoomId, setChatRoomId] = useState<string | null>(null);

    // 견적 폼 상태
    const [quotePrice, setQuotePrice] = useState('');
    const [quoteDescription, setQuoteDescription] = useState('');
    const [quoteImage, setQuoteImage] = useState<File | null>(null); // legacy (can remove later if sure, but keeping to avoid re-writing everything if used elsewhere, wait, I will rewrite)
    const [quoteImages, setQuoteImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const costToQuote = 100;
    const maxQuotes = 5;
    const MAX_IMAGES = 3;

    useEffect(() => {
        const fetchRequest = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            const { data } = await supabase
                .from('match_requests')
                .select('*, match_quotes(*)')
                .eq('request_id', requestId)
                .single();

            setRequest(data);

            if (sessionUser && data?.match_quotes) {
                const myQuote = data.match_quotes.find((q: any) => q.pro_id === sessionUser.id);
                if (myQuote) {
                    setIsSent(true);
                    setSubmittedQuote(myQuote);

                    // 채팅방 ID 조회
                    const { data: roomData } = await supabase
                        .from('chat_rooms')
                        .select('room_id')
                        .eq('request_id', requestId)
                        .eq('pro_id', sessionUser.id)
                        .single();

                    if (roomData) {
                        setChatRoomId(roomData.room_id);
                    }
                }
            }

            setLoading(false);
        };
        fetchRequest();
    }, [requestId]);

    // 사진 선택 핸들러
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const selectedFiles = Array.from(e.target.files);

        if (quoteImages.length + selectedFiles.length > MAX_IMAGES) {
            alert(`사진은 최대 ${MAX_IMAGES}장까지만 첨부할 수 있습니다.`);
            return;
        }

        const validFiles = selectedFiles.filter(file => {
            if (file.size > 5 * 1024 * 1024) {
                alert(`${file.name} 파일 크기는 5MB 이하만 가능합니다.`);
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        setQuoteImages(prev => [...prev, ...validFiles]);

        validFiles.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });

        // Reset input value to allow selecting same file again if removed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setQuoteImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
        setImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSendQuote = async () => {
        if (isSubmitting || isSent) return;

        const { data: authData } = await supabase.auth.getUser();
        const sessionUser = authData?.user;

        if (!sessionUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        // 폼 검증
        if (!quotePrice || Number(quotePrice) <= 0) {
            alert('견적 금액을 입력해주세요.');
            return;
        }

        const confirm = window.confirm(
            `${costToQuote} 캐시를 사용하여 견적을 보내시겠습니까?\n\n견적 금액: ₱${Number(quotePrice).toLocaleString()}\n설명: ${quoteDescription || '(없음)'}\n사진: ${quoteImages.length > 0 ? `${quoteImages.length}장 첨부됨` : '없음'}`
        );
        if (!confirm) return;

        setIsSubmitting(true);

        try {
            // [개선된 단일 트랜잭션 로직: 이미지 우선 다중 업로드 -> RPC 한 번에 호출]
            let imageUrl: string | null = null;

            if (quoteImages.length > 0) {
                const uploadPromises = quoteImages.map(async (file) => {
                    const tempId = crypto.randomUUID();
                    const fileExt = file.name.split('.').pop();
                    const filePath = `quotes/${tempId}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage
                        .from('quote_images')
                        .upload(filePath, file, { upsert: true });

                    if (uploadError) throw uploadError;

                    const { data: publicUrlData } = supabase.storage
                        .from('quote_images')
                        .getPublicUrl(filePath);

                    return publicUrlData.publicUrl;
                });

                try {
                    const uploadedUrls = await Promise.all(uploadPromises);
                    imageUrl = JSON.stringify(uploadedUrls); // 배열을 JSON 텍스트로 저장
                } catch (e: any) {
                    console.warn('이미지 업로드 실패:', e.message);
                    throw new Error('이미지 업로드에 실패하여 견적 발송이 취소되었습니다.');
                }
            }

            // 2단계: RPC로 견적 생성 + 금액/설명/사진 업뎃 + 캐시 차감 (원자적 단일 트랜잭션)
            const { data: quoteId, error } = await supabase.rpc('send_quote_and_deduct_cash', {
                p_pro_id: sessionUser.id,
                p_request_id: requestId,
                p_deduct_amount: costToQuote,
                p_price: Number(quotePrice),
                p_description: quoteDescription || null,
                p_image_url: imageUrl
            });

            if (error) {
                if (error.message.includes('잔액이 부족합니다')) {
                    if (window.confirm('캐시가 부족합니다. 지갑(Wallet) 페이지로 이동하시겠습니까?')) {
                        router.push('/pro/wallet');
                    }
                } else if (error.message.includes('이미 초과된') || error.message.includes('정원이 마감된')) {
                    alert('이미 5명 정원이 마감된 요청입니다.');
                } else if (error.message.includes('이미 견적을 발송한')) {
                    alert('이미 이 요청에 견적을 발송하셨습니다.');
                } else {
                    throw error;
                }
                setIsSubmitting(false);
                return;
            }

            // 4단계: 고객에게 알림 전송
            if (request?.customer_id) {
                await supabase.from('notifications').insert({
                    user_id: request.customer_id,
                    type: 'QUOTE',
                    message: "새로운 견적이 도착했습니다! 지금 바로 확인해보세요.",
                    reference_id: requestId,
                    is_read: false
                });
            }

            setIsSent(true);
            alert('견적이 성공적으로 발송되었습니다!');
            window.dispatchEvent(new CustomEvent('wallet-updated'));
            router.push('/pro/requests');
        } catch (e: any) {
            alert('오류 발생: ' + e.message);
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 text-center mt-20 text-gray-500">요청서 세부정보를 불러오는 중입니다...</div>;
    if (!request) return <div className="p-4 text-center mt-20 text-red-500">요청서를 찾을 수 없습니다.</div>;

    const timeRemaining = request.created_at ? new Date(request.created_at).getTime() + (48 * 60 * 60 * 1000) - Date.now() : 0;
    const isExpired = timeRemaining <= 0;
    const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
    const minutesRemaining = Math.max(0, Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60)));
    const isHurry = hoursRemaining < 24 && !isExpired;

    // dynamic_answers 파싱: 모든 키-값을 가독성 있게 렌더링
    const dynamicAnswers = { ...(request.dynamic_answers || {}) };

    if (dynamicAnswers.region_reg && dynamicAnswers.region_city) {
        dynamicAnswers.merged_region = `${dynamicAnswers.region_reg}, ${dynamicAnswers.region_city}`;
        delete dynamicAnswers.region_reg;
        delete dynamicAnswers.region_city;
    }

    const answerEntries = Object.entries(dynamicAnswers).filter(([k, v]) => {
        if (['details_mode', 'depth1', 'depth2'].includes(k)) return false;
        return true;
    });

    const ORDERED_KEYS = [
        'depth1', 'depth2', 'service_type',
        'merged_region',
        'move_type', 'move_date',
        'from_region', 'from_floor', 'from_size', 'from_elevator',
        'appliances', 'furniture', 'images',
        'to_region', 'to_floor', 'to_elevator',
        'details'
    ];

    answerEntries.sort((a, b) => {
        const indexA = ORDERED_KEYS.indexOf(a[0]);
        const indexB = ORDERED_KEYS.indexOf(b[0]);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const canSubmit = !isSent && !isExpired && request.quote_count < maxQuotes && !isSubmitting;

    return (
        <div className="relative min-h-screen bg-gray-50 pb-24">
            {/* 1. 상단 정보 패널 */}
            <div className="bg-white p-4 border-b sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <button
                        onClick={() => router.back()}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold">고객 요청 (ID: {request.request_id.slice(0, 6)})</h1>
                        <p className="text-xs text-gray-500">
                            {request.service_type ? `${request.service_type} | ` : ''}
                            {request.region ? request.region : `카테고리: ${request.category_id} | 지역: ${request.region_id}`}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className={`inline-block font-bold px-3 py-1 rounded-full text-sm shadow-sm ${isExpired ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600 border border-red-200 animate-pulse'}`}>
                            💡 {request.quote_count}/{maxQuotes}명
                        </span>
                        <div className={`text-xs mt-1 font-bold ${isExpired ? 'text-gray-500' : isHurry ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                            {isExpired ? '마감됨' : `${hoursRemaining}시간 ${minutesRemaining}분 후 마감!`}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* 1.5. 내가 보낸 견적 내용 (발송 완료 시 최상단 노출) */}
                {isSent && submittedQuote && (
                    <div className="bg-blue-50 rounded-xl p-4 shadow-sm border border-blue-200">
                        <h3 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <span className="text-blue-600">✉️</span> 내가 보낸 견적 내용
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <span className="text-xs text-blue-500 font-bold block mb-1">제안 금액</span>
                                <div className="text-sm font-bold text-gray-900 bg-white p-2.5 rounded-lg border border-blue-100">
                                    ₱ {Number(submittedQuote.price).toLocaleString()}
                                </div>
                            </div>
                            {submittedQuote.description && (
                                <div>
                                    <span className="text-xs text-blue-500 font-bold block mb-1">견적 설명</span>
                                    <div className="text-sm text-gray-800 bg-white p-2.5 rounded-lg border border-blue-100 whitespace-pre-wrap leading-relaxed">
                                        {submittedQuote.description}
                                    </div>
                                </div>
                            )}
                            {submittedQuote.image_url && (
                                <div>
                                    <span className="text-xs text-blue-500 font-bold block mb-1">첨부 사진</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {(() => {
                                            let imageList: string[] = [];
                                            if (submittedQuote.image_url.startsWith('[')) {
                                                try {
                                                    imageList = JSON.parse(submittedQuote.image_url);
                                                } catch (e) {
                                                    imageList = [submittedQuote.image_url];
                                                }
                                            } else {
                                                imageList = [submittedQuote.image_url];
                                            }
                                            return imageList.map((url, idx) => (
                                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block relative cursor-pointer hover:opacity-90 transition">
                                                    <img src={url} alt={`첨부사진 ${idx + 1}`} className="w-24 h-24 object-cover rounded-xl border border-blue-200 shadow-sm bg-white" />
                                                </a>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. 요청 상세 내용 (dynamic_answers 전체 파싱) */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="text-blue-500">📋</span> 요청 상세 내용
                    </h3>

                    {answerEntries.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">상세 내용이 없습니다.</p>
                    ) : (
                        <ul className="space-y-3">
                            {answerEntries.map(([key, value]) => {
                                // 키 이름을 사람이 읽기 쉬운 형태로 변환
                                const labelMap: Record<string, string> = {
                                    depth1: '서비스 대분류',
                                    depth2: '서비스 중분류',
                                    move_type: '이사 종류',
                                    move_date: '이사 날짜',
                                    merged_region: '서비스를 받으실 지역',
                                    from_region: '출발 지역',
                                    from_floor: '출발지 층수',
                                    from_size: '출발지 면적 / 인원',
                                    from_elevator: '출발지 엘리베이터',
                                    appliances: '이전 가전',
                                    furniture: '이전 가구',
                                    images: '첨부 사진',
                                    to_region: '도착 지역',
                                    to_floor: '도착지 층수',
                                    to_elevator: '도착지 엘리베이터',
                                    details: '추가 요청사항',
                                    service_type: '상세 서비스',
                                    region: '지역',
                                    region_reg: '지역 (Region)',
                                    region_city: '도시 (City)'
                                };
                                const label = labelMap[key] || key;

                                return (
                                    <li key={key} className="flex flex-col">
                                        <span className="text-xs text-gray-400 font-medium mb-1">{label}</span>
                                        <div className="text-sm font-medium text-gray-800 bg-blue-50 p-2.5 rounded-lg whitespace-pre-wrap leading-relaxed">
                                            {(() => {
                                                if (value === null || value === undefined || value === '') {
                                                    return <span className="text-gray-400 italic">미입력 (건너뜀)</span>;
                                                }
                                                if (Array.isArray(value) && value.length === 0) {
                                                    return <span className="text-gray-400 italic">선택 항목 없음</span>;
                                                }
                                                if (value === '없음' || (Array.isArray(value) && value.length === 1 && value[0] === '없음')) {
                                                    return <span className="text-gray-500 font-bold">없음</span>;
                                                }

                                                if (key === 'images' && Array.isArray(value)) {
                                                    return (
                                                        <div className="flex flex-wrap gap-2 mt-1">
                                                            {value.map((img: any, i: number) => (
                                                                <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block relative cursor-pointer hover:opacity-90 transition group overflow-hidden rounded-lg">
                                                                    <img src={img.url} className="w-24 h-24 object-cover border border-blue-200" alt={`첨부사진 ${i + 1}`} />
                                                                    {img.description && <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1.5 truncate text-center transition-all group-hover:bg-black/80">{img.description}</span>}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                if (value && typeof value === 'object' && !Array.isArray(value)) {
                                                    const v = value as any;
                                                    if (v.reg && v.city) return `${v.reg}, ${v.city}`;
                                                    return JSON.stringify(value);
                                                }
                                                if (Array.isArray(value)) {
                                                    return value.join(', ');
                                                }
                                                return String(value);
                                            })()}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* 3. 견적 작성 폼 (금액 / 설명 / 사진) */}
                {!isSent && !isExpired && request.quote_count < maxQuotes && (
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <span className="text-yellow-500">✍️</span> 견적 작성
                        </h3>

                        {/* 금액 입력 */}
                        <div className="mb-3">
                            <label className="text-xs font-bold text-gray-600 mb-1 block">견적 금액 (₱) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                value={quotePrice}
                                onChange={e => setQuotePrice(e.target.value)}
                                placeholder="예: 50000"
                                min="0"
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm font-medium"
                            />
                        </div>

                        {/* 설명 입력 */}
                        <div className="mb-3">
                            <label className="text-xs font-bold text-gray-600 mb-1 block">견적 설명 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                            <textarea
                                value={quoteDescription}
                                onChange={e => setQuoteDescription(e.target.value)}
                                rows={3}
                                placeholder="서비스 범위, 포함 사항, 예상 소요 시간 등을 간략히 작성해주세요."
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm resize-none"
                            />
                        </div>

                        {/* 사진 첨부 */}
                        <div>
                            <label className="text-xs font-bold text-gray-600 mb-1 block">사진 첨부 <span className="text-xs text-gray-400 font-normal">({imagePreviews.length}/{MAX_IMAGES}장 최대 5MB)</span></label>

                            <div className="flex flex-wrap gap-2">
                                {imagePreviews.map((preview, idx) => (
                                    <div key={idx} className="relative inline-block">
                                        <img src={preview} alt={`미리보기 ${idx + 1}`} className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 transition"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}

                                {imagePreviews.length < MAX_IMAGES && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-400 transition bg-gray-50 hover:bg-blue-50"
                                    >
                                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-[10px] font-medium">사진 추가</span>
                                    </button>
                                )}
                            </div>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageSelect}
                                className="hidden"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 4. 플로팅 견적 발송 버튼 */}
            <div className="fixed bottom-14 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pb-6 z-20">
                {isSent ? (
                    <button
                        onClick={() => {
                            if (chatRoomId) {
                                router.push(`/chat/${chatRoomId}`);
                            } else {
                                alert('채팅방 정보를 불러오는 중이거나 생성되지 않았습니다.');
                            }
                        }}
                        className="w-full max-w-md mx-auto block font-bold py-4 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition transform hover:-translate-y-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        💬 채팅방으로 이동하기
                    </button>
                ) : (
                    <button
                        onClick={handleSendQuote}
                        disabled={!canSubmit}
                        className={`w-full max-w-md mx-auto block font-bold py-4 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition transform hover:-translate-y-1 ${!canSubmit ? 'bg-gray-400 text-white cursor-not-allowed shadow-none hover:translate-y-0' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        {isSubmitting ? '발송 중...' :
                            isExpired ? '시간이 초과되어 마감되었습니다' :
                                request.quote_count >= maxQuotes ? '선착순 5명 견적이 모두 마감되었습니다' :
                                    `${costToQuote} 캐시로 견적 보내기${quotePrice ? ` (₱${Number(quotePrice).toLocaleString()})` : ''}`}
                    </button>
                )}
            </div>
        </div>
    );

}

`
