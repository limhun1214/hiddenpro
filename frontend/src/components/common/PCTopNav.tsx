"use client";

import React, { useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { NavStateContext } from '@/context/NavStateContext';

export default function PCTopNav({ isFixed = false }: { isFixed?: boolean }) {
    const router = useRouter();
    const pathname = usePathname();
    const navState = useContext(NavStateContext);

    const customerItems = [
        { label: '견적요청', href: '/request', icon: '📝' },
        { label: '받은견적', href: '/quotes/received', icon: '📩' },
        { label: '채팅', href: '/chat', icon: '💬' },
        { label: '알림', href: '/notifications', icon: '🔔' },
        { label: '고객 프로필', href: '/profile', icon: '👤' },
    ];

    const proItems = [
        { label: '받은요청', href: '/pro/requests', icon: '📋' },
        { label: '채팅', href: '/chat', icon: '💬' },
        { label: '지갑', href: '/pro/wallet', icon: '💰' },
        { label: '알림', href: '/notifications', icon: '🔔' },
        { label: '고수 프로필', href: '/profile', icon: '👤' },
    ];

    const items = navState.isProUser ? proItems : customerItems;
    const proProfileRequiredPaths = ['/pro/requests', '/chat', '/pro/wallet', '/notifications'];

    return (
        <div className={`hidden lg:block w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-[60] shadow-sm shrink-0 ${isFixed ? 'fixed top-0 left-0' : 'sticky top-0'}`}>
            <div className="flex flex-row justify-end items-center space-x-8 px-8 py-5 w-full max-w-4xl mx-auto">
                {items.map(item => {
                    const isActive = pathname === item.href || (pathname?.startsWith(item.href) && item.href !== '/');
                    return (
                        <button
                            key={item.label}
                            onClick={(e) => {
                                if (navState.isProUser && !navState.isProProfileComplete && proProfileRequiredPaths.some(p => item.href.startsWith(p))) {
                                    e.preventDefault();
                                    navState.setShowProfileIncompleteModal(true);
                                    return;
                                }
                                router.push(item.href);
                            }}
                            className={`flex items-center space-x-2 transition-colors relative ${isActive ? 'text-blue-600 font-bold' : 'text-gray-500 hover:text-blue-500 font-medium'}`}
                        >
                            <div className="relative text-xl">
                                {item.icon}
                                {item.label === '알림' && navState.unreadNotifsCount > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                                {item.label === '채팅' && navState.unreadChatsCount > 0 && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                                {item.label === '받은견적' && navState.hasNewQuotes && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                                {item.label === '받은요청' && navState.hasNewRequests && (
                                    <span className="absolute -top-1 -right-2 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                    </span>
                                )}
                                {navState.isProUser && item.label === '지갑' && (
                                    <span className="absolute -bottom-1 -right-8 flex h-4 px-1 rounded-full bg-yellow-400 items-center justify-center text-[10px] font-black text-white border-2 border-white shadow-sm whitespace-nowrap">
                                        {navState.walletBalance !== null ? navState.walletBalance.toLocaleString() : 'C'}
                                    </span>
                                )}
                            </div>
                            <span className="text-sm tracking-tight">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

