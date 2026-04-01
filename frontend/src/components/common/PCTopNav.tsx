"use client";

import React, { useContext, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { NavStateContext } from "@/context/NavStateContext";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

const ADMIN_PIN = "191214";

interface NavItem {
  label: string;
  href: string;
  symbol: string;
  color: string;
}

function NavPillButton({
  item,
  isActive,
  onClick,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 active:scale-95 whitespace-nowrap ${
          isActive
            ? "bg-[#E8F0FE] text-[#1a73e8]"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        {item.label}
        {badge && <span className="relative">{badge}</span>}
      </button>
    </div>
  );
}

export default function PCTopNav({ isFixed = false }: { isFixed?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const navState = useContext(NavStateContext);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const customerMainItems: NavItem[] = [
    { label: "Home", href: "/", symbol: "home", color: "#1a73e8" },
    {
      label: "Quotes",
      href: "/quotes/received",
      symbol: "request_quote",
      color: "#1a73e8",
    },
    { label: "Chat", href: "/chat", symbol: "chat", color: "#1a73e8" },
  ];

  const proMainItems: NavItem[] = [
    { label: "Home", href: "/", symbol: "home", color: "#1a73e8" },
    {
      label: "Requests",
      href: "/pro/requests",
      symbol: "assignment",
      color: "#1a73e8",
    },
    { label: "Chat", href: "/chat", symbol: "chat", color: "#1a73e8" },
  ];

  const profileItem: NavItem = {
    label: "Profile",
    href: "/profile",
    symbol: "person",
    color: "#1a73e8",
  };

  const walletItem: NavItem = {
    label: "Credits",
    href: "/pro/wallet",
    symbol: "account_balance_wallet",
    color: "#1a73e8",
  };

  const notificationsItem: NavItem = {
    label: "Notifications",
    href: "/notifications",
    symbol: "notifications",
    color: "#1a73e8",
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

  const showLogo = !navState.isLoggedIn;

  return (
    <>
      <div
        className={`hidden lg:block w-full bg-white border-b border-gray-200 z-[60] shrink-0 ${isFixed ? "fixed top-0 left-0" : "sticky top-0"}`}
      >
        <div className="flex flex-row justify-between items-center px-8 py-3 w-full max-w-4xl mx-auto">
          {/* 로고 — 비로그인 상태에서만 표시 */}
          {showLogo ? (
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 shrink-0"
            >
              <Image
                src="/favicon.svg"
                alt="Hidden Logo"
                width={28}
                height={28}
                priority
              />
              <span className="font-bold text-[#2563EB] text-lg tracking-tight">
                Hidden
              </span>
            </button>
          ) : (
            <div />
          )}

          {/* 우측 네비게이션 */}
          <div className="flex items-center gap-3">
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
                  onClick={() => {
                    if (
                      navState.isProUser &&
                      !navState.isProProfileComplete &&
                      proProfileRequiredPaths.some((p) =>
                        item.href.startsWith(p),
                      )
                    ) {
                      navState.setShowProfileIncompleteModal(true);
                      return;
                    }
                    router.push(item.href);
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
                onClick={() => router.push("/pro/wallet")}
              />
            )}

            {/* 알림 */}
            <NavPillButton
              item={notificationsItem}
              isActive={pathname === "/notifications"}
              onClick={() => router.push("/notifications")}
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
                className="bg-[#a68cff] text-white rounded-full px-4 py-1.5 text-sm hover:bg-[#9070ff] transition-colors"
              >
                관리자 대시보드
              </button>
            )}

            {navState.isAdminUser && <LanguageSwitcher />}

            {/* Profile — 항상 가장 우측 */}
            <NavPillButton
              item={profileItem}
              isActive={pathname === "/profile"}
              onClick={() => router.push("/profile")}
            />
          </div>
        </div>
      </div>

      {/* PIN 입력 모달 */}
      {showPinModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-xs flex flex-col gap-5">
            <h2 className="text-lg font-bold text-gray-900 text-center">
              관리자 인증
            </h2>
            <p className="text-sm text-gray-500 text-center">
              PIN 번호를 입력하세요
            </p>
            <input
              type="password"
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
              autoFocus
              className="border border-gray-300 rounded-xl px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-[#a68cff] transition"
            />
            {pinError && (
              <p className="text-red-500 text-sm text-center -mt-2">
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
                className="flex-1 py-2.5 rounded-xl bg-[#a68cff] text-white text-sm font-semibold hover:bg-[#9070ff] transition"
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
