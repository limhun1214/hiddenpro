"use client";

import React from 'react';
import Link from 'next/link';

export default function GlobalFooter() {
    return (
        <footer className="bg-gray-50 border-t border-gray-200 shrink-0">
            <div className="max-w-7xl mx-auto px-4 py-8 text-center">
                <div className="flex flex-wrap justify-center items-center gap-3 text-xs text-gray-500 mb-4 font-medium">
                    <Link href="/legal/TERMS" className="hover:text-gray-900 transition">이용약관</Link>
                    <span>|</span>
                    <Link href="/legal/PRIVACY" className="hover:text-gray-900 transition">개인정보처리방침</Link>
                    <span>|</span>
                    <Link href="/support/business-info" className="hover:text-gray-900 transition">사업자정보</Link>
                </div>

                <p className="text-xs text-gray-400 font-medium">© 2026 HiddenPro. All rights reserved.</p>
                {/* 탭 바 공간 확보 (pb-20) */}
                <div className="h-[80px] md:h-0"></div>
            </div>
        </footer>
    );
}
