"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function GlobalFooter() {
  const t = useTranslations();
  return (
    <footer className="bg-[#0f0d13] shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="flex flex-wrap justify-center items-center gap-6 text-xs text-gray-500 mb-2 font-medium">
          <Link href="/legal/TERMS" className="hover:text-gray-900 transition">
            {t("footer.terms")}
          </Link>
          <Link
            href="/legal/PRIVACY"
            className="hover:text-gray-900 transition"
          >
            {t("footer.privacy")}
          </Link>
        </div>

        <div className="mb-2">
          <Link
            href="/support/business-info"
            className="text-xs text-gray-500 hover:text-gray-900 transition font-medium"
          >
            {t("footer.businessInfo")}
          </Link>
        </div>

        <p className="text-xs text-gray-500 font-medium">
          © {new Date().getFullYear()} HiddenPro. All rights reserved.
        </p>
        {/* 탭 바 공간 확보 (pb-20) */}
        <div className="h-[80px] md:h-0"></div>
      </div>
    </footer>
  );
}
