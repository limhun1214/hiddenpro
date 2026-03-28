"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function GlobalFooter() {
  const t = useTranslations();
  return (
    <footer className="bg-[#0f0d13] shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 text-xs text-gray-500 mb-2 font-medium">
          <Link href="/legal/TERMS" className="hover:text-gray-400 transition">
            {t("footer.terms")}
          </Link>
          <span className="text-gray-700">|</span>
          <Link
            href="/legal/PRIVACY"
            className="hover:text-gray-400 transition"
          >
            {t("footer.privacy")}
          </Link>
          <span className="text-gray-700">|</span>
          <Link href="/legal/REFUND" className="hover:text-gray-400 transition">
            {t("footer.refund")}
          </Link>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-x-2 gap-y-1 mb-2">
          <Link
            href="/support/inquiry"
            className="text-xs text-gray-500 hover:text-gray-400 transition font-medium"
          >
            {t("footer.contactUs")}
          </Link>
          <span className="text-xs text-gray-700">|</span>
          <Link
            href="/support/business-info"
            className="text-xs text-gray-500 hover:text-gray-400 transition font-medium"
          >
            {t("footer.businessInfo")}
          </Link>
        </div>

        <p className="text-xs text-gray-500 font-medium">
          © {new Date().getFullYear()} HiddenPro. All rights reserved.
          <span className="mx-2 text-gray-700">|</span>
          {t("footer.businessRegNo")} [사업자등록번호]
        </p>
        {/* 탭 바 공간 확보 (pb-20) */}
        <div className="h-[80px] md:h-0"></div>
      </div>
    </footer>
  );
}
