'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';

export const runtime = 'edge';

export default function LegalDocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const [legalDoc, setLegalDoc] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDoc = async () => {
            if (!params.type) return;
            const typeParam = typeof params.type === 'string' ? params.type.toUpperCase() : '';

            // 타입(TERMS, PRIVACY)에 맞는 활성화된 최신 문서 가져오기
            const { data } = await supabase
                .from('legal_documents')
                .select('*')
                .eq('document_type', typeParam)
                .eq('is_active', true)
                .order('effective_date', { ascending: false })
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
            <div className="w-full flex flex-col pt-4">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                    <h1 className="font-bold text-gray-800">법적 고지</h1>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!legalDoc) {
        return (
            <div className="w-full flex flex-col pt-4">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                    <h1 className="font-bold text-gray-800">문서 없음</h1>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="text-gray-400 mb-4 text-6xl">⚖️</div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">법적 고지 문서를 불러올 수 없습니다</h2>
                    <p className="text-gray-500 mb-6">등록된 문서가 없거나 현재 활성화된 버전이 없습니다.</p>
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
        <div className="w-full flex flex-col pt-4">
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                <h1 className="font-bold text-gray-800">{legalDoc.document_type === 'TERMS' ? '이용약관' : '개인정보처리방침'}</h1>
                <div className="w-10"></div>
            </div>
            <main className="flex-1 w-full max-w-3xl mx-auto p-5 md:p-8">
                <div className="mb-6 md:mb-10 pb-6 border-b border-gray-100 flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                            {legalDoc.title}
                        </h1>
                        <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded">
                            {legalDoc.version}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">시행일자: {legalDoc.effective_date}</p>
                </div>

                <div
                    className="prose prose-sm md:prose-base max-w-none text-gray-700
                        whitespace-pre-wrap break-keep
                        prose-headings:font-bold prose-headings:text-gray-900
                        prose-a:text-blue-600 prose-a:underline
                        prose-li:my-1
                    "
                    dangerouslySetInnerHTML={{ __html: legalDoc.content }}
                />
            </main>
        </div>
    );
}
