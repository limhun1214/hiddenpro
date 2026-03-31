"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  DYNAMIC_ANSWER_LABELS,
  DYNAMIC_ANSWER_ORDERED_KEYS,
} from "@/constants/dynamicAnswerLabels";

interface QuoteDetailModalProps {
  quote: {
    quote_id: string;
    pro_id: string;
    price?: number | null;
    description?: string | null;
    image_url?: string | null;
    created_at: string;
    pro_profiles?: {
      pro_id: string;
      average_rating?: number;
      review_count?: number;
      is_phone_verified?: boolean;
      facebook_url?: string;
    };
  };
  onClose: () => void;
  onStartChat: (quote: any) => void;
  requestId: string;
  request?: any;
  isReadOnly?: boolean;
  proName?: string;
}

export default function QuoteDetailModal({
  quote,
  onClose,
  onStartChat,
  requestId,
  request,
  isReadOnly,
  proName,
}: QuoteDetailModalProps) {
  const t = useTranslations();
  const proProfile = Array.isArray(quote.pro_profiles)
    ? quote.pro_profiles[0]
    : quote.pro_profiles;
  const userInfo = proProfile?.users
    ? Array.isArray(proProfile.users)
      ? proProfile.users[0]
      : proProfile.users
    : null;
  const displayProName =
    proName ||
    (userInfo?.nickname && userInfo.nickname.trim() !== ""
      ? userInfo.nickname
      : userInfo?.name || "Pro");
  const avatarUrl = userInfo?.avatar_url || null;
  const avgRating = proProfile?.average_rating || 0;
  const reviewCount = proProfile?.review_count || 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div className="flex-1 flex items-center justify-center">
        <div
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">
              {t("quoteModal.title")}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500"
            >
              ✕
            </button>
          </div>

          {/* 스크롤 가능 본문 */}
          <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-4">
            {/* A. 고수 정보 + 트러스트 배지 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-5 h-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="font-bold text-gray-800 text-base">
                    {displayProName}님
                  </span>
                  {proProfile?.is_phone_verified && (
                    <span className="inline-flex items-center text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap">
                      {t("quoteModal.phoneVerified")}
                    </span>
                  )}
                  {proProfile?.facebook_url && (
                    <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">
                      {t("quoteModal.facebookLinked")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-bold text-yellow-500">
                    ⭐ {Number(avgRating).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({reviewCount}
                    {t("quoteModal.reviewCount")})
                  </span>
                </div>
              </div>
            </div>

            {/* 한 줄 소개 */}
            {proProfile?.intro && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                "{proProfile.intro}"
              </p>
            )}

            {/* B. 제안 금액 (가장 눈에 띄게) */}
            <div className="bg-blue-50 py-3 px-5 rounded-xl border border-blue-100 text-center">
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">
                {t("quoteModal.proposedPrice")}
              </span>
              {quote.price ? (
                <span className="text-3xl font-black text-gray-900">
                  {Number(quote.price).toLocaleString()}
                </span>
              ) : (
                <span className="text-lg font-bold text-gray-400">
                  {t("quoteModal.noPrice")}
                </span>
              )}
            </div>

            {/* C. 상세 설명 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                {t("quoteModal.descriptionTitle")}
              </h3>
              {quote.description ? (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {quote.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  {t("quoteModal.noDescription")}
                </p>
              )}
            </div>

            {/* D. 첨부 사진 */}
            {(() => {
              let imageList: string[] = [];
              if (quote.image_url) {
                if (quote.image_url.startsWith("[")) {
                  try {
                    const parsed = JSON.parse(quote.image_url);
                    if (Array.isArray(parsed)) {
                      imageList = parsed;
                    }
                  } catch (e) {
                    imageList = [quote.image_url];
                  }
                } else {
                  imageList = [quote.image_url];
                }
              }

              if (imageList.length === 0) return null;

              return (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("quoteModal.photosTitle")} ({imageList.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {imageList.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`${t("quoteModal.quoteImageAlt")}${idx + 1}`}
                          className="w-full rounded-lg object-contain border border-gray-200 shadow-sm max-h-80 bg-white"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* E. 요청 내용 (고객 원본 데이터) */}
            {request && request.dynamic_answers && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-6">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {t("quoteModal.requestTitle")}
                </h3>
                <ul className="space-y-3">
                  {(() => {
                    const dynamicAnswers = { ...request.dynamic_answers };
                    delete dynamicAnswers.details_mode;
                    delete dynamicAnswers.depth1;
                    delete dynamicAnswers.depth2;

                    if (
                      dynamicAnswers.region_reg &&
                      dynamicAnswers.region_city
                    ) {
                      dynamicAnswers.merged_region = `${dynamicAnswers.region_reg}, ${dynamicAnswers.region_city}`;
                      delete dynamicAnswers.region_reg;
                      delete dynamicAnswers.region_city;
                    }

                    const answerEntries = Object.entries(dynamicAnswers).filter(
                      ([k, v]) => {
                        if (v === null || v === undefined || v === "")
                          return false;
                        if (
                          [
                            "details_mode",
                            "depth1",
                            "depth2",
                            "_history",
                          ].includes(k)
                        )
                          return false;
                        return true;
                      },
                    );

                    answerEntries.sort((a, b) => {
                      const indexA = DYNAMIC_ANSWER_ORDERED_KEYS.indexOf(a[0]);
                      const indexB = DYNAMIC_ANSWER_ORDERED_KEYS.indexOf(b[0]);
                      if (indexA === -1 && indexB === -1) return 0;
                      if (indexA === -1) return 1;
                      if (indexB === -1) return -1;
                      return indexA - indexB;
                    });

                    const labelMap = DYNAMIC_ANSWER_LABELS;

                    if (answerEntries.length === 0) {
                      return (
                        <p className="text-sm text-gray-400">
                          {t("quoteModal.noRequestDetails")}
                        </p>
                      );
                    }

                    return answerEntries.map(([key, value]) => {
                      const label = labelMap[key] || key;
                      return (
                        <li key={key} className="flex flex-col">
                          <span className="text-xs text-gray-400 font-medium mb-1">
                            {label}
                          </span>
                          <div className="text-sm font-medium text-gray-800 bg-white p-2.5 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                            {(() => {
                              if (key === "images" && Array.isArray(value)) {
                                return (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {value.map((img: any, i: number) => (
                                      <a
                                        key={i}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block relative cursor-pointer hover:opacity-90 transition group overflow-hidden rounded-lg"
                                      >
                                        <img
                                          src={img.url}
                                          className="w-20 h-20 object-cover border border-gray-200"
                                          alt={`${t("quoteModal.imageAlt")}${i + 1}`}
                                        />
                                        {img.description && (
                                          <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate text-center transition-all group-hover:bg-black/80">
                                            {img.description}
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                );
                              }
                              if (
                                value &&
                                typeof value === "object" &&
                                !Array.isArray(value)
                              ) {
                                const v = value as any;
                                if (v.reg && v.city)
                                  return `${v.reg}, ${v.city}`;
                                return JSON.stringify(value);
                              }
                              if (Array.isArray(value)) {
                                return value.join(", ");
                              }
                              return String(value);
                            })()}
                          </div>
                        </li>
                      );
                    });
                  })()}
                </ul>
              </div>
            )}

            {/* 견적 도착 시간 */}
            <p className="text-xs text-gray-400 text-right">
              {t("quoteModal.arrivedAt")}
              {new Date(quote.created_at).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
