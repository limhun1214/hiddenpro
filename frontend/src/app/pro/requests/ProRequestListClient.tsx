'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import BadgeCleaner from '@/components/BadgeCleaner';
import { useTranslations } from 'next-intl';

export default function ProRequestListClient() {
    const t = useTranslations();
    const router = useRouter();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isAcceptingRequests, setIsAcceptingRequests] = useState<boolean>(true);
    const [requests, setRequests] = useState<any[]>([]);
    const [quotedRequestIds, setQuotedRequestIds] = useState<string[]>([]);
    const [proQuotes, setProQuotes] = useState<any[]>([]);
    const [filterType, setFilterType] = useState<'NEW' | 'QUOTED'>('NEW');
    const [quotedSubTab, setQuotedSubTab] = useState<'IN_PROGRESS' | 'ARCHIVED'>('IN_PROGRESS');
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [customerVerifiedMap, setCustomerVerifiedMap] = useState<Record<string, boolean>>({});
    const [customerNameMap, setCustomerNameMap] = useState<Record<string, string>>({});
    const [customerAvatarMap, setCustomerAvatarMap] = useState<Record<string, string | null>>({});
    const [reviewedRequestIds, setReviewedRequestIds] = useState<Set<string>>(new Set());
    const [readRequestIds, setReadRequestIds] = useState<Set<string>>(new Set());
    // ── [확장] 3-15-0 어뷰징 적발 고객 ID 맵 ──
    const [flaggedCustomerIds, setFlaggedCustomerIds] = useState<Set<string>>(new Set());

    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        try {
            const stored = localStorage.getItem('read_requests');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    setReadRequestIds(new Set(parsed));
                }
            }
        } catch (error) {
            console.error('Failed to parse read_requests from localStorage', error);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchRequests = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (sessionUser) {
                setCurrentUserId(sessionUser.id);
                const { data: quotesData } = await supabase
                    .from('match_quotes')
                    .select('request_id, status, is_read, created_at')
                    .eq('pro_id', sessionUser.id);

                if (quotesData) {
                    setProQuotes(quotesData);
                    const qIds = quotesData.map(q => q.request_id);
                    setQuotedRequestIds(qIds);

                    const { data: reviewsData } = await supabase
                        .from('reviews')
                        .select('room_id')
                        .eq('pro_id', sessionUser.id);

                    if (reviewsData && reviewsData.length > 0) {
                        const roomIds = reviewsData.map(r => r.room_id);
                        const { data: roomsData } = await supabase
                            .from('chat_rooms')
                            .select('request_id')
                            .in('room_id', roomIds);
                        if (roomsData) {
                            setReviewedRequestIds(new Set(roomsData.map(r => r.request_id)));
                        }
                    }

                    // 1. 고수 프로필 선 조회 (제공 서비스, 활동 지역 파악)
                    const { data: proProfile, error: profileError } = await supabase
                        .from('pro_profiles')
                        .select('services, region, is_accepting_requests, category_ids')
                        .eq('pro_id', sessionUser.id)
                        .single();

                    if (profileError) {
                        console.warn('⚠️ 프로필 조회 실패 (RLS 또는 스키마 문제):', profileError.message);
                    }

                    setIsAcceptingRequests(proProfile?.is_accepting_requests !== false);
                    const proServices: string[] = proProfile?.services || [];
                    const proRegion: string = proProfile?.region || '';
                    const isNationwide = proRegion.includes('전체');

                    // 고수 가입 시각을 users 테이블에서 안전하게 조회 (pro_profiles에는 created_at이 없을 수 있음)
                    let proCreatedAt: string | null = null;
                    const { data: userData } = await supabase
                        .from('users')
                        .select('created_at')
                        .eq('user_id', sessionUser.id)
                        .single();
                    if (userData) proCreatedAt = userData.created_at;

                    // 2. 고객 요청 투 트랙(Two-Track) 패칭 로직
                    let biddedRequests: any[] = [];
                    let matchingOpenRequests: any[] = [];

                    // Track A: 기존에 견적을 보낸(참여한) 요청건 무조건 조회 (qIds가 있을 경우)
                    if (qIds.length > 0) {
                        const { data: biddedData } = await supabase
                            .from('match_requests')
                            .select('*, categories(name)')
                            .in('request_id', qIds);
                        if (biddedData) biddedRequests = biddedData;
                    }

                    // ── 프로필 완성도 가드 ──
                    // 프로필이 정상 로드되었고 서비스·지역이 미설정인 경우에만 차단
                    // 프로필 로드 실패(RLS 등) 시에는 차단하지 않고 서비스 필터 없이 진행
                    const profileLoaded = !profileError && proProfile !== null;
                    const proCategoryIds = proProfile?.category_ids || [];
                    const isProfileIncomplete = profileLoaded && (proServices.length === 0 && proCategoryIds.length === 0) || proRegion.trim() === '';

                    if (!isProfileIncomplete) {
                        // Track B: 현재 프로필에 맞는 신규(OPEN) 요청건 조회
                        let openQuery = supabase.from('match_requests').select('*, categories(name)').eq('status', 'OPEN');

                        // 서비스 타입 필터 (프로필이 정상 로드된 경우에만 적용)
                        if (profileLoaded) {
                            if (proCategoryIds.length > 0) {
                                // PostgreSQL 배열 연산자로 IN 같은 효과 (any)
                                openQuery = openQuery.in('category_id', proCategoryIds);
                            } else if (proServices.length > 0) {
                                openQuery = openQuery.in('service_type', proServices);
                            }
                        }

                        // ── 타임스탬프 필터: 고수 가입 시점 이후에 생성된 요청만 조회 ──
                        if (proCreatedAt) {
                            openQuery = openQuery.gte('created_at', proCreatedAt);
                        }

                        const { data: openData } = await openQuery;

                        if (openData) {
                            if (!profileLoaded || isNationwide) {
                                matchingOpenRequests = openData;
                            } else {
                                const mainRegion = proRegion.split(',')[0].trim();
                                // [양방향 크로스 매칭]: 고수가 특정 지역이더라도, 고객 요청이 '전체'인 경우 포함
                                matchingOpenRequests = openData.filter(req => {
                                    const reqRegion = req.region || '';
                                    return reqRegion.includes('전체') || reqRegion.includes(mainRegion);
                                });
                            }
                        }
                    }

                    // 3. 데이터 병합(Merge), 중복 제거(Dedup) 및 최신순 정렬
                    const combined = [...biddedRequests, ...matchingOpenRequests];
                    const uniqueRequests = Array.from(new Map(combined.map(item => [item.request_id, item])).values());
                    const sortedData = uniqueRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    const data = sortedData;
                    if (data) {
                        setRequests(data);
                        // 고객 인증 상태 일괄 조회
                        const customerIds = Array.from(new Set(data.map((r: any) => r.customer_id).filter(Boolean)));
                        if (customerIds.length > 0) {
                            const { data: usersData } = await supabase
                                .from('users')
                                .select('user_id, is_phone_verified, nickname, name, avatar_url') // 이름 및 아바타 추가
                                .in('user_id', customerIds);
                            if (usersData) {
                                const vMap: Record<string, boolean> = {};
                                const nMap: Record<string, string> = {}; // 이름 맵 추가
                                const aMap: Record<string, string | null> = {};
                                usersData.forEach((u: any) => {
                                    vMap[u.user_id] = u.is_phone_verified === true;
                                    nMap[u.user_id] = (u.nickname && u.nickname.trim() !== '') ? u.nickname : (u.name || t('proRequestList.unknownCustomer'));
                                    aMap[u.user_id] = u.avatar_url || null;
                                });
                                setCustomerVerifiedMap(vMap);
                                setCustomerNameMap(nMap);
                                setCustomerAvatarMap(aMap);
                            }

                            // ── [확장] 3-15-0 어뷰징 적발 고객 조회 (Pro에게만 노출) ──
                            const { data: flaggedData } = await supabase
                                .from('user_penalty_stats')
                                .select('user_id')
                                .in('user_id', customerIds)
                                .eq('is_flagged', true);
                            if (flaggedData) {
                                setFlaggedCustomerIds(new Set(flaggedData.map((f: any) => f.user_id)));
                            }
                        }
                    }
                } else {
                    const { data } = await supabase.from('match_requests').select('*, categories(name)').eq('status', 'OPEN').order('created_at', { ascending: false });
                    if (data) {
                        setRequests(data);
                        // ✅ 추가: else 분기에도 고객 이름/아바타 맵 구성
                        const customerIds = Array.from(new Set(data.map((r: any) => r.customer_id).filter(Boolean)));
                        if (customerIds.length > 0) {
                            const { data: usersData } = await supabase
                                .from('users')
                                .select('user_id, is_phone_verified, nickname, name, avatar_url')
                                .in('user_id', customerIds);
                            if (usersData) {
                                const vMap: Record<string, boolean> = {};
                                const nMap: Record<string, string> = {};
                                const aMap: Record<string, string | null> = {};
                                usersData.forEach((u: any) => {
                                    vMap[u.user_id] = u.is_phone_verified === true;
                                    nMap[u.user_id] = (u.nickname && u.nickname.trim() !== '') ? u.nickname : (u.name || t('proRequestList.unknownCustomer'));
                                    aMap[u.user_id] = u.avatar_url || null;
                                });
                                setCustomerVerifiedMap(vMap);
                                setCustomerNameMap(nMap);
                                setCustomerAvatarMap(aMap);
                            }
                        }
                    }
                }
            }
        };
        fetchRequests();
    }, [refreshTrigger]);

    // [뱃지 동기화] localStorage 기반 읽음 상태와 GNB 뱃지를 동기화
    // 요청 목록 로드 후, 읽지 않은(localStorage에 없는) 활성 신규 요청이 있으면 뱃지 유지
    useEffect(() => {
        if (requests.length === 0) return;
        const newUnreadRequests = requests.filter(req => {
            const isQuoted = quotedRequestIds.includes(req.request_id);
            if (isQuoted) return false; // 이미 견적 보낸 건은 "새로운 요청"이 아님
            // 만료/마감된 요청은 뱃지 대상에서 제외
            const expiresAt = new Date(req.created_at).getTime() + (48 * 60 * 60 * 1000);
            const isExpired = expiresAt <= now;
            if (isExpired) return false;
            if (req.status !== 'OPEN') return false;
            if (req.quote_count >= (req.max_quotes || 5)) return false;
            return !readRequestIds.has(req.request_id);
        });
        if (newUnreadRequests.length > 0) {
            window.dispatchEvent(new CustomEvent('force-requests-badge', { detail: true }));
        } else {
            window.dispatchEvent(new Event('requests-read'));
        }
    }, [requests, readRequestIds, quotedRequestIds, now]);

    const handleRequestClick = (requestId: string) => {
        try {
            const stored = localStorage.getItem('read_requests');
            let parsed: string[] = [];
            if (stored) {
                parsed = JSON.parse(stored);
                if (!Array.isArray(parsed)) parsed = [];
            }
            if (!parsed.includes(requestId)) {
                parsed.push(requestId);
                localStorage.setItem('read_requests', JSON.stringify(parsed));
            }
            setReadRequestIds(prev => new Set([...Array.from(prev), requestId]));
        } catch (error) {
            console.error('Failed to update read_requests in localStorage', error);
        }

        // 1. DB 알림 상태 낙관적/백그라운드 업데이트 (await 없이 비동기 실행)
        if (currentUserId) {
            supabase.from('notifications')
                .update({ is_read: true })
                .eq('user_id', currentUserId)
                .eq('type', 'MATCH')
                .eq('reference_id', requestId)
                .eq('is_read', false)
                .then(async () => {
                    // 1. 일반 알림(종 모양) 갱신 트리거
                    window.dispatchEvent(new Event('notifications-updated'));

                    // 2. 잔여 읽지 않은 알림 개수 확인 후 동기화
                    const { count, error } = await supabase
                        .from('notifications')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', currentUserId)
                        .eq('type', 'MATCH')
                        .eq('is_read', false);

                    if (!error && count === 0) {
                        window.dispatchEvent(new Event('requests-read'));
                    }
                });
        }
        // 3. 상세 페이지로 이동
        router.push(`/pro/requests/${requestId}`);
    };

    useEffect(() => {
        const channel = supabase
            .channel('match_requests_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_requests' }, (payload) => {
                console.log("🚨 [Realtime 수신 완료] 새 요청 감지. 화면을 갱신합니다.", payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_requests' }, async (payload) => {
                console.log("🔄 [Realtime] 기존 고객 요청 변경 감지! 리스트 갱신", payload);
                const newStatus = (payload.new as any)?.status;
                const reqId = (payload.new as any)?.request_id;
                // ── [핫픽스] 즉각 로컬 필터링: 취소/마감된 카드를 네트워크 대기 없이 즉시 제거 ──
                if (newStatus && newStatus !== 'OPEN' && reqId) {
                    setRequests(prev => prev.map(r =>
                        r.request_id === reqId ? { ...r, status: newStatus } : r
                    ));
                }
                setRefreshTrigger(prev => prev + 1);
                // [핵심] 마감된 요청의 MATCH 알림을 자동 읽음 처리 → GNB 뱃지 잔류 방지
                if (newStatus && newStatus !== 'OPEN' && currentUserId && reqId) {
                    await supabase.from('notifications')
                        .update({ is_read: true })
                        .eq('user_id', currentUserId)
                        .eq('type', 'MATCH')
                        .eq('reference_id', reqId)
                        .eq('is_read', false);
                    window.dispatchEvent(new Event('requests-read'));
                }
            })
            // [추가] 리뷰(거래 완료) 등록 시 즉시 반영
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload) => {
                console.log("✅ [Realtime] 거래 완료(리뷰) 감지! 리스트 갱신", payload);
                setRefreshTrigger(prev => prev + 1);
            })
            // [추가] 견적 상태 변경 (ACCEPTED/REJECTED) 시 즉시 반영
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_quotes' }, (payload) => {
                console.log("📝 [Realtime] 견적 상태 변경 감지! 리스트 갱신", payload);
                setRefreshTrigger(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // ── [핫픽스] Supabase Broadcast 수신: 고객이 요청 취소 시 RLS 우회하여 즉시 반영 ──
    useEffect(() => {
        const syncChannel = supabase.channel('request-status-sync')
            .on('broadcast', { event: 'request-canceled' }, (payload: any) => {
                const canceledId = payload?.payload?.request_id;
                if (canceledId) {
                    console.log('🚫 [Broadcast] 고객 요청 취소 감지:', canceledId);
                    setRequests(prev => prev.filter(r => r.request_id !== canceledId));
                    window.dispatchEvent(new Event('requests-read'));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(syncChannel);
        };
    }, []);

    // [보강] 알림 시스템 기반 실시간 갱신 (Supabase Realtime 미작동 시에도 동작 보장)
    useEffect(() => {
        const handleProDataChanged = () => setRefreshTrigger(prev => prev + 1);
        window.addEventListener('pro-data-changed', handleProDataChanged);
        return () => window.removeEventListener('pro-data-changed', handleProDataChanged);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 p-4 pb-24 space-y-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        {t('proRequestList.pageTitle')}
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                    </h1>
                </div>

                <div className="flex space-x-2 bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setFilterType('NEW')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === 'NEW' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('proRequestList.tabNew')}
                    </button>
                    <button
                        onClick={() => setFilterType('QUOTED')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === 'QUOTED' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('proRequestList.tabQuoted')}
                    </button>
                </div>

                {/* 2뎁스 서브 탭 (보낸 견적 선택 시에만 노출) */}
                {filterType === 'QUOTED' && (
                    <div className="flex space-x-2 mt-2">
                        <button
                            onClick={() => setQuotedSubTab('IN_PROGRESS')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${quotedSubTab === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'text-gray-400 hover:text-gray-600 border border-transparent'}`}
                        >
                            {t('proRequestList.subTabInProgress')}
                        </button>
                        <button
                            onClick={() => setQuotedSubTab('ARCHIVED')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${quotedSubTab === 'ARCHIVED' ? 'bg-gray-200 text-gray-700 border border-gray-300' : 'text-gray-400 hover:text-gray-600 border border-transparent'}`}
                        >
                            {t('proRequestList.subTabArchived')}
                        </button>
                    </div>
                )}
            </div>

            {!isAcceptingRequests ? (
                <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 mt-4 text-center">
                    <span className="text-4xl mb-4 opacity-80">🔒</span>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">{t('proRequestList.vacationTitle')}</h2>
                    <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-4">
                        {t('proRequestList.vacationDesc')}
                    </p>
                    <button
                        onClick={() => router.push('/profile')}
                        className="bg-gray-800 hover:bg-black text-white font-bold py-2 px-6 rounded-lg text-sm transition"
                    >
                        {t('proRequestList.vacationBtn')}
                    </button>
                </div>
            ) : (
                <>
                    {/* 보관함 CS 방어 배너 */}
                    {filterType === 'QUOTED' && quotedSubTab === 'ARCHIVED' && (
                        <div className="bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium p-4 rounded-xl shadow-sm leading-relaxed sticky top-[140px] z-[5]">
                            {t('proRequestList.archiveBanner')}
                        </div>
                    )}
                    {requests.filter(req => {
                        const isQuoted = quotedRequestIds.includes(req.request_id);
                        if (filterType === 'NEW') return !isQuoted && req.status !== 'CANCELED'; // ── [핫픽스] 취소된 요청 제외 ──
                        if (filterType === 'QUOTED') {
                            if (!isQuoted) return false;
                            const myQuote = proQuotes.find(q => q.request_id === req.request_id);
                            const isAccepted = myQuote?.status === 'ACCEPTED';
                            const isMatchedButNotMe = req.status === 'MATCHED' && !isAccepted;
                            const isCanceled = req.status === 'CANCELED';

                            // 48시간 만료 여부
                            const isExpired = req.created_at
                                ? new Date(req.created_at).getTime() + (48 * 60 * 60 * 1000) <= now
                                : false;

                            // 리뷰 작성 완료 여부
                            const isReviewed = reviewedRequestIds.has(req.request_id);

                            // ACCEPTED 후 30일 경과 여부 (updated_at 우선, 없을 시 created_at 폴백)
                            const matchedAt = req.updated_at
                                ? new Date(req.updated_at).getTime()
                                : new Date(req.created_at).getTime();
                            const is30DaysOver = isAccepted && (now - matchedAt > 30 * 24 * 60 * 60 * 1000);

                            const isArchived = isMatchedButNotMe || isCanceled || isExpired || isReviewed || is30DaysOver;

                            if (quotedSubTab === 'IN_PROGRESS') return !isArchived;
                            if (quotedSubTab === 'ARCHIVED') {
                                if (!isArchived) return false;
                                // 7일 숨김: updated_at 우선, 없을 시 created_at 폴백
                                const baseTime = req.updated_at
                                    ? new Date(req.updated_at).getTime()
                                    : new Date(req.created_at).getTime();
                                if (now - baseTime > 7 * 24 * 60 * 60 * 1000) return false;
                                return true;
                            }
                        }
                        return true;
                    }).length === 0 ? (
                        <div className="text-center p-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
                            <p>{filterType === 'QUOTED' && quotedSubTab === 'ARCHIVED' ? t('proRequestList.noArchived') : t('proRequestList.noRequests')}</p>
                        </div>
                    ) : (
                        requests.filter(req => {
                            const isQuoted = quotedRequestIds.includes(req.request_id);
                            if (filterType === 'NEW') return !isQuoted && req.status !== 'CANCELED'; // ── [핫픽스] 취소된 요청 제외 ──
                            if (filterType === 'QUOTED') {
                                if (!isQuoted) return false;
                                const myQuote = proQuotes.find(q => q.request_id === req.request_id);
                                const isAccepted = myQuote?.status === 'ACCEPTED';
                                const isMatchedButNotMe = req.status === 'MATCHED' && !isAccepted;
                                const isCanceled = req.status === 'CANCELED';

                                // 48시간 만료 여부
                                const isExpired = req.created_at
                                    ? new Date(req.created_at).getTime() + (48 * 60 * 60 * 1000) <= now
                                    : false;

                                // 리뷰 작성 완료 여부
                                const isReviewed = reviewedRequestIds.has(req.request_id);

                                // ACCEPTED 후 30일 경과 여부 (updated_at 우선, 없을 시 created_at 폴백)
                                const matchedAt = req.updated_at
                                    ? new Date(req.updated_at).getTime()
                                    : new Date(req.created_at).getTime();
                                const is30DaysOver = isAccepted && (now - matchedAt > 30 * 24 * 60 * 60 * 1000);

                                const isArchived = isMatchedButNotMe || isCanceled || isExpired || isReviewed || is30DaysOver;

                                if (quotedSubTab === 'IN_PROGRESS') return !isArchived;
                                if (quotedSubTab === 'ARCHIVED') {
                                    if (!isArchived) return false;
                                    // 7일 숨김: updated_at 우선, 없을 시 created_at 폴백
                                    const baseTime = req.updated_at
                                        ? new Date(req.updated_at).getTime()
                                        : new Date(req.created_at).getTime();
                                    if (now - baseTime > 7 * 24 * 60 * 60 * 1000) return false;
                                    return true;
                                }
                            }
                            return true;
                        }).map((req) => {
                            const customerName = customerNameMap[req.customer_id] || t('proRequestList.unknownCustomer');
                            const customerAvatar = customerAvatarMap[req.customer_id];
                            const expiresAt = new Date(req.created_at).getTime() + (48 * 60 * 60 * 1000);
                            const diffMs = expiresAt - now;
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                            const isExpired = diffMs <= 0;
                            const isHurrying = diffHours < 24 && !isExpired;

                            const myQuote = proQuotes.find(q => q.request_id === req.request_id);
                            const isAccepted = myQuote?.status === 'ACCEPTED';
                            const isMatchedButNotMe = req.status === 'MATCHED' && !isAccepted;
                            // [소급 방어] 보너스 정책 도입일 이후 생성된 미열람 견적만 환급 UI 표시
                            const BONUS_POLICY_DATE = new Date('2026-03-02T00:00:00Z');
                            const isUnreadRefund = isMatchedButNotMe && myQuote && myQuote.is_read === false && new Date(myQuote.created_at) >= BONUS_POLICY_DATE;
                            const isReviewed = reviewedRequestIds.has(req.request_id);

                            const isClosed = isExpired || req.status === 'MATCHED' || req.quote_count >= (req.max_quotes || 5);
                            const isReadLocally = readRequestIds.has(req.request_id);

                            return (
                                <div key={req.request_id} className={`bg-white p-4 rounded-xl shadow-sm border transition transform hover:-translate-y-1 ${isExpired || isMatchedButNotMe ? 'border-gray-200 opacity-70' : isReadLocally && !myQuote ? 'bg-gray-50 border-gray-200 opacity-80' : 'border-blue-100'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                                                {customerAvatar ? (
                                                    <img src={customerAvatar} alt="Customer Profile" className="w-full h-full object-cover" />
                                                ) : (
                                                    <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                                                )}
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold">{customerName}{t('proRequestList.requestTitle')}</h2>
                                                <p className="text-sm text-gray-500">
                                                    {(req.categories?.name || req.service_type) ? `${req.categories?.name || req.service_type} | ` : ''}
                                                    {req.region ? req.region : `카테고리: ${req.categories?.name || req.category_id} | 지역: ${req.region_id}`}
                                                </p>
                                                {customerVerifiedMap[req.customer_id] && (
                                                    <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full border border-green-200 mt-1">
                                                        {t('proRequestList.verifiedCustomer')}
                                                    </span>
                                                )}
                                                {/* ── [확장] 3-15-0 어뷰징 경고 배지 (고수에게만 노출) ── */}
                                                {flaggedCustomerIds.has(req.customer_id) && (
                                                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full border border-red-200 mt-1 animate-pulse">
                                                        {t('proRequestList.abuseWarning')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-block font-bold px-3 py-1 rounded-full text-sm shadow-sm ${isClosed ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-red-50 text-red-600 border-red-200 animate-pulse'}`}>
                                                💡 {req.quote_count} / {req.max_quotes || 5}명 {isClosed ? t('proRequestList.bidClosed') : t('proRequestList.bidding')}
                                            </span>
                                            <div className={`text-xs mt-1 font-bold ${isExpired || isMatchedButNotMe ? 'text-gray-500' : isHurrying ? 'text-red-500 animate-pulse' : 'text-blue-500'}`}>
                                                {req.status === 'MATCHED' ? t('proRequestList.matched') : isExpired ? t('proRequestList.expired') : `${diffHours}${t('proRequestList.hours')} ${diffMinutes}${t('proRequestList.minutes')} ${t('proRequestList.timeLeft')}`}
                                            </div>
                                        </div>
                                    </div>
                                    {isReviewed ? (
                                        <div className="mt-3 bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-gray-300">
                                            <span>✅</span> {t('proRequestList.dealDone')}
                                        </div>
                                    ) : isAccepted ? (
                                        <div className="mt-3 bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-green-200">
                                            <span>🎉</span> {t('proRequestList.matchSuccess')}
                                        </div>
                                    ) : isMatchedButNotMe ? (
                                        <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border ${isUnreadRefund ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                            <span>{isUnreadRefund ? '🎁' : '🔒'}</span>
                                            {isUnreadRefund ? t('proRequestList.unreadRefund') : t('proRequestList.closedOther')}
                                        </div>
                                    ) : myQuote ? (
                                        <div className="mt-3 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-blue-200">
                                            <span>✅</span> {t('proRequestList.alreadySent')}
                                        </div>
                                    ) : null}

                                    <button
                                        onClick={() => handleRequestClick(req.request_id)}
                                        disabled={(isExpired && !isAccepted) || isMatchedButNotMe || req.status === 'CANCELED'}
                                        className={`w-full min-h-[48px] mt-4 font-bold py-3 rounded-xl transition text-sm break-keep ${(isExpired && !isAccepted) || isMatchedButNotMe || req.status === 'CANCELED'
                                            ? (isUnreadRefund ? 'bg-green-100 text-green-600 cursor-not-allowed shadow-none border border-green-200' : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none')
                                            : (!myQuote && !isAccepted)
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                            }`}
                                    >
                                        {isAccepted
                                            ? t('proRequestList.btnDetail')
                                            : req.status === 'CANCELED'
                                                ? t('proRequestList.btnCanceled')
                                                : isMatchedButNotMe
                                                    ? (isUnreadRefund
                                                        ? t('proRequestList.btnUnreadRefund')
                                                        : t('proRequestList.btnClosedOther'))
                                                    : req.quote_count >= (req.max_quotes || 5) && !myQuote
                                                        ? t('proRequestList.btnFull')
                                                        : isExpired
                                                            ? t('proRequestList.btnExpired')
                                                            : myQuote
                                                                ? t('proRequestList.btnDetail')
                                                                : isReadLocally
                                                                    ? t('proRequestList.btnSend')
                                                                    : t('proRequestList.btnViewNew')}
                                    </button>
                                </div>
                            );
                        })
                    )}
                </>
            )}
        </div>
    );
}
