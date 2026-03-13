'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

export default function ProBiddingDetail({ requestId }: { requestId: string }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [request, setRequest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [submittedQuote, setSubmittedQuote] = useState<any>(null);
    const [chatRoomId, setChatRoomId] = useState<string | null>(null);
    const [isReviewed, setIsReviewed] = useState(false);
    const [customerName, setCustomerName] = useState<string>('고객');
    const [customerAvatar, setCustomerAvatar] = useState<string | null>(null);

    // 견적 폼 상태
    const [quotePrice, setQuotePrice] = useState('');
    const [quoteDescription, setQuoteDescription] = useState('');
    const [quoteImage, setQuoteImage] = useState<File | null>(null); // legacy (can remove later if sure, but keeping to avoid re-writing everything if used elsewhere, wait, I will rewrite)
    const [quoteImages, setQuoteImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── 관리자 설정 동기화: platform_settings 테이블에서 동적 로드 ──
    const [costToQuote, setCostToQuote] = useState(0); // 0으로 초기화 → 로드 전 절대 렌더링 금지
    const [maxQuotes, setMaxQuotes] = useState(5);
    const [agreeNoRefund, setAgreeNoRefund] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isPriceReady, setIsPriceReady] = useState(false); // [로딩 가드] 단가 결정 전 버튼 표시 차단
    const MAX_IMAGES = 3;

    // ── [확장 1단계] 원클릭 템플릿 시스템 ──
    const [templates, setTemplates] = useState<{ id: number; title: string; content: string; attachments?: string[] }[]>([]);
    const [showTemplatePanel, setShowTemplatePanel] = useState(false);
    const [newTplTitle, setNewTplTitle] = useState('');
    const [showSaveTpl, setShowSaveTpl] = useState(false);
    const [savingTemplate, setSavingTemplate] = useState(false);
    // ── [확장] 템플릿에서 로드된 기업로드 이미지 URL 추적 (File 객체와 분리) ──
    const [preloadedImageUrls, setPreloadedImageUrls] = useState<string[]>([]);

    // ── [확장 2단계] 인앱 충전 브릿지 ──
    const [myBalance, setMyBalance] = useState<number | null>(null);
    const [showChargeModal, setShowChargeModal] = useState(false);
    const [currentProId, setCurrentProId] = useState<string | null>(null);

    // [단일 비동기 플로우] settings → request+category 순차 로드 (Flickering 원천 차단)
    useEffect(() => {
        const loadAll = async () => {
            // Step 1: 전역 기본값 로드
            let globalCost = 100; // 하드코드 fallback
            const { data: settingsData } = await supabase.from('platform_settings').select('key, value');
            if (settingsData) {
                settingsData.forEach((s: any) => {
                    if (s.key === 'quote_cost') globalCost = Number(s.value);
                    if (s.key === 'max_quotes_per_request') setMaxQuotes(Number(s.value));
                });
            }

            // Step 2: 요청 + 카테고리 단가 로드
            const { data: authData } = await supabase.auth.getUser();
            const sessionUser = authData?.user;
            if (sessionUser) setCurrentProId(sessionUser.id);

            const { data } = await supabase
                .from('match_requests')
                .select('*, match_quotes(*), categories(name, base_price)')
                .eq('request_id', requestId)
                .single();

            setRequest(data);

            // Step 3: [동적 과금 우선순위] 카테고리 단가 > 전역 단가 > 하드코드 fallback
            const finalCost = (data?.categories?.base_price && data.categories.base_price > 0)
                ? data.categories.base_price
                : globalCost;
            setCostToQuote(finalCost);
            setIsPriceReady(true); // ✅ 단가 확정 완료 → UI 렌더링 허용

            // ── [확장 2단계] 보유 코인 실시간 조회 ──
            if (sessionUser) {
                const { data: profile } = await supabase
                    .from('pro_profiles')
                    .select('current_cash, bonus_cash')
                    .eq('pro_id', sessionUser.id)
                    .single();
                if (profile) setMyBalance((profile.current_cash || 0) + (profile.bonus_cash || 0));
            }

            // ── [확장 1단계] 템플릿 로드 ──
            if (sessionUser) {
                const { data: tpls } = await supabase
                    .from('pro_quote_templates')
                    .select('id, title, content, attachments')
                    .eq('pro_id', sessionUser.id)
                    .order('created_at', { ascending: false });
                if (tpls) setTemplates(tpls);
            }

            if (data?.customer_id) {
                const { data: customerData } = await supabase
                    .from('users')
                    .select('nickname, name, avatar_url')
                    .eq('user_id', data.customer_id)
                    .single();
                if (customerData) {
                    setCustomerName((customerData.nickname && customerData.nickname.trim() !== '') ? customerData.nickname : (customerData.name || '알 수 없는 고객'));
                    setCustomerAvatar(customerData.avatar_url || null);
                }
            }

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

                        // 리뷰 존재 여부 확인
                        const { count } = await supabase
                            .from('reviews')
                            .select('*', { count: 'exact', head: true })
                            .eq('room_id', roomData.room_id);

                        if (count && count > 0) {
                            setIsReviewed(true);
                        }
                    }
                }
            }

            setLoading(false);
        };
        loadAll();
    }, [requestId]);

    // ── 실시간 요청 상태 동기화 (MATCHED 즉시 반영) ──
    useEffect(() => {
        const channel = supabase
            .channel(`request_status_${requestId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'match_requests',
                filter: `request_id=eq.${requestId}`
            }, (payload) => {
                console.log('🔄 [Realtime] 요청 상태 변경 감지:', payload.new);
                setRequest((prev: any) => prev ? { ...prev, ...payload.new } : prev);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [requestId]);

    // 사진 선택 핸들러
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;

        const selectedFiles = Array.from(e.target.files);

        if (quoteImages.length + selectedFiles.length > MAX_IMAGES) {
            showToast(`사진은 최대 ${MAX_IMAGES}장까지만 첨부할 수 있습니다.`, 'warning');
            return;
        }

        const validFiles = selectedFiles.filter(file => {
            if (file.size > 5 * 1024 * 1024) {
                showToast(`${file.name} 파일 크기는 5MB 이하만 가능합니다.`, 'warning');
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
            showToast('로그인이 필요합니다.', 'error');
            return;
        }

        // 폼 검증
        if (!quotePrice || Number(quotePrice) <= 0) {
            showToast('견적 금액을 올바르게 입력해주세요. (1 이상)', 'error', true);
            return;
        }
        if (!quoteDescription.trim()) {
            showToast('견적 설명을 입력해주세요.', 'error', true);
            return;
        }

        // [CS 방어] 환불 불가 동의 체크박스 미체크 시 발송 차단 (모달 내부 체크박스 기반)
        if (!agreeNoRefund) {
            return;
        }
        setShowConfirmModal(false);

        setIsSubmitting(true);

        try {
            // [방어 로직] 발송 직전 요청서 최신 상태 재검증 (stale data 방어)
            const { data: latestReq } = await supabase
                .from('match_requests')
                .select('status, quote_count')
                .eq('request_id', requestId)
                .single();

            if (latestReq?.status !== 'OPEN') {
                showToast('이 요청은 이미 마감되었습니다.', 'error');
                setRequest((prev: any) => prev ? { ...prev, status: latestReq?.status, quote_count: latestReq?.quote_count } : prev);
                setIsSubmitting(false);
                return;
            }
            if ((latestReq?.quote_count || 0) >= maxQuotes) {
                showToast('선착순 5명 견적이 모두 마감되었습니다.', 'error');
                setRequest((prev: any) => prev ? { ...prev, quote_count: latestReq?.quote_count } : prev);
                setIsSubmitting(false);
                return;
            }

            // [개선된 단일 트랜잭션 로직: 이미지 우선 다중 업로드 -> RPC 한 번에 호출]
            let imageUrl: string | null = null;
            // ── [확장] 새 File 업로드 URL + 템플릿에서 로드된 기업로드 URL 합산 ──
            let allImageUrls: string[] = [...preloadedImageUrls];

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
                    allImageUrls = [...allImageUrls, ...uploadedUrls];
                } catch (e: any) {
                    console.warn('이미지 업로드 실패:', e.message);
                    throw new Error('이미지 업로드에 실패하여 견적 발송이 취소되었습니다.');
                }
            }

            if (allImageUrls.length > 0) {
                imageUrl = JSON.stringify(allImageUrls);
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
                console.error("RPC Error:", error);
                if (error.message.includes('잔액이 부족합니다')) {
                    // ── [확장 2단계] 화면 이탈 제거 → 인앱 충전 모달 ──
                    setShowChargeModal(true);
                } else if (error.message.includes('이미 초과된') || error.message.includes('정원이 마감된')) {
                    showToast('이미 5명 정원이 마감된 요청입니다.', 'error');
                } else if (error.message.includes('이미 견적을 발송한')) {
                    showToast('이미 이 요청에 견적을 발송하셨습니다.', 'warning');
                } else if (error.message.includes('chk_price_max') || error.message.includes('price')) {
                    showToast('견적 금액은 최대 ₱10,000,000까지 입력 가능합니다.', 'error', true);
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
                    sender_id: sessionUser.id,
                    type: 'QUOTE',
                    message: "새로운 견적이 도착했습니다! 지금 바로 확인해보세요.",
                    reference_id: requestId,
                    is_read: false
                });
            }

            setIsSent(true);
            showToast('견적이 성공적으로 발송되었습니다!', 'success');
            window.dispatchEvent(new CustomEvent('wallet-updated'));
            router.push('/pro/requests');
        } catch (e: any) {
            showToast('오류 발생: ' + e.message, 'error');
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

    const isRequestClosed = request.status === 'MATCHED' || request.status === 'CLOSED' || request.status === 'EXPIRED';
    const isQuoteValid = Number(quotePrice) > 0 && quoteDescription.trim().length > 0;
    const canSubmit = !isSent && !isExpired && !isRequestClosed && request.quote_count < maxQuotes && !isSubmitting && isPriceReady && isQuoteValid;

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
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                            {customerAvatar ? (
                                <img src={customerAvatar} alt="고객 프로필" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                            )}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">{customerName}님의 요청</h1>
                            <p className="text-xs text-gray-500">
                                {request.service_type ? `${request.service_type} | ` : ''}
                                {request.region ? request.region : `카테고리: ${request.category_id} | 지역: ${request.region_id}`}
                            </p>
                        </div>
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
                                                if (value === '상담 시 논의할게요') {
                                                    return <span className="text-blue-500 font-bold bg-blue-50 px-2 py-1 rounded-md">🤝 상담 시 논의할게요</span>;
                                                }
                                                if (value === null || value === undefined || value === '') {
                                                    return <span className="text-gray-400 italic">상담 시 논의 (미입력)</span>;
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
                                placeholder="견적 금액을 입력하세요 (₱)"
                                min="0"
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm font-medium"
                            />
                        </div>

                        {/* 설명 입력 */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-gray-600">견적 설명 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                                <button
                                    onClick={() => setShowTemplatePanel(!showTemplatePanel)}
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                                >
                                    ⭐️ 자주 쓰는 내용 불러오기
                                </button>
                            </div>

                            {/* ── [확장 1단계] 템플릿 패널 ── */}
                            {showTemplatePanel && (
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-2 space-y-2">
                                    {templates.length === 0 ? (
                                        <p className="text-xs text-gray-500 text-center py-2">저장된 템플릿이 없습니다. 아래에서 견적을 작성 후 저장해보세요.</p>
                                    ) : (
                                        templates.map(tpl => (
                                            <div key={tpl.id} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border border-blue-100 shadow-sm">
                                                <button
                                                    onClick={() => {
                                                        // 템스트만 삽입 (금액 절대 미변경)
                                                        setQuoteDescription(tpl.content);
                                                        // ── [확장] 첨부 이미지 동기화 ──
                                                        const tplImgs = tpl.attachments || [];
                                                        setPreloadedImageUrls(tplImgs);
                                                        setQuoteImages([]);  // File 객체 초기화
                                                        setImagePreviews(tplImgs);  // URL을 미리보기로 설정
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                        setShowTemplatePanel(false);
                                                    }}
                                                    className="flex-1 text-left text-sm font-medium text-gray-800 hover:text-blue-600 transition truncate"
                                                    title={tpl.content}
                                                >
                                                    📝 {tpl.title} {(tpl.attachments && tpl.attachments.length > 0) && <span className="text-[10px] text-blue-500 ml-1">🖼️{tpl.attachments.length}</span>}
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`"${tpl.title}" 템플릿을 삭제하시겠습니까?`)) return;
                                                        await supabase.from('pro_quote_templates').delete().eq('id', tpl.id);
                                                        setTemplates(prev => prev.filter(t => t.id !== tpl.id));
                                                    }}
                                                    className="text-xs text-red-400 hover:text-red-600 px-1.5 py-0.5 flex-shrink-0"
                                                >✕</button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            <textarea
                                value={quoteDescription}
                                onChange={e => setQuoteDescription(e.target.value)}
                                rows={3}
                                placeholder="서비스 범위, 포함 사항, 예상 소요 시간 등을 간략히 작성해주세요."
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm resize-none"
                            />

                            {/* ── [확장 1단계] 현재 내용 템플릿으로 저장 ── */}
                            {quoteDescription.trim().length >= 10 && (
                                !showSaveTpl ? (
                                    <button
                                        onClick={() => setShowSaveTpl(true)}
                                        className="mt-2 w-full text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-2.5 rounded-xl transition shadow-sm hover:shadow-md flex items-center justify-center gap-1.5"
                                    >💾 이 내용을 템플릿으로 저장</button>
                                ) : (
                                    <div className="mt-1.5 flex gap-2 items-center">
                                        <input
                                            value={newTplTitle}
                                            onChange={e => setNewTplTitle(e.target.value)}
                                            placeholder="템플릿 이름 (예: 기본 인사말)"
                                            className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                        />
                                        <button
                                            disabled={savingTemplate}
                                            onClick={async () => {
                                                if (!newTplTitle.trim() || !currentProId || savingTemplate) return;
                                                // ── [정책] 고수당 최대 5개 템플릿 제한 ──
                                                if (templates.length >= 5) {
                                                    showToast('템플릿은 최대 5개까지만 저장할 수 있습니다. 기존 템플릿을 삭제 후 다시 시도해주세요.', 'error');
                                                    return;
                                                }
                                                setSavingTemplate(true);
                                                try {
                                                    // ── [버그 수정] 로컬 File 객체를 Storage에 선행 업로드 ──
                                                    let uploadedNewUrls: string[] = [];
                                                    if (quoteImages.length > 0) {
                                                        const uploads = quoteImages.map(async (file) => {
                                                            const tempId = crypto.randomUUID();
                                                            const fileExt = file.name.split('.').pop();
                                                            const filePath = `templates/${currentProId}/${tempId}.${fileExt}`;
                                                            const { error: upErr } = await supabase.storage
                                                                .from('quote_images')
                                                                .upload(filePath, file, { upsert: true });
                                                            if (upErr) throw upErr;
                                                            const { data: pub } = supabase.storage.from('quote_images').getPublicUrl(filePath);
                                                            return pub.publicUrl;
                                                        });
                                                        uploadedNewUrls = await Promise.all(uploads);
                                                    }
                                                    // 기업로드 URL + 새로 업로드된 URL 합산
                                                    const allUrls = [...preloadedImageUrls, ...uploadedNewUrls];

                                                    const { data: newTpl, error } = await supabase.from('pro_quote_templates').insert({
                                                        pro_id: currentProId,
                                                        title: newTplTitle.trim(),
                                                        content: quoteDescription.trim(),
                                                        attachments: allUrls.length > 0 ? allUrls : null,
                                                    }).select('id, title, content, attachments').single();
                                                    if (!error && newTpl) {
                                                        setTemplates(prev => [newTpl, ...prev]);
                                                        // 업로드된 URL로 preloaded 상태 갱신 (다음 저장 시 중복 업로드 방지)
                                                        setPreloadedImageUrls(allUrls);
                                                        setImagePreviews(allUrls);
                                                        setQuoteImages([]);
                                                        setNewTplTitle('');
                                                        setShowSaveTpl(false);
                                                        showToast('템플릿이 저장되었습니다!', 'success');
                                                    } else {
                                                        showToast('저장 실패: ' + (error?.message || ''), 'error');
                                                    }
                                                } catch (e: any) {
                                                    showToast('이미지 업로드 실패: ' + e.message, 'error');
                                                } finally {
                                                    setSavingTemplate(false);
                                                }
                                            }}
                                            className={`text-xs font-bold text-white px-3 py-1.5 rounded-lg transition ${savingTemplate ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                        >{savingTemplate ? '저장 중...' : '저장'}</button>
                                        <button onClick={() => { setShowSaveTpl(false); setNewTplTitle(''); }} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
                                    </div>
                                )
                            )}
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
                    isReviewed ? (
                        <button
                            disabled
                            className="w-full max-w-md mx-auto block font-bold py-4 rounded-xl shadow-none bg-gray-400 text-white cursor-not-allowed"
                        >
                            ✅ 거래 완료된 요청입니다 (채팅 종료)
                        </button>
                    ) : (
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
                    )
                ) : (
                    <button
                        onClick={() => {
                            if (!canSubmit) return;
                            setAgreeNoRefund(false);
                            setShowConfirmModal(true);
                        }}
                        disabled={!canSubmit}
                        className={`w-full max-w-md mx-auto block font-bold py-4 rounded-xl shadow-[0_10px_20px_rgba(37,99,235,0.3)] transition transform hover:-translate-y-1 ${!canSubmit ? 'bg-gray-400 text-white cursor-not-allowed shadow-none hover:translate-y-0' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        {isSubmitting ? '발송 중...' :
                            isRequestClosed ? '이미 마감된 요청입니다' :
                                isExpired ? '시간이 초과되어 마감되었습니다' :
                                    request.quote_count >= maxQuotes ? '선착순 5명 견적이 모두 마감되었습니다' :
                                        !isPriceReady ? '단가 계산 중...' :
                                            !isQuoteValid ? (Number(quotePrice) <= 0 ? '견적 금액을 입력해주세요' : '견적 설명을 입력해주세요') :
                                                `${costToQuote} 캐시로 견적 보내기${quotePrice ? ` (₱${Number(quotePrice).toLocaleString()})` : ''}`}
                    </button>
                )}
            </div>

            {/* 5. 견적 발송 확인 커스텀 모달 (Slide-up) */}
            {
                showConfirmModal && (
                    <div
                        className="fixed inset-0 z-[200] flex items-end justify-center"
                        onClick={(e) => { if (e.target === e.currentTarget) { setShowConfirmModal(false); setAgreeNoRefund(false); } }}
                    >
                        {/* 배경 오버레이 */}
                        <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out]"></div>

                        {/* 모달 본체 (Slide-up, 3단 Flex 레이아웃) */}
                        <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl animate-[slideUp_0.3s_ease-out] max-h-[85dvh] flex flex-col mb-14">

                            {/* ① 상단 헤더 (고정) */}
                            <div className="px-6 pt-5 pb-3 flex-shrink-0">
                                <div className="flex justify-center mb-3">
                                    <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 text-center">견적 발송 확인</h3>
                            </div>

                            {/* ② 중앙 내용부 (스크롤 가능) */}
                            <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
                                {/* 견적 요약 */}
                                <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-500 font-medium">서비스</span>
                                        <span className="text-sm font-bold text-gray-800">{request.service_type || request.categories?.name || '서비스'}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-500 font-medium">견적 금액</span>
                                        <span className="text-lg font-bold text-blue-600">₱ {Number(quotePrice).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm text-gray-500 font-medium">차감 캐시</span>
                                        <span className="text-sm font-bold text-red-500">{costToQuote} 캐시</span>
                                    </div>
                                    {/* ── [확장 2단계] 보유 코인 명시 ── */}
                                    <div className="flex justify-between items-center pt-2 mt-2 border-t border-blue-100">
                                        <span className="text-sm text-gray-500 font-medium">보유 캐시</span>
                                        <span className={`text-sm font-bold ${(myBalance !== null && myBalance < costToQuote) ? 'text-red-500' : 'text-green-600'}`}>
                                            {myBalance !== null ? `${myBalance.toLocaleString()} 캐시` : '조회 중...'}
                                            {myBalance !== null && myBalance < costToQuote && (
                                                <span className="ml-1 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">부족</span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* 환불 정책 안내 */}
                                <div className="bg-yellow-50 rounded-xl p-3.5 mb-2 border border-yellow-200">
                                    <p className="text-xs text-gray-700 leading-relaxed break-keep">
                                        💡 정상적으로 발송된 견적은 고객이 타 전문가를 채택하여 마감되더라도 <strong className="text-red-600">사용된 캐시가 환불되지 않습니다.</strong>
                                    </p>
                                </div>
                                {/* 보너스 환급 안내 */}
                                <div className="bg-green-50 rounded-xl p-3.5 mb-4 border border-green-200">
                                    <p className="text-xs text-gray-700 leading-relaxed break-keep">
                                        🎁 단, 고객이 48시간 내에 견적을 <strong className="text-green-700">읽지 않거나</strong>, 미열람 상태로 타 전문가와 매칭될 경우 사용된 캐시는 <strong className="text-green-700">100% 보너스 캐시로 환급</strong>됩니다.
                                    </p>
                                </div>

                                {/* 필수 동의 체크박스 */}
                                <label className="flex items-start gap-2.5 px-3 py-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={agreeNoRefund}
                                        onChange={(e) => setAgreeNoRefund(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                                    />
                                    <span className="text-xs text-gray-700 font-medium leading-relaxed break-keep">
                                        위 내용을 확인했으며 결제에 동의합니다.
                                    </span>
                                </label>
                            </div>

                            {/* ③ 하단 버튼부 (고정, 스크롤 무관) */}
                            <div className="flex-shrink-0 px-6 pb-6 pt-3 bg-white border-t border-gray-100 rounded-b-none">
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => { setShowConfirmModal(false); setAgreeNoRefund(false); }}
                                        className="flex-1 py-3.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition text-sm"
                                    >
                                        취소
                                    </button>
                                    <button
                                        onClick={handleSendQuote}
                                        disabled={!agreeNoRefund || isSubmitting}
                                        className={`flex-[2] py-3.5 rounded-xl font-bold transition text-sm shadow-md ${!agreeNoRefund || isSubmitting ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_4px_12px_rgba(37,99,235,0.4)]'}`}
                                    >
                                        {isSubmitting ? '발송 중...' : `${costToQuote} 캐시로 견적 보내기`}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 모달 애니메이션 키프레임 */}
            <style jsx>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>

            {/* ── [확장 2단계] 인앱 충전 모달 (화면 이탈 제로) ── */}
            {
                showChargeModal && (
                    <div
                        className="fixed inset-0 z-[300] flex items-end justify-center"
                        onClick={(e) => { if (e.target === e.currentTarget) setShowChargeModal(false); }}
                    >
                        <div className="absolute inset-0 bg-black/50 animate-[fadeIn_0.2s_ease-out]"></div>
                        <div className="relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl animate-[slideUp_0.3s_ease-out] p-6 mb-14">
                            <div className="flex justify-center mb-3">
                                <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
                            </div>
                            <div className="text-center mb-4">
                                <span className="text-4xl mb-2 block">💰</span>
                                <h3 className="text-lg font-bold text-gray-900">캐시가 부족합니다</h3>
                                <p className="text-sm text-gray-500 mt-1">견적 발송에 <strong className="text-red-500">{costToQuote} 캐시</strong>가 필요합니다.</p>
                                <p className="text-sm text-gray-500">현재 잔액: <strong className={`${(myBalance || 0) < costToQuote ? 'text-red-500' : 'text-green-600'}`}>{(myBalance || 0).toLocaleString()} 캐시</strong></p>
                            </div>
                            <div className="flex flex-col gap-2.5">
                                {[10000, 30000, 50000].map((amount, i) => (
                                    <button
                                        key={amount}
                                        onClick={async () => {
                                            if (!currentProId) return;
                                            showToast('GCash/Maya 결제 모듈 호출 예정 (가상 결제 진행)', 'info');
                                            const { data: newBalance, error } = await supabase.rpc('charge_pro_cash', {
                                                p_pro_id: currentProId,
                                                p_amount: amount
                                            });
                                            if (error) { showToast('충전 실패: ' + error.message, 'error'); return; }
                                            showToast(`${amount.toLocaleString()} 캐시가 충전되었습니다!`, 'success');
                                            setMyBalance(newBalance);
                                            setShowChargeModal(false);
                                            window.dispatchEvent(new Event('wallet-updated'));
                                        }}
                                        className={`w-full font-bold py-3.5 rounded-xl border transition text-base ${i === 2 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md border-blue-600' :
                                            i === 1 ? 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300' :
                                                'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                                            }`}
                                    >
                                        {amount.toLocaleString()} 캐시 충전 {i === 2 && <span className="text-sm bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full ml-1">BEST</span>}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowChargeModal(false)}
                                className="w-full mt-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition text-sm"
                            >나중에 할게요</button>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
