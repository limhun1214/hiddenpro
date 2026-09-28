"use client";

import React, { useEffect, useState, useRef } from "react";
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
  const noticeDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLoginModal && !showProfileIncompleteModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = noticeDialogRef.current;
    dialog?.querySelector<HTMLButtonElement>("button")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLoginModal(false);
        setShowProfileIncompleteModal(false);
      }
      if (event.key !== "Tab" || !dialog) return;
      const controls = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex="0"]',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [showLoginModal, showProfileIncompleteModal]);

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

  // 일반 화면은 문서 스크롤을 사용하고 채팅방만 고정 높이를 유지한다.
  const isSpecialPage = isLandingPage || isAdminPage;

  // 최상위 컨테이너 클래스 (조건부 라우팅)
  const rootContainerClasses = isLandingPage
    ? "hp-app-shell flex flex-col min-h-screen relative w-full bg-[#f7f8fa]"
    : isAdminPage
      ? "flex flex-col min-h-screen relative overflow-hidden w-full"
      : `hp-app-shell flex flex-col w-full min-h-screen bg-[#f7f8fa] relative ${isChatRoom ? "lg:h-[100dvh] lg:overflow-hidden" : ""}`;

  // 우측 영역(본문) 컨테이너 클래스 (서브 페이지용)
  const rightPanelClasses = `flex flex-col w-full flex-1 min-h-screen bg-[#f7f8fa] relative ${isChatRoom ? "lg:min-h-0 lg:h-full" : ""}`;

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
        <div className={rootContainerClasses} data-app-page={isLandingPage ? "home" : isAdminPage ? "admin" : "internal"} data-route={currentPath}>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000] focus:rounded-xl focus:bg-[#176b57] focus:px-5 focus:py-3 focus:font-semibold focus:text-white focus:shadow-lg">
            {t("common.skipToContent")}
          </a>

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
              <header
                className="hp-mobile-header lg:hidden sticky top-0 z-40 w-full border-b border-[#e1e7e3] bg-white/95 backdrop-blur-xl shrink-0"
              >
                <div className="flex items-center px-5 py-3 gap-2">
                  <Link href="/" aria-label="HiddenPro" className="mr-auto flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#176b57]">
                    <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173e31] text-white">
                      <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M12 9v22m0-11c0-8 13-8 13 0v11" stroke="#e2f2a6" strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="30" r="2.5" fill="#f7f8f2"/></svg>
                    </span>
                    <span className="text-xl font-extrabold tracking-[-0.06em] text-[#142522]">Hidden<span className="text-[#176b57]">Pro</span></span>
                  </Link>
                  {isProUser && (
                    <button
                      onClick={() => router.push("/pro/wallet")}
                      aria-label={t("pcTopNav.wallet")}
                      aria-current={currentPath === "/pro/wallet" ? "page" : undefined}
                      className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${currentPath === "/pro/wallet" ? "bg-[#e8f3ed] text-[#176b57]" : "text-[#64716b] hover:bg-[#f2f5f3]"}`}
                    >
                      <span
                        aria-hidden="true"
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
                    aria-label={t("pcTopNav.notifications")}
                    aria-current={currentPath === "/notifications" ? "page" : undefined}
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${currentPath === "/notifications" ? "bg-[#e8f3ed] text-[#176b57]" : "text-[#64716b] hover:bg-[#f2f5f3]"}`}
                  >
                    <span
                      aria-hidden="true"
                      className="material-symbols-outlined text-[22px]"
                      style={{
                        fontVariationSettings:
                          unreadNotifsCount > 0 ? "'FILL' 1" : "'FILL' 0",
                      }}
                    >
                      notifications
                    </span>
                    {unreadNotifsCount > 0 && (
                      <span aria-hidden="true" className="absolute top-2 right-2 flex h-2.5 w-2.5">
                        <span
                          className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white`}
                        ></span>
                      </span>
                    )}
                  </button>
                  {isAdminUser && <LanguageSwitcher />}
                </div>
              </header>
            )}

            {isCheckingAuth &&
            (currentPath === "/pro" || currentPath.startsWith("/pro/")) ? (
              <div id="main-content" tabIndex={-1} role="status" className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div aria-hidden="true" className="animate-spin rounded-full h-10 w-10 border-2 border-[#dce7df] border-t-[#176b57]"></div>
                <span className="text-sm text-[#64716b]">{t("common.loading")}</span>
              </div>
            ) : (
              <>
                <main
                  id="main-content"
                  tabIndex={-1}
                  data-app-content="true"
                  data-page-kind={isLandingPage ? "home" : isAdminPage ? "admin" : "internal"}
                  className={`hp-main-content flex-1 flex flex-col w-full min-w-0 ${isChatRoom ? "lg:overflow-y-auto custom-scrollbar" : ""} ${!hideNavBar ? "pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0" : ""}`}
                >
                  {children}
                </main>

                {!hideNavBar && (
                  <nav
                    aria-label={t("common.primaryNavigation")}
                    className="hp-bottom-nav fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-[#e1e7e3] z-40 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
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
                              prefetch={false}
                              aria-current={isActive ? "page" : undefined}
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
                              className={`flex flex-col items-center justify-center w-full min-h-14 rounded-xl space-y-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#176b57] ${
                                isActive ? "text-[#176b57]" : "text-[#64716b] hover:text-[#142522]"
                              }`}
                            >
                              <div className={`relative flex h-7 w-14 items-center justify-center rounded-full ${isActive ? "bg-[#e8f3ed]" : ""}`}>
                                <span
                                  aria-hidden="true"
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
                                        className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white`}
                                      ></span>
                                    </span>
                                  )}

                                {item.key === "chat" &&
                                  unreadChatsCount > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                      <span
                                        className={`relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white`}
                                      ></span>
                                    </span>
                                  )}

                                {item.key === "quotes" && hasNewQuotes && (
                                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                  </span>
                                )}

                                {item.key === "requests" && hasNewRequests && (
                                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                  </span>
                                )}

                                {isProUser && item.key === "wallet" && (
                                  <span
                                    className={`absolute -bottom-1 -right-8 flex h-4 px-1 rounded-full bg-yellow-400 items-center justify-center text-[10px] font-black text-white border-2 border-white shadow-sm whitespace-nowrap`}
                                  >
                                    {walletBalance !== null
                                      ? walletBalance.toLocaleString()
                                      : "C"}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`text-[11px] ${isActive ? "font-bold" : "font-medium"}`}
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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#142522]/50 backdrop-blur-sm">
              <div ref={noticeDialogRef} role="dialog" aria-modal="true" aria-labelledby="login-required-title" className="bg-[#f7f8f2] border border-[#dce4d6] rounded-3xl w-full max-w-sm max-h-[90dvh] overflow-y-auto shadow-2xl">
                <div className="bg-[#173e31] p-6 text-center">
                  <div className="w-16 h-16 bg-[#e2f2a6] text-[#173e31] rounded-2xl flex items-center justify-center mx-auto">
                    <span aria-hidden="true" className="material-symbols-outlined text-3xl">lock</span>
                  </div>
                </div>
                <div className="p-6 text-center">
                  <h3 id="login-required-title" className="text-lg font-bold text-[#142522] mb-2">
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
                      className="flex-[2] py-3 bg-[#173e31] text-white font-bold rounded-xl hover:bg-[#245d47] transition-colors text-sm"
                    >
                      {t("common.loginRequiredBtn")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showProfileIncompleteModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#142522]/50 backdrop-blur-sm">
              <div ref={noticeDialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-incomplete-title" className="bg-white rounded-3xl w-full max-w-sm max-h-[90dvh] overflow-y-auto shadow-2xl">
                {/* 아이콘 헤더 */}
                <div className="bg-[#e8f3ed] p-6 text-center">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-3xl">📋</span>
                  </div>
                </div>

                {/* 본문 */}
                <div className="p-6 text-center">
                  <h3 id="profile-incomplete-title" className="text-lg font-bold text-[#142522] mb-2">
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
                    className="w-full py-3.5 bg-[#176b57] text-white font-bold rounded-xl hover:bg-[#105441] transition-colors"
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
