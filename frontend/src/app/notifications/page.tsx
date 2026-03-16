'use client';
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NotificationsPage() {
    const t = useTranslations();
    const router = useRouter();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    useEffect(() => {
        let notifChannel: any;

        const fetchNotifications = async () => {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (authError || !sessionUser) {
                router.replace('/');
                return;
            }
            setCurrentUser({ id: sessionUser.id });

            const threeDaysAgo = new Date();
            threeDaysAgo.setHours(threeDaysAgo.getHours() - 72);

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', sessionUser.id)
                .not('type', 'in', '("CHAT","MATCH","QUOTE")')
                .gte('created_at', threeDaysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (data && data.length > 0) {
                const senderIds = Array.from(
                    new Set(data.map(n => n.sender_id).filter(Boolean))
                );

                if (senderIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('user_id, name, nickname, avatar_url')
                        .in('user_id', senderIds);

                    if (usersData) {
                        const senderMap: Record<string, any> = {};

                        usersData.forEach(u => {
                            senderMap[u.user_id] = {
                                name:
                                    u.nickname && u.nickname.trim() !== ''
                                        ? u.nickname
                                        : u.name || 'Unknown',
                                avatar: u.avatar_url || null
                            };
                        });

                        const enrichedData = data.map(n => ({
                            ...n,
                            sender: n.sender_id ? senderMap[n.sender_id] : null
                        }));

                        setNotifications(enrichedData);
                        setLoading(false);
                        return;
                    }
                }

                setNotifications(data);
            }
            setLoading(false);

            // Supabase 구독: UPDATE만 수신 (INSERT는 ClientLayout의 CustomEvent로 수신 → 이중 구독 방지)
            notifChannel = supabase.channel('realtime:notifications_page')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${sessionUser.id}` }, (payload) => {
                    const updatedNotif = payload.new as any;
                    setNotifications(prev => prev.map(n => n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n));
                })
                .subscribe();
        };

        // ClientLayout에서 브로드캐스트된 새 알림 수신 (단일 이벤트 소스 패턴)
        const handleNewNotification = async (e: Event) => {
            const newNotif = (e as CustomEvent).detail;
            if (!newNotif || ['CHAT', 'MATCH', 'QUOTE'].includes(newNotif.type)) return;

            // sender_id가 있고 아직 sender 객체가 매핑되지 않은 경우 DB에서 즉시 조회
            if (newNotif.sender_id && !newNotif.sender) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('name, nickname, avatar_url')
                    .eq('user_id', newNotif.sender_id)
                    .single();

                if (userData) {
                    newNotif.sender = {
                        name: (userData.nickname && userData.nickname.trim() !== '') ? userData.nickname : (userData.name || 'Unknown'),
                        avatar: userData.avatar_url || null
                    };
                }
            }

            setNotifications(prev => {
                // 중복 방지
                if (prev.some(n => n.id === newNotif.id)) return prev;
                return [newNotif, ...prev];
            });
        };

        window.addEventListener('notification-inserted', handleNewNotification);
        fetchNotifications();

        return () => {
            if (notifChannel) {
                supabase.removeChannel(notifChannel);
            }
            window.removeEventListener('notification-inserted', handleNewNotification);
        };
    }, []);

    const markAsRead = async (id: string) => {
        if (!currentUser) return;

        await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        window.dispatchEvent(new Event('notifications-updated'));
    };

    const handleNotificationClick = async (notif: any) => {
        if (!notif.is_read) {
            await markAsRead(notif.id);
        }

        // [핵심] 알림 클릭 시 관련 GNB 뱃지도 연동 소멸
        if (notif.type === 'MATCH') {
            window.dispatchEvent(new Event('requests-read')); // 받은요청 뱃지 소멸
        } else if (notif.type === 'QUOTE') {
            window.dispatchEvent(new Event('quotes-read')); // 받은견적 뱃지 소멸
        }

        if (!notif.reference_id) {
            console.error('Routing failed: reference_id is missing for notification', notif.id);
            return;
        }

        // 라우팅 로직
        if (notif.type === 'MATCH') {
            router.push(`/pro/requests/${notif.reference_id}`);
        } else if (notif.type === 'QUOTE') {
            router.push(`/quotes/received?requestId=${notif.reference_id}`);
        } else if (notif.type === 'MATCH_SUCCESS') {
            // reference_id = request_id → 해당 채팅방 조회 후 이동
            const { data: room } = await supabase
                .from('chat_rooms')
                .select('room_id')
                .eq('request_id', notif.reference_id)
                .single();
            if (room?.room_id) {
                router.push(`/chat/${room.room_id}`);
            } else {
                router.push('/chat');
            }
        } else if (notif.type === 'SYSTEM' && notif.message?.includes('리뷰를 남겼습니다')) {
            router.push('/pro/reviews');
        } else if (notif.type === 'SYSTEM' && notif.message?.includes('1:1 문의 답변')) {
            router.push('/support/inquiry?tab=history');
        }
    };

    const deleteNotification = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
        setOpenMenuId(null);
    };

    const toggleMenu = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setOpenMenuId(prev => prev === id ? null : id);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'MATCH': return '📋';
            case 'QUOTE': return '📩';
            case 'SYSTEM':
            case 'BILLING': return '⚙️';
            case 'MATCH_SUCCESS': return '🎉';
            default: return '🔔';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col" onClick={() => setOpenMenuId(null)}>
            <header className="bg-white p-4 border-b border-gray-100 sticky top-0 z-10 flex justify-between items-center">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    {t('notifications.title')}
                </h1>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {loading ? (
                    <div className="text-center py-10 text-gray-400">{t('notifications.loading')}</div>
                ) : !currentUser ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
                        <p>{t('notifications.loginRequired')}</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
                        <p>{t('notifications.empty')}</p>
                    </div>
                ) : (
                    notifications.map(notif => (
                        <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`relative p-4 rounded-xl shadow-sm border transition cursor-pointer flex gap-3 ${notif.is_read ? 'bg-white border-gray-100 opacity-75' : 'bg-blue-50 border-blue-100'}`}
                        >
                            <div className="flex-shrink-0 relative mt-1">
                                {notif.sender?.avatar ? (
                                    <img
                                        src={notif.sender.avatar}
                                        alt="Profile"
                                        className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm bg-white"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center border border-blue-200 shadow-sm">
                                        <span className="text-xl">{getIcon(notif.type)}</span>
                                    </div>
                                )}

                                {!notif.is_read && (
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0 pl-1 pr-6">
                                {notif.sender && (
                                    <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">
                                        {notif.sender.name}
                                    </p>
                                )}

                                <p
                                    className={`text-sm ${notif.is_read ? 'text-gray-500' : 'text-gray-800 font-medium'
                                        } line-clamp-2`}
                                >
                                    {notif.message}
                                </p>

                                <p className="text-xs text-gray-400 mt-1.5">
                                    {new Date(notif.created_at).toLocaleString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>

                            {/* 점 3개 메뉴 버튼 */}
                            <button
                                onClick={(e) => toggleMenu(e, notif.id)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
                            >
                                ⋮
                            </button>

                            {/* 삭제 팝업 */}
                            {openMenuId === notif.id && (
                                <div className="absolute top-10 right-4 bg-white border border-gray-200 shadow-md rounded-lg py-1 z-20">
                                    <button
                                        onClick={(e) => deleteNotification(e, notif.id)}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50 font-medium"
                                    >
                                        {t('notifications.delete')}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
