'use client';

import React, { useState, useEffect } from 'react';
import QuoteDetailModal from '../customer/QuoteDetailModal';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';

// API 연동 전 UI 로직 테스트를 위한 모의 데이터 세팅
const mockRoomData = {
    id: 'room_123',
    opponentName: '김고수',
    opponentProfileImg: '/default-avatar.png',
    quoteAmount: 150000,
    initialStatus: 'OPEN', // DB의 room_status: 'OPEN' | 'MATCHED' | 'CLOSED'
    isCustomer: true, // 고객(CUSTOMER) 권한 여부 (리뷰 권한 체크용)
};

export default function ChatRoom({ roomId }: { roomId: string }) {
    const t = useTranslations();
    const [status, setStatus] = useState(mockRoomData.initialStatus);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<{ id: number; text: string; sender: 'me' | 'other' }[]>([]);
    const [showWarning, setShowWarning] = useState(false);

    // 견적 상세 모달 관련 상태 추가
    const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
    const [quoteData, setQuoteData] = useState<any>(null);
    const [requestData, setRequestData] = useState<any>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // 신고 기능 state
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    // 채팅방 데이터 로드 (room_id 기반)
    useEffect(() => {
        const loadChatRoomData = async () => {
            if (!roomId) return;
            const { data: authData } = await supabase.auth.getUser();
            if (authData?.user) setCurrentUserId(authData.user.id);
            const { data: room, error: roomError } = await supabase
                .from('chat_rooms')
                .select('request_id, pro_id, customer_id')
                .eq('room_id', roomId)
                .single();

            if (roomError || !room) return;

            const { data: quote, error: quoteError } = await supabase
                .from('match_quotes')
                .select('*')
                .eq('request_id', room.request_id)
                .eq('pro_id', room.pro_id)
                .single();

            if (!quoteError && quote) {
                setQuoteData(quote);
            }

            const { data: request, error: requestError } = await supabase
                .from('match_requests')
                .select('*')
                .eq('request_id', room.request_id)
                .single();

            if (!requestError && request) {
                setRequestData(request);
                // DB의 실제 상태를 프론트 state에 반영
                if (request.status === 'MATCHED') {
                    setStatus('MATCHED');
                }
            }
        };
        loadChatRoomData();
    }, [roomId]);


    // 1. 우회 차단 정규식: 연속된 숫자 7자리 이상(전화번호, 계좌번호 패턴) 감지
    const bypassRegex = /(\d{7,})/gi;

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        // 공백과 하이픈(-)을 제거한 뒤 정규식 검사 수행
        const normalizedMessage = message.replace(/[\s-]/g, '');
        if (bypassRegex.test(normalizedMessage) || bypassRegex.test(message)) {
            setShowWarning(true); // 외부 거래 우회 패턴 감지 시 경고 모달 노출
            return;
        }

        // 정상 통화 패턴일 경우 상태 배열에 추가
        setMessages([...messages, { id: Date.now(), text: message, sender: 'me' }]);
        setMessage('');
    };

    const handleMatchConfirm = async () => {
        const confirmed = window.confirm(t('chatRoom.matchConfirm'));
        if (!confirmed || !currentUserId) return;

        const { data, error } = await supabase.rpc('confirm_match', {
            p_room_id: roomId,
            p_customer_id: currentUserId,
        });

        if (error) {
            console.error('매칭 확정 RPC 에러:', error);
            alert(t('chatRoom.matchError'));
            return;
        }

        const result = typeof data === 'string' ? JSON.parse(data) : data;
        if (!result.success) {
            alert(result.error || t('chatRoom.matchError'));
            return;
        }

        setStatus('MATCHED');
        alert(t('chatRoom.matchSuccess'));
    };

    const handleSubmitReport = async () => {
        if (!reportReason.trim() || !currentUserId) return;
        setReportSubmitting(true);
        const { error } = await supabase.from('reports').insert({
            room_id: roomId,
            reporter_id: currentUserId,
            reported_user_id: mockRoomData.isCustomer ? 'pro_placeholder' : 'customer_placeholder',
            reason: reportReason.trim(),
            status: 'pending',
        });
        setReportSubmitting(false);
        if (error) {
            alert(t('chatRoom.reportError') + error.message);
        } else {
            setShowReportModal(false);
            setReportReason('');
            alert(t('chatRoom.reportSuccess'));
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 relative">

            {/* 1. 상단 고정 패널 (프로필, 견적 금액 및 매칭 확정) */}
            <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 shadow-sm">

                {/* 1행: 아바타 + 이름 / 우측 액션 버튼 묶음 */}
                <div className="flex items-center justify-between">

                    {/* 좌측: 아바타 + 이름 */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 font-bold shrink-0">
                            고
                        </div>
                        <h2 className="font-bold text-gray-800 text-sm">
                            {mockRoomData.opponentName}{t('chatRoom.proSuffix')}
                        </h2>
                    </div>

                    {/* 우측: 견적/요청 상세 + 신고 버튼 묶음 */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsQuoteModalOpen(true)}
                            className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold px-3 py-1.5 rounded-lg text-xs shadow-sm transition"
                        >
                            {t('chatRoom.quoteDetailBtn')}
                        </button>
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="bg-white border border-red-200 hover:bg-red-50 text-red-500 font-semibold px-3 py-1.5 rounded-lg text-xs shadow-sm transition"
                        >
                            {t('chatRoom.reportBtn')}
                        </button>
                    </div>
                </div>

                {/* 2행: 견적 금액(좌) + 매칭 상태 배지(우) */}
                <div className="flex items-center justify-between mt-2.5">

                    {/* 좌측: 제안된 견적 금액 */}
                    <div>
                        <span className="text-xs text-gray-400 block leading-none mb-0.5">{t('chatRoom.proposedQuote')}</span>
                        <span className="text-sm font-bold text-blue-600">
                            ₱ {quoteData ? quoteData.price?.toLocaleString() : mockRoomData.quoteAmount.toLocaleString()}
                        </span>
                    </div>

                    {/* 우측: 상태에 따른 배지 또는 확정 버튼 */}
                    {status === 'OPEN' ? (
                        <button
                            onClick={handleMatchConfirm}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition shadow-sm"
                        >
                            {t('chatRoom.confirmBtn')}
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 font-semibold px-3 py-1.5 rounded-lg text-xs border border-green-200">
                            {t('chatRoom.dealDone')}
                        </span>
                    )}
                </div>
            </div>

            {/* 2. 채팅 메시지 리스트 컨테이너 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-36">
                {messages.map(msg => {
                    const renderMessageWithLinks = (text: string, isMine: boolean) => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        if (!text) return '';
                        const parts = text.split(urlRegex);
                        return parts.map((part, i) => {
                            if (part.match(urlRegex)) {
                                return (
                                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`underline break-all transition-colors ${isMine ? 'text-white font-bold hover:text-blue-200' : 'text-blue-600 font-bold hover:text-blue-800'}`}>
                                        {part}
                                    </a>
                                );
                            }
                            return part;
                        });
                    };

                    return (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl p-3 text-sm shadow-sm whitespace-pre-wrap leading-relaxed ${msg.sender === 'me' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-gray-200 rounded-tl-none text-gray-800'}`}>
                                {renderMessageWithLinks(msg.text, msg.sender === 'me')}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 3. 하단 UI: 입력 폼 및 리뷰 작성 버튼 영역 */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex flex-col space-y-3 pb-8">

                {/* [기획 핵심] 매칭 완료 상태 & 고객 권한을 동시에 만족할 때만 리뷰 버튼 노출 */}
                {status === 'MATCHED' && mockRoomData.isCustomer && (
                    <button className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold py-3 text-sm rounded-xl shadow-md transition transform hover:-translate-y-0.5 animate-bounce">
                        {t('chatRoom.leaveReview')}
                    </button>
                )}

                {/* 텍스트 입력창은 항상 노출 (MATCHED 상태여도 추가 대화 가능 가정) */}
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 bg-gray-100 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl px-4 py-2 outline-none text-sm transition"
                        placeholder={t('chatRoom.inputPlaceholder')}
                    />
                    <button
                        type="submit"
                        className="bg-gray-800 hover:bg-gray-700 text-white px-4 rounded-xl font-bold text-sm transition"
                    >
                        {t('chatRoom.sendBtn')}
                    </button>
                </form>
            </div>

            {/* 4. 우회 차단 경고 모달 (Anti-bypass Warning) */}
            {showWarning && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-red-500 text-2xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('chatRoom.bypassTitle')}</h3>
                        <p className="text-red-600 text-sm font-medium mb-3">
                            {t('chatRoom.bypassDesc')}
                        </p>
                        <p className="text-gray-500 text-xs mb-6">
                            {t('chatRoom.bypassSub')}
                        </p>
                        <button
                            onClick={() => { setShowWarning(false); setMessage(''); }}
                            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl transition"
                        >
                            {t('chatRoom.bypassConfirm')}
                        </button>
                    </div>
                </div>
            )}

            {isQuoteModalOpen && quoteData && requestData && (
                <QuoteDetailModal
                    quote={quoteData}
                    request={requestData}
                    requestId={requestData.request_id}
                    isReadOnly={true}
                    onClose={() => setIsQuoteModalOpen(false)}
                    onStartChat={() => { }}
                />
            )}

            {showReportModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">{t('chatRoom.reportTitle')}</h3>
                        <p className="text-xs text-gray-400 mb-4">{t('chatRoom.reportDesc')}</p>
                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder={t('chatRoom.reportPlaceholder')}
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <div className="flex gap-2 mt-4">
                            <button
                                onClick={() => { setShowReportModal(false); setReportReason(''); }}
                                className="flex-1 border border-gray-200 text-gray-600 font-bold py-2 rounded-xl text-sm hover:bg-gray-50 transition"
                            >
                                {t('chatRoom.reportCancel')}
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                disabled={reportSubmitting || !reportReason.trim()}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50 transition"
                            >
                                {reportSubmitting ? t('chatRoom.reportSubmitting') : t('chatRoom.reportSubmitBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
