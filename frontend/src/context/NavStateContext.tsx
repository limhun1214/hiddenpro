"use client";

import { createContext } from "react";

export const NavStateContext = createContext<{
  unreadNotifsCount: number;
  unreadChatsCount: number;
  hasNewQuotes: boolean;
  hasNewRequests: boolean;
  isProUser: boolean;
  isLoggedIn: boolean;
  walletBalance: number | null;
  isProProfileComplete: boolean;
  isAdminUser: boolean;
  setShowProfileIncompleteModal: (show: boolean) => void;
}>({
  unreadNotifsCount: 0,
  unreadChatsCount: 0,
  hasNewQuotes: false,
  hasNewRequests: false,
  isProUser: false,
  isLoggedIn: false,
  walletBalance: null,
  isProProfileComplete: true,
  isAdminUser: false,
  setShowProfileIncompleteModal: () => {},
});
