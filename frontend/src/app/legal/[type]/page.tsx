"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export const runtime = "edge";

export default function LegalDocumentViewer() {
  const t = useTranslations();
  const params = useParams();
  const router = useRouter();
  const [legalDoc, setLegalDoc] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      if (!params.type) return;
      const typeParam =
        typeof params.type === "string" ? params.type.toUpperCase() : "";

      // 타입(TERMS, PRIVACY)에 맞는 활성화된 최신 문서 가져오기
      const { data } = await supabase
        .from("legal_documents")
        .select("*")
        .eq("document_type", typeParam)
        .eq("is_active", true)
        .order("effective_date", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLegalDoc(data);
      }
      setLoading(false);
    };
    fetchDoc();
  }, [params]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
            >
              <span className="material-symbols-outlined text-[#D32D7D]">
                arrow_back
              </span>
            </button>
            <h1 className="font-bold text-gray-900">{t("legal.title")}</h1>
            <div className="w-10"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#D32D7D] animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!legalDoc) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 h-14 flex justify-between items-center">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
            >
              <span className="material-symbols-outlined text-[#D32D7D]">
                arrow_back
              </span>
            </button>
            <h1 className="font-bold text-gray-900">{t("legal.notFound")}</h1>
            <div className="w-10"></div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-gray-500 mb-4 text-6xl">⚖️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t("legal.notFoundDesc")}
          </h2>
          <p className="text-gray-500 mb-6">{t("legal.notFoundSub")}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-[#D32D7D] to-[#ff6ea9] text-white px-6 py-3 rounded-full font-bold active:scale-[0.98] transition-all"
          >
            {t("common.goToMain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col pb-32">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[#D32D7D]">
              arrow_back
            </span>
          </button>
          <h1 className="font-bold text-gray-900">
            {legalDoc.document_type === "TERMS"
              ? t("legal.terms")
              : legalDoc.document_type === "REFUND"
                ? t("legal.refund")
                : t("legal.privacy")}
          </h1>
          <div className="w-10"></div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8 md:px-8">
        {/* 에디토리얼 헤더 */}
        <div className="mb-10">
          <span className="text-[#D32D7D] font-bold tracking-widest text-xs uppercase mb-3 block">
            Legal
          </span>
          <div className="flex justify-between items-end gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {legalDoc.title}
            </h2>
            <span className="bg-gray-100 text-gray-500 text-xs font-mono px-2 py-1 rounded shrink-0">
              {legalDoc.version}
            </span>
          </div>
          <p className="text-sm text-gray-400 font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              calendar_today
            </span>
            {t("legal.effectiveDate")} {legalDoc.effective_date}
          </p>
        </div>

        <div
          className="
            prose max-w-none
            prose-headings:font-bold prose-headings:text-gray-900
            prose-p:text-gray-500 prose-p:leading-relaxed
            prose-li:text-gray-500 prose-li:my-1
            prose-a:text-[#D32D7D] prose-a:underline prose-a:underline-offset-2
            prose-strong:text-gray-900
            prose-hr:border-gray-200
            prose-blockquote:border-l-[#ff88b5] prose-blockquote:text-gray-500
            prose-code:text-[#D32D7D] prose-code:bg-gray-100
            whitespace-pre-wrap break-keep
          "
          dangerouslySetInnerHTML={{ __html: legalDoc.content }}
        />
      </main>
    </div>
  );
}
