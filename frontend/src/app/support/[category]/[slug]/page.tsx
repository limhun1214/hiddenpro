'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export const runtime = 'edge';

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
                .from('support_categories')
                .select('id, title')
                .eq('slug', params.category)
                .single();

            if (!catData) {
                setLoading(false);
                return;
            }

            // 카테고리 ID와 슬러그로 페이지 조회
            const { data: pageData } = await supabase
                .from('support_pages')
                .select('*')
                .eq('category_id', catData.id)
                .eq('slug', params.slug)
                .eq('is_active', true)
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
            <div className="min-h-screen bg-gray-50 flex flex-col pt-4">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                    <h1 className="font-bold text-gray-800">고객 지원</h1>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!pageContent) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col pt-4">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                    <h1 className="font-bold text-gray-800">문서를 찾을 수 없음</h1>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-gray-400 mb-4 text-6xl">📄</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">원하시는 페이지를 찾을 수 없습니다</h2>
                    <p className="text-gray-500 mb-6">주소가 잘못되었거나 문서가 삭제되었을 수 있습니다.</p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                    >
                        메인으로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col pt-4">
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                <h1 className="font-bold text-gray-800">{pageContent.categoryTitle}</h1>
                <div className="w-10"></div>
            </div>
            <main className="flex-1 w-full max-w-3xl mx-auto p-5 md:p-8">
                <div className="mb-6 md:mb-10 pb-6 border-b border-gray-100">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                        {pageContent.title}
                    </h1>
                </div>
                {/* 
                    CMS V2 본문 영역: HTML 렌더링 
                    tailwindcss typography 플러그인이 있다면 prose 클래스를 붙이는 것이 좋습니다.
                */}
                <div
                    className="prose prose-blue max-w-none text-gray-700
                        whitespace-pre-wrap break-keep
                        prose-headings:font-bold prose-headings:text-gray-900
                        prose-a:text-blue-600 prose-a:underline
                        prose-li:my-1
                    "
                    dangerouslySetInnerHTML={{ __html: pageContent.content }}
                />
            </main>
        </div>
    );
}
