"use client";

import React from "react";
import { useTranslations } from "next-intl";

export default function BrandSidePanel() {
  const t = useTranslations();
  return (
    <div className="hidden lg:flex w-[350px] shrink-0 flex-col justify-center sticky top-0 h-[100dvh] bg-[#0D1629] text-white p-8 lg:px-10 overflow-hidden relative border-r border-gray-800">
      <div className="relative z-10 w-full max-w-lg">
        {/* 로고 영역 */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-xl text-white font-black">H</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">
            HiddenPro
          </span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight leading-[1.5] mb-6 break-keep">
          {t("brandPanel.headline1")}
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            {t("brandPanel.headline2")}
          </span>
        </h1>
        <p className="text-sm text-gray-400 leading-[1.6] mb-12 break-keep">
          {t("brandPanel.subtext")
            .split("\n")
            .map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i === 0 && <br />}
              </React.Fragment>
            ))}
        </p>

        {/* Feature Micro-copy */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-white text-[15px]">
                {t("brandPanel.feature1Title")}
              </h4>
              <p className="text-sm text-gray-400 mt-1">
                {t("brandPanel.feature1Desc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-white text-[15px]">
                {t("brandPanel.feature2Title")}
              </h4>
              <p className="text-sm text-gray-400 mt-1">
                {t("brandPanel.feature2Desc")}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* 데코레이션 블러 */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
    </div>
  );
}
