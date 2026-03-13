'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface ProProfileDetailModalProps {
    proId: string;
    requestId: string;
    hideChat?: boolean;
    onClose: () => void;
    onStartChat: (quote: any) => void;
}

export default function ProProfileDetailModal({ proId, requestId, hideChat, onClose, onStartChat }: ProProfileDetailModalProps) {
    const [activeTab, setActiveTab] = useState<'INFO' | 'REVIEWS'>('INFO');
    const [proProfile, setProProfile] = useState<any>(null);
    const [proName, setProName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // 고수 프로필 조회 (독립 쿼리 — FK 미설정 대비)
            const { data: profile } = await supabase
                .from('pro_profiles')
                .select('*')
                .eq('pro_id', proId)
                .single();

            // 고수 이름 독립 조회
            const { data: userData } = await supabase
                .from('users')
                .select('name, nickname, avatar_url')
                .eq('user_id', proId)
                .single();

            if (profile) {
                setProProfile(profile);
            }
            setProName(profile?.nickname || userData?.nickname || userData?.name || '전문가');
            setAvatarUrl(userData?.avatar_url || null);

            // 리뷰 조회 (독립 쿼리 — FK 없이도 동작)
            const { data: reviewsData } = await supabase
                .from('reviews')
                .select('review_id, rating, comment, created_at, customer_id')
                .eq('pro_id', proId)
                .eq('is_hidden', false)
                .order('created_at', { ascending: false });

            if (reviewsData && reviewsData.length > 0) {
                // 각 리뷰의 customer_id로 작성자 이름 일괄 조회
                const customerIds = reviewsData.map((r: any) => r.customer_id).filter(Boolean);
                const { data: customerUsers } = await supabase
                    .from('users')
                    .select('user_id, name, nickname')
                    .in('user_id', customerIds);

                const nameMap: Record<string, string> = {};
                if (customerUsers) {
                    customerUsers.forEach((u: any) => { nameMap[u.user_id] = u.nickname || u.name; });
                }

                const enrichedReviews = reviewsData.map((r: any) => ({
                    ...r,
                    reviewer_name: nameMap[r.customer_id] || '고객'
                }));
                setReviews(enrichedReviews);
            } else {
                setReviews([]);
            }

            setLoading(false);
        };
        fetchData();
    }, [proId]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-2xl w-full max-w-md p-8 text-center text-gray-500">
                    프로필 정보를 불러오는 중...
                </div>
            </div>
        );
    }

    const avgRating = proProfile?.average_rating || 0;
    const reviewCount = proProfile?.review_count || 0;
    const services = Array.isArray(proProfile?.services) ? proProfile.services : [];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-50">
            {/* 모달 컨테이너 */}
            <div className="flex-1 flex items-end justify-center sm:items-center p-0 sm:p-4">
                <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] relative">
                    {/* 헤더 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                )}
                            </div>
                            <h2 className="text-lg font-bold text-gray-800">{proName}님 프로필</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500 flex-shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 평균 별점 요약 */}
                    <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 flex items-center gap-2">
                        <span className="text-yellow-500 text-lg">⭐</span>
                        <span className="font-bold text-gray-800">{Number(avgRating).toFixed(1)}</span>
                        <span className="text-sm text-gray-500">({reviewCount}개 리뷰)</span>
                    </div>

                    {/* 2단 탭 */}
                    <div className="flex bg-gray-50 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('INFO')}
                            className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'INFO' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            고수 정보
                        </button>
                        <button
                            onClick={() => setActiveTab('REVIEWS')}
                            className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'REVIEWS' ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            고객 리뷰
                        </button>
                    </div>

                    {/* 탭 본문 (스크롤 가능) */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                        {activeTab === 'INFO' ? (
                            <>
                                {/* 인증 배지 */}
                                <div className="flex flex-wrap gap-2">
                                    {proProfile?.is_phone_verified && (
                                        <span className="inline-flex items-center bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 shadow-sm whitespace-nowrap">
                                            ✅ 전화번호 인증
                                        </span>
                                    )}
                                    {proProfile?.facebook_url && (
                                        <span className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200 shadow-sm whitespace-nowrap">
                                            🔵 Facebook 연동
                                        </span>
                                    )}
                                    {!proProfile?.is_phone_verified && !proProfile?.facebook_url && (
                                        <span className="text-xs text-gray-400">아직 인증된 항목이 없습니다.</span>
                                    )}
                                </div>

                                {/* 한 줄 소개 */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">한 줄 소개</h3>
                                    <p className="text-sm text-gray-800 leading-relaxed">
                                        {proProfile?.intro || '아직 소개가 작성되지 않았습니다.'}
                                    </p>
                                </div>

                                {/* 상세 소개 */}
                                {proProfile?.detailed_intro && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">상세 소개</h3>
                                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                            {proProfile.detailed_intro}
                                        </p>
                                    </div>
                                )}

                                {/* 지역 */}
                                {proProfile?.region && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">활동 지역</h3>
                                        <p className="text-sm text-gray-800 font-medium">📍 {proProfile.region}</p>
                                    </div>
                                )}

                                {/* 서비스 목록 */}
                                {services.length > 0 && (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">제공 서비스</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {services.map((s: string) => (
                                                <span key={s} className="bg-white text-gray-700 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                                    {s}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* 리뷰 탭 */}
                                {reviews.length === 0 ? (
                                    <div className="text-center p-8 text-gray-400">
                                        <p className="text-3xl mb-2">📝</p>
                                        <p className="text-sm">아직 리뷰가 없습니다.</p>
                                    </div>
                                ) : (
                                    reviews.map((review: any) => (
                                        <div key={review.review_id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-yellow-400 text-sm">
                                                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-600">{Number(review.rating).toFixed(1)}</span>
                                                </div>
                                                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{review.comment}</p>
                                            <p className="text-xs text-gray-400">{review.reviewer_name || '고객'}</p>
                                        </div>
                                    ))
                                )}
                            </>
                        )}
                    </div>

                    {/* 하단 고정 채팅 버튼 — 거래 완료 시 숨김 */}
                    {!hideChat && (
                        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                            <button
                                onClick={() => onStartChat({ pro_id: proId, request_id: requestId })}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
                            >
                                <span className="text-lg">💬</span> 채팅방으로 이동
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
