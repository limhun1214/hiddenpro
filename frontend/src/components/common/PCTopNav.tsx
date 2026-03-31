"use client";

import React, { useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { NavStateContext } from "@/context/NavStateContext";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useTranslations } from "next-intl";

export default function PCTopNav({ isFixed = false }: { isFixed?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const navState = useContext(NavStateContext);

  const customerItems = [
    { label: t("pcTopNav.home"), href: "/", symbol: "home" },
    {
      label: t("pcTopNav.receivedQuotes"),
      href: "/quotes/received",
      symbol: "request_quote",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
    {
      label: t("pcTopNav.customerProfile"),
      href: "/profile",
      symbol: "person",
    },
  ];

  const proItems = [
    { label: t("pcTopNav.home"), href: "/", symbol: "home" },
    {
      label: t("pcTopNav.requests"),
      href: "/pro/requests",
      symbol: "assignment",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
    { label: t("pcTopNav.proProfile"), href: "/profile", symbol: "person" },
  ];

  const items = navState.isProUser ? proItems : customerItems;
  const proProfileRequiredPaths = ["/pro/requests", "/chat"];

  return (
    <div
      className={`hidden lg:block w-full bg-white border-b border-gray-200 z-[60] shrink-0 ${isFixed ? "fixed top-0 left-0" : "sticky top-0"}`}
    >
      <div className="flex flex-row justify-end items-center space-x-8 px-8 py-5 w-full max-w-4xl mx-auto">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname?.startsWith(item.href) && item.href !== "/");
          return (
            <button
              key={item.label}
              onClick={(e) => {
                if (
                  navState.isProUser &&
                  !navState.isProProfileComplete &&
                  proProfileRequiredPaths.some((p) => item.href.startsWith(p))
                ) {
                  e.preventDefault();
                  navState.setShowProfileIncompleteModal(true);
                  return;
                }
                router.push(item.href);
              }}
              className={`flex items-center space-x-2 transition-colors relative ${isActive ? "text-[#0020A0]" : "text-gray-500 hover:text-gray-800"}`}
            >
              <div className="relative text-xl">
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.symbol}
                </span>
                {item.href === "/chat" && navState.unreadChatsCount > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
                {item.href === "/quotes/received" && navState.hasNewQuotes && (
                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
                {item.href === "/pro/requests" && navState.hasNewRequests && (
                  <span className="absolute -top-1 -right-2 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                  </span>
                )}
              </div>
              <span className="text-sm tracking-tight">{item.label}</span>
            </button>
          );
        })}

        {/* 지갑 아이콘 (PRO 전용) */}
        {navState.isProUser && (
          <button
            onClick={() => router.push("/pro/wallet")}
            className="flex items-center space-x-2 transition-colors relative text-gray-500 hover:text-gray-800"
          >
            <div className="relative text-xl">
              <span
                className="material-symbols-outlined text-[22px]"
                style={{
                  fontVariationSettings:
                    pathname === "/pro/wallet" ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                account_balance_wallet
              </span>
            </div>
            <span className="text-sm tracking-tight">
              {t("pcTopNav.wallet")}
            </span>
          </button>
        )}

        {/* 알림 아이콘 */}
        <button
          onClick={() => router.push("/notifications")}
          className={`flex items-center space-x-2 transition-colors relative ${
            pathname === "/notifications"
              ? "text-[#0020A0]"
              : "text-gray-500 hover:text-gray-800"
          }`}
        >
          <div className="relative text-xl">
            <span
              className="material-symbols-outlined text-[22px]"
              style={{
                fontVariationSettings:
                  pathname === "/notifications" ||
                  navState.unreadNotifsCount > 0
                    ? "'FILL' 1"
                    : "'FILL' 0",
              }}
            >
              notifications
            </span>
            {navState.unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
              </span>
            )}
          </div>
          <span className="text-sm tracking-tight">
            {t("pcTopNav.notifications")}
          </span>
        </button>

        {navState.isAdminUser && (
          <button
            onClick={() => router.push("/admin")}
            className="bg-[#a68cff] text-white rounded-full px-4 py-1.5 text-sm hover:bg-[#9070ff] transition-colors"
          >
            관리자 대시보드
          </button>
        )}

        {navState.isAdminUser && <LanguageSwitcher />}
      </div>
    </div>
  );
}
