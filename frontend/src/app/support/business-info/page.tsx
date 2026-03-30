"use client";
export const runtime = "edge";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function BusinessInfoPage() {
  const t = useTranslations();
  const router = useRouter();
  const [bizInfoHtml, setBizInfoHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBizInfo = async () => {
      const { data } = await supabase
        .from("support_pages")
        .select("content")
        .eq("slug", "business")
        .eq("is_active", true)
        .single();

      if (data && data.content) {
        setBizInfoHtml(data.content);
      }
      setLoading(false);
    };
    fetchBizInfo();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="flex justify-between items-center px-4 h-14 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[#D32D7D]">
              arrow_back
            </span>
          </button>
          <h1 className="font-bold text-gray-900">{t("businessInfo.title")}</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-[#D32D7D] animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col pb-32">
      <header className="flex justify-between items-center px-4 h-14 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-[#D32D7D]">
            arrow_back
          </span>
        </button>
        <h1 className="font-bold text-gray-900">{t("businessInfo.title")}</h1>
        <div className="w-10"></div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8 md:px-8">
        {/* 에디토리얼 헤더 */}
        <div className="mb-10">
          <span className="text-[#D32D7D] font-bold tracking-widest text-xs uppercase mb-3 block">
            Business
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            {t("businessInfo.title")}
          </h2>
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
            whitespace-pre-wrap break-keep leading-relaxed
          "
        >
          {bizInfoHtml ? (
            <div dangerouslySetInnerHTML={{ __html: bizInfoHtml }} />
          ) : (
            <div className="space-y-4 text-gray-500">
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.companyName")}
                </strong>{" "}
                HiddenPro Philippines Inc.
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.representative")}
                </strong>{" "}
                [대표자 성함]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.businessReg")}
                </strong>{" "}
                [000-000-000]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.tin")}
                </strong>{" "}
                [000-000-000-000]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.ecommerce")}
                </strong>{" "}
                [현지 허가 번호 또는 DTI Permit No.]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.headquarters")}
                </strong>{" "}
                [12F, XYZ Building, Bonifacio Global City, Taguig, Metro Manila,
                Philippines]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.support")}
                </strong>{" "}
                [+63-2-XXXX-XXXX] {t("businessInfo.supportHours")}
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.email")}
                </strong>{" "}
                [help@hiddenpro.ph]
              </p>
              <p>
                <strong className="text-gray-900">
                  {t("businessInfo.hosting")}
                </strong>{" "}
                Amazon Web Services (AWS)
              </p>
              <hr className="my-6 border-gray-200" />
              <p className="text-gray-400 text-sm">
                {t("businessInfo.disclaimer")}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
