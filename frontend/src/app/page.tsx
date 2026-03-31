"use client";
export const runtime = "edge";

import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useTranslations } from "next-intl";
import { NavStateContext } from "@/context/NavStateContext";
import { useToast } from "@/components/ui/Toast";

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { isLoggedIn, isAdminUser, isProUser } = useContext(NavStateContext);
  const { showToast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const shouldShowLogin = localStorage.getItem("pending_show_login");
      if (shouldShowLogin === "1") {
        localStorage.removeItem("pending_show_login");
        setAuthMode("login");
        setShowLoginModal(true);
      }
    }
  }, []);
  const [authMode, setAuthMode] = useState<
    "login" | "customer_signup" | "pro_signup"
  >("login");
  const [authTab, setAuthTab] = useState<"CUSTOMER" | "PRO">("CUSTOMER");
  const [authError, setAuthError] = useState("");
  const authLock = React.useRef(false);
  // ── [확장] 정지 계정 경고 배너 ──
  const [showSuspendedBanner, setShowSuspendedBanner] = useState(false);
  const [showWithdrawnBanner, setShowWithdrawnBanner] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [showAllRecommendServices, setShowAllRecommendServices] =
    useState(false);

  const [allServices, setAllServices] = useState<
    { service: string; service_en: string; category: string; depth2: string }[]
  >([]);
  const [depth1Keys, setDepth1Keys] = useState<string[]>([]);

  React.useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, name_en, depth1, depth2")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (data) {
        const list: {
          service: string;
          service_en: string;
          category: string;
          depth2: string;
        }[] = [];
        const d1Set = new Set<string>();
        data.forEach((item) => {
          if (item.depth1) {
            d1Set.add(item.depth1);
            list.push({
              service: item.name,
              service_en: item.name_en || item.name,
              category: item.depth1,
              depth2: item.depth2 || "",
            });
          }
        });
        setAllServices(list);
        setDepth1Keys(Array.from(d1Set));
      }
    };
    loadCategories();
  }, []);

  const [searchResults, setSearchResults] = useState<
    { category: string; service: string; relevance: number }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

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
        const { data, error } = await supabase.rpc("search_services", {
          search_keyword: debouncedQuery.trim(),
          max_results: 10,
        });

        if (error) throw error;

        if (!isMounted) return;

        const results = (data || []).map((item: any) => {
          const matched = allServices.find(
            (s) =>
              s.service === item.service_name &&
              s.category === item.category_title,
          );
          return {
            category: item.category_title,
            service: item.service_name,
            service_en: matched ? matched.service_en : item.service_name,
            category_en: DEPTH1_EN[item.category_title] ?? item.category_title,
            relevance: item.relevance_score,
            depth2: matched ? matched.depth2 : "",
          };
        });

        setSearchResults(results);

        // 검색 결과가 0건일 경우 이탈 방지 로그를 비동기로 저장 (UI 블로킹 방지)
        if (results.length === 0) {
          supabase
            .from("search_fail_logs")
            .insert([{ keyword: debouncedQuery.trim() }])
            .then(({ error }) => {
              if (error) console.error("Zero-Search Log Failed", error);
              else console.log("Zero-Search Logged");
            });
        }
      } catch (err) {
        console.error("Search API Error", err);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };

    fetchSearchResults();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // CMS 데이터 상태
  const [heroBanner, setHeroBanner] = useState<{
    media_url: string;
    media_type: string;
  } | null>(null);
  const [cmsCategories, setCmsCategories] = useState<
    {
      id: string;
      title: string;
      title_en: string;
      desc: string;
      desc_en: string;
      icon: string;
      link_url: string;
    }[]
  >([]);
  const [isCmsLoading, setIsCmsLoading] = useState(true);

  // 실시간 소셜 프루프 (리뷰) 데이터
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);

  // 롤링 타이핑 애니메이션 텍스트
  const [currentTextIdx, setCurrentTextIdx] = useState(0);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    const currentService = placeholderTexts[currentTextIdx];

    let typingSpeed = isDeleting ? 40 : 80;
    let timer: NodeJS.Timeout;

    if (!isDeleting && animatedPlaceholder === currentService) {
      timer = setTimeout(() => setIsDeleting(true), 1500);
    } else if (isDeleting && animatedPlaceholder === "") {
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      // ── 추천인 코드 저장 (referral_enabled 체크) ──
      const refCode = params.get("ref");
      if (refCode && refCode.trim().length > 0) {
        (async () => {
          try {
            const { data: refSetting } = await supabase
              .from("platform_settings")
              .select("value")
              .eq("key", "referral_enabled")
              .single();
            if (refSetting && Number(refSetting.value) === 1) {
              localStorage.setItem(
                "pending_referral_code",
                refCode.trim().toUpperCase(),
              );
            }
          } catch {}
        })();
      }
      if (params.get("login") === "true") {
        setShowLoginModal(true);
      }
      // ── [확장] 정지 계정 감지 → 경고 배너 표시 ──
      if (params.get("suspended") === "true") {
        setShowSuspendedBanner(true);
      }
      if (params.get("withdrawn") === "true") {
        setShowWithdrawnBanner(true);
      }

      // ── [확장] 인증 에러 감지 → Alert 표출 ──
      const error = params.get("error");
      if (error) {
        setAuthError(decodeURIComponent(error));
        setShowLoginModal(true);
      }

      // URL에서 파라미터 제거 (선택 사항: 사용자 경험을 위해 유지하거나 제거)
      if (
        params.get("suspended") === "true" ||
        params.get("withdrawn") === "true" ||
        params.get("error")
      ) {
        window.history.replaceState({}, "", "/");
      }
    }
  }, [router]);

  React.useEffect(() => {
    const fetchCMS = async () => {
      try {
        const { data: banners } = await supabase
          .from("cms_banners")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .limit(1);
        if (banners && banners.length > 0) setHeroBanner(banners[0]);

        const { data: cats } = await supabase
          .from("cms_categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if (cats && cats.length > 0) {
          setCmsCategories(
            cats.map((c) => ({
              id: c.id,
              title: c.title,
              title_ko: c.title,
              title_en: c.title_en || c.title,
              desc: c.description || "",
              desc_en: c.description_en || c.description || "",
              icon: c.icon || "✨",
              link_url: c.link_url,
            })),
          );
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
          .from("reviews")
          .select(
            `
                        review_id, rating, comment, created_at,
                        users!reviews_customer_id_fkey ( name, nickname, avatar_url ),
                        chat_rooms!reviews_room_id_fkey ( match_requests!chat_rooms_request_id_fkey ( service_type ) )
                    `,
          )
          .eq("is_featured_on_main", true)
          .gte("rating", 4.5)
          .order("created_at", { ascending: false })
          .limit(10); // 일단 10개 가져와서 JS에서 50자 필터링 후 3개 컷

        if (reviews) {
          const validReviews = reviews.filter(
            (r) => r.comment && r.comment.length >= 50,
          );
          // 50자 이상인게 부족하면 짧은거라도 채워서 3개 맞춤
          const finalReviews =
            validReviews.length >= 3
              ? validReviews.slice(0, 3)
              : reviews.slice(0, 3);
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
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    // 선택된 역할과 모드를 localStorage에 저장 (OAuth 리다이렉트 후 콜백에서 복원)
    localStorage.setItem(
      "pending_auth_role",
      authMode === "pro_signup" ? "PRO" : "CUSTOMER",
    );
    localStorage.setItem("pending_auth_mode", authMode);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) alert(t("landing.socialLoginError") + error.message);
  };

  const DEPTH1_EN: Record<string, string> = {
    "이사/청소": "Moving & Cleaning",
    "설치/수리": "Installation & Repair",
    "인테리어/시공": "Interior & Construction",
    "비즈니스/외주": "Business & Outsourcing",
    "이벤트/파티": "Events & Parties",
    "레슨/튜터링": "Lessons & Tutoring",
  };

  const [locale, setLocale] = useState<string>("en");
  React.useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((r) => r.startsWith("locale="))
      ?.split("=")[1];
    if (saved) setLocale(saved);
  }, []);

  const placeholderTexts =
    locale === "ko"
      ? [
          "어떤 서비스를 찾고 계세요?",
          "에어컨 청소를 검색해 보세요",
          "가사 도우미를 찾아보세요",
          "방문 수리 전문가",
        ]
      : [
          "What service are you looking for?",
          "Try AC cleaning",
          "Find a housekeeper",
          "On-site repair expert",
        ];

  const categoryUI: Record<string, { icon: React.ReactNode; desc: string }> = {
    "이사/청소": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
          />
        </svg>
      ),
      desc: "Moving, Cleaning",
    },
    "설치/수리": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      desc: "AC, Plumbing, Repair",
    },
    "인테리어/시공": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
      desc: "Remodeling, Construction",
    },
    "비즈니스/외주": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
      desc: "Translation, Design",
    },
    "이벤트/파티": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      ),
      desc: "Event Planning, Catering",
    },
    "레슨/튜터링": {
      icon: (
        <svg
          className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      ),
      desc: "Language, Arts Lessons",
    },
  };

  const fallbackCategories = depth1Keys.map((key, idx) => ({
    id: String(idx + 1),
    title: locale === "en" && DEPTH1_EN[key] ? DEPTH1_EN[key] : key,
    title_ko: key,
    icon: categoryUI[key]?.icon || (
      <svg
        className="w-8 h-8 md:w-10 md:h-10 text-blue-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    desc: categoryUI[key]?.desc || t("landing.hiddenProServiceFallback"),
    link_url: `/quotes/requests/request?categoryId=${encodeURIComponent(key)}`,
  }));

  const displayCategories =
    cmsCategories.length > 0 ? cmsCategories : fallbackCategories;

  // 카테고리 아이콘/색상 매핑
  const categoryStitchUI: Record<
    string,
    {
      icon: string;
      colorClass: string;
      bgClass: string;
      tags: string[];
      title: string;
      desc: string;
    }
  > = {
    "이사/청소": {
      icon: "cleaning_services",
      colorClass: "text-[#0020A0]",
      bgClass: "bg-[#E8F0FE]",
      tags:
        locale === "en"
          ? ["Residential", "Post-Renovation"]
          : ["주거", "이사 후 청소"],
      title: "Moving & Cleaning",
      desc: "Expert moving logistics and deep cleaning for homes and offices.",
    },
    "설치/수리": {
      icon: "build",
      colorClass: "text-[#0D9488]",
      bgClass: "bg-[#CCFBF1]",
      tags:
        locale === "en"
          ? ["AC Maintenance", "24/7 Plumbing"]
          : ["에어컨", "배관"],
      title: "Installation & Repair",
      desc: "HVAC, plumbing, electrical, and general appliance maintenance.",
    },
    "인테리어/시공": {
      icon: "architecture",
      colorClass: "text-[#D97706]",
      bgClass: "bg-[#FEF3C7]",
      tags: locale === "en" ? ["Design", "Building"] : ["디자인", "건축"],
      title: "Interior & Construction",
      desc: "Architectural design, full-scale remodeling, and structural work.",
    },
    "비즈니스/외주": {
      icon: "work",
      colorClass: "text-[#6B7280]",
      bgClass: "bg-gray-100",
      tags: locale === "en" ? ["Creative", "Legal"] : ["크리에이티브", "법률"],
      title: "Business & Outsourcing",
      desc: "Translation, graphic design, and professional virtual assistants.",
    },
    "이벤트/파티": {
      icon: "celebration",
      colorClass: "text-[#7C3AED]",
      bgClass: "bg-[#EDE9FE]",
      tags:
        locale === "en" ? ["Catering", "Live Music"] : ["케이터링", "라이브"],
      title: "Events & Parties",
      desc: "Premium catering, photography, and expert event management.",
    },
    "레슨/튜터링": {
      icon: "school",
      colorClass: "text-[#059669]",
      bgClass: "bg-[#D1FAE5]",
      tags: locale === "en" ? ["Language", "Music"] : ["언어", "음악"],
      title: "Lessons & Tutoring",
      desc: "Personal development through languages, arts, and academics.",
    },
  };

  return (
    <div className="bg-[#F8F9FA] text-[#1F2937] antialiased overflow-x-hidden min-h-screen">
      {/* ── [확장] 정지 계정 경고 배너 ── */}
      {showSuspendedBanner && (
        <div className="fixed top-0 left-0 w-full z-[200] bg-red-600 text-white py-4 px-6 shadow-lg animate-slide-down">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⛔</span>
              <div>
                <p className="font-bold text-lg">
                  {t("landing.suspendedTitle")}
                </p>
                <p className="text-red-100 text-sm">
                  {t("landing.suspendedContact")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSuspendedBanner(false)}
              className="text-white/80 hover:text-white text-xl font-bold px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {showWithdrawnBanner && (
        <div className="fixed top-0 left-0 w-full z-[200] bg-gray-800 text-white py-4 px-6 shadow-lg animate-slide-down">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">👋</span>
              <div>
                <p className="font-bold text-lg">
                  {t("landing.withdrawnTitle")}
                </p>
                <p className="text-gray-300 text-sm">
                  {t("landing.withdrawnSub")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowWithdrawnBanner(false)}
              className="text-white/80 hover:text-white text-xl font-bold px-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* [헤더] Stitch TopAppBar — 비로그인 시에만 표시 */}
      <header
        className={`fixed top-0 z-50 w-full backdrop-blur-xl transition-all duration-300 ${isScrolled ? "bg-white/95 border-b border-gray-200" : "bg-white/90"} ${isLoggedIn ? "hidden" : ""}`}
      >
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#0020A0] flex items-center justify-center shadow-lg shadow-[#0020A0]/20">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 4v16M18 4v16M6 12h12"
                />
              </svg>
            </div>
          </div>
          {/* 언어 + 액션 */}
          <div className="flex items-center gap-2">
            {isAdminUser && <LanguageSwitcher />}
            <button
              onClick={() => {
                setAuthMode("login");
                setShowLoginModal(true);
              }}
              className="text-[#6B7280] hover:text-[#1F2937] font-semibold text-sm transition-colors px-4 py-2"
            >
              {t("landing.loginAriaLabel") || "Login"}
            </button>
            <button
              onClick={() => {
                setAuthMode("pro_signup");
                setAuthTab("PRO");
                setShowLoginModal(true);
              }}
              className="bg-[#0020A0] hover:scale-95 duration-200 ease-in-out text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-[#0020A0]/20"
            >
              {t("landing.proSignupBtn")}
            </button>
          </div>
        </div>
      </header>

      <main className={isLoggedIn ? "" : "pt-20"}>
        {/* [히어로] Stitch Hero */}
        <section className="relative min-h-[751px] flex items-center px-6 overflow-hidden bg-[#06101E]">
          {/* 배경 이미지 */}
          <div className="absolute inset-0 z-0">
            {isCmsLoading ? (
              <div className="w-full h-full bg-[#06101E] animate-pulse" />
            ) : (
              <Image
                src={heroBanner?.media_url || "/images/hero-bg.jpg"}
                alt="HiddenPro Service Professional"
                fill
                priority
                className="object-cover object-center"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#06101E] via-[#06101E]/80 to-[#06101E]/10" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              {/* Verified pill */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white animate-pulse">
                <span
                  className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  verified
                </span>
                <span className="text-xs font-bold tracking-widest uppercase">
                  Verified Expert Network
                </span>
              </div>

              {/* 헤드라인 */}
              <h1 className="text-5xl md:text-7xl font-headline font-extrabold tracking-tight leading-[1.1] text-white">
                HiddenPro: Your <span className="text-[#7DAFFF]">Trusted</span>{" "}
                Home Service
              </h1>

              <p className="text-xl text-white/80 max-w-lg leading-relaxed">
                Meet the perfect professional for your next project. From
                cleaning to complex construction, we bridge the gap with elite
                local talent.
              </p>

              {/* 검색바 */}
              <div className="flex flex-col gap-4 max-w-xl" ref={searchRef}>
                <div className="flex gap-3 items-center">
                  <div className="flex-1 relative">
                    <span
                      className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#9CA3AF] pointer-events-none"
                      style={{ fontSize: "20px" }}
                    >
                      search
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(e.target.value.length > 0);
                      }}
                      placeholder={
                        animatedPlaceholder || t("landing.searchPlaceholder")
                      }
                      className="w-full pl-12 pr-4 py-4 rounded-full bg-white text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#0020A0]/30 transition-all placeholder:text-[#9CA3AF]"
                    />

                    {/* 자동완성 드롭다운 */}
                    {showDropdown && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 max-h-[300px] overflow-y-auto z-[60]">
                        {isSearching ? (
                          <div className="px-6 py-6 text-center text-[#6B7280] font-medium">
                            {t("landing.searching")}
                          </div>
                        ) : searchQuery.trim() ? (
                          <>
                            {searchResults.map((item, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setShowDropdown(false);
                                  router.push(
                                    `/request?categoryId=${encodeURIComponent(item.category)}&serviceId=${encodeURIComponent((item as any).service_ko || item.service)}${(item as any).depth2 ? `&depth2=${encodeURIComponent((item as any).depth2)}&serviceType=${encodeURIComponent((item as any).service_ko || item.service)}` : ""}`,
                                  );
                                }}
                                className="px-6 py-4 hover:bg-[#F8F9FA] cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors"
                              >
                                <span className="text-[#1F2937] font-semibold">
                                  {(item as any).service_en || item.service}
                                </span>
                                <span className="text-xs font-semibold text-[#0020A0] bg-[#E8F0FE] px-3 py-1 rounded-full">
                                  {(item as any).category_en || item.category}
                                </span>
                              </div>
                            ))}
                            {searchResults.length === 0 && (
                              <div className="px-6 py-6 text-center text-[#6B7280] font-medium">
                                {t("landing.noResults")}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="px-6 py-3 bg-[#F8F9FA] border-b border-gray-200 flex justify-between items-center rounded-t-2xl">
                              <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
                                {t("landing.recommendedServices")}
                              </span>
                              {showAllRecommendServices && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAllRecommendServices(false);
                                  }}
                                  className="text-xs font-bold text-[#6B7280] hover:text-[#1F2937] cursor-pointer"
                                >
                                  {t("landing.collapseServices")}
                                </span>
                              )}
                            </div>
                            {(showAllRecommendServices
                              ? allServices.map((s) => ({
                                  service: s.service,
                                  service_display: s.service_en || s.service,
                                  category: s.category,
                                  category_display:
                                    DEPTH1_EN[s.category] ?? s.category,
                                  depth2: s.depth2,
                                }))
                              : [
                                  {
                                    service: "에어컨 청소",
                                    service_display: "AC Cleaning",
                                    category: "이사/청소",
                                    category_display: "Moving & Cleaning",
                                  },
                                  {
                                    service: "가사/메이드",
                                    service_display: "Housekeeping & Maid",
                                    category: "이사/청소",
                                    category_display: "Moving & Cleaning",
                                  },
                                  {
                                    service: "수도/배관 및 워터펌프 수리",
                                    service_display:
                                      "Plumbing & Water Pump Repair",
                                    category: "설치/수리",
                                    category_display: "Installation & Repair",
                                  },
                                  {
                                    service: "전기 및 발전기 수리",
                                    service_display:
                                      "Electrical & Generator Repair",
                                    category: "설치/수리",
                                    category_display: "Installation & Repair",
                                  },
                                  {
                                    service: "특수 청소 및 방역",
                                    service_display:
                                      "Special Cleaning & Pest Control",
                                    category: "이사/청소",
                                    category_display: "Moving & Cleaning",
                                  },
                                ]
                            ).map((item, i) => (
                              <div
                                key={i}
                                onClick={() => {
                                  setShowDropdown(false);
                                  router.push(
                                    `/request?categoryId=${encodeURIComponent(item.category)}&serviceId=${encodeURIComponent(item.service)}${(item as any).depth2 ? `&depth2=${encodeURIComponent((item as any).depth2)}&serviceType=${encodeURIComponent(item.service)}` : ""}`,
                                  );
                                }}
                                className="px-6 py-4 hover:bg-[#F8F9FA] cursor-pointer flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors"
                              >
                                <span className="text-[#1F2937] font-semibold">
                                  {(item as any).service_display ||
                                    (item as any).service_en ||
                                    item.service}
                                </span>
                                <span className="text-xs font-semibold text-[#0020A0] bg-[#E8F0FE] px-3 py-1 rounded-full">
                                  {(item as any).category_display ||
                                    DEPTH1_EN[item.category] ||
                                    item.category}
                                </span>
                              </div>
                            ))}
                            {!showAllRecommendServices && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAllRecommendServices(true);
                                }}
                                className="px-6 py-4 text-center cursor-pointer hover:bg-[#F8F9FA] transition-colors border-t border-gray-200 rounded-b-2xl"
                              >
                                <span className="text-sm font-bold text-[#0020A0] flex items-center justify-center gap-1">
                                  {t("landing.viewAllServices")}
                                  <span className="material-symbols-outlined text-sm">
                                    expand_more
                                  </span>
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA 버튼 */}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (isProUser) {
                      showToast("This page is for customers only.", "warning");
                      return;
                    }
                    router.push("/request");
                  }}
                  className="bg-white text-[#0020A0] font-bold rounded-full py-3 px-6 w-full text-center hover:bg-[#F8F9FA] transition-colors"
                >
                  Get a Free Quote in 1 Minute
                </button>

                {/* 아바타 스택 */}
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <img
                      src="/images/avatar-1.jpg"
                      alt="Professional"
                      className="w-9 h-9 rounded-full border-2 border-[#0020A0] object-cover"
                    />
                    <img
                      src="/images/avatar-2.jpg"
                      alt="Professional"
                      className="w-9 h-9 rounded-full border-2 border-[#0020A0] object-cover"
                    />
                    <img
                      src="/images/avatar-3.jpg"
                      alt="Professional"
                      className="w-9 h-9 rounded-full border-2 border-[#0020A0] object-cover"
                    />
                  </div>
                  <span className="text-sm text-white/70">
                    <span className="text-white font-bold">12k+</span>{" "}
                    professionals active this week
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* [섹션 2: Explore Our Services - Stitch Bento Grid] */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-headline font-bold text-[#1F2937] mb-4">
                Explore Our Services
              </h2>
              <p className="text-[#6B7280] text-lg max-w-2xl mx-auto mb-4">
                Find the right expertise for every corner of your life, from
                home repairs to business expansion.
              </p>
              <button
                onClick={() => {
                  if (isProUser) {
                    showToast("This page is for customers only.", "warning");
                    return;
                  }
                  router.push("/request");
                }}
                className="text-[#0020A0] font-semibold flex items-center gap-1 cursor-pointer mx-auto"
              >
                View All Services →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {displayCategories.map((cat) => {
                const ui = categoryStitchUI[
                  (cat as any).title_ko || cat.title
                ] || {
                  icon: "home_repair_service",
                  colorClass: "text-primary",
                  bgClass: "bg-primary/10",
                  tags: [],
                };
                return (
                  <Link
                    key={cat.id}
                    href={
                      cat.link_url ||
                      `/request?categoryId=${encodeURIComponent((cat as any).title_ko || cat.title)}`
                    }
                    onClick={(e) => {
                      if (isProUser) {
                        e.preventDefault();
                        showToast(
                          "This page is for customers only.",
                          "warning",
                        );
                      }
                    }}
                    className="group bg-white rounded-lg p-6 hover:bg-[#F8F9FA] transition-all duration-300 border border-gray-200 hover:border-[#0020A0]/30 flex flex-col gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl ${ui.bgClass} flex items-center justify-center`}
                    >
                      <span
                        className={`material-symbols-outlined ${ui.colorClass}`}
                        style={{
                          fontVariationSettings: "'FILL' 1",
                          fontSize: "24px",
                        }}
                      >
                        {ui.icon}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <h3 className="font-bold text-[#1F2937] text-lg">
                        {ui.title ||
                          (locale === "en"
                            ? (cat as any).title_en || cat.title
                            : cat.title)}
                      </h3>
                      <p className="text-sm text-gray-400">
                        {ui.desc ||
                          (cat.desc &&
                            (locale === "en"
                              ? (cat as any).desc_en || cat.desc
                              : cat.desc))}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ui.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2.5 py-1 rounded-full bg-[#F8F9FA] text-[#6B7280] border border-gray-100"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* [섹션 3: Live Customer Reviews - Stitch Dark] */}
        <section className="py-24 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-headline font-bold text-[#1F2937] mb-4">
                {t("landing.reviewSectionTitle")}
              </h2>
              <p className="text-[#6B7280] text-lg">
                {t("landing.reviewSectionSub")}
              </p>
            </div>
            {isReviewsLoading ? (
              <div className="flex justify-center py-10">
                <span className="text-on-surface-variant animate-pulse">
                  {t("landing.loadingReviews")}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(recentReviews.length > 0
                  ? recentReviews
                  : [
                      {
                        review_id: "s1",
                        rating: 5,
                        comment:
                          "The cleaner was professional and thorough. My apartment has never been this spotless!",
                        created_at: new Date().toISOString(),
                        users: {
                          nickname: "Sarah K.",
                          avatar_url: "/images/review-sarah.jpg",
                        },
                        chat_rooms: {
                          match_requests: { service_type: "House Cleaning" },
                        },
                      },
                      {
                        review_id: "s2",
                        rating: 5,
                        comment:
                          "Fixed my AC in under an hour. Very knowledgeable and fair pricing. Highly recommend!",
                        created_at: new Date().toISOString(),
                        users: {
                          nickname: "James L.",
                          avatar_url: "/images/review-james.jpg",
                        },
                        chat_rooms: {
                          match_requests: { service_type: "AC Repair" },
                        },
                      },
                      {
                        review_id: "s3",
                        rating: 5,
                        comment:
                          "Excellent interior design consultation. Transformed my space completely within budget.",
                        created_at: new Date().toISOString(),
                        users: {
                          nickname: "Elena M.",
                          avatar_url: "/images/review-elena.jpg",
                        },
                        chat_rooms: {
                          match_requests: { service_type: "Interior Design" },
                        },
                      },
                    ]
                )
                  .slice(0, 3)
                  .map((review: any) => (
                    <div
                      key={review.review_id}
                      className="bg-white rounded-lg p-6 flex flex-col gap-4 border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                    >
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <span
                            key={i}
                            className="material-symbols-outlined text-yellow-400"
                            style={{
                              fontVariationSettings:
                                i < review.rating ? "'FILL' 1" : "'FILL' 0",
                              fontSize: "18px",
                            }}
                          >
                            star
                          </span>
                        ))}
                      </div>
                      <p className="text-[#1F2937] leading-relaxed line-clamp-4 flex-1">
                        &ldquo;{review.comment}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#F8F9FA] shrink-0">
                          <img
                            src={
                              review.users?.avatar_url ||
                              `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(review.users?.nickname || review.review_id)}&backgroundColor=1b1820`
                            }
                            alt={t("landing.profileAlt")}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-[#1F2937] text-sm">
                            {review.users?.nickname ||
                              review.users?.name ||
                              t("landing.anonymousCustomer")}
                          </p>
                          <p className="text-xs text-[#0020A0]">
                            {review.chat_rooms?.match_requests?.service_type ||
                              t("landing.defaultService")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* [섹션 4: The HiddenPro Difference - Stitch 3-col] */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-headline font-bold text-[#1F2937] mb-4 break-keep">
                The HiddenPro Difference
              </h2>
              <p className="text-[#6B7280] text-lg max-w-2xl mx-auto break-keep">
                We've built a marketplace based on trust, transparency, and
                speed. No hidden fees, no guesswork.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  icon: "verified_user",
                  colorClass: "text-[#0020A0]",
                  bgClass: "bg-[#E8F0FE]",
                  title: t("landing.feature1Title"),
                  desc: t("landing.feature1Desc"),
                },
                {
                  icon: "payments",
                  colorClass: "text-[#059669]",
                  bgClass: "bg-[#D1FAE5]",
                  title: t("landing.feature2Title"),
                  desc: t("landing.feature2Desc"),
                },
                {
                  icon: "bolt",
                  colorClass: "text-[#D97706]",
                  bgClass: "bg-[#FEF3C7]",
                  title: t("landing.feature3Title"),
                  desc: t("landing.feature3Desc"),
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="bg-white rounded-lg p-8 flex flex-col gap-5 border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <div
                    className={`w-14 h-14 rounded-xl ${feature.bgClass} flex items-center justify-center`}
                  >
                    <span
                      className={`material-symbols-outlined ${feature.colorClass}`}
                      style={{
                        fontVariationSettings: "'FILL' 1",
                        fontSize: "28px",
                      }}
                    >
                      {feature.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#1F2937] mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-[#6B7280] leading-relaxed break-keep">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* [섹션 5: Join as a Pro - Stitch] */}
        <section className="py-24 bg-[#F8F9FA]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-[#07101F] to-[#1840C8] p-10 md:p-16">
              {/* 텍스트 + CTA */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-4xl md:text-5xl font-headline font-bold text-white mb-5 leading-tight break-keep">
                  Are You a Service Professional?
                </h2>
                <p className="text-white/80 text-lg mb-6 leading-relaxed max-w-lg break-keep">
                  Join the fastest-growing marketplace for high-end service
                  providers. Keep 100% of your earnings and connect with quality
                  clients in your neighborhood.
                </p>
                <ul className="flex flex-col gap-3 mb-8 text-left max-w-lg mx-auto md:mx-0">
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <circle cx="10" cy="10" r="10" fill="#22c55e" />
                      <path
                        d="M6 10l3 3 5-5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-white">
                      Zero percent commission platform
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <circle cx="10" cy="10" r="10" fill="#22c55e" />
                      <path
                        d="M6 10l3 3 5-5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-white">
                      Verified lead quality control
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 flex-shrink-0"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <circle cx="10" cy="10" r="10" fill="#22c55e" />
                      <path
                        d="M6 10l3 3 5-5"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-white">
                      Flexible scheduling &amp; mobile app management
                    </span>
                  </li>
                </ul>
                <button
                  onClick={() => {
                    setAuthMode("pro_signup");
                    setAuthTab("PRO");
                    setShowLoginModal(true);
                  }}
                  className="bg-white hover:scale-95 duration-200 text-[#0020A0] font-bold px-8 py-4 rounded-full shadow-lg shadow-black/20 transition-all inline-flex items-center gap-2"
                >
                  Start as a Pro ⚡
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 프로덕션 레디 로그인/가입 모달 */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-200">
            {/* 헤더 */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-[#1F2937]">
                {authMode === "login"
                  ? t("landing.loginTitle")
                  : authMode === "pro_signup"
                    ? t("landing.proSignupTitle")
                    : t("landing.signupTitle")}
              </h3>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setAuthError("");
                  setAuthMode("login");
                }}
                className="text-gray-400 hover:text-gray-700 font-bold w-8 h-8 flex items-center justify-center rounded-full transition"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* 고수 가입 모드일 때 안내 문구 */}
              {authMode === "pro_signup" && (
                <div className="bg-[#F8F9FA] p-4 rounded-xl text-center border border-gray-100">
                  <p className="text-sm font-bold text-[#1F2937]">
                    {t("landing.proSignupDesc")}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {t("landing.proSignupDescSub")}
                  </p>
                </div>
              )}

              {/* 소셜 로그인 */}
              <div className="space-y-3">
                <button
                  onClick={() => handleSocialLogin("google")}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition text-sm font-bold text-[#1F2937]"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  {t("landing.googleLogin")}
                </button>
                <button
                  onClick={() => handleSocialLogin("facebook")}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#0020A0] hover:bg-[#001880] transition text-sm font-bold text-white"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {t("landing.facebookLogin")}
                </button>
              </div>

              <p className="text-[11px] text-[#6B7280] text-center leading-relaxed">
                {t("landing.termsAgreement")}{" "}
                <span className="underline cursor-pointer text-[#0020A0]">
                  {t("landing.termsLink")}
                </span>{" "}
                {t("landing.termsAnd")}{" "}
                <span className="underline cursor-pointer text-[#0020A0]">
                  {t("landing.privacyLink")}
                </span>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
