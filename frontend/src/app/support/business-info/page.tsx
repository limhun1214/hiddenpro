'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function BusinessInfoPage() {
    const router = useRouter();
    const [bizInfoHtml, setBizInfoHtml] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBizInfo = async () => {
            const { data } = await supabase
                .from('support_pages')
                .select('content')
                .eq('slug', 'business')
                .eq('is_active', true)
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
            <div className="w-full flex flex-col pt-4">
                <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                    <h1 className="font-bold text-gray-800">사업자 정보</h1>
                    <div className="w-10"></div>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-blue-600 animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col pt-4">
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; 뒤로</button>
                <h1 className="font-bold text-gray-800">사업자 정보</h1>
                <div className="w-10"></div>
            </div>
            <main className="flex-1 w-full max-w-3xl mx-auto p-5 md:p-8">
                <div className="mb-6 md:mb-10 pb-6 border-b border-gray-100 flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                        사업자 정보
                    </h1>
                </div>

                <div
                    className="prose prose-sm md:prose-base max-w-none text-gray-700
                        whitespace-pre-wrap break-keep leading-relaxed
                        prose-headings:font-bold prose-headings:text-gray-900
                        prose-a:text-blue-600 prose-a:underline
                        prose-li:my-1
                    "
                >
                    {bizInfoHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: bizInfoHtml }} />
                    ) : (
                        <>
                            <strong>상호명:</strong> HiddenPro Philippines Inc.<br /><br />
                            <strong>대표:</strong> [대표자 성함]<br /><br />
                            <strong>사업자등록번호(SEC/DTI):</strong> [000-000-000]<br /><br />
                            <strong>납세자번호(TIN):</strong> [000-000-000-000]<br /><br />
                            <strong>통신판매업신고:</strong> [현지 허가 번호 또는 DTI Permit No.]<br /><br />
                            <strong>본사 주소:</strong> [12F, XYZ Building, Bonifacio Global City, Taguig, Metro Manila, Philippines]<br /><br />
                            <strong>고객센터:</strong> [+63-2-XXXX-XXXX] (운영시간 09:00~18:00, 주말/공휴일 휴무)<br /><br />
                            <strong>이메일:</strong> [help@hiddenpro.ph]<br /><br />
                            <strong>호스팅 제공자:</strong> Amazon Web Services (AWS)<br /><br />
                            <hr className="my-6 border-gray-200" />
                            <p className="text-gray-500 text-sm">
                                HiddenPro는 서비스 중개 플랫폼으로서 통신판매의 당사자가 아닙니다. 따라서 HiddenPro는 전문가가 등록한 서비스의 내용, 거래 조건 및 실제 제공된 서비스 품질에 대하여 일체의 책임을 지지 않습니다. 서비스 제공 및 거래에 대한 모든 책임은 전문가와 의뢰인 양 당사자에게 있습니다.
                            </p>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
