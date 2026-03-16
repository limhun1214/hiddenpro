'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useTranslations } from 'next-intl';

export default function HomePage() {
    const t = useTranslations();
    const router = useRouter();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const shouldShowLogin = localStorage.getItem('pending_show_login');
            if (shouldShowLogin === '1') {
                localStorage.removeItem('pending_show_login');
                setAuthMode('login');
                setShowLoginModal(true);
            }
        }
    }, []);
    const [authMode, setAuthMode] = useState<'login' | 'customer_signup' | 'pro_signup'>('login');
    const [authTab, setAuthTab] = useState<'CUSTOMER' | 'PRO'>('CUSTOMER');
    const [authError, setAuthError] = useState('');
    const authLock = React.useRef(false);
    // ── [확장] 정지 계정 경고 배너 ──
    const [showSuspendedBanner, setShowSuspendedBanner] = useState(false);
    const [showWithdrawnBanner, setShowWithdrawnBanner] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = React.useRef<HTMLDivElement>(null);
    const [showAllRecommendServices, setShowAllRecommendServices] = useState(false);

    const [allServices, setAllServices] = useState<{ service: string, service_en: string, category: string, depth2: string }[]>([]);
    const [depth1Keys, setDepth1Keys] = useState<string[]>([]);

    React.useEffect(() => {
        const loadCategories = async () => {
            const { data } = await supabase.from('categories').select('name, name_en, depth1, depth2').eq('is_active', true).order('sort_order', { ascending: true });
            if (data) {
                const list: { service: string, service_en: string, category: string, depth2: string }[] = [];
                const d1Set = new Set<string>();
                data.forEach(item => {
                    if (item.depth1) {
                        d1Set.add(item.depth1);
                        list.push({ service: item.name, service_en: item.name_en || item.name, category: item.depth1, depth2: item.depth2 || '' });
                    }
                });
                setAllServices(list);
                setDepth1Keys(Array.from(d1Set));
            }
        };
        loadCategories();
    }, []);

    const [searchResults, setSearchResults] = useState<{ category: string; service: string; relevance: number }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // 디바운싱 처리 (입력 중지 후 300ms 뒤 반영)
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // DB 연동 및 Zero-Search 슛앤포겟 로깅
    React.useEffect(() => {
        let isMounted = true;
        const fetchSearchResults = async () => {
            if (!debouncedQuery.trim()) {
                setSearchResults([]);
                setIsSearching(false);
                return;
            }
            setIsSearching(true);
            try {
                const { data, error } = await supabase.rpc('search_services', {
                    search_keyword: debouncedQuery.trim(),
                    max_results: 10
                });

                if (error) throw error;

                if (!isMounted) return;

                const results = (data || []).map((item: any) => {
                    const matched = allServices.find(s => s.service === item.service_name && s.category === item.category_title);
                    return {
                        category: item.category_title,
                        service: item.service_name,
                        relevance: item.relevance_score,
                        depth2: matched ? matched.depth2 : ''
                    };
                });

                setSearchResults(results);

                // 검색 결과가 0건일 경우 이탈 방지 로그를 비동기로 저장 (UI 블로킹 방지)
                if (results.length === 0) {
                    supabase.from('search_fail_logs')
                        .insert([{ keyword: debouncedQuery.trim() }])
                        .then(({ error }) => {
                            if (error) console.error('Zero-Search Log Failed', error);
                            else console.log('Zero-Search Logged');
                        });
                }

            } catch (err) {
                console.error("Search API Error", err);
            } finally {
                if (isMounted) setIsSearching(false);
            }
        };

        fetchSearchResults();
        return () => { isMounted = false; };
    }, [debouncedQuery]);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // CMS 데이터 상태
    const [heroBanner, setHeroBanner] = useState<{ media_url: string; media_type: string } | null>(null);
    const [cmsCategories, setCmsCategories] = useState<{ id: string; title: string; title_en: string; desc: string; desc_en: string; icon: string; link_url: string }[]>([]);
    const [isCmsLoading, setIsCmsLoading] = useState(true);

    // 실시간 소셜 프루프 (리뷰) 데이터
    const [recentReviews, setRecentReviews] = useState<any[]>([]);
    const [isReviewsLoading, setIsReviewsLoading] = useState(true);

    // 롤링 타이핑 애니메이션 텍스트
    const placeholderTexts = [
        "What service are you looking for?",
        "Try AC cleaning",
        "Find a housekeeper",
        "On-site repair expert",
    ];
    const [currentTextIdx, setCurrentTextIdx] = useState(0);
    const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    React.useEffect(() => {
        const currentService = placeholderTexts[currentTextIdx];

        let typingSpeed = isDeleting ? 40 : 80;
        let timer: NodeJS.Timeout;

        if (!isDeleting && animatedPlaceholder === currentService) {
            timer = setTimeout(() => setIsDeleting(true), 1500);
        } else if (isDeleting && animatedPlaceholder === '') {
            setIsDeleting(false);
            setCurrentTextIdx((prev) => (prev + 1) % placeholderTexts.length);
        } else {
            timer = setTimeout(() => {
                const nextChar = isDeleting
                    ? currentService.substring(0, animatedPlaceholder.length - 1)
                    : currentService.substring(0, animatedPlaceholder.length + 1);
                setAnimatedPlaceholder(nextChar);
            }, typingSpeed);
        }

        return () => clearTimeout(timer);
    }, [animatedPlaceholder, isDeleting, currentTextIdx]);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('login') === 'true') {
                setShowLoginModal(true);
            }
            // ── [확장] 정지 계정 감지 → 경고 배너 표시 ──
            if (params.get('suspended') === 'true') {
                setShowSuspendedBanner(true);
            }
            if (params.get('withdrawn') === 'true') {
                setShowWithdrawnBanner(true);
            }

            // ── [확장] 인증 에러 감지 → Alert 표출 ──
            const error = params.get('error');
            if (error) {
                setAuthError(decodeURIComponent(error));
                setShowLoginModal(true);
            }

            // URL에서 파라미터 제거 (선택 사항: 사용자 경험을 위해 유지하거나 제거)
            if (params.get('suspended') === 'true' || params.get('withdrawn') === 'true' || params.get('error')) {
                window.history.replaceState({}, '', '/');
            }
        }
    }, [router]);

    React.useEffect(() => {
        const fetchCMS = async () => {
            try {
                const { data: banners } = await supabase.from('cms_banners').select('*').eq('is_active', true).order('sort_order', { ascending: true }).limit(1);
                if (banners && banners.length > 0) setHeroBanner(banners[0]);

                const { data: cats } = await supabase.from('cms_categories').select('*').eq('is_active', true).order('sort_order', { ascending: true });
                if (cats && cats.length > 0) {
                    setCmsCategories(cats.map(c => ({ id: c.id, title: c.title, title_ko: c.title, title_en: c.title_en || c.title, desc: c.description || '', desc_en: c.description_en || c.description || '', icon: c.icon || '✨', link_url: c.link_url })));
                }

            } catch (err) {
                console.error("CMS Load Error", err);
            } finally {
                setIsCmsLoading(false);
            }
        };
        fetchCMS();

        const fetchLiveReviews = async () => {
            try {
                // 최근 리뷰 3개 가져오기 (고객 이름, 서비스 타입 조인) - 4.5점 이상, 메인 노출 체크된 것만
                const { data: reviews } = await supabase
                    .from('reviews')
                    .select(`
                        review_id, rating, comment, created_at,
                        users!reviews_customer_id_fkey ( name, nickname, avatar_url ),
                        chat_rooms!reviews_room_id_fkey ( match_requests!chat_rooms_request_id_fkey ( service_type ) )
                    `)
                    .eq('is_featured_on_main', true)
                    .gte('rating', 4.5)
                    .order('created_at', { ascending: false })
                    .limit(10); // 일단 10개 가져와서 JS에서 50자 필터링 후 3개 컷

                if (reviews) {
                    const validReviews = reviews.filter(r => r.comment && r.comment.length >= 50);
                    // 50자 이상인게 부족하면 짧은거라도 채워서 3개 맞춤
                    const finalReviews = validReviews.length >= 3 ? validReviews.slice(0, 3) : reviews.slice(0, 3);
                    setRecentReviews(finalReviews);
                }
            } catch (err) {
                console.error("Live Reviews Load Error", err);
            } finally {
                setIsReviewsLoading(false);
            }
        };
        fetchLiveReviews();
    }, []);

    const [isScrolled, setIsScrolled] = useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSocialLogin = async (provider: 'google' | 'facebook') => {
        // 선택된 역할과 모드를 localStorage에 저장 (OAuth 리다이렉트 후 콜백에서 복원)
        localStorage.setItem('pending_auth_role', authMode === 'pro_signup' ? 'PRO' : 'CUSTOMER');
        localStorage.setItem('pending_auth_mode', authMode);
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${location.origin}/auth/callback`,
                queryParams: { prompt: 'select_account' }
            }
        });
        if (error) alert(t('landing.socialLoginError') + error.message);
    };

    const DEPTH1_EN: Record<string, string> = {
        '이사/청소': 'Moving & Cleaning',
        '설치/수리': 'Installation & Repair',
        '인테리어/시공': 'Interior & Construction',
        '비즈니스/외주': 'Business & Outsourcing',
        '이벤트/파티': 'Events & Parties',
        '레슨/튜터링': 'Lessons & Tutoring',
    };

    const [locale, setLocale] = useState<string>('en');
    React.useEffect(() => {
        const saved = document.cookie.split('; ').find(r => r.startsWith('locale='))?.split('=')[1];
        if (saved) setLocale(saved);
    }, []);

    const categoryUI: Record<string, { icon: React.ReactNode; desc: string }> = {
        "이사/청소": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
            desc: 'Moving, Cleaning'
        },
        "설치/수리": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            desc: 'AC, Plumbing, Repair'
        },
        "인테리어/시공": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            desc: 'Remodeling, Construction'
        },
        "비즈니스/외주": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
            desc: 'Translation, Design'
        },
        "이벤트/파티": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
            desc: 'Event Planning, Catering'
        },
        "레슨/튜터링": {
            icon: <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
            desc: 'Language, Arts Lessons'
        },
    };

    const fallbackCategories = depth1Keys.map((key, idx) => ({
        id: String(idx + 1),
        title: (locale === 'en' && DEPTH1_EN[key]) ? DEPTH1_EN[key] : key,
        title_ko: key,
        icon: categoryUI[key]?.icon || <svg className="w-8 h-8 md:w-10 md:h-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
        desc: categoryUI[key]?.desc || t('landing.hiddenProServiceFallback'),
        link_url: `/quotes/requests/request?categoryId=${encodeURIComponent(key)}`
    }));

    const displayCategories = cmsCategories.length > 0 ? cmsCategories : fallbackCategories;

    return (
        <div className="w-full bg-white font-sans text-gray-900">
            {/* ── [확장] 정지 계정 경고 배너 ── */}
            {showSuspendedBanner && (
                <div className="fixed top-0 left-0 w-full z-[200] bg-red-600 text-white py-4 px-6 shadow-lg animate-slide-down">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⛔</span>
                            <div>
                                <p className="font-bold text-lg">{t('landing.suspendedTitle')}</p>
                                <p className="text-red-100 text-sm">{t('landing.suspendedContact')}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowSuspendedBanner(false)} className="text-white/80 hover:text-white text-xl font-bold px-2">✕</button>
                    </div>
                </div>
            )}
            {showWithdrawnBanner && (
                <div className="fixed top-0 left-0 w-full z-[200] bg-gray-800 text-white py-4 px-6 shadow-lg animate-slide-down">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">👋</span>
                            <div>
                                <p className="font-bold text-lg">{t('landing.withdrawnTitle')}</p>
                                <p className="text-gray-300 text-sm">{t('landing.withdrawnSub')}</p>
                            </div>
                        </div>
                        <button onClick={() => setShowWithdrawnBanner(false)} className="text-white/80 hover:text-white text-xl font-bold px-2">✕</button>
                    </div>
                </div>
            )}
            {/* [섹션 1: 초경량 헤더] */}
            <header className={`fixed top-0 left-0 w-full z-[100] transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm' : 'bg-transparent'}`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* 로고 영역 */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                                <span className="text-xl text-white font-black">H</span>
                            </div>
                            <span className={`text-xl font-extrabold tracking-tight hidden sm:block drop-shadow-sm transition-colors duration-300 ${isScrolled ? 'text-blue-600' : 'text-white'}`}>HiddenPro</span>
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex items-center gap-3">
                            <LanguageSwitcher />
                            <button
                                onClick={() => { setAuthMode('pro_signup'); setAuthTab('PRO'); setShowLoginModal(true); }}
                                className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 ${isScrolled ? 'bg-gray-900 text-yellow-400 hover:bg-gray-800' : 'bg-white/20 text-white border border-white/40 hover:bg-white/30'}`}
                            >
                                {t('landing.proSignupBtn')}
                            </button>
                            <button
                                onClick={() => { setAuthMode('login'); setShowLoginModal(true); }}
                                className={`p-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 active:scale-95 ${isScrolled ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50' : 'text-white hover:text-white hover:bg-white/20'}`}
                                aria-label={t('landing.loginAriaLabel')}
                            >
                                <svg className="w-6 h-6 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* [섹션 2: 히어로 영역 (고객 퍼넬)] */}
            <section className="relative px-4 pt-20 pb-24 lg:pt-32 lg:pb-36 bg-[#0D1629] overflow-hidden">
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes float-1 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                    @keyframes float-2 { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                    @keyframes pulse-soft { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
                    @keyframes fade-up-delay { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
                    .animate-float-1 { animation: float-1 4.5s ease-in-out infinite; will-change: transform; }
                    .animate-float-2 { animation: float-2 5.5s ease-in-out infinite; will-change: transform; }
                    .animate-pulse-soft { animation: pulse-soft 3s ease-in-out infinite; will-change: transform; }
                    .animate-fade-up-delay { animation: fade-up-delay 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both; will-change: transform, opacity; }
                `}} />

                {/* 실사 이미지 배경 */}
                <div className="absolute inset-0 z-0">
                    {isCmsLoading ? (
                        <div className="w-full h-full bg-slate-800 animate-pulse"></div>
                    ) : (
                        <Image
                            src={heroBanner?.media_url || "https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=2670&auto=format&fit=crop"}
                            alt="HiddenPro Service Professional"
                            fill
                            priority
                            className="object-cover object-center"
                        />
                    )}
                </div>

                {/* 다크 그라데이션 오버레이 (좌측 텍스트 가독성 방어) */}
                <div className="absolute inset-0 z-0" style={{ background: 'linear-gradient(to right, rgba(13, 22, 41, 0.9) 0%, rgba(13, 22, 41, 0.7) 45%, rgba(13, 22, 41, 0.1) 100%)' }}></div>
                <div className="absolute inset-0 z-0 bg-black/20 md:hidden"></div> {/* 모바일 추가 어두움 */}

                <div className="max-w-6xl mx-auto w-full relative z-30 flex flex-col md:flex-row items-center justify-between min-h-[380px] lg:min-h-[440px]">

                    {/* 좌측: 강력한 타이포그래피 & 검색바 */}
                    <div className="text-left flex flex-col justify-center w-full md:w-3/5 lg:w-1/2">
                        <h1 className="text-[28px] md:text-[36px] lg:text-[42px] text-white tracking-[-1.5px] leading-[1.3] break-keep mb-6 drop-shadow-md">
                            <span className="font-normal">{t('landing.heroTitle1')}</span><br />
                            <span className="font-bold">{t('landing.heroTitle2')}</span>
                        </h1>
                        <p className="text-lg sm:text-[22px] text-gray-200 font-medium mb-12 max-w-lg leading-[1.6] tracking-[-0.5px] drop-shadow-sm">
                            {t('landing.heroSubtitle')}
                        </p>

                        {/* 크몽 스타일 검색바 + 애니메이션 (자동완성 드롭다운 적용) */}
                        <div className="relative max-w-xl group z-50" ref={searchRef}>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowDropdown(true);
                                }}
                                onClick={() => setShowDropdown(prev => !prev)}
                                placeholder={animatedPlaceholder || t('landing.searchPlaceholder')}
                                className="w-full pl-8 pr-20 py-5 md:py-6 rounded-[28px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.15)] text-[19px] font-bold text-gray-900 focus:outline-none hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] focus:shadow-[0_12px_32px_rgba(37,99,235,0.25)] transition-all placeholder-gray-400"
                            />
                            <button onClick={() => setShowDropdown(false)} className="absolute right-3 top-3 bottom-3 aspect-square bg-gray-900 hover:bg-gray-800 text-white rounded-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 shadow-md">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </button>

                            {/* 자동완성 드롭다운 (비동기 처리) */}
                            {showDropdown && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[300px] overflow-y-auto z-[60]">
                                    {isSearching ? (
                                        <div className="px-6 py-6 text-center text-gray-500 font-medium">{t('landing.searching')}</div>
                                    ) : searchQuery.trim() ? (
                                        <>
                                            {searchResults.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => { setShowDropdown(false); router.push(`/request?categoryId=${encodeURIComponent(item.category)}&serviceId=${encodeURIComponent((item as any).service_ko || item.service)}${(item as any).depth2 ? `&depth2=${encodeURIComponent((item as any).depth2)}&serviceType=${encodeURIComponent((item as any).service_ko || item.service)}` : ''}`); }}
                                                    className="px-6 py-4 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <span className="text-gray-900 font-bold text-lg">{item.service}</span>
                                                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{item.category}</span>
                                                </div>
                                            ))}
                                            {searchResults.length === 0 && (
                                                <div className="px-6 py-6 text-center text-gray-500 font-medium">
                                                    {t('landing.noResults')}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{t('landing.recommendedServices')}</span>
                                                {showAllRecommendServices && (
                                                    <span onClick={(e) => { e.stopPropagation(); setShowAllRecommendServices(false); }} className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer">{t('landing.collapseServices')}</span>
                                                )}
                                            </div>
                                            {(showAllRecommendServices ? allServices : (
                                                locale === 'en' ? [
                                                    { service: '에어컨 청소', service_display: 'AC Cleaning', category: '이사/청소', category_display: 'Moving & Cleaning' },
                                                    { service: '가사/메이드', service_display: 'Housekeeping & Maid', category: '이사/청소', category_display: 'Moving & Cleaning' },
                                                    { service: '수도/배관 및 워터펌프 수리', service_display: 'Plumbing & Water Pump Repair', category: '설치/수리', category_display: 'Installation & Repair' },
                                                    { service: '전기 및 발전기 수리', service_display: 'Electrical & Generator Repair', category: '설치/수리', category_display: 'Installation & Repair' },
                                                    { service: '특수 청소 및 방역', service_display: 'Special Cleaning & Pest Control', category: '이사/청소', category_display: 'Moving & Cleaning' },
                                                ] : [
                                                    { service: '에어컨 청소', service_display: '에어컨 청소', category: '이사/청소', category_display: '이사/청소' },
                                                    { service: '가사/메이드', service_display: '가사/메이드', category: '이사/청소', category_display: '이사/청소' },
                                                    { service: '수도/배관 및 워터펌프 수리', service_display: '수도/배관 및 워터펌프 수리', category: '설치/수리', category_display: '설치/수리' },
                                                    { service: '전기 및 발전기 수리', service_display: '전기 및 발전기 수리', category: '설치/수리', category_display: '설치/수리' },
                                                    { service: '특수 청소 및 방역', service_display: '특수 청소 및 방역', category: '이사/청소', category_display: '이사/청소' },
                                                ]
                                            )).map((item, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => { setShowDropdown(false); router.push(`/request?categoryId=${encodeURIComponent(item.category)}&serviceId=${encodeURIComponent(item.service)}${(item as any).depth2 ? `&depth2=${encodeURIComponent((item as any).depth2)}&serviceType=${encodeURIComponent(item.service)}` : ''}`); }}
                                                    className="px-6 py-4 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <span className="text-gray-900 font-bold text-lg">{(item as any).service_display || (locale === 'en' ? ((item as any).service_en || item.service) : item.service)}</span>
                                                    <span className="text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">{(item as any).category_display || (locale === 'en' ? (DEPTH1_EN[item.category] ?? item.category) : item.category)}</span>
                                                </div>
                                            ))}
                                            {!showAllRecommendServices && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setShowAllRecommendServices(true); }}
                                                    className="px-6 py-4 text-center cursor-pointer hover:bg-gray-50 transition-colors border-t border-gray-100"
                                                >
                                                    <span className="text-sm font-bold text-blue-600 flex items-center justify-center gap-1">
                                                        {t('landing.viewAllServices')}
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 우측: 동적 컴포넌트 (Floating UI) absolute 배치 */}
                    {/* 모바일에서는 검색바/텍스트를 가리지 않도록 scale/위치 조정, 데스크탑에서는 오른쪽 여백 활용 */}
                    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">

                        {/* 플로팅 카드 1: 신뢰도 뱃지 (상단) */}
                        <div className="hidden md:block absolute top-[5%] md:top-[10%] right-[2%] sm:right-[5%] md:right-[15%] lg:right-[20%] pointer-events-auto animate-pulse-soft">
                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.15)] scale-75 sm:scale-90 md:scale-100 origin-top-right">
                                <div className="bg-green-500 rounded-full p-1 shadow-[0_0_12px_rgba(34,197,94,0.6)] flex items-center justify-center">
                                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <span className="text-white font-bold text-xs sm:text-sm tracking-tight drop-shadow-md">{t('landing.trustBadge')}</span>
                            </div>
                        </div>

                        {/* 플로팅 카드 2: 리뷰 요약 (중앙 측면) */}
                        <div className="hidden md:block absolute top-[35%] right-[-5%] sm:right-[2%] md:right-[-2%] lg:right-[5%] pointer-events-auto animate-float-1">
                            <div className="flex flex-col gap-2 bg-white/15 backdrop-blur-lg border border-white/20 rounded-2xl p-3 sm:p-4 shadow-[0_12px_40px_rgba(0,0,0,0.2)] scale-75 sm:scale-90 md:scale-100 origin-right">
                                <div className="flex items-center gap-3">
                                    <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Pro&backgroundColor=ffedd5" alt="Pro" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-white/30" />
                                    <div>
                                        <div className="flex items-center text-yellow-400 gap-0.5 text-xs sm:text-sm drop-shadow-sm">
                                            <span>★</span><span className="text-white font-bold ml-1 mr-1">5.0</span>
                                        </div>
                                        <div className="text-white font-bold text-[11px] sm:text-[13px] tracking-tight drop-shadow-md">{t('landing.floatingReview')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 플로팅 카드 3: 매칭 알림 팝업 (하단) */}
                        <div className="hidden md:block absolute bottom-[25%] md:bottom-[15%] right-[10%] sm:right-[15%] md:right-[5%] lg:right-[15%] pointer-events-auto animate-fade-up-delay">
                            <div className="flex items-center gap-3 bg-white/15 backdrop-blur-xl border border-white/20 rounded-[20px] px-4 sm:px-6 py-3 sm:py-4 shadow-[0_16px_40px_rgba(0,0,0,0.25)] scale-75 sm:scale-90 md:scale-100 origin-bottom-right animate-float-2">
                                <span className="text-lg sm:text-xl drop-shadow-lg animate-pulse">⚡</span>
                                <span className="text-white font-extrabold text-[13px] sm:text-[15px] tracking-tight drop-shadow-md">{t('landing.floatingBooking')}</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* 하단: 미니멀리스트 아이콘 그리드 (Touch-friendly Hitboxes & SVG Icons) 확대 및 마이크로 카피 추가 */}
                <div className="max-w-6xl mx-auto w-full relative z-10 flex flex-col items-center mt-12 mb-4">
                    <div className="bg-yellow-400 text-gray-900 font-black text-sm md:text-base px-5 py-1.5 rounded-full mb-4 shadow-md inline-block transform animate-bounce">
                        ⚡ {t('landing.ctaBanner')}
                    </div>

                    <div className="w-full grid grid-cols-3 sm:grid-cols-6 gap-3 md:gap-6 lg:gap-8 px-0">
                        {displayCategories.map((cat) => (
                            <Link key={cat.id} href={cat.link_url || `/quotes/requests/request?categoryId=${encodeURIComponent((cat as any).title_ko || cat.title)}`} className="group flex flex-col items-center justify-start h-full">
                                <div className="p-5 md:p-6 lg:p-7 w-full bg-white/95 backdrop-blur-md border border-white/20 rounded-[20px] transition-all duration-300 transform active:scale-95 active:shadow-sm cursor-pointer flex flex-col items-center flex-grow shadow-[0_4px_12px_rgba(0,0,0,0.1)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] hover:scale-[1.03]">
                                    <div className="mb-3 text-blue-600 drop-shadow-sm">
                                        {cat.icon}
                                    </div>
                                    <span className="text-[13px] sm:text-[15px] font-bold text-[#111827] tracking-tight text-center w-full break-keep mb-1 drop-shadow-sm">
                                        {locale === 'en' ? ((cat as any).title_en || cat.title) : cat.title}
                                    </span>
                                    {cat.desc && (
                                        <span className="text-[11px] sm:text-[13px] text-gray-600 font-medium hidden md:block text-center break-keep w-full">
                                            {locale === 'en' ? ((cat as any).desc_en || cat.desc) : cat.desc}
                                        </span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            {/* [섹션 2.5: 동적 소셜 프루프 (라이브 리뷰)] */}
            <section className="py-20 bg-slate-50 border-t border-b border-gray-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-end mb-10">
                        <div>
                            <h2 className="text-[28px] md:text-[36px] font-black text-[#1A1C23] tracking-[-1px] mb-2">{t('landing.reviewSectionTitle')}</h2>
                            <p className="text-[#555969] font-medium text-lg">{t('landing.reviewSectionSub')}</p>
                        </div>
                    </div>

                    {isReviewsLoading ? (
                        <div className="flex justify-center py-10">
                            <span className="text-gray-400 loading animate-pulse">{t('landing.loadingReviews')}</span>
                        </div>
                    ) : recentReviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {recentReviews.map((review: any) => (
                                <div key={review.review_id} className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition-transform hover:-translate-y-1">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="flex text-yellow-400 text-lg">
                                            {[...Array(5)].map((_, i) => (
                                                <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                                            ))}
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 ml-2">{review.rating ? Number(review.rating).toFixed(1) : '0.0'}</span>
                                    </div>
                                    <p className="text-gray-800 font-medium leading-[1.6] line-clamp-3 mb-6 min-h-[76px]">
                                        "{review.comment}"
                                    </p>
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-200 shrink-0 bg-slate-50">
                                                <img
                                                    src={review.users?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(review.users?.nickname || review.users?.name || review.review_id)}&backgroundColor=e2e8f0`}
                                                    alt={t('landing.profileAlt')}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[15px] font-extrabold text-[#111827]">{review.users?.nickname || review.users?.name || t('landing.anonymousCustomer')}</span>
                                                <span className="text-xs text-blue-600 font-bold">{review.chat_rooms?.match_requests?.service_type || t('landing.defaultService')}</span>
                                            </div>
                                        </div>
                                        <span className="text-[12px] text-gray-400 font-medium bg-slate-50 px-2.5 py-1 rounded-md">{new Date(review.created_at).toLocaleDateString('en-US')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400">
                            {t('landing.noReviews')}
                        </div>
                    )}
                </div>
            </section>

            {/* [섹션 3: 신뢰도 (Trust Indicators) - Asymmetric High-end Layout 개편] */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="lg:grid lg:grid-cols-12 lg:gap-16 items-start">

                        {/* 좌측: 강력한 브랜드 메시지 (Sticky 효과로 스크롤 시 고정됨) */}
                        <div className="lg:col-span-5 mb-16 lg:mb-0 lg:sticky lg:top-32">
                            <span className="text-blue-600 font-extrabold tracking-wider uppercase text-sm mb-4 block">
                                Why HiddenPro
                            </span>
                            <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.2] mb-6 break-keep">
                                {t('landing.whyTitle1')}<br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                                    {t('landing.whyTitle2')}
                                </span>
                            </h2>
                            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed mb-8 break-keep">
                                {t('landing.whyDesc')}
                            </p>
                        </div>

                        {/* 우측: 핵심 가치 리스트 (카드 배열 탈피) */}
                        <div className="lg:col-span-7 space-y-8 sm:space-y-12">

                            {/* Feature 1: 신원 검증 */}
                            <div className="flex flex-col sm:flex-row gap-6 group">
                                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-blue-600 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:border-blue-200">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-3 group-hover:text-blue-600 transition-colors">
                                        {t('landing.feature1Title')}
                                    </h3>
                                    <p className="text-gray-600 text-lg leading-relaxed break-keep">
                                        {t('landing.feature1Desc')}
                                    </p>
                                </div>
                            </div>

                            {/* Feature 2: 수수료 0원 */}
                            <div className="flex flex-col sm:flex-row gap-6 group">
                                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-green-600 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:border-green-200">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-3 group-hover:text-green-600 transition-colors">
                                        {t('landing.feature2Title')}
                                    </h3>
                                    <p className="text-gray-600 text-lg leading-relaxed break-keep">
                                        {t('landing.feature2Desc')}
                                    </p>
                                </div>
                            </div>

                            {/* Feature 3: 선착순 매칭 */}
                            <div className="flex flex-col sm:flex-row gap-6 group">
                                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-yellow-500 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-md group-hover:border-yellow-200">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight mb-3 group-hover:text-yellow-600 transition-colors">
                                        {t('landing.feature3Title')}
                                    </h3>
                                    <p className="text-gray-600 text-lg leading-relaxed break-keep">
                                        {t('landing.feature3Desc')}
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </section>

            {/* [섹션 4: 고수 영입 와이드 배너] */}
            <section className="relative py-48 md:py-64 bg-[#0B0F19] overflow-hidden text-center flex flex-col items-center justify-center">
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-600 opacity-20 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[600px] h-[600px] bg-yellow-500 opacity-10 rounded-full blur-[120px] pointer-events-none"></div>

                <div className="relative z-10 max-w-5xl mx-auto px-6">
                    <h2 className="text-[48px] md:text-[68px] font-black tracking-[-0.04em] text-white mb-10 leading-[1.3] break-keep">
                        {t('landing.proBannerTitle1')}<br />
                        <span className="text-[#FFD335]">HiddenPro</span> {t('landing.proBannerTitle2')}
                    </h2>
                    <p className="text-[19px] md:text-[26px] text-gray-300 mb-20 max-w-4xl mx-auto font-medium leading-[1.85] tracking-[-0.02em] break-keep">
                        {t('landing.proBannerDesc')}
                    </p>
                    <button
                        onClick={() => { setAuthMode('pro_signup'); setAuthTab('PRO'); setShowLoginModal(true); }}
                        className="flex items-center justify-center mx-auto gap-4 bg-gradient-to-r from-[#FFD335] to-[#F59E0B] hover:from-[#F59E0B] hover:to-[#D97706] text-[#111827] font-black text-[22px] md:text-[26px] px-16 py-6 sm:py-7 rounded-full shadow-[0_20px_60px_rgba(245,158,11,0.4)] transition-all transform hover:-translate-y-2"
                    >
                        <span className="text-3xl">💰</span>
                        <span>{t('landing.proBannerBtn')}</span>
                    </button>
                </div>
            </section>

            {/* 프로덕션 레디 로그인/가입 모달 */}
            {
                showLoginModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                            {/* 헤더 */}
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h3 className="text-xl font-bold text-gray-900">
                                    {authMode === 'login' ? t('landing.loginTitle') : authMode === 'pro_signup' ? t('landing.proSignupTitle') : t('landing.signupTitle')}
                                </h3>
                                <button
                                    onClick={() => { setShowLoginModal(false); setAuthError(''); setAuthMode('login'); }}
                                    className="text-gray-400 hover:text-gray-600 font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
                                >
                                    &times;
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* 고수 가입 모드일 때 안내 문구 */}
                                {authMode === 'pro_signup' && (
                                    <div className="bg-gray-900 text-yellow-400 p-4 rounded-xl text-center">
                                        <p className="text-sm font-bold">{t('landing.proSignupDesc')}</p>
                                        <p className="text-xs text-gray-400 mt-1">{t('landing.proSignupDescSub')}</p>
                                    </div>
                                )}

                                {/* 소셜 로그인 */}
                                <div className="space-y-3">
                                    <button
                                        onClick={() => handleSocialLogin('google')}
                                        className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition text-sm font-bold text-gray-700"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                        {t('landing.googleLogin')}
                                    </button>
                                    <button
                                        onClick={() => handleSocialLogin('facebook')}
                                        className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] transition text-sm font-bold text-white"
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                        {t('landing.facebookLogin')}
                                    </button>
                                </div>

                                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                                    {t('landing.termsAgreement')} <span className="underline cursor-pointer">{t('landing.termsLink')}</span> {t('landing.termsAnd')} <span className="underline cursor-pointer">{t('landing.privacyLink')}</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
