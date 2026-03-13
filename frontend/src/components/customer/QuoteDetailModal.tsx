'use client';

import React from 'react';

interface QuoteDetailModalProps {
    quote: {
        quote_id: string;
        pro_id: string;
        price?: number | null;
        description?: string | null;
        image_url?: string | null;
        created_at: string;
        pro_profiles?: {
            pro_id: string;
            average_rating?: number;
            review_count?: number;
            is_phone_verified?: boolean;
            facebook_url?: string;
        };
    };
    onClose: () => void;
    onStartChat: (quote: any) => void;
    requestId: string;
    request?: any;
    isReadOnly?: boolean;
    proName?: string;
}

export default function QuoteDetailModal({ quote, onClose, onStartChat, requestId, request, isReadOnly, proName }: QuoteDetailModalProps) {
    const proProfile = Array.isArray(quote.pro_profiles) ? quote.pro_profiles[0] : quote.pro_profiles;
    const userInfo = proProfile?.users
        ? (Array.isArray(proProfile.users) ? proProfile.users[0] : proProfile.users)
        : null;
    const displayProName = proName || ((userInfo?.nickname && userInfo.nickname.trim() !== '') ? userInfo.nickname : (userInfo?.name || '전문가'));
    const avatarUrl = userInfo?.avatar_url || null;
    const avgRating = proProfile?.average_rating || 0;
    const reviewCount = proProfile?.review_count || 0;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-50 p-4" onClick={onClose}>
            <div className="flex-1 flex items-center justify-center">
                <div
                    className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden relative"
                    onClick={e => e.stopPropagation()}
                >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800">견적 상세</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 스크롤 가능 본문 */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                        {/* A. 고수 정보 + 트러스트 배지 */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center flex-wrap gap-1.5">
                                    <span className="font-bold text-gray-800 text-base">{displayProName}님</span>
                                    {proProfile?.is_phone_verified && (
                                        <span className="inline-flex items-center text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap">✅ 전화번호 인증</span>
                                    )}
                                    {proProfile?.facebook_url && (
                                        <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">🔵 Facebook 연동</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs font-bold text-yellow-500">⭐ {Number(avgRating).toFixed(1)}</span>
                                    <span className="text-xs text-gray-400">({reviewCount}개 리뷰)</span>
                                </div>
                            </div>
                        </div>

                        {/* 한 줄 소개 */}
                        {proProfile?.intro && (
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                "{proProfile.intro}"
                            </p>
                        )}

                        {/* B. 제안 금액 (가장 눈에 띄게) */}
                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 text-center">
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">제안 금액</span>
                            {quote.price ? (
                                <span className="text-3xl font-black text-gray-900">
                                    ₱{Number(quote.price).toLocaleString()}
                                </span>
                            ) : (
                                <span className="text-lg font-bold text-gray-400">금액 미기재</span>
                            )}
                        </div>

                        {/* C. 상세 설명 */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">상세 설명</h3>
                            {quote.description ? (
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                    {quote.description}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400">상세 설명이 첨부되지 않았습니다.</p>
                            )}
                        </div>

                        {/* D. 첨부 사진 */}
                        {(() => {
                            let imageList: string[] = [];
                            if (quote.image_url) {
                                if (quote.image_url.startsWith('[')) {
                                    try {
                                        const parsed = JSON.parse(quote.image_url);
                                        if (Array.isArray(parsed)) {
                                            imageList = parsed;
                                        }
                                    } catch (e) {
                                        imageList = [quote.image_url];
                                    }
                                } else {
                                    imageList = [quote.image_url];
                                }
                            }

                            if (imageList.length === 0) return null;

                            return (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">첨부 사진 ({imageList.length}장)</h3>
                                    <div className="flex flex-col gap-3">
                                        {imageList.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block cursor-pointer hover:opacity-90 transition-opacity">
                                                <img
                                                    src={url}
                                                    alt={`견적서 첨부 이미지 ${idx + 1}`}
                                                    className="w-full rounded-lg object-contain border border-gray-200 shadow-sm max-h-80 bg-white"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* E. 요청 내용 (고객 원본 데이터) */}
                        {request && request.dynamic_answers && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-6">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">요청 내용</h3>
                                <ul className="space-y-3">
                                    {(() => {
                                        const dynamicAnswers = { ...request.dynamic_answers };
                                        delete dynamicAnswers.details_mode;
                                        delete dynamicAnswers.depth1;
                                        delete dynamicAnswers.depth2;

                                        if (dynamicAnswers.region_reg && dynamicAnswers.region_city) {
                                            dynamicAnswers.merged_region = `${dynamicAnswers.region_reg}, ${dynamicAnswers.region_city}`;
                                            delete dynamicAnswers.region_reg;
                                            delete dynamicAnswers.region_city;
                                        }

                                        const answerEntries = Object.entries(dynamicAnswers).filter(([k, v]) => {
                                            if (v === null || v === undefined || v === '') return false;
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

                                        if (answerEntries.length === 0) {
                                            return <p className="text-sm text-gray-400">요청 상세 내용이 없습니다.</p>;
                                        }

                                        return answerEntries.map(([key, value]) => {
                                            const label = labelMap[key] || key;
                                            return (
                                                <li key={key} className="flex flex-col">
                                                    <span className="text-xs text-gray-400 font-medium mb-1">{label}</span>
                                                    <div className="text-sm font-medium text-gray-800 bg-white p-2.5 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                                                        {(() => {
                                                            if (key === 'images' && Array.isArray(value)) {
                                                                return (
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {value.map((img: any, i: number) => (
                                                                            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block relative cursor-pointer hover:opacity-90 transition group overflow-hidden rounded-lg">
                                                                                <img src={img.url} className="w-20 h-20 object-cover border border-gray-200" alt={`첨부사진 ${i + 1}`} />
                                                                                {img.description && <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate text-center transition-all group-hover:bg-black/80">{img.description}</span>}
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
                                        });
                                    })()}
                                </ul>
                            </div>
                        )}

                        {/* 견적 도착 시간 */}
                        <p className="text-xs text-gray-400 text-right">
                            견적 도착: {new Date(quote.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {/* 하단 고정 CTA */}
                    {!isReadOnly && (
                        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                            <button
                                onClick={() => onStartChat({ ...quote, request_id: requestId })}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base active:scale-[0.98]"
                            >
                                <span className="text-lg">💬</span> 상담 / 채팅하기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
