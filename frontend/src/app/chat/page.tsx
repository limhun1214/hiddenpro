'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChatListPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [lastMessageMap, setLastMessageMap] = useState<Record<string, string>>({});

    const formatChatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

        if (isToday) {
            return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (isYesterday) {
            return '어제';
        } else {
            return `${date.getMonth() + 1}월 ${date.getDate()}일`;
        }
    };

    const fetchChatRooms = React.useCallback(async () => {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (authError || !sessionUser) {
                router.replace('/');
                return;
            }

            const userId = sessionUser.id;
            setCurrentUserId(userId);

            // [사용자 요구사항]: 렌더링 시 현재 로그인된 사용자의 명확한 role 확인
            const { data: roleData } = await supabase.from('users').select('role').eq('user_id', userId).single();
            console.log("Current Verified Role:", roleData?.role?.toUpperCase() || 'UNKNOWN');

            const { data: roomsData, error: roomsError } = await supabase
                .from('chat_rooms')
                .select(`room_id, status, created_at, customer_id, pro_id`)
                .or(`customer_id.eq.${userId},pro_id.eq.${userId}`)
                .order('created_at', { ascending: false });

            if (roomsError) {
                console.error("채팅방 목록 로드 실패:", roomsError);
                setErrorMsg(roomsError.message);
                setLoading(false);
                return;
            }

            if (roomsData && roomsData.length > 0) {
                const userIds = new Set<string>();
                roomsData.forEach(r => {
                    if (r.customer_id) userIds.add(r.customer_id);
                    if (r.pro_id) userIds.add(r.pro_id);
                });

                const { data: usersData } = await supabase
                    .from('users')
                    .select('user_id, name, nickname, avatar_url') // avatar_url 추가
                    .in('user_id', Array.from(userIds));

                const userMap: Record<string, string> = {};
                const avatarMap: Record<string, string | null> = {}; // 아바타 맵 추가
                if (usersData) {
                    usersData.forEach(u => {
                        userMap[u.user_id] = (u.nickname && u.nickname.trim() !== '') ? u.nickname : (u.name || '알 수 없음');
                        avatarMap[u.user_id] = u.avatar_url || null; // 아바타 저장
                    });
                }

                // [추가 로직] 안 읽은 메시지 개수를 단일 쿼리로 일괄 조회
                const roomIds = roomsData.map(r => r.room_id);

                const { data: unreadData } = await supabase
                    .from('chat_messages')
                    .select('room_id')
                    .in('room_id', roomIds)
                    .neq('sender_id', userId)
                    .eq('is_read', false);

                const unreadMap: Record<string, number> = {};
                if (unreadData) {
                    unreadData.forEach(msg => {
                        unreadMap[msg.room_id] = (unreadMap[msg.room_id] || 0) + 1;
                    });
                }

                const mappedRooms = roomsData.map(room => ({
                    ...room,
                    customer_name: userMap[room.customer_id] || '고객',
                    pro_name: userMap[room.pro_id] || '고수',
                    customer_avatar: avatarMap[room.customer_id] || null, // 고객 아바타 추가
                    pro_avatar: avatarMap[room.pro_id] || null, // 고수 아바타 추가
                    unread_count: unreadMap[room.room_id] || 0
                }));

                // 각 채팅방의 마지막 메시지 일괄 조회 (N+1 방지)
                const { data: lastMsgsData } = await supabase
                    .from('chat_messages')
                    .select('room_id, content, message_type, created_at')
                    .in('room_id', roomIds)
                    .order('created_at', { ascending: false });

                const lastMsgMap: Record<string, string> = {};
                if (lastMsgsData) {
                    lastMsgsData.forEach(msg => {
                        if (!lastMsgMap[msg.room_id]) {
                            // 시스템 메시지는 별도 표시
                            if (msg.message_type === 'SYSTEM' || msg.message_type === 'SYSTEM_CLOSE' || msg.message_type === 'SYSTEM_REVIEWED' || msg.message_type === 'SYSTEM_PRIVATE') {
                                lastMsgMap[msg.room_id] = '📢 시스템 메시지';
                            } else if (msg.content === 'IMAGE') {
                                lastMsgMap[msg.room_id] = '🖼️ 사진';
                            } else {
                                lastMsgMap[msg.room_id] = msg.content || '';
                            }
                        }
                    });
                }
                setLastMessageMap(lastMsgMap);

                mappedRooms.sort((a, b) => {
                    if (a.unread_count > 0 && b.unread_count === 0) return -1;
                    if (a.unread_count === 0 && b.unread_count > 0) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });

                console.log("Mapped Rooms Result:", JSON.stringify(mappedRooms, null, 2));
                setRooms(mappedRooms);
            } else {
                setRooms([]);
            }
            setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchChatRooms();
    }, [fetchChatRooms]);

    // [추가 로직] 채팅방에서 읽고 목록으로 복귀 시 unread_count 갱신
    useEffect(() => {
        const handleChatRead = () => {
            fetchChatRooms();
        };
        window.addEventListener('chat-read', handleChatRead);
        return () => {
            window.removeEventListener('chat-read', handleChatRead);
        };
    }, [fetchChatRooms]);

    // [추가 로직] 실시간 새 메시지 감지 및 UI 자동 재정렬
    useEffect(() => {
        if (!currentUserId || rooms.length === 0) return;

        const chatListChannel = supabase.channel('realtime:chat_list')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver_id=eq.${currentUserId}` },
                (payload) => {
                    const newMsg = payload.new as any;

                    setRooms(prevRooms => {
                        // 1. 해당 방의 unread_count 증가
                        const updatedRooms = prevRooms.map(room => {
                            if (room.room_id === newMsg.room_id) {
                                return { ...room, unread_count: (room.unread_count || 0) + 1 };
                            }
                            return room;
                        });

                        // 2. 안 읽은 방을 최상단으로 즉시 재정렬
                        return updatedRooms.sort((a, b) => {
                            if (a.unread_count > 0 && b.unread_count === 0) return -1;
                            if (a.unread_count === 0 && b.unread_count > 0) return 1;
                            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                        });
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(chatListChannel);
        };
    }, [currentUserId, rooms.length]);

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">채팅방 목록을 불러오는 중...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-4 py-4">
                    <h1 className="text-xl font-black text-gray-900">채팅</h1>
                </div>
                {/* 안내 배너 */}
                <div className="mx-4 mb-3 bg-blue-50 text-blue-700 px-3 py-2 rounded-xl text-xs flex items-center gap-2">
                    <span>💡</span>
                    <span>안전한 거래를 위해 대화 내역은 90일 보관 후 자동 삭제됩니다.</span>
                </div>
            </div>

            {errorMsg && (
                <div className="mx-4 mt-3 text-red-500 text-sm bg-red-50 p-3 rounded-xl border border-red-100">
                    데이터 조회 오류: {errorMsg}
                </div>
            )}

            {/* 채팅방 목록 */}
            {!errorMsg && rooms.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-3xl">💬</div>
                    <p className="text-sm font-medium">아직 채팅방이 없습니다.</p>
                </div>
            ) : (
                <ul className="flex-1 divide-y divide-gray-100">
                    {rooms.map((room) => {
                        const partnerName = room.pro_id === currentUserId ? (room.customer_name || '이름 없음') : (room.pro_name || '이름 없음');
                        const partnerAvatar = room.pro_id === currentUserId ? room.customer_avatar : room.pro_avatar;
                        const unread = room.unread_count || 0;
                        const isClosed = room.status === 'CLOSED';

                        return (
                            <li key={room.room_id}>
                                <Link
                                    href={`/chat/${room.room_id}`}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition"
                                >
                                    {/* 아바타 */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                                            {partnerAvatar ? (
                                                <img src={partnerAvatar} alt="프로필" className="w-full h-full object-cover" />
                                            ) : (
                                                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            )}
                                        </div>
                                        {/* 종료됨 오버레이 */}
                                        {isClosed && (
                                            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center">
                                                <span className="text-white text-[9px] font-bold">종료</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 이름 + 마지막 메시지 영역 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className={`text-[15px] font-bold truncate ${isClosed ? 'text-gray-400' : 'text-gray-900'}`}>
                                                {partnerName}님
                                            </span>
                                            {isClosed && (
                                                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">종료</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                                            {isClosed
                                                ? (lastMessageMap[room.room_id] || '🔒 종료된 채팅방입니다.')
                                                : (lastMessageMap[room.room_id] || (room.status === 'MATCHED' ? '🤝 매칭이 성사되었습니다.' : '대화를 시작해보세요.'))}
                                        </p>
                                    </div>

                                    {/* 시간 + 뱃지 */}
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <span className="text-[11px] text-gray-400">{formatChatTime(room.created_at)}</span>
                                        {unread > 0 ? (
                                            <span className="min-w-[20px] h-5 bg-red-500 text-white text-[11px] font-black px-1.5 rounded-full flex items-center justify-center">
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        ) : room.status === 'MATCHED' ? (
                                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">매칭 성사</span>
                                        ) : !isClosed ? (
                                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">진행 중</span>
                                        ) : null}
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
