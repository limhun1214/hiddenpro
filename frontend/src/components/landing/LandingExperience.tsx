"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

type Service = { name: string; name_en: string | null; depth1: string; depth2: string | null };
type Category = { id: string; title: string; title_en?: string; description?: string; description_en?: string; link_url?: string };
type SearchResult = { service_name: string; category_title: string };
type Review = { review_id: string; rating: number; comment: string; users: { nickname?: string; name?: string; avatar_url?: string } | null };
// The September redesign replaces older artwork. Later CMS uploads still take priority.
const HERO_REFRESH_AT = "2026-09-27T15:00:00.000Z";
const HERO_IMAGE = "/images/hero-craftsman.webp";
const categoryArt: Record<string, { title: string; icon: string; description: string; koDescription: string }> = {
  "이사/청소": { title: "Moving & cleaning", icon: "cleaning_services", description: "A fresh start for your space.", koDescription: "새로운 공간, 산뜻한 시작." },
  "설치/수리": { title: "Installation & repair", icon: "handyman", description: "Everyday fixes. Expert hands.", koDescription: "일상의 수리, 전문가의 손길." },
  "인테리어/시공": { title: "Interior & construction", icon: "chair", description: "Make your space feel like you.", koDescription: "내 취향을 담은 공간." },
  "비즈니스/외주": { title: "Business & freelance", icon: "work", description: "Good ideas, brought to life.", koDescription: "좋은 아이디어를 현실로." },
  "이벤트/파티": { title: "Events & celebrations", icon: "celebration", description: "For moments that matter.", koDescription: "오래 기억될 특별한 순간." },
  "레슨/튜터링": { title: "Lessons & tutoring", icon: "auto_stories", description: "Your next chapter starts here.", koDescription: "새로운 배움의 시작." },
};

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function LandingExperience({ isLoggedIn, isProUser, isAdminUser, onLogin, onJoinPro }: {
  isLoggedIn: boolean; isProUser: boolean; isAdminUser: boolean; onLogin: () => void; onJoinPro: () => void;
}) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const { showToast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banner, setBanner] = useState<{ media_url: string; media_type: string } | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeResult, setActiveResult] = useState(-1);
  const [mobileMenu, setMobileMenu] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const c = (english: string, korean: string) => ko ? korean : english;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCatalogError(false);
    setReviewError(false);
    async function load() {
      const responses = await Promise.allSettled([
        supabase.from("categories").select("name, name_en, depth1, depth2").eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("cms_categories").select("id, title, title_en, description, description_en, link_url").eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("cms_banners").select("media_url, media_type").eq("is_active", true).gte("created_at", HERO_REFRESH_AT).order("sort_order", { ascending: true }).limit(1),
        supabase.from("reviews").select("review_id, rating, comment, users!reviews_customer_id_fkey(name, nickname, avatar_url)").eq("is_featured_on_main", true).gte("rating", 4.5).order("created_at", { ascending: false }).limit(3),
      ]);
      if (cancelled) return;
      const [catalog, cms, hero, feedback] = responses;
      const catalogFailed = catalog.status === "rejected" || !!catalog.value.error;
      const cmsFailed = cms.status === "rejected" || !!cms.value.error;
      setCatalogError(catalogFailed || cmsFailed);
      if (!catalogFailed && catalog.status === "fulfilled") setServices((catalog.value.data || []) as Service[]);
      if (!cmsFailed && cms.status === "fulfilled") setCategories((cms.value.data || []) as Category[]);
      if (hero.status === "fulfilled" && !hero.value.error) setBanner(hero.value.data?.[0] || null);
      if (feedback.status === "fulfilled" && !feedback.value.error) setReviews((feedback.value.data || []) as unknown as Review[]);
      else setReviewError(true);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setResults([]);
    setSearchError(false);
    setActiveResult(-1);
    if (!query.trim()) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.rpc("search_services", { search_keyword: query.trim(), max_results: 8 });
        if (cancelled) return;
        if (error) throw error;
        setResults((data || []) as SearchResult[]);
        if (!data?.length) {
          void supabase.from("search_fail_logs").insert([{ keyword: query.trim() }]).then(({ error: logError }) => {
            if (logError) console.error("Search analytics unavailable", logError.code);
          });
        }
      } catch {
        if (!cancelled) setSearchError(true);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  const beginRequest = (href = "/request") => {
    if (isProUser) { showToast(c("Switch to a customer account to request a service.", "서비스 요청은 고객 계정에서 이용해 주세요."), "warning"); return; }
    setOpen(false);
    router.push(href);
  };
  const selectService = (item: SearchResult) => {
    const matched = services.find(service => service.name === item.service_name && service.depth1 === item.category_title);
    const params = new URLSearchParams({ categoryId: item.category_title, serviceId: item.service_name });
    if (matched?.depth2) { params.set("depth2", matched.depth2); params.set("serviceType", item.service_name); }
    beginRequest(`/request?${params}`);
  };
  const visibleCategories: Category[] = categories.length ? categories : Array.from(new Set(services.map(service => service.depth1).filter(Boolean))).map(title => ({ id: title, title, title_en: categoryArt[title]?.title }));
  const suggestions: SearchResult[] = query.trim() ? results : services.slice(0, 6).map(service => ({ service_name: service.name, category_title: service.depth1 }));
  const serviceLabel = (item: SearchResult) => ko ? item.service_name : services.find(service => service.name === item.service_name)?.name_en || item.service_name;
  const categoryHref = (category: Category) => {
    // Existing CMS links used a retired route; keep its selected category on the current form.
    if (category.link_url?.startsWith("/quotes/requests/request")) return category.link_url.replace("/quotes/requests/request", "/request");
    if (category.link_url?.startsWith("/") && !category.link_url.startsWith("//")) return category.link_url;
    return `/request?categoryId=${encodeURIComponent(category.title)}`;
  };

  return (
    <div className="hp-landing">
      {!isLoggedIn && <header className="hp-header">
        <div className="hp-container hp-header-inner">
          <Link href="/" className="hp-brand" aria-label="HiddenPro home"><span className="hp-brand-symbol">h<span>.</span></span>Hidden<span className="hp-brand-light">Pro</span></Link>
          <nav className="hp-desktop-links" aria-label={c("Main navigation", "주요 메뉴")}>
            <a href="#services">{c("Explore services", "서비스 둘러보기")}</a><a href="#how-it-works">{c("How it works", "이용 방법")}</a><a href="#for-pros">{c("For professionals", "전문가 안내")}</a>
          </nav>
          <div className="hp-header-actions">{isAdminUser && <LanguageSwitcher />}<button onClick={onLogin} className="hp-login">{c("Log in", "로그인")}</button><button onClick={onJoinPro} className="hp-button hp-button-dark hp-header-pro">{c("Join as a pro", "전문가 등록")}<Icon name="north_east" /></button><button className="hp-menu-button" aria-label={c("Toggle menu", "메뉴 열기/닫기")} aria-expanded={mobileMenu} aria-controls="landing-mobile-menu" onClick={() => setMobileMenu(value => !value)}><Icon name={mobileMenu ? "close" : "menu"} /></button></div>
        </div>
        {mobileMenu && <nav id="landing-mobile-menu" className="hp-mobile-menu" aria-label={c("Mobile navigation", "모바일 메뉴")}><a href="#services" onClick={() => setMobileMenu(false)}>{c("Explore services", "서비스 둘러보기")}</a><a href="#how-it-works" onClick={() => setMobileMenu(false)}>{c("How it works", "이용 방법")}</a><a href="#for-pros" onClick={() => setMobileMenu(false)}>{c("For professionals", "전문가 안내")}</a><button onClick={() => { setMobileMenu(false); onJoinPro(); }}>{c("Join as a pro", "전문가 등록")} ↗</button></nav>}
      </header>}

      <section className="hp-hero hp-container" aria-labelledby="hero-title">
        <div className="hp-hero-copy">
          <p className="hp-eyebrow"><span className="hp-status-dot" />{c("LIFE, WITH A LITTLE HELP.", "일상에 필요한, 좋은 전문가.")}</p>
          <h1 id="hero-title">{c("Big plans.", "하고 싶은 일.")}<br />{c("Little fixes.", "해결할 작은 일.")}<br /><span>{c("The right pro.", "딱 맞는 전문가.")}</span></h1>
          <p className="hp-hero-description">{c("From a fresh coat of paint to a fresh start. Find local experts who make your everyday a little better.", "공간의 작은 변화부터 새로운 시작까지. 나의 일상을 더 편하게 만들어 줄 전문가를 만나보세요.")}</p>
          <div className="hp-search-wrap" ref={searchRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
            <form className="hp-search" onSubmit={event => { event.preventDefault(); if (activeResult >= 0 && suggestions[activeResult]) selectService(suggestions[activeResult]); else { setOpen(true); inputRef.current?.focus(); } }}>
              <Icon name="search" /><label htmlFor="service-search" className="sr-only">{c("What can we help with?", "어떤 서비스가 필요하세요?")}</label>
              <input id="service-search" ref={inputRef} role="combobox" aria-expanded={open} aria-controls="service-results" aria-autocomplete="list" aria-activedescendant={activeResult >= 0 ? `service-result-${activeResult}` : undefined} autoComplete="off" placeholder={c("What can we help with?", "어떤 서비스가 필요하세요?")} value={query} onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => {
                if (event.key === "Escape") { setOpen(false); setActiveResult(-1); }
                if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveResult(index => Math.min(index + 1, suggestions.length - 1)); }
                if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult(index => Math.max(index - 1, 0)); }
              }} />
              <button type="submit" className="hp-search-submit" aria-label={c("Search services", "서비스 검색")}><span>{c("Find a pro", "검색")}</span><Icon name="arrow_forward" /></button>
            </form>
            {open && <div className="hp-search-results">
              <p className="hp-search-caption">{query.trim() ? c("MATCHING SERVICES", "검색 결과") : c("EXPLORE SERVICES", "서비스 둘러보기")}</p>
              <div role="status" aria-live="polite">{searching ? <p className="hp-search-message">{c("Finding the right services…", "서비스를 찾고 있어요…")}</p> : searchError ? <p className="hp-search-message">{c("Search is unavailable. Please try again or browse services below.", "검색을 불러오지 못했어요. 다시 시도하거나 아래 서비스를 살펴보세요.")}</p> : !suggestions.length ? <p className="hp-search-message">{loading ? c("Loading services…", "서비스를 불러오는 중…") : c("No services found. Browse all services to get started.", "검색 결과가 없어요. 전체 서비스에서 찾아보세요.")}</p> : null}</div>
              <ul id="service-results" role="listbox" aria-label={c("Service suggestions", "서비스 추천")}>{!searching && suggestions.map((item, index) => <li id={`service-result-${index}`} role="option" aria-selected={activeResult === index} key={`${item.category_title}-${item.service_name}`} className={activeResult === index ? "is-active" : ""}><button type="button" onClick={() => selectService(item)}><span>{serviceLabel(item)}<small>{ko ? item.category_title : categoryArt[item.category_title]?.title || item.category_title}</small></span><Icon name="north_east" /></button></li>)}</ul>
              <button className="hp-search-all" onClick={() => beginRequest()}>{c("Browse all services", "전체 서비스 보기")}<Icon name="arrow_forward" /></button>
            </div>}
          </div>
          <div className="hp-popular"><span>{c("Explore", "추천")}</span>{[...new Set(services.map(service => service.depth1))].slice(0, 3).map(title => <button key={title} onClick={() => beginRequest(`/request?categoryId=${encodeURIComponent(title)}`)}>{ko ? title : categoryArt[title]?.title || title}<Icon name="north_east" /></button>)}</div>
          <p className="hp-hero-note"><Icon name="check_circle" />{c("Compare quotes. Chat directly. Choose with confidence.", "견적 비교부터 직접 상담까지, 내게 맞는 선택.")}</p>
        </div>
        <div className="hp-hero-visual">
          <div className="hp-photo-frame">
            {banner?.media_type?.toLowerCase().includes("video") ? <video className="hp-hero-photo" src={banner.media_url} controls playsInline preload="metadata" poster={HERO_IMAGE} aria-label={c("Meet HiddenPro professionals", "HiddenPro 전문가 소개")} /> : <Image src={banner?.media_url || HERO_IMAGE} alt={c("A craftsman fitting an oak shelf in a sunlit home", "밝은 집에서 원목 선반을 설치하는 전문가")} fill priority sizes="(max-width: 700px) 100vw, 48vw" className="hp-hero-photo" unoptimized={!!banner?.media_url} />}
            <div className="hp-photo-caption"><span>{c("GOOD PEOPLE. GREAT WORK.", "좋은 사람, 확실한 일솜씨.")}</span><span>01 — HIDDENPRO</span></div>
          </div>
          <div className="hp-visual-stamp" aria-hidden="true"><Icon name="asterisk" /></div>
          <div className="hp-project-note"><span className="hp-project-icon"><Icon name="task_alt" /></span><div><strong>{c("One less thing on your list.", "할 일 목록이 하나 줄었어요.")}</strong><span>{c("More time for what matters.", "소중한 일에 더 많은 시간을.")}</span></div><Icon name="north_east" /></div>
          <span className="hp-side-caption" aria-hidden="true">A LITTLE EXPERTISE GOES A LONG WAY.</span>
        </div>
      </section>

      <div className="hp-promise-strip"><div className="hp-container">{[{ icon: "chat_bubble", en: "Direct conversations", ko: "전문가와 직접 상담" }, { icon: "compare_arrows", en: "Quotes worth comparing", ko: "한눈에 비교하는 견적" }, { icon: "tune", en: "Your project. Your choice.", ko: "내 프로젝트, 나의 선택" }].map(item => <span key={item.icon}><Icon name={item.icon} />{ko ? item.ko : item.en}</span>)}</div></div>

      <section id="services" className="hp-section hp-container" aria-labelledby="services-title">
        <div className="hp-section-heading"><div><p className="hp-eyebrow">{c("A PRO FOR EVERY PROJECT", "어떤 일이든, 맞는 전문가")}</p><h2 id="services-title">{c("What’s on your list?", "어떤 도움이 필요하세요?")}</h2></div><button className="hp-text-link" onClick={() => beginRequest()}>{c("Explore all services", "전체 서비스 보기")}<Icon name="north_east" /></button></div>
        {loading ? <div className="hp-category-grid" aria-busy="true" aria-label={c("Loading services", "서비스 불러오는 중")}>{Array.from({ length: 6 }, (_, index) => <div key={index} className="hp-category-card hp-skeleton" />)}</div> : <>
          {catalogError && <div className="hp-inline-notice" role="status"><span>{c("Some services couldn’t load. Please try again.", "일부 서비스를 불러오지 못했어요. 다시 시도해 주세요.")}</span><button onClick={() => setReload(value => value + 1)}>{c("Try again", "다시 시도")}</button></div>}
          <div className="hp-category-grid">{visibleCategories.map((category, index) => { const art = categoryArt[category.title]; return <Link key={category.id} href={categoryHref(category)} onClick={event => { if (isProUser) { event.preventDefault(); beginRequest(); } }} className="hp-category-card"><div className="hp-category-top"><span className={`hp-category-icon hp-category-icon-${index % 6}`}><Icon name={art?.icon || "home_repair_service"} /></span><span className="hp-category-number">{String(index + 1).padStart(2, "0")}</span></div><div><h3>{ko ? category.title : category.title_en || art?.title || category.title}</h3><p>{ko ? category.description || art?.koDescription : category.description_en || art?.description}</p></div><span className="hp-category-arrow"><Icon name="north_east" /></span></Link>; })}</div>
          {!catalogError && !visibleCategories.length && <p className="hp-inline-notice">{c("New services are on their way. Please check back soon.", "새로운 서비스를 준비하고 있어요. 잠시 후 다시 방문해 주세요.")}</p>}
        </>}
      </section>

      <section id="how-it-works" className="hp-how-section"><div className="hp-container hp-how-layout"><div><p className="hp-eyebrow">{c("LESS SEARCHING. MORE LIVING.", "찾는 시간은 줄이고, 일상은 더 여유롭게.")}</p><h2>{c("From to-do", "해야 할 일에서")}<br />{c("to done.", "완료한 일로.")}<span className="hp-heading-dot">●</span></h2><p>{c("Good help should be easy to find. Here’s how to make your next project happen.", "좋은 전문가를 만나는 일은 쉬워야 하니까. 세 단계로 다음 프로젝트를 시작하세요.")}</p><button className="hp-button hp-button-dark" onClick={() => beginRequest()}>{c("Tell us what you need", "필요한 서비스 요청하기")}<Icon name="arrow_forward" /></button></div><div className="hp-steps">{[
          { n: "01", icon: "edit_note", title: c("Tell us about your project", "필요한 일을 알려주세요"), text: c("A few details about what you need, where, and when. We’ll take it from there.", "어떤 일이 필요한지, 장소와 일정을 간단히 알려주세요.") },
          { n: "02", icon: "forum", title: c("Meet your options", "견적을 비교하고 상담하세요"), text: c("Receive quotes from professionals. Compare profiles and chat about the details.", "전문가의 견적과 프로필을 비교하고 채팅으로 자세히 이야기하세요.") },
          { n: "03", icon: "done_all", title: c("Choose your kind of expert", "내게 맞는 전문가를 선택하세요"), text: c("Find the right fit for your budget and your plans. Then make it happen.", "예산과 계획에 맞는 전문가와 함께 시작하세요.") },
        ].map(step => <article className="hp-step" key={step.n}><span className="hp-step-number">{step.n}</span><div><h3>{step.title}</h3><p>{step.text}</p></div><Icon name={step.icon} /></article>)}</div></div></section>

      {reviews.length > 0 && !reviewError && <section className="hp-section hp-container"><div className="hp-section-heading"><div><p className="hp-eyebrow">{c("REAL EXPERIENCES", "직접 경험한 이야기")}</p><h2>{c("Good work gets talked about.", "좋은 경험은 후기로 남아요.")}</h2></div><Icon name="format_quote" className="hp-large-quote" /></div><div className="hp-reviews">{reviews.map(review => <article className="hp-review" key={review.review_id}><div className="hp-review-stars" aria-label={`${review.rating} / 5`}>{Array.from({ length: 5 }, (_, i) => <Icon key={i} name={i < Math.round(review.rating) ? "star" : "star_border"} />)}</div><blockquote>{review.comment}</blockquote><div className="hp-review-author">{review.users?.avatar_url ? <Image src={review.users.avatar_url} alt="" width={40} height={40} unoptimized /> : <span className="hp-review-avatar"><Icon name="person" /></span>}<strong>{review.users?.nickname || review.users?.name || c("HiddenPro customer", "HiddenPro 고객")}</strong></div></article>)}</div></section>}

      <section id="for-pros" className="hp-container hp-pro-section"><div className="hp-pro-banner"><div className="hp-pro-copy"><p className="hp-eyebrow">{c("GOOD AT WHAT YOU DO?", "당신의 전문성이 필요한 곳")}</p><h2>{c("Your skills.", "당신의 실력.")}<br />{c("Someone’s next big thing.", "누군가의 멋진 시작.")}</h2><p>{c("Bring your expertise to HiddenPro. Discover new requests, connect with customers, and build what comes next.", "HiddenPro에서 당신의 전문성을 펼쳐보세요. 새로운 요청을 찾고, 고객과 연결하고, 다음 기회를 만들어 보세요.")}</p><button className="hp-button hp-button-lime" onClick={isProUser ? () => router.push("/pro/requests") : onJoinPro}>{isProUser ? c("View customer requests", "고객 요청 확인하기") : c("Become a HiddenPro", "HiddenPro 전문가 시작하기")}<Icon name="north_east" /></button></div><div className="hp-pro-art" aria-hidden="true"><span className="hp-art-ring hp-art-ring-one" /><span className="hp-art-ring hp-art-ring-two" /><span className="hp-art-ring hp-art-ring-three" /><span className="hp-art-star">✳</span><span className="hp-art-label">GREAT WORK<br />STARTS WITH YOU.</span></div></div></section>

      <section className="hp-container hp-faq-section"><div><p className="hp-eyebrow">{c("A LITTLE MORE CLARITY", "시작 전, 궁금한 이야기")}</p><h2>{c("Good questions.", "자주 묻는 질문.")}</h2><Link className="hp-text-link" href="/support/inquiry">{c("Get in touch", "고객 지원 문의")}<Icon name="north_east" /></Link></div><div className="hp-faq-list">{[
        { q: c("How do I find the right professional?", "어떻게 전문가를 찾나요?"), a: c("Choose a service and describe your project. You can then compare the quotes you receive, view professional profiles, and discuss the details in chat before making your choice.", "서비스를 선택하고 요청서를 작성하세요. 도착한 견적과 전문가 프로필을 비교하고, 채팅으로 상담한 후 선택할 수 있어요.") },
        { q: c("Can I talk to a pro before choosing?", "선택하기 전에 상담할 수 있나요?"), a: c("Yes. Use the chat available with your quotes to discuss your needs, availability, and scope with the professional.", "네. 받은 견적의 채팅 기능을 통해 서비스 범위와 일정 등 자세한 내용을 전문가와 이야기할 수 있어요.") },
        { q: c("How do I join as a professional?", "전문가로 어떻게 참여하나요?"), a: c("Select “Join as a pro”, create your account, and complete your professional profile with your services and service area to start exploring requests.", "‘전문가 등록’에서 가입한 후, 제공 서비스와 활동 지역 등 프로필을 완성하면 고객 요청을 살펴볼 수 있어요.") },
      ].map(item => <details key={item.q}><summary>{item.q}<Icon name="add" /></summary><p>{item.a}</p></details>)}</div></section>
    </div>
  );
}
