"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";

export const runtime = "edge";

export default function SupportPageViewer() {
  const params = useParams();
  const router = useRouter();
  const [pageContent, setPageContent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPage = async () => {
      if (!params.category || !params.slug) return;

      // 카테고리 슬러그로 카테고리 ID 조회
      const { data: catData } = await supabase
        .from("support_categories")
        .select("id, title")
        .eq("slug", params.category)
        .single();

      if (!catData) {
        setLoading(false);
        return;
      }

      // 카테고리 ID와 슬러그로 페이지 조회
      const { data: pageData } = await supabase
        .from("support_pages")
        .select("*")
        .eq("category_id", catData.id)
        .eq("slug", params.slug)
        .eq("is_active", true)
        .single();

      if (pageData) {
        setPageContent({ ...pageData, categoryTitle: catData.title });
      }
      setLoading(false);
    };
    fetchPage();
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
          <h1 className="font-bold text-[#f8f1fb]">고객 지원</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-4 border-[#27242d] border-t-[#ff88b5] animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!pageContent) {
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
          <h1 className="font-bold text-[#f8f1fb]">문서를 찾을 수 없음</h1>
          <div className="w-10"></div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-[#aea9b2] mb-4 text-6xl">📄</div>
          <h2 className="text-xl font-bold text-[#f8f1fb] mb-2">
            원하시는 페이지를 찾을 수 없습니다
          </h2>
          <p className="text-[#aea9b2] mb-6">
            주소가 잘못되었거나 문서가 삭제되었을 수 있습니다.
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] px-6 py-3 rounded-full font-bold active:scale-[0.98] transition-all"
          >
            메인으로 돌아가기
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
          {pageContent.categoryTitle}
        </h1>
        <div className="w-10"></div>
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8 md:px-8">
        {/* 에디토리얼 헤더 */}
        <div className="mb-10">
          <span className="text-[#ff88b5] font-bold tracking-widest text-xs uppercase mb-3 block">
            Documentation
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#f8f1fb] tracking-tight leading-tight mb-3">
            {pageContent.title}
          </h2>
        </div>
        {/* CMS V2 본문 영역: HTML 렌더링 */}
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
          dangerouslySetInnerHTML={{ __html: pageContent.content }}
        />
      </main>
    </div>
  );
}
