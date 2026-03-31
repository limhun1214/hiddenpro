"use client";

import React, { useEffect, useState, useRef, createContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import GlobalFooter from "@/components/common/GlobalFooter";
import PCTopNav from "@/components/common/PCTopNav";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

import { NavStateContext } from "@/context/NavStateContext";
import { ToastProvider } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname || "/";

  const pathnameRef = useRef(currentPath);
  useEffect(() => {
    pathnameRef.current = currentPath;
    if (typeof window !== "undefined") {
      if ("scrollRestoration" in history) {
        history.scrollRestoration = "manual";
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      // 내부 스크롤 컨테이너(main)가 있는 경우를 대비해 main 태그도 초기화
      const mainContent = document.querySelector("main");
      if (mainContent) {
        mainContent.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }
  }, [currentPath]);

  // [보안 강화]: 전역 사용자 상태 (DB 검증 기반)
  const [isProUser, setIsProUser] = useState<boolean>(false);
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [unreadChatsCount, setUnreadChatsCount] = useState<number>(0);
  const [hasNewQuotes, setHasNewQuotes] = useState<boolean>(false);
  const [hasNewRequests, setHasNewRequests] = useState<boolean>(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [isProProfileComplete, setIsProProfileComplete] = useState(true);
  const [showProfileIncompleteModal, setShowProfileIncompleteModal] =
    useState(false);

  const t = useTranslations();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !isProUser) return;
    const checkProProfile = async () => {
      const { data, error } = await supabase
        .from("pro_profiles")
        .select(
          "phone, is_phone_verified, intro, detailed_intro, region, services",
        )
        .eq("pro_id", userId)
        .single();

      if (error || !data) {
        setIsProProfileComplete(false);
        return;
      }

      const hasPhone = data.is_phone_verified === true && !!data.phone;
      const hasIntro = !!data.intro && data.intro.trim().length > 0;
      const hasDetailedIntro =
        !!data.detailed_intro && data.detailed_intro.trim().length > 0;
      const hasRegion = !!data.region && data.region.trim().length > 0;
      const hasServices =
        Array.isArray(data.services) && data.services.length > 0;

      setIsProProfileComplete(
        hasPhone && hasIntro && hasDetailedIntro && hasRegion && hasServices,
      );
    };
    checkProProfile();
  }, [userId, isProUser]);

  // 1단계: 초기 인증 및 역할/데이터 확인 (마운트 시 1회만 실행)
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      setIsCheckingAuth(true);
      let role = "CUSTOMER";

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        const sessionUser = authData?.user;

        if (authError || !sessionUser) {
          if (isMounted) {
            setIsProUser(false);
            setUserId(null);
          }
          return;
        }

        if (isMounted) setUserId(sessionUser.id);

        const { data: userData, error: dbError } = await supabase
          .from("users")
          .select("role, status")
          .eq("user_id", sessionUser.id)
          .single();

        if (!dbError && userData) role = String(userData.role).toUpperCase();

        // ── [확장] 계정 정지 원천 차단: SUSPENDED 유저 강제 로그아웃 ──
        if (
          !dbError &&
          userData &&
          String(userData.status).toUpperCase() === "SUSPENDED"
        ) {
          await supabase.auth.signOut();
          if (isMounted) {
            setUserId(null);
            setIsProUser(false);
            setIsAdminUser(false);
            setIsCheckingAuth(false);
          }
          // ── [확장] 계정 정지 원천 차단: alert 대신 URL 파라미터로 에러 전달 ──
          window.location.href = "/?suspended=true";
          return;
        }

        const isPro = role === "PRO";
        const isAdmin = ["ADMIN", "ADMIN_OPERATION", "ADMIN_VIEWER"].includes(
          role,
        );
        if (isMounted) {
          setIsProUser(isPro);
          setIsAdminUser(isAdmin);
          // 비관리자 기존 세션: locale을 en으로 강제
          if (!isAdmin) {
            document.cookie =
              "locale=en; path=/; max-age=31536000; SameSite=Lax";
          }
        }

        if (isPro) {
          const { data, error } = await supabase
            .from("pro_profiles")
            .select("current_cash, bonus_cash")
            .eq("pro_id", sessionUser.id)
            .single();
          if (!error && data && isMounted)
            setWalletBalance((data.current_cash || 0) + (data.bonus_cash || 0));
        }

        const { count, error: notifError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", sessionUser.id)
          .eq("is_read", false)
          .not("type", "in", '("CHAT","MATCH","QUOTE")');
        if (!notifError && count !== null && isMounted)
          setUnreadNotifsCount(count);

        // ── [핫픽스] MATCH 알림 중 실제로 유효(OPEN)한 요청에 대한 것만 뱃지 카운트 ──
        const { count: matchCount, error: matchError } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", sessionUser.id)
          .eq("type", "MATCH")
          .eq("is_read", false);
        if (!matchError && matchCount !== null && matchCount > 0 && isMounted) {
          // 2차 검증: 해당 알림의 reference_id(요청 ID)가 아직 OPEN 상태인지 확인
          const { data: matchNotifs } = await supabase
            .from("notifications")
            .select("reference_id")
            .eq("user_id", sessionUser.id)
            .eq("type", "MATCH")
            .eq("is_read", false);
          if (matchNotifs && matchNotifs.length > 0) {
            const refIds = matchNotifs
              .map((n) => n.reference_id)
              .filter(Boolean);
            const { count: openCount } = await supabase
              .from("match_requests")
              .select("*", { count: "exact", head: true })
              .in("request_id", refIds)
              .eq("status", "OPEN");
            if (isMounted) setHasNewRequests((openCount || 0) > 0);
          } else {
            if (isMounted) setHasNewRequests(false);
          }
        }

        // ── [원복] 받은견적 뱃지: 순수 is_read=false 카운트 (이벤트 기반 무효화 아키텍처) ──
        const { count: quoteCount, error: quoteError } = await supabase
          .from("match_quotes")
          .select("quote_id, match_requests!inner(customer_id)", {
            count: "exact",
            head: true,
          })
          .eq("match_requests.customer_id", sessionUser.id)
          .eq("is_read", false);
        if (!quoteError && quoteCount !== null && quoteCount > 0 && isMounted)
          setHasNewQuotes(true);

        // 내가 참여한 채팅방 ID 목록 조회 후, 해당 방의 읽지 않은 메시지만 카운트
        const { data: myRooms } = await supabase
          .from("chat_rooms")
          .select("room_id")
          .or(`customer_id.eq.${sessionUser.id},pro_id.eq.${sessionUser.id}`);
        const myRoomIds = (myRooms || []).map((r) => r.room_id);
        if (myRoomIds.length > 0) {
          const { count: chatCnt, error: chatError } = await supabase
            .from("chat_messages")
            .select("*", { count: "exact", head: true })
            .in("room_id", myRoomIds)
            .neq("sender_id", sessionUser.id)
            .eq("is_read", false);
          if (!chatError && chatCnt !== null && isMounted)
            setUnreadChatsCount(chatCnt);
        } else {
          if (isMounted) setUnreadChatsCount(0);
        }
      } catch (err) {
        console.error("인증 확인 에러:", err);
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    };

    initAuth();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2단계: 라우트 가드
  // [SSR/Edge Middleware 전환] 기존 클라이언트 사이드 가드는 회귀 방지를 위해 주석 처리
  /*
    useEffect(() => {
        if (isCheckingAuth) return;
        if ((currentPath === '/pro' || currentPath.startsWith('/pro/')) && !isProUser && !userId) {
            router.replace('/');
        }

        // [중요 로직] 메인 화면 접속 시, 이미 인증된 PRO 유저라면 즉시 고수 대시보드로 리다이렉트
        if (currentPath === '/' && isProUser && userId) {
            router.replace('/pro/requests');
        }
        // [중요 로직] 메인 화면 접속 시, 이미 인증된 관리자라면 즉시 관리자 대시보드로 리다이렉트
        if (currentPath === '/' && isAdminUser && userId) {
            router.replace('/admin');
        }
        // [중요 로직] 메인 화면 접속 시, 이미 인증된 고객(CUSTOMER)이면 견적 요청 페이지로 리다이렉트
        if (currentPath === '/' && !isProUser && !isAdminUser && userId) {
            router.replace('/request');
        }
    }, [currentPath, isCheckingAuth, isProUser, isAdminUser, userId, router]);
    */

  // 3단계: WebSocket 구독 + 커스텀 이벤트 리스너
  useEffect(() => {
    if (!userId) return;

    // ── 미읽음 MATCH 알림 중 유효(OPEN) 요청 존재 여부 공통 쿼리 ──
    const queryUnreadMatchRequests = async (): Promise<boolean> => {
      const { data: matchNotifs } = await supabase
        .from("notifications")
        .select("reference_id")
        .eq("user_id", userId)
        .eq("type", "MATCH")
        .eq("is_read", false);
      if (!matchNotifs || matchNotifs.length === 0) return false;
      const refIds = matchNotifs
        .map((n: any) => n.reference_id)
        .filter(Boolean);
      const { count: openCount } = await supabase
        .from("match_requests")
        .select("*", { count: "exact", head: true })
        .in("request_id", refIds)
        .eq("status", "OPEN");
      return (openCount || 0) > 0;
    };

    const notifChannel = supabase
      .channel("gnb-notif-" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          const currentPath = pathnameRef.current;
          const nType = payload.new?.type;
          const referenceId = payload.new?.reference_id;

          // 유저가 현재 해당 채팅방에 접속 중일 때 파생된 채팅 알림 수신
          if (nType === "CHAT" && currentPath === `/chat/${referenceId}`) {
            // [핵심] 알림이 도착한 즉시 DB 상태를 읽음(true)으로 카운터 업데이트
            supabase
              .from("notifications")
              .update({ is_read: true })
              .eq("id", payload.new.id)
              .then(() => {
                // 로컬 알림 리스트 동기화 이벤트 트리거
                window.dispatchEvent(new Event("notifications-updated"));
              });
            return; // GNB 배지 증가 무시
          }

          // [핵심] 알림 데이터를 항상 브로드캐스팅 → 하위 컴포넌트(알림 리스트)가 수신 가능
          window.dispatchEvent(
            new CustomEvent("notification-inserted", { detail: payload.new }),
          );

          // 유저가 알림 탭에 머무는 중이면 → 뱃지 증가만 차단
          // (이벤트는 위에서 이미 전파 완료, 알림은 미읽음 상태로 리스트에 파란색 표시)
          if (currentPath === "/notifications") {
            return; // unreadNotifsCount 증가만 차단 — DB 읽음 처리는 유저 클릭 시에만
          }

          if (nType === "MATCH") {
            setHasNewRequests(true);
            window.dispatchEvent(new Event("pro-data-changed")); // 고수 요청 리스트 실시간 갱신
          } else if (nType === "QUOTE") {
            setHasNewQuotes(true);
          } else if (nType === "CHAT") {
            // 기존 채팅 뱃지 증가 로직과 중복되므로 unreadNotifsCount 는 증가시키지 않음
          } else {
            setUnreadNotifsCount((prev) => prev + 1);
            if (nType === "MATCH_SUCCESS") {
              window.dispatchEvent(new Event("pro-data-changed")); // 매칭 성공 시 리스트 갱신
            }
          }
        },
      )
      .subscribe();

    // ── 초기 로드 시 미읽음 MATCH 요청 배지 상태 체크 ──
    queryUnreadMatchRequests().then((hasUnread) =>
      setHasNewRequests(hasUnread),
    );

    const chatChannel = supabase
      .channel("gnb-chat-" + userId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_id=eq.${userId}`, // 서버 단에서 철저히 나에게 온 메시지만 수신
        },
        (payload: any) => {
          const currentPath = pathnameRef.current;
          const roomId = payload.new?.room_id;

          // 현재 유저가 해당 채팅방에 접속 중이면 GNB 배지 증가 무시 (즉시 읽음 처리 목적)
          if (currentPath === `/chat/${roomId}`) return;

          // 그 외의 경우(다른 방에서 온 메시지, 다른 화면 탐색 중)에만 알림 카운트 증가
          setUnreadChatsCount((prev) => prev + 1);
        },
      )
      .subscribe();

    const handleWalletUpdate = async () => {
      const { data, error } = await supabase
        .from("pro_profiles")
        .select("current_cash, bonus_cash")
        .eq("pro_id", userId)
        .single();
      if (!error && data)
        setWalletBalance((data.current_cash || 0) + (data.bonus_cash || 0));
    };

    const handleNotifRead = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .not("type", "in", '("CHAT","MATCH","QUOTE")');
      if (!error && count !== null) setUnreadNotifsCount(count);
    };

    const handleChatRead = async () => {
      const { data: myRooms } = await supabase
        .from("chat_rooms")
        .select("room_id")
        .or(`customer_id.eq.${userId},pro_id.eq.${userId}`);
      const myRoomIds = (myRooms || []).map((r: any) => r.room_id);
      if (myRoomIds.length > 0) {
        const { count, error } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .in("room_id", myRoomIds)
          .neq("sender_id", userId)
          .eq("is_read", false);
        if (!error && count !== null) setUnreadChatsCount(count);
      } else {
        setUnreadChatsCount(0);
      }
    };

    const handleQuotesRead = async () => {
      // ── [원복] 순수 is_read=false 카운트 (이벤트 기반 무효화 아키텍처) ──
      const { count, error } = await supabase
        .from("match_quotes")
        .select("quote_id, match_requests!inner(customer_id)", {
          count: "exact",
          head: true,
        })
        .eq("match_requests.customer_id", userId)
        .eq("is_read", false);
      setHasNewQuotes(!error && count !== null && count > 0);
    };
    const handleRequestsRead = async () => {
      const hasUnread = await queryUnreadMatchRequests();
      setHasNewRequests(hasUnread);
    };

    const handleForceRequestsBadge = () => setHasNewRequests(true);

    // ── [신규] 취소 시 GNB 배지 직접 오버라이드 (추가 DB 조회 없음) ──
    const handleBadgeSync = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d.hasNewQuotes !== undefined) setHasNewQuotes(d.hasNewQuotes);
      if (d.unreadNotifsCount !== undefined)
        setUnreadNotifsCount(d.unreadNotifsCount);
    };

    window.addEventListener("wallet-updated", handleWalletUpdate);
    window.addEventListener("notifications-updated", handleNotifRead);
    window.addEventListener("chat-read", handleChatRead);
    window.addEventListener("quotes-read", handleQuotesRead);
    window.addEventListener("requests-read", handleRequestsRead);
    window.addEventListener("force-requests-badge", handleForceRequestsBadge);
    window.addEventListener("gnb-badge-sync", handleBadgeSync);

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(chatChannel);
      window.removeEventListener("wallet-updated", handleWalletUpdate);
      window.removeEventListener("notifications-updated", handleNotifRead);
      window.removeEventListener("chat-read", handleChatRead);
      window.removeEventListener("quotes-read", handleQuotesRead);
      window.removeEventListener("requests-read", handleRequestsRead);
      window.removeEventListener(
        "force-requests-badge",
        handleForceRequestsBadge,
      );
      window.removeEventListener("gnb-badge-sync", handleBadgeSync);
    };
  }, [userId]);

  const customerNav = [
    { label: t("pcTopNav.home"), href: "/", icon: "🏠", key: "home" },
    {
      label: t("pcTopNav.receivedQuotes"),
      href: "/quotes/received",
      icon: "📩",
      key: "quotes",
    },
    { label: t("pcTopNav.chat"), href: "/chat", icon: "💬", key: "chat" },
    {
      label: t("pcTopNav.customerProfile"),
      href: "/profile",
      icon: "👤",
      key: "profile",
    },
  ];

  const proNav = [
    { label: t("pcTopNav.home"), href: "/", icon: "🏠", key: "home" },
    {
      label: t("pcTopNav.requests"),
      href: "/pro/requests",
      icon: "📋",
      key: "requests",
    },
    { label: t("pcTopNav.chat"), href: "/chat", icon: "💬", key: "chat" },
    {
      label: t("pcTopNav.proProfile"),
      href: "/profile",
      icon: "👤",
      key: "profile",
    },
  ];

  const proProfileRequiredPaths = ["/pro/requests", "/chat"];

  const currentNav = isProUser ? proNav : customerNav;

  const NAV_ICONS: Record<string, string> = {
    home: "home",
    quotes: "request_quote",
    chat: "chat",
    profile: "person",
    requests: "assignment",
  };

  const isChatRoom =
    currentPath.startsWith("/chat") &&
    currentPath !== "/chat" &&
    currentPath !== "/chat/";
  const isRequestForm = currentPath.startsWith("/request");
  const isLandingPage = currentPath === "/";
  const isAdminPage = currentPath.startsWith("/admin");

  const hideFooter = isChatRoom || isRequestForm || isAdminPage || !!userId;
  const hideNavBar = isChatRoom || (isLandingPage && !userId) || isAdminPage;

  // 메인 홈 화면 및 관리자 페이지: 모바일 제약 해제, 풀스크린 반응형 레이아웃 제공
  // 서브 페이지 (견적요청, 프로필 등): 모바일은 max-w-md, PC는 넓게 50:50 분할
  const isSpecialPage = isLandingPage || isAdminPage;
  const isInternalPage = !!userId && !isAdminPage && !isLandingPage;

  // 최상위 컨테이너 클래스 (조건부 라우팅)
  const rootContainerClasses = isLandingPage
    ? "flex flex-col min-h-screen relative w-full bg-[#0f0d13]"
    : isAdminPage
      ? "flex flex-col min-h-screen relative overflow-hidden w-full"
      : `flex flex-col lg:flex-row w-full min-h-screen lg:h-[100dvh] ${isInternalPage ? "bg-[#FAFAFA]" : "bg-white"} relative shadow-xl lg:overflow-hidden`;

  // 우측 영역(본문) 컨테이너 클래스 (서브 페이지용)
  const rightPanelClasses = `flex flex-col w-full flex-1 min-h-screen lg:min-h-0 lg:h-full ${isInternalPage ? "bg-[#FAFAFA]" : "bg-white"} relative`;

  return (
    <ToastProvider>
      <NavStateContext.Provider
        value={{
          unreadNotifsCount,
          unreadChatsCount,
          hasNewQuotes,
          hasNewRequests,
          isProUser,
          isLoggedIn: !!userId,
          walletBalance,
          isProProfileComplete,
          isAdminUser,
          setShowProfileIncompleteModal,
        }}
      >
        <div className={rootContainerClasses}>
          {/* BrandSidePanel: 전체 내부 페이지에서 제거 */}

          <div
            className={
              isSpecialPage
                ? "flex flex-col w-full min-h-screen"
                : rightPanelClasses
            }
          >
            {(!isSpecialPage || (isLandingPage && !!userId)) && <PCTopNav />}

            {/* 모바일 전용 상단 헤더: 알림 벨 + 언어 전환 */}
            {(!isSpecialPage || (isLandingPage && !!userId)) && !isChatRoom && (
              <div
                className={`lg:hidden sticky top-0 z-[60] w-full ${isLandingPage ? "bg-[#0f0d13] border-b border-white/10" : "bg-white border-b border-gray-100"} shrink-0`}
              >
                <div className="flex justify-end items-center px-4 py-3 gap-3">
                  {isProUser && (
                    <button
                      onClick={() => router.push("/pro/wallet")}
                      aria-label={t("pcTopNav.wallet")}
                      className={`relative transition-colors ${isLandingPage ? "text-white/70 hover:text-white" : currentPath === "/pro/wallet" ? "text-[#0020a0]" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                    >
                      <span
                        className="material-symbols-outlined text-[22px]"
                        style={{
                          fontVariationSettings:
                            currentPath === "/pro/wallet"
                              ? "'FILL' 1"
                              : "'FILL' 0",
                        }}
                      >
                        account_balance_wallet
                      </span>
                    </button>
                  )}
                  <button
                    onClick={() => router.push("/notifications")}
                    className={`relative transition-colors ${isLandingPage ? "text-white/70 hover:text-white" : currentPath === "/notifications" ? "text-[#0020a0]" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                  >
                    <span
                      className="material-symbols-outlined text-[22px]"
                      style={{
                        fontVariationSettings:
                          unreadNotifsCount > 0 ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      notifications
                    </span>
                    {unreadNotifsCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span
                          className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 ${isLandingPage ? "border-[#0f0d13]" : "border-white"}`}
                        ></span>
                      </span>
                    )}
                  </button>
                  {isAdminUser && <LanguageSwitcher />}
                </div>
              </div>
            )}

            {isCheckingAuth &&
            (currentPath === "/pro" || currentPath.startsWith("/pro/")) ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <main
                  className={`flex-1 flex flex-col w-full ${!isSpecialPage ? "lg:overflow-y-auto custom-scrollbar" : ""} ${!hideNavBar ? "pb-16" : ""}`}
                >
                  {children}
                </main>

                {!hideNavBar && (
                  <nav
                    className={`fixed bottom-0 left-0 w-full ${isLandingPage ? "bg-[#1a1721] border-t border-white/10" : "bg-white border-t border-gray-200"} z-[999] px-2 py-2 md:hidden`}
                    style={{
                      position: "fixed",
                      bottom: 0,
                      left: 0,
                      width: "100%",
                      zIndex: 999,
                    }}
                  >
                    <ul className="flex justify-between items-center h-14 max-w-md mx-auto">
                      {currentNav.map((item) => {
                        const isActive =
                          (currentPath.startsWith(item.href) &&
                            item.href !== "/") ||
                          currentPath === item.href;

                        return (
                          <li key={item.key} className="flex-1">
                            <Link
                              href={item.href}
                              onClick={(e) => {
                                if (
                                  !isCheckingAuth &&
                                  !userId &&
                                  item.href !== "/" &&
                                  item.href !== "/request"
                                ) {
                                  e.preventDefault();
                                  router.push("/");
                                  return;
                                }
                                if (
                                  isProUser &&
                                  !isProProfileComplete &&
                                  proProfileRequiredPaths.some((p) =>
                                    item.href.startsWith(p),
                                  )
                                ) {
                                  e.preventDefault();
                                  setShowProfileIncompleteModal(true);
                                  return;
                                }
                                if (isActive)
                                  window.dispatchEvent(
                                    new Event("gnb-tab-reset"),
                                  );
                              }}
                              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                                isActive
                                  ? isLandingPage
                                    ? "text-[#6b8cff]"
                                    : "text-[#0020a0]"
                                  : isLandingPage
                                    ? "text-white/50"
                                    : "text-[#374151]"
                              }`}
                            >
                              <div className="relative">
                                <span
                                  className="material-symbols-outlined text-[22px]"
                                  style={{
                                    fontVariationSettings: isActive
                                      ? "'FILL' 1"
                                      : "'FILL' 0",
                                  }}
                                >
                                  {NAV_ICONS[item.key] || "circle"}
                                </span>

                                {item.key === "notifications" &&
                                  unreadNotifsCount > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span
                                        className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 ${isLandingPage ? "border-[#1a1721]" : "border-white"}`}
                                      ></span>
                                    </span>
                                  )}

                                {item.key === "chat" &&
                                  unreadChatsCount > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span
                                        className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 ${isLandingPage ? "border-[#1a1721]" : "border-white"}`}
                                      ></span>
                                    </span>
                                  )}

                                {item.key === "quotes" && hasNewQuotes && (
                                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#1a1721]"></span>
                                  </span>
                                )}

                                {item.key === "requests" && hasNewRequests && (
                                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#1a1721]"></span>
                                  </span>
                                )}

                                {isProUser && item.key === "wallet" && (
                                  <span
                                    className={`absolute -bottom-1 -right-8 flex h-4 px-1 rounded-full bg-yellow-400 items-center justify-center text-[10px] font-black text-white border-2 ${isLandingPage ? "border-[#1a1721]" : "border-white"} shadow-sm whitespace-nowrap`}
                                  >
                                    {walletBalance !== null
                                      ? walletBalance.toLocaleString()
                                      : "C"}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[10px] ${isActive ? "scale-110 transition-transform" : ""}`}
                              >
                                {item.label}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                )}

                {!isSpecialPage && !hideFooter && <GlobalFooter />}
              </>
            )}
          </div>
          {isSpecialPage && !hideFooter && <GlobalFooter />}

          {showLoginModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-6 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-3xl">🔐</span>
                  </div>
                </div>
                <div className="p-6 text-center">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {t("common.loginRequiredTitle")}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6 whitespace-pre-line">
                    {t("common.loginRequiredDesc")}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLoginModal(false)}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
                    >
                      {t("common.loginRequiredCancel")}
                    </button>
                    <button
                      onClick={() => {
                        setShowLoginModal(false);
                        router.push("/?login=true");
                      }}
                      className="flex-[2] py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md active:scale-[0.98] text-sm"
                    >
                      {t("common.loginRequiredBtn")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showProfileIncompleteModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                {/* 아이콘 헤더 */}
                <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-3xl">📋</span>
                  </div>
                </div>

                {/* 본문 */}
                <div className="p-6 text-center">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {t("common.profileIncompleteTitle")}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4 whitespace-pre-line">
                    {t("common.profileIncompleteDesc")}
                  </p>

                  <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">📱</span>
                      <span>{t("common.profileIncompletePhone")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">✏️</span>
                      <span>{t("common.profileIncompleteIntro")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">📝</span>
                      <span>{t("common.profileIncompleteDetail")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">📍</span>
                      <span>{t("common.profileIncompleteRegion")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-base">🔧</span>
                      <span>{t("common.profileIncompleteServices")}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileIncompleteModal(false);
                      router.push("/profile");
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-orange-500 transition-all shadow-md active:scale-[0.98]"
                  >
                    {t("common.profileIncompleteBtn")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </NavStateContext.Provider>
    </ToastProvider>
  );
}
