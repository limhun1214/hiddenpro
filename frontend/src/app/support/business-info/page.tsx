'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function BusinessInfoPage() {
    const t = useTranslations();
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
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; {t('common.back')}</button>
                    <h1 className="font-bold text-gray-800">{t('businessInfo.title')}</h1>
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
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; {t('common.back')}</button>
                <h1 className="font-bold text-gray-800">{t('businessInfo.title')}</h1>
                <div className="w-10"></div>
            </div>
            <main className="flex-1 w-full max-w-3xl mx-auto p-5 md:p-8">
                <div className="mb-6 md:mb-10 pb-6 border-b border-gray-100 flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">
                        {t('businessInfo.title')}
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
                            <strong>{t('businessInfo.companyName')}</strong> HiddenPro Philippines Inc.<br /><br />
                            <strong>{t('businessInfo.representative')}</strong> [대표자 성함]<br /><br />
                            <strong>{t('businessInfo.businessReg')}</strong> [000-000-000]<br /><br />
                            <strong>{t('businessInfo.tin')}</strong> [000-000-000-000]<br /><br />
                            <strong>{t('businessInfo.ecommerce')}</strong> [현지 허가 번호 또는 DTI Permit No.]<br /><br />
                            <strong>{t('businessInfo.headquarters')}</strong> [12F, XYZ Building, Bonifacio Global City, Taguig, Metro Manila, Philippines]<br /><br />
                            <strong>{t('businessInfo.support')}</strong> [+63-2-XXXX-XXXX] {t('businessInfo.supportHours')}<br /><br />
                            <strong>{t('businessInfo.email')}</strong> [help@hiddenpro.ph]<br /><br />
                            <strong>{t('businessInfo.hosting')}</strong> Amazon Web Services (AWS)<br /><br />
                            <hr className="my-6 border-gray-200" />
                            <p className="text-gray-500 text-sm">
                                {t('businessInfo.disclaimer')}
                            </p>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}
