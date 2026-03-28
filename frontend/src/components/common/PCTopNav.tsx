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
    {
      label: t("pcTopNav.requestQuote"),
      href: "/request",
      symbol: "edit_note",
    },
    {
      label: t("pcTopNav.receivedQuotes"),
      href: "/quotes/received",
      symbol: "request_quote",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
    {
      label: t("referral.gnbInvite"),
      href: "/referral",
      symbol: "card_giftcard",
    },
    {
      label: t("pcTopNav.notifications"),
      href: "/notifications",
      symbol: "notifications",
    },
    {
      label: t("pcTopNav.customerProfile"),
      href: "/profile",
      symbol: "person",
    },
  ];

  const proItems = [
    {
      label: t("pcTopNav.requests"),
      href: "/pro/requests",
      symbol: "assignment",
    },
    { label: t("pcTopNav.chat"), href: "/chat", symbol: "chat" },
    {
      label: t("pcTopNav.wallet"),
      href: "/pro/wallet",
      symbol: "account_balance_wallet",
    },
    {
      label: t("referral.gnbInvite"),
      href: "/referral",
      symbol: "card_giftcard",
    },
    {
      label: t("pcTopNav.notifications"),
      href: "/notifications",
      symbol: "notifications",
    },
    { label: t("pcTopNav.proProfile"), href: "/profile", symbol: "person" },
  ];

  const items = navState.isProUser ? proItems : customerItems;
  const proProfileRequiredPaths = [
    "/pro/requests",
    "/chat",
    "/pro/wallet",
    "/notifications",
  ];

  return (
    <div
      className={`hidden lg:block w-full bg-[#0f0d13] border-b border-white/10 z-[60] shrink-0 ${isFixed ? "fixed top-0 left-0" : "sticky top-0"}`}
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
              className={`flex items-center space-x-2 transition-colors relative ${isActive ? "text-[#ff88b5]" : "text-white/50 hover:text-white/80"}`}
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
                {item.label === t("pcTopNav.notifications") &&
                  navState.unreadNotifsCount > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0f0d13]"></span>
                    </span>
                  )}
                {item.label === t("pcTopNav.chat") &&
                  navState.unreadChatsCount > 0 && (
                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0f0d13]"></span>
                    </span>
                  )}
                {item.label === t("pcTopNav.receivedQuotes") &&
                  navState.hasNewQuotes && (
                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0f0d13]"></span>
                    </span>
                  )}
                {item.label === t("pcTopNav.requests") &&
                  navState.hasNewRequests && (
                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#0f0d13]"></span>
                    </span>
                  )}
                {navState.isProUser && item.label === t("pcTopNav.wallet") && (
                  <span className="absolute -bottom-1 -right-8 flex h-4 px-1 rounded-full bg-yellow-400 items-center justify-center text-[10px] font-black text-white border-2 border-[#0f0d13] shadow-sm whitespace-nowrap">
                    {navState.walletBalance !== null
                      ? navState.walletBalance.toLocaleString()
                      : "C"}
                  </span>
                )}
              </div>
              <span className="text-sm tracking-tight">{item.label}</span>
            </button>
          );
        })}
        <LanguageSwitcher />
      </div>
    </div>
  );
}
