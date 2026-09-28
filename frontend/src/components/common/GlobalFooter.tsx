"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function GlobalFooter() {
  const t = useTranslations();
  const linkClass = "w-fit text-sm leading-6 text-[#63716a] transition-colors hover:text-[#176b57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#176b57] rounded-sm";

  return (
    <footer className="hp-footer shrink-0 border-t border-[#dfe6e1] bg-[#f0f4f1]">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:px-10 lg:py-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg text-[#142522] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#176b57]">
              <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173e31] text-white">
                <svg width="28" height="28" viewBox="0 0 40 40" fill="none"><path d="M12 9v22m0-11c0-8 13-8 13 0v11" stroke="#e2f2a6" strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="30" r="2.5" fill="#f7f8f2"/></svg>
              </span>
              <span className="text-2xl font-extrabold tracking-[-0.06em]">Hidden<span className="text-[#176b57]">Pro</span></span>
            </Link>
            <p className="mt-5 max-w-[260px] text-sm leading-7 text-[#63716a]">{t("footer.tagline")}</p>
          </div>
          <nav aria-labelledby="footer-services" className="flex flex-col gap-3">
            <h2 id="footer-services" className="mb-1 text-sm font-bold text-[#142522]">{t("footer.services")}</h2>
            <Link href="/" className={linkClass}>{t("pcTopNav.home")}</Link>
            <Link href="/request" className={linkClass}>{t("pcTopNav.requestQuote")}</Link>
          </nav>
          <nav aria-labelledby="footer-support" className="flex flex-col gap-3">
            <h2 id="footer-support" className="mb-1 text-sm font-bold text-[#142522]">{t("footer.support")}</h2>
            <Link href="/support/inquiry" className={linkClass}>{t("footer.contactUs")}</Link>
            <Link href="/support/business-info" className={linkClass}>{t("footer.businessInfo")}</Link>
          </nav>
          <nav aria-labelledby="footer-legal" className="flex flex-col gap-3">
            <h2 id="footer-legal" className="mb-1 text-sm font-bold text-[#142522]">{t("footer.legal")}</h2>
            <Link href="/legal/TERMS" className={linkClass}>{t("footer.terms")}</Link>
            <Link href="/legal/PRIVACY" className={linkClass}>{t("footer.privacy")}</Link>
            <Link href="/support/customer/refund" className={linkClass}>{t("footer.refund")}</Link>
          </nav>
        </div>
        <p className="mt-10 border-t border-[#dfe6e1] pt-6 text-xs leading-6 text-[#63716a]">
          © {new Date().getFullYear()} HiddenPro. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
