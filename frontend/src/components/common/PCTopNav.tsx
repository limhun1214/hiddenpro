"use client";

import React, { useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NavStateContext } from "@/context/NavStateContext";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

const ADMIN_PIN = "191214";

interface NavItem {
  label: string;
  href: string;
  symbol: string;
}

function NavPillButton({
  item,
  isActive,
  onClick,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <Link
        href={item.href}
        prefetch={false}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={`relative flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#176b57] ${
          isActive
            ? "bg-[#e8f3ed] text-[#176b57]"
            : "text-[#64716b] hover:bg-[#f2f5f3] hover:text-[#142522]"
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[19px]">
          {item.symbol}
        </span>
        {item.label}
        {badge && <span className="relative">{badge}</span>}
      </Link>
    </div>
  );
}

export default function PCTopNav({ isFixed = false }: { isFixed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const navState = useContext(NavStateContext);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPinModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = pinDialogRef.current;
    dialog?.querySelector<HTMLInputElement>("input")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowPinModal(false);
      if (event.key !== "Tab" || !dialog) return;
      const controls = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
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
  }, [showPinModal]);

  const customerMainItems: NavItem[] = [
    { label: t("pcTopNav.home"), href: "/", symbol: "home" },
    {
      label: t("pcTopNav.receivedQuotes"),
      href: "/quotes/received",
      symbol: "request_quote",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
  ];

  const proMainItems: NavItem[] = [
    { label: t("pcTopNav.home"), href: "/", symbol: "home" },
    {
      label: t("pcTopNav.requests"),
      href: "/pro/requests",
      symbol: "assignment",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
  ];

  const profileItem: NavItem = {
    label: t(navState.isProUser ? "pcTopNav.proProfile" : "pcTopNav.customerProfile"),
    href: "/profile",
    symbol: "person",
  };

  const walletItem: NavItem = {
    label: t("pcTopNav.wallet"),
    href: "/pro/wallet",
    symbol: "account_balance_wallet",
  };

  const notificationsItem: NavItem = {
    label: t("pcTopNav.notifications"),
    href: "/notifications",
    symbol: "notifications",
  };

  const mainItems = navState.isProUser ? proMainItems : customerMainItems;
  const proProfileRequiredPaths = ["/pro/requests", "/chat"];

  const getBadge = (href: string) => {
    if (href === "/chat" && navState.unreadChatsCount > 0)
      return (
        <span className="absolute -top-1 -right-2 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white" />
        </span>
      );
    if (href === "/quotes/received" && navState.hasNewQuotes)
      return (
        <span className="absolute -top-1 -right-2 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white" />
        </span>
      );
    if (href === "/pro/requests" && navState.hasNewRequests)
      return (
        <span className="absolute -top-1 -right-2 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white" />
        </span>
      );
    return undefined;
  };

  return (
    <>
      <div
        className={`hp-desktop-nav hidden lg:block w-full bg-white/95 backdrop-blur-xl border-b border-[#e1e7e3] z-40 shrink-0 ${isFixed ? "fixed top-0 left-0" : "sticky top-0"}`}
      >
        <div className="flex items-center justify-between gap-6 px-6 xl:px-10 py-4 w-full max-w-[1440px] mx-auto">
          <Link href="/" aria-label="HiddenPro" className="flex shrink-0 items-center gap-2.5 rounded-lg text-[#142522] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#176b57]">
            <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173e31] text-white">
              <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M12 9v22m0-11c0-8 13-8 13 0v11" stroke="#e2f2a6" strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="30" r="2.5" fill="#f7f8f2"/></svg>
            </span>
            <span className="text-xl font-extrabold tracking-[-0.06em]">Hidden<span className="text-[#176b57]">Pro</span></span>
          </Link>

          {/* 우측 네비게이션 */}
          <nav aria-label={t("common.primaryNavigation")} className="flex items-center gap-1 xl:gap-2">
            {/* 메인 아이템 */}
            {mainItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (pathname?.startsWith(item.href) && item.href !== "/");
              return (
                <NavPillButton
                  key={item.href}
                  item={item}
                  isActive={isActive}
                  onClick={(event) => {
                    if (
                      navState.isProUser &&
                      !navState.isProProfileComplete &&
                      proProfileRequiredPaths.some((p) =>
                        item.href.startsWith(p),
                      )
                    ) {
                      event.preventDefault();
                      navState.setShowProfileIncompleteModal(true);
                      return;
                    }
                    if (isActive) window.dispatchEvent(new Event("gnb-tab-reset"));
                  }}
                  badge={getBadge(item.href)}
                />
              );
            })}

            {/* 지갑 (PRO 전용) */}
            {navState.isProUser && (
              <NavPillButton
                item={walletItem}
                isActive={pathname === "/pro/wallet"}
              />
            )}

            {/* 알림 */}
            <NavPillButton
              item={notificationsItem}
              isActive={pathname === "/notifications"}
              badge={
                navState.unreadNotifsCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white" />
                  </span>
                ) : undefined
              }
            />

            {/* 관리자 */}
            {navState.isAdminUser && (
              <button
                onClick={() => {
                  setPin("");
                  setPinError(false);
                  setShowPinModal(true);
                }}
                className="rounded-xl bg-[#e8f3ed] px-3 py-3 text-xs font-semibold text-[#176b57] hover:bg-[#d6e9de] transition-colors"
              >
                관리자 대시보드
              </button>
            )}

            {navState.isAdminUser && <LanguageSwitcher />}

            {/* Profile — 항상 가장 우측 */}
            <NavPillButton
              item={profileItem}
              isActive={pathname === "/profile"}
            />
          </nav>
        </div>
      </div>

      {/* PIN 입력 모달 */}
      {showPinModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#142522]/50 backdrop-blur-sm">
          <div ref={pinDialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-pin-title" className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs flex flex-col gap-5">
            <h2 id="admin-pin-title" className="text-lg font-bold text-gray-900 text-center">
              관리자 인증
            </h2>
            <p className="text-sm text-gray-500 text-center">
              PIN 번호 6자리를 입력하세요
            </p>
            <input
              type="password"
              aria-label="관리자 PIN"
              aria-invalid={pinError}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (pin === ADMIN_PIN) {
                    setShowPinModal(false);
                    router.push("/admin");
                  } else {
                    setPinError(true);
                    setPin("");
                  }
                }
              }}
              placeholder="PIN 입력"
              maxLength={10}
              className="border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-[#176b57] focus:ring-2 focus:ring-[#176b57]/20 transition"
            />
            {pinError && (
              <p role="alert" className="text-red-500 text-sm text-center -mt-2">
                PIN 번호가 올바르지 않습니다.
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm hover:bg-gray-50 transition"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (pin === ADMIN_PIN) {
                    setShowPinModal(false);
                    router.push("/admin");
                  } else {
                    setPinError(true);
                    setPin("");
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#173e31] text-white text-sm font-semibold hover:bg-[#105441] transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
