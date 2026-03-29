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
      <div className="min-h-screen bg-[#0f0d13] flex flex-col">
        <div className="flex justify-between items-center px-4 h-14 bg-[#0f0d13] border-b border-[#4a474e]/15 sticky top-0 z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1b1820] transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[#ff88b5]">
              arrow_back
            </span>
          </button>
          <h1 className="font-bold text-[#f8f1fb]">{t("legal.title")}</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#27242d] border-t-[#ff88b5] animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!legalDoc) {
    return (
      <div className="min-h-screen bg-[#0f0d13] flex flex-col">
        <div className="flex justify-between items-center px-4 h-14 bg-[#0f0d13] border-b border-[#4a474e]/15 sticky top-0 z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1b1820] transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[#ff88b5]">
              arrow_back
            </span>
          </button>
          <h1 className="font-bold text-[#f8f1fb]">{t("legal.notFound")}</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-[#aea9b2] mb-4 text-6xl">⚖️</div>
          <h2 className="text-xl font-bold text-[#f8f1fb] mb-2">
            {t("legal.notFoundDesc")}
          </h2>
          <p className="text-[#aea9b2] mb-6">{t("legal.notFoundSub")}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] px-6 py-3 rounded-full font-bold active:scale-[0.98] transition-all"
          >
            {t("common.goToMain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0d13] text-[#f8f1fb] flex flex-col pb-32">
      <header className="flex justify-between items-center px-4 h-14 bg-[#0f0d13] border-b border-[#4a474e]/15 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1b1820] transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-[#ff88b5]">
            arrow_back
          </span>
        </button>
        <h1 className="font-bold text-[#f8f1fb]">
          {legalDoc.document_type === "TERMS"
            ? t("legal.terms")
            : t("legal.privacy")}
        </h1>
        <div className="w-10"></div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8 md:px-8">
        {/* 에디토리얼 헤더 */}
        <div className="mb-10">
          <span className="text-[#ff88b5] font-bold tracking-widest text-xs uppercase mb-3 block">
            Legal
          </span>
          <div className="flex justify-between items-end gap-4 mb-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#f8f1fb] tracking-tight leading-tight">
              {legalDoc.title}
            </h2>
            <span className="bg-[#211e26] text-[#aea9b2] text-xs font-mono px-2 py-1 rounded shrink-0">
              {legalDoc.version}
            </span>
          </div>
          <p className="text-sm text-[#78747c] font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              calendar_today
            </span>
            {t("legal.effectiveDate")} {legalDoc.effective_date}
          </p>
        </div>

        <div
          className="
            prose max-w-none
            prose-headings:font-bold prose-headings:text-[#f8f1fb]
            prose-p:text-[#aea9b2] prose-p:leading-relaxed
            prose-li:text-[#aea9b2] prose-li:my-1
            prose-a:text-[#ff88b5] prose-a:underline prose-a:underline-offset-2
            prose-strong:text-[#f8f1fb]
            prose-hr:border-[#4a474e]/30
            prose-blockquote:border-l-[#ff88b5] prose-blockquote:text-[#aea9b2]
            prose-code:text-[#ff88b5] prose-code:bg-[#1b1820]
            whitespace-pre-wrap break-keep
          "
          dangerouslySetInnerHTML={{ __html: legalDoc.content }}
        />
      </main>
    </div>
  );
}
