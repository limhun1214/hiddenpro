"use client";
export const runtime = "edge";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { optimizeImage } from "@/utils/imageOptimizer";
import { useToast } from "@/components/ui/Toast";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

function InquiryContent() {
  const t = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"WRITE" | "HISTORY">(
    searchParams.get("tab") === "history" ? "HISTORY" : "WRITE",
  );
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Form states
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 이미지 첨부 states
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History states
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 이 페이지에서만 스크롤바 숨기기
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "inquiry-hide-scrollbar";
    style.textContent =
      "html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }";
    document.head.appendChild(style);
    return () => {
      document.getElementById("inquiry-hide-scrollbar")?.remove();
    };
  }, []);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);
      setUserId(session.user.id);
    };
    checkUser();
  }, [router]);

  useEffect(() => {
    if (activeTab === "HISTORY" && userId) {
      fetchHistory();
    }
  }, [activeTab, userId]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("inquiries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      showToast(t("inquiry.loadFailed"), "error");
    } else if (data) {
      setInquiries(data);
    }
    setLoadingHistory(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = 5 - imageFiles.length;
    if (remaining <= 0) {
      showToast(t("inquiry.maxImages"), "error");
      return;
    }

    const selected = files.slice(0, remaining);
    const newFiles = [...imageFiles, ...selected];
    setImageFiles(newFiles);

    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const optimizedFile = await optimizeImage(file, 1920, 1080, 0.8);
      const fileName = `inquiry_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      const { error: upErr } = await supabase.storage
        .from("quote_images")
        .upload(`inquiries/${fileName}`, optimizedFile);
      if (upErr)
        throw new Error(t("inquiry.imageUploadFailed") + upErr.message);
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("quote_images")
        .getPublicUrl(`inquiries/${fileName}`);
      urls.push(publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !title.trim() || !content.trim()) {
      showToast(t("inquiry.fillAll"), "error");
      return;
    }

    setIsSubmitting(true);

    const { data: proProfile } = await supabase
      .from("pro_profiles")
      .select("pro_id")
      .eq("pro_id", userId)
      .maybeSingle();

    const userType = proProfile ? "PRO" : "CUSTOMER";

    let imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      try {
        imageUrls = await uploadImages(imageFiles);
      } catch (err: any) {
        showToast(err.message, "error");
        setIsSubmitting(false);
        return;
      }
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString());

    if ((todayCount ?? 0) >= 10) {
      showToast(t("inquiry.dailyLimit"), "error");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("inquiries").insert({
      user_id: userId,
      user_type: userType,
      category,
      title,
      content: transactionId.trim()
        ? `[Transaction ID: ${transactionId.trim()}]\n\n${content}`
        : content,
      status: "pending",
      image_urls: imageUrls,
    });

    setIsSubmitting(false);

    if (error) {
      showToast(t("inquiry.submitError") + error.message, "error");
    } else {
      showToast(t("inquiry.submitSuccess"), "success");
      setCategory("");
      setTitle("");
      setContent("");
      setTransactionId("");
      setImageFiles([]);
      setImagePreviews([]);
      setActiveTab("HISTORY");
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "pending":
        return (
          <span className="bg-yellow-400/10 text-yellow-600 text-xs font-bold px-3 py-1 rounded-full border border-yellow-400/20">
            {t("inquiry.statusPending")}
          </span>
        );
      case "in_progress":
        return (
          <span className="bg-[#0020a0]/10 text-[#0020a0] text-xs font-bold px-3 py-1 rounded-full border border-[#0020a0]/20">
            {t("inquiry.statusInProgress")}
          </span>
        );
      case "resolved":
        return (
          <span className="bg-green-50 text-green-600 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
            {t("inquiry.statusResolved")}
          </span>
        );
      default:
        return null;
    }
  };

  if (!user)
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001269]"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#191c1e] flex flex-col pb-32 font-body">
      {/* 내부 헤더 */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-[#c5c5d6]/40 shadow-[0_0_32px_0_rgba(0,15,93,0.06)] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100/50 transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-[#001269]">
              arrow_back
            </span>
          </button>
          <h1 className="font-headline font-bold text-lg tracking-tight text-[#001269]">
            {t("inquiry.pageTitle")}
          </h1>
          <div className="w-10"></div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-6 pt-8">
        {/* 탭 바 */}
        <nav className="flex items-center justify-start gap-8 mb-10">
          <button
            onClick={() => setActiveTab("WRITE")}
            className={`relative font-headline font-bold text-sm tracking-wide whitespace-nowrap pb-1 transition-colors ${
              activeTab === "WRITE"
                ? "text-[#001269] after:content-[''] after:absolute after:bottom-[-2px] after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-[3px] after:bg-[#001269] after:rounded-full"
                : "text-slate-400 hover:text-[#001269]"
            }`}
          >
            {t("inquiry.tabWrite")}
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`relative font-headline font-bold text-sm tracking-wide whitespace-nowrap pb-1 transition-colors ${
              activeTab === "HISTORY"
                ? "text-[#001269] after:content-[''] after:absolute after:bottom-[-2px] after:left-1/2 after:-translate-x-1/2 after:w-5 after:h-[3px] after:bg-[#001269] after:rounded-full"
                : "text-slate-400 hover:text-[#001269]"
            }`}
          >
            {t("inquiry.tabHistory")}
          </button>
        </nav>

        {/* ── WRITE 탭 ── */}
        {activeTab === "WRITE" && (
          <>
            {/* 히어로 브랜딩 */}
            <section className="mb-12 flex flex-col items-start gap-6">
              <div className="flex items-center gap-6 w-full">
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-[#0020a0] tracking-[0.15em] uppercase mb-2 block">
                    Service Excellence
                  </span>
                  <h2 className="font-headline font-extrabold text-3xl text-[#001269] leading-tight">
                    How can we elevate your experience?
                  </h2>
                </div>
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 rounded-2xl bg-white shadow-lg border border-[#e0e3e6] flex items-center justify-center">
                    <svg
                      viewBox="0 0 96 96"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-20 h-20"
                    >
                      {/* 배경 원형 */}
                      <circle cx="48" cy="48" r="40" fill="#eceef1" />
                      {/* 얼굴 */}
                      <circle cx="48" cy="44" r="18" fill="#fde8d8" />
                      {/* 헤드셋 밴드 */}
                      <path
                        d="M30 42 Q30 26 48 26 Q66 26 66 42"
                        stroke="#001269"
                        strokeWidth="3.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* 헤드셋 왼쪽 이어컵 */}
                      <rect
                        x="27"
                        y="40"
                        width="7"
                        height="10"
                        rx="3.5"
                        fill="#001269"
                      />
                      {/* 헤드셋 오른쪽 이어컵 */}
                      <rect
                        x="62"
                        y="40"
                        width="7"
                        height="10"
                        rx="3.5"
                        fill="#001269"
                      />
                      {/* 눈 */}
                      <circle cx="42" cy="43" r="2.5" fill="#2d3133" />
                      <circle cx="54" cy="43" r="2.5" fill="#2d3133" />
                      {/* 눈 하이라이트 */}
                      <circle cx="43" cy="42" r="1" fill="white" />
                      <circle cx="55" cy="42" r="1" fill="white" />
                      {/* 미소 */}
                      <path
                        d="M42 50 Q48 55 54 50"
                        stroke="#2d3133"
                        strokeWidth="2"
                        fill="none"
                        strokeLinecap="round"
                      />
                      {/* 마이크 암 */}
                      <path
                        d="M34 49 Q32 52 34 54"
                        stroke="#001269"
                        strokeWidth="2.5"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            {/* 문의 폼 */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 카테고리 */}
              <div className="group">
                <label className="text-[11px] font-bold text-[#001269] tracking-widest uppercase mb-2 block px-1">
                  {t("inquiry.categoryLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none bg-[#f2f4f7] border border-[#c5c5d6] focus:border-[#0020a0] px-4 py-4 rounded-lg font-medium text-[#191c1e] focus:outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="" disabled>
                      {t("inquiry.categoryPlaceholder")}
                    </option>
                    <option value="ACCOUNT">
                      {t("inquiry.categoryAccount")}
                    </option>
                    <option value="PAYMENT">
                      {t("inquiry.categoryPayment")}
                    </option>
                    <option value="MATCHING">
                      {t("inquiry.categoryMatching")}
                    </option>
                    <option value="REPORT">
                      {t("inquiry.categoryReport")}
                    </option>
                    <option value="OTHER">{t("inquiry.categoryOther")}</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <span className="material-symbols-outlined">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* 거래 ID (결제 카테고리만) */}
              {category === "PAYMENT" && (
                <div className="group">
                  <label className="text-[11px] font-bold text-[#001269] tracking-widest uppercase mb-2 block px-1">
                    {t("inquiry.transactionIdLabel")}
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder={t("inquiry.transactionIdPlaceholder")}
                    className="w-full bg-[#f2f4f7] border border-[#c5c5d6] focus:border-[#0020a0] px-4 py-4 rounded-lg font-medium text-[#191c1e] placeholder:text-slate-400 focus:outline-none transition-all"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-400 font-medium mt-1 px-1">
                    {t("inquiry.transactionIdHint")}
                  </p>
                </div>
              )}

              {/* 제목 */}
              <div className="group">
                <label className="text-[11px] font-bold text-[#001269] tracking-widest uppercase mb-2 block px-1">
                  {t("inquiry.titleLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("inquiry.titlePlaceholder")}
                  className="w-full bg-[#f2f4f7] border border-[#c5c5d6] focus:border-[#0020a0] px-4 py-4 rounded-lg font-medium text-[#191c1e] placeholder:text-slate-400 focus:outline-none transition-all"
                  required
                  maxLength={100}
                />
              </div>

              {/* 내용 */}
              <div className="group">
                <label className="text-[11px] font-bold text-[#001269] tracking-widest uppercase mb-2 block px-1">
                  {t("inquiry.contentLabel")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("inquiry.contentPlaceholder")}
                  className="w-full bg-[#f2f4f7] border border-[#c5c5d6] focus:border-[#0020a0] px-4 py-4 rounded-lg font-medium text-[#191c1e] placeholder:text-slate-400 focus:outline-none transition-all resize-none min-h-[150px]"
                  required
                  minLength={10}
                />
              </div>

              {/* 사진 첨부 */}
              <div>
                <label className="text-[11px] font-bold text-[#001269] tracking-widest uppercase mb-4 block px-1">
                  {t("inquiry.photoLabel")} ({t("inquiry.photoOptional")})
                </label>

                <div className="grid grid-cols-4 gap-3">
                  {/* 미리보기 이미지 */}
                  {imagePreviews.map((src, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-xl overflow-hidden relative group"
                    >
                      <img
                        src={src}
                        alt={`Attachment ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="bg-[#0020a0]/90 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold"
                        >
                          <span className="material-symbols-outlined text-sm">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 추가 버튼 슬롯 */}
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
                        className="aspect-square rounded-xl bg-white border-2 border-dashed border-[#c5c5d6] flex flex-col items-center justify-center group hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-slate-400 group-hover:text-[#001269] transition-colors text-xl">
                          add_a_photo
                        </span>
                        <span className="text-[10px] mt-1 font-bold text-slate-400 group-hover:text-[#001269] transition-colors">
                          Add
                        </span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* 제출 버튼 */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-5 rounded-xl bg-[#0020a0] hover:bg-[#001269] text-white text-base font-headline font-bold shadow-[0_8px_24px_rgba(0,32,160,0.2)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? t("inquiry.submitting") : t("inquiry.submit")}
                  <span className="material-symbols-outlined text-sm">
                    send
                  </span>
                </button>
                <p className="text-center text-[11px] text-slate-400 mt-6 px-4 leading-relaxed font-medium">
                  {t("inquiry.formDesc")}
                </p>
              </div>
            </form>
          </>
        )}

        {/* ── HISTORY 탭 ── */}
        {activeTab === "HISTORY" && (
          <div className="pb-4">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-b-2 border-[#001269] rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">
                  {t("inquiry.loadingHistory")}
                </p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-[#eceef1] flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-3xl">
                    inbox
                  </span>
                </div>
                <p className="text-slate-400 font-medium text-sm">
                  {t("inquiry.noInquiries")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {inquiries.map((iq) => {
                  const isExpanded = expandedId === iq.id;
                  const catMap: Record<string, string> = {
                    ACCOUNT: t("inquiry.catAccount"),
                    PAYMENT: t("inquiry.catPayment"),
                    MATCHING: t("inquiry.catMatching"),
                    REPORT: t("inquiry.catReport"),
                    OTHER: t("inquiry.catOther"),
                  };
                  const catLabel = catMap[iq.category] || iq.category;
                  const imgs: string[] = Array.isArray(iq.image_urls)
                    ? iq.image_urls
                    : [];

                  return (
                    <div
                      key={iq.id}
                      className="bg-white rounded-xl overflow-hidden border border-[#c5c5d6]/60"
                    >
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : iq.id)}
                        className="p-4 cursor-pointer flex flex-col gap-2 hover:bg-[#f2f4f7] transition"
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#454653] bg-[#eceef1] px-2.5 py-1 rounded-md">
                              {catLabel}
                            </span>
                            <span className="text-xs text-slate-400">
                              {new Date(iq.created_at).toLocaleDateString()}
                            </span>
                            {imgs.length > 0 && (
                              <span className="text-xs text-slate-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">
                                  attach_file
                                </span>
                                {imgs.length}
                              </span>
                            )}
                          </div>
                          <StatusBadge status={iq.status} />
                        </div>
                        <div className="flex justify-between items-center w-full">
                          <h3 className="font-bold text-[#191c1e] line-clamp-1 flex-1 pr-3 text-sm">
                            {iq.title}
                          </h3>
                          <span
                            className="material-symbols-outlined text-slate-400 text-lg transition-transform duration-200"
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "none",
                            }}
                          >
                            expand_more
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#f2f4f7] px-4 pb-4 pt-3 border-t border-[#c5c5d6]/40 space-y-4">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                              {t("inquiry.myQuestion")}
                            </span>
                            <p className="text-slate-500 text-sm whitespace-pre-wrap leading-relaxed">
                              {iq.content}
                            </p>

                            {imgs.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {imgs.map((url: string, idx: number) => (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <img
                                      src={url}
                                      alt={`Attachment ${idx + 1}`}
                                      className="w-20 h-20 object-cover rounded-xl border border-[#c5c5d6] hover:opacity-80 transition"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {iq.status === "resolved" && iq.admin_reply && (
                            <div className="bg-[#0020a0]/10 border border-[#0020a0]/20 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="material-symbols-outlined text-[#0020a0] text-lg"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  support_agent
                                </span>
                                <span className="text-xs font-bold text-[#0020a0] uppercase tracking-wider">
                                  {t("inquiry.adminReply")}
                                </span>
                              </div>
                              <div
                                className="text-[#191c1e] text-sm whitespace-pre-wrap leading-relaxed border-t border-[#0020a0]/15 pt-2"
                                dangerouslySetInnerHTML={{
                                  __html: iq.admin_reply,
                                }}
                              />
                              {Array.isArray(iq.admin_reply_images) &&
                                iq.admin_reply_images.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-3">
                                    {iq.admin_reply_images.map(
                                      (url: string, idx: number) => (
                                        <a
                                          key={idx}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <img
                                            src={url}
                                            alt={`Reply Attachment ${idx + 1}`}
                                            className="w-20 h-20 object-cover rounded-xl border border-[#0020a0]/20 hover:opacity-80 transition"
                                          />
                                        </a>
                                      ),
                                    )}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function InquiryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#001269]"></div>
        </div>
      }
    >
      <InquiryContent />
    </Suspense>
  );
}
