'use client';
export const runtime = 'edge';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { optimizeImage } from '@/utils/imageOptimizer';
import { useToast } from '@/components/ui/Toast';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

function InquiryContent() {
    const t = useTranslations();
    const router = useRouter();
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'WRITE' | 'HISTORY'>(
        searchParams.get('tab') === 'history' ? 'HISTORY' : 'WRITE'
    );
    const [user, setUser] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Form states
    const [category, setCategory] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 이미지 첨부 states
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // History states
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showToast(t('inquiry.loginRequired'), 'error');
                router.push('/');
                return;
            }
            setUser(session.user);
            setUserId(session.user.id);
        };
        checkUser();
    }, [router]);

    useEffect(() => {
        if (activeTab === 'HISTORY' && userId) {
            fetchHistory();
        }
    }, [activeTab, userId]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        const { data, error } = await supabase
            .from('inquiries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Failed to fetch inquiries:', error);
            showToast(t('inquiry.loadFailed'), 'error');
        } else if (data) {
            setInquiries(data);
        }
        setLoadingHistory(false);
    };

    // 이미지 선택 핸들러
    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const remaining = 5 - imageFiles.length;
        if (remaining <= 0) {
            showToast(t('inquiry.maxImages'), 'error');
            return;
        }

        const selected = files.slice(0, remaining);
        const newFiles = [...imageFiles, ...selected];
        setImageFiles(newFiles);

        // 미리보기 생성
        selected.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImagePreviews(prev => [...prev, ev.target?.result as string]);
            };
            reader.readAsDataURL(file);
        });

        // input 초기화 (동일 파일 재선택 허용)
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // 이미지 제거 핸들러
    const handleRemoveImage = (index: number) => {
        setImageFiles(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    // 이미지 업로드 (기존 imageOptimizer 방식 준수)
    const uploadImages = async (files: File[]): Promise<string[]> => {
        const urls: string[] = [];
        for (const file of files) {
            const optimizedFile = await optimizeImage(file, 1920, 1080, 0.8);
            const fileName = `inquiry_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
            const { error: upErr } = await supabase.storage
                .from('quote_images')
                .upload(`inquiries/${fileName}`, optimizedFile);
            if (upErr) throw new Error(t('inquiry.imageUploadFailed') + upErr.message);
            const { data: { publicUrl } } = supabase.storage
                .from('quote_images')
                .getPublicUrl(`inquiries/${fileName}`);
            urls.push(publicUrl);
        }
        return urls;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!category || !title.trim() || !content.trim()) {
            showToast(t('inquiry.fillAll'), 'error');
            return;
        }

        setIsSubmitting(true);

        // 버그수정: .single() → .maybeSingle() (CUSTOMER는 pro_profiles 행 없음 → 406 방지)
        const { data: proProfile } = await supabase
            .from('pro_profiles')
            .select('pro_id')
            .eq('pro_id', userId)
            .maybeSingle();

        const userType = proProfile ? 'PRO' : 'CUSTOMER';

        // 이미지 업로드
        let imageUrls: string[] = [];
        if (imageFiles.length > 0) {
            try {
                imageUrls = await uploadImages(imageFiles);
            } catch (err: any) {
                showToast(err.message, 'error');
                setIsSubmitting(false);
                return;
            }
        }

        // 하루 10개 제한 체크
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count: todayCount } = await supabase
            .from('inquiries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', todayStart.toISOString());

        if ((todayCount ?? 0) >= 10) {
            showToast(t('inquiry.dailyLimit'), 'error');
            setIsSubmitting(false);
            return;
        }

        const { error } = await supabase.from('inquiries').insert({
            user_id: userId,
            user_type: userType,
            category,
            title,
            content: transactionId.trim() ? `[Transaction ID: ${transactionId.trim()}]\n\n${content}` : content,
            status: 'pending',
            image_urls: imageUrls,
        });

        setIsSubmitting(false);

        if (error) {
            console.error('Failed to submit inquiry:', error);
            showToast(t('inquiry.submitError') + error.message, 'error');
        } else {
            showToast(t('inquiry.submitSuccess'), 'success');
            setCategory('');
            setTitle('');
            setContent('');
            setTransactionId('');
            setImageFiles([]);
            setImagePreviews([]);
            setActiveTab('HISTORY');
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        switch (status) {
            case 'pending':
                return <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full border border-yellow-200">{t('inquiry.statusPending')}</span>;
            case 'in_progress':
                return <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">{t('inquiry.statusInProgress')}</span>;
            case 'resolved':
                return <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-full border border-green-200">{t('inquiry.statusResolved')}</span>;
            default:
                return null;
        }
    };

    if (!user) return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">{t('common.loading')}</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pt-4 pb-20">
            <div className="flex justify-between items-center p-4 bg-white border-b border-gray-100 sticky top-0 z-10">
                <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 font-bold">&larr; {t('common.back')}</button>
                <h1 className="font-bold text-gray-800">{t('inquiry.pageTitle')}</h1>
                <div className="w-10"></div>
            </div>

            <main className="flex-1 w-full max-w-2xl mx-auto p-4 md:p-6 w-full">
                {/* 탭 네비게이션 */}
                <div className="flex space-x-2 mb-6 bg-gray-200 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('WRITE')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'WRITE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('inquiry.tabWrite')}
                    </button>
                    <button
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${activeTab === 'HISTORY' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t('inquiry.tabHistory')}
                    </button>
                </div>

                {/* 문의 작성 탭 */}
                {activeTab === 'WRITE' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <p className="text-sm text-gray-500 mb-6 font-medium">{t('inquiry.formDesc')}</p>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('inquiry.categoryLabel')} <span className="text-red-500">*</span></label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    required
                                >
                                    <option value="" disabled>{t('inquiry.categoryPlaceholder')}</option>
                                    <option value="ACCOUNT">{t('inquiry.categoryAccount')}</option>
                                    <option value="PAYMENT">{t('inquiry.categoryPayment')}</option>
                                    <option value="MATCHING">{t('inquiry.categoryMatching')}</option>
                                    <option value="REPORT">{t('inquiry.categoryReport')}</option>
                                    <option value="OTHER">{t('inquiry.categoryOther')}</option>
                                </select>
                            </div>
                            {category === 'PAYMENT' && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('inquiry.transactionIdLabel')}</label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        placeholder={t('inquiry.transactionIdPlaceholder')}
                                        className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                        maxLength={100}
                                    />
                                    <p className="text-xs text-gray-400 mt-1">{t('inquiry.transactionIdHint')}</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('inquiry.titleLabel')} <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('inquiry.titlePlaceholder')}
                                    className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                                    required
                                    maxLength={100}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('inquiry.contentLabel')} <span className="text-red-500">*</span></label>
                                <textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={t('inquiry.contentPlaceholder')}
                                    className="w-full border border-gray-300 rounded-xl p-3 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-h-[150px] resize-none"
                                    required
                                    minLength={10}
                                />
                            </div>

                            {/* ── 이미지 첨부 (최대 5장) ── */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    {t('inquiry.photoLabel')} <span className="text-gray-400 font-normal text-xs">{t('inquiry.photoOptional')}</span>
                                </label>

                                {/* 미리보기 그리드 */}
                                {imagePreviews.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {imagePreviews.map((src, idx) => (
                                            <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                                <img src={src} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveImage(idx)}
                                                    className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold hover:bg-black/80 transition"
                                                >✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 추가 버튼 */}
                                {imageFiles.length < 5 && (
                                    <>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageSelect}
                                            className="hidden"
                                            id="inquiry-image-input"
                                        />
                                        <label
                                            htmlFor="inquiry-image-input"
                                            className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 font-medium hover:border-blue-400 hover:text-blue-500 cursor-pointer transition"
                                        >
                                            📷 {t('inquiry.addPhoto')} ({imageFiles.length}/5)
                                        </label>
                                    </>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-lg py-4 rounded-xl shadow-md transition mt-6"
                            >
                                {isSubmitting ? t('inquiry.submitting') : t('inquiry.submit')}
                            </button>
                        </form>
                    </div>
                )}

                {/* 나의 문의 내역 탭 */}
                {activeTab === 'HISTORY' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        {loadingHistory ? (
                            <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center">
                                <div className="w-6 h-6 border-b-2 border-blue-600 rounded-full animate-spin mb-3"></div>
                                {t('inquiry.loadingHistory')}
                            </div>
                        ) : inquiries.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                <div className="text-4xl mb-4">📭</div>
                                <p className="font-medium">{t('inquiry.noInquiries')}</p>
                            </div>
                        ) : (
                            <ul className="flex flex-col">
                                {inquiries.map((iq) => {
                                    const isExpanded = expandedId === iq.id;
                                    const catMap: Record<string, string> = {
                                        'ACCOUNT': t('inquiry.catAccount'),
                                        'PAYMENT': t('inquiry.catPayment'),
                                        'MATCHING': t('inquiry.catMatching'),
                                        'REPORT': t('inquiry.catReport'),
                                        'OTHER': t('inquiry.catOther')
                                    };
                                    const catLabel = catMap[iq.category] || iq.category;
                                    const imgs: string[] = Array.isArray(iq.image_urls) ? iq.image_urls : [];

                                    return (
                                        <li key={iq.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition">
                                            <div
                                                onClick={() => setExpandedId(isExpanded ? null : iq.id)}
                                                className="p-5 cursor-pointer flex flex-col gap-2"
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{catLabel}</span>
                                                        <span className="text-xs text-gray-400">{new Date(iq.created_at).toLocaleDateString()}</span>
                                                        {imgs.length > 0 && <span className="text-xs text-gray-400">📎 {imgs.length}</span>}
                                                    </div>
                                                    <StatusBadge status={iq.status} />
                                                </div>
                                                <div className="flex justify-between items-center w-full">
                                                    <h3 className="font-bold text-gray-900 line-clamp-1 flex-1 pr-4">{iq.title}</h3>
                                                    <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="bg-gray-50 p-5 border-t border-gray-100 shadow-inner">
                                                    <div className="mb-4">
                                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">{t('inquiry.myQuestion')}</span>
                                                        <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{iq.content}</p>

                                                        {/* 첨부 이미지 표시 */}
                                                        {imgs.length > 0 && (
                                                            <div className="flex flex-wrap gap-2 mt-3">
                                                                {imgs.map((url: string, idx: number) => (
                                                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                                        <img src={url} alt={`Attachment ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {iq.status === 'resolved' && iq.admin_reply && (
                                                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-lg">🧑‍💻</span>
                                                                <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">{t('inquiry.adminReply')}</span>
                                                            </div>
                                                            <div
                                                                className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed border-t border-blue-100/50 pt-2"
                                                                dangerouslySetInnerHTML={{ __html: iq.admin_reply }}
                                                            />
                                                            {Array.isArray(iq.admin_reply_images) && iq.admin_reply_images.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-3">
                                                                    {iq.admin_reply_images.map((url: string, idx: number) => (
                                                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                                            <img src={url} alt={`Reply Attachment ${idx + 1}`} className="w-20 h-20 object-cover rounded-xl border border-blue-200 hover:opacity-80 transition" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function InquiryPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <InquiryContent />
        </Suspense>
    );
}
