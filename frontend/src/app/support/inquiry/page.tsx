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

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        showToast(t("inquiry.loginRequired"), "error");
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
          <span className="bg-yellow-400/10 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-400/20">
            {t("inquiry.statusPending")}
          </span>
        );
      case "in_progress":
        return (
          <span className="bg-[#a68cff]/10 text-[#a68cff] text-xs font-bold px-3 py-1 rounded-full border border-[#a68cff]/20">
            {t("inquiry.statusInProgress")}
          </span>
        );
      case "resolved":
        return (
          <span className="bg-[#b5ffc2]/10 text-[#b5ffc2] text-xs font-bold px-3 py-1 rounded-full border border-[#b5ffc2]/20">
            {t("inquiry.statusResolved")}
          </span>
        );
      default:
        return null;
    }
  };

  if (!user)
    return (
      <div className="min-h-screen bg-[#0f0d13] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff88b5]"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0f0d13] text-[#f8f1fb] flex flex-col pb-32">
      {/* 내부 헤더 */}
      <header className="flex items-center justify-between w-full px-4 h-14 bg-[#0f0d13] border-b border-[#4a474e]/15 sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#1b1820] transition-colors active:scale-90"
        >
          <span className="material-symbols-outlined text-[#ff88b5]">
            arrow_back
          </span>
        </button>
        <h1 className="font-bold text-[#f8f1fb]">{t("inquiry.pageTitle")}</h1>
        <div className="w-10"></div>
      </header>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-6">
        {/* 탭 바 */}
        <div className="flex p-1 mb-8 rounded-full bg-[#151219] border border-[#4a474e]/10">
          <button
            onClick={() => setActiveTab("WRITE")}
            className={`flex-1 py-3 text-sm font-semibold rounded-full transition-all ${
              activeTab === "WRITE"
                ? "bg-[#ff6ea9] text-[#4b0027]"
                : "text-[#aea9b2] hover:text-[#f8f1fb]"
            }`}
          >
            {t("inquiry.tabWrite")}
          </button>
          <button
            onClick={() => setActiveTab("HISTORY")}
            className={`flex-1 py-3 text-sm font-semibold rounded-full transition-all ${
              activeTab === "HISTORY"
                ? "bg-[#ff6ea9] text-[#4b0027]"
                : "text-[#aea9b2] hover:text-[#f8f1fb]"
            }`}
          >
            {t("inquiry.tabHistory")}
          </button>
        </div>

        {/* ── WRITE 탭 ── */}
        {activeTab === "WRITE" && (
          <>
            {/* 히어로 브랜딩 */}
            <div className="mb-10 flex gap-6 items-end">
              <div className="flex-1">
                <p className="text-[#ff88b5] font-extrabold text-xs uppercase tracking-[0.2em] mb-2">
                  Service Excellence
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                  How can we <span className="text-[#ff88b5]">elevate</span>{" "}
                  your experience?
                </h2>
              </div>
              <div className="hidden md:block w-32 h-32 rounded-xl bg-[#211e26] overflow-hidden shadow-2xl rotate-3 flex-shrink-0">
                <img
                  alt="Support Representative"
                  className="w-full h-full object-cover grayscale brightness-75 contrast-125"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbsDXwcq4lVHEL6I9Aj1C_BwLcEBTa-mC2VRlniABp6BUt0Ejp0Z_TRbRRajge6xICzZV5URH8ZW_ATH5l-xM6N6xBNytIyAKEwZjcUrwLMKvOGvQDwAh-LFyj51dNSsg86xUano7W4haeJDb_lt36rcjWQACmNsHWxZ9Nghkcn4SMTs6zEQgKve40u7Ir8h3e-EwDw8VMlZqRezheB70z2HtU7OZErJ0ZUVf0OYGlNj3t-k6O54lpbg3qqTK7YHRjtczF1MGa0Lx2"
                />
              </div>
            </div>

            {/* 문의 폼 */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* 카테고리 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#aea9b2] ml-1">
                  {t("inquiry.categoryLabel")}{" "}
                  <span className="text-[#ff6e84]">*</span>
                </label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-14 px-6 bg-[#211e26] rounded-xl text-[#f8f1fb] appearance-none focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/30 transition-all font-medium cursor-pointer"
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
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-[#aea9b2]">
                    <span className="material-symbols-outlined">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* 거래 ID (결제 카테고리만) */}
              {category === "PAYMENT" && (
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-[#aea9b2] ml-1">
                    {t("inquiry.transactionIdLabel")}
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder={t("inquiry.transactionIdPlaceholder")}
                    className="w-full h-14 px-6 bg-[#211e26] rounded-xl text-[#f8f1fb] placeholder-[#78747c] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/30 transition-all font-medium"
                    maxLength={100}
                  />
                  <p className="text-xs text-[#aea9b2]/70 ml-1">
                    {t("inquiry.transactionIdHint")}
                  </p>
                </div>
              )}

              {/* 제목 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#aea9b2] ml-1">
                  {t("inquiry.titleLabel")}{" "}
                  <span className="text-[#ff6e84]">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("inquiry.titlePlaceholder")}
                  className="w-full h-14 px-6 bg-[#211e26] rounded-xl text-[#f8f1fb] placeholder-[#78747c] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/30 transition-all font-medium"
                  required
                  maxLength={100}
                />
              </div>

              {/* 내용 */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-[#aea9b2] ml-1">
                  {t("inquiry.contentLabel")}{" "}
                  <span className="text-[#ff6e84]">*</span>
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={t("inquiry.contentPlaceholder")}
                  className="w-full p-6 bg-[#211e26] rounded-xl text-[#f8f1fb] placeholder-[#78747c] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/30 transition-all font-medium resize-none min-h-[150px]"
                  required
                  minLength={10}
                />
              </div>

              {/* 사진 첨부 */}
              <div className="space-y-4">
                <div className="flex justify-between items-end ml-1">
                  <label className="text-sm font-semibold text-[#aea9b2]">
                    {t("inquiry.photoLabel")}
                  </label>
                  <span className="text-[10px] text-[#78747c] font-bold uppercase tracking-widest">
                    {t("inquiry.photoOptional")}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                          className="bg-[#ff6e84]/90 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold"
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
                        className="aspect-square rounded-xl bg-black border-2 border-dashed border-[#4a474e]/30 flex flex-col items-center justify-center group hover:border-[#ff88b5]/50 cursor-pointer transition-all"
                      >
                        <span className="material-symbols-outlined text-[#78747c] group-hover:text-[#ff88b5] transition-colors">
                          add_a_photo
                        </span>
                        <span className="text-[10px] mt-1.5 font-bold text-[#78747c] group-hover:text-[#ff88b5] uppercase tracking-tighter transition-colors">
                          {t("inquiry.addPhoto")} ({imageFiles.length}/5)
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
                  className="w-full py-5 rounded-full bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] text-base font-bold shadow-lg shadow-[#ff88b5]/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined">send</span>
                  {isSubmitting ? t("inquiry.submitting") : t("inquiry.submit")}
                </button>
                <p className="text-center text-[11px] text-[#78747c] mt-6 px-4 leading-relaxed font-medium">
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
                <div className="w-8 h-8 border-b-2 border-[#ff88b5] rounded-full animate-spin"></div>
                <p className="text-[#aea9b2] text-sm">
                  {t("inquiry.loadingHistory")}
                </p>
              </div>
            ) : inquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-[#1b1820] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#aea9b2] text-3xl">
                    inbox
                  </span>
                </div>
                <p className="text-[#aea9b2] font-medium text-sm">
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
                      className="bg-[#1b1820] rounded-xl overflow-hidden border border-[#4a474e]/15"
                    >
                      <div
                        onClick={() => setExpandedId(isExpanded ? null : iq.id)}
                        className="p-4 cursor-pointer flex flex-col gap-2 hover:bg-[#211e26] transition"
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-[#aea9b2] bg-[#27242d] px-2.5 py-1 rounded-md">
                              {catLabel}
                            </span>
                            <span className="text-xs text-[#aea9b2]/60">
                              {new Date(iq.created_at).toLocaleDateString()}
                            </span>
                            {imgs.length > 0 && (
                              <span className="text-xs text-[#aea9b2]/60 flex items-center gap-0.5">
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
                          <h3 className="font-bold text-[#f8f1fb] line-clamp-1 flex-1 pr-3 text-sm">
                            {iq.title}
                          </h3>
                          <span
                            className="material-symbols-outlined text-[#aea9b2] text-lg transition-transform duration-200"
                            style={{
                              transform: isExpanded ? "rotate(180deg)" : "none",
                            }}
                          >
                            expand_more
                          </span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-[#151219] px-4 pb-4 pt-3 border-t border-[#4a474e]/15 space-y-4">
                          <div>
                            <span className="text-[10px] font-bold text-[#aea9b2]/60 uppercase tracking-wider mb-2 block">
                              {t("inquiry.myQuestion")}
                            </span>
                            <p className="text-[#aea9b2] text-sm whitespace-pre-wrap leading-relaxed">
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
                                      className="w-20 h-20 object-cover rounded-xl border border-[#4a474e]/20 hover:opacity-80 transition"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {iq.status === "resolved" && iq.admin_reply && (
                            <div className="bg-[#a68cff]/10 border border-[#a68cff]/20 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className="material-symbols-outlined text-[#a68cff] text-lg"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  support_agent
                                </span>
                                <span className="text-xs font-bold text-[#a68cff] uppercase tracking-wider">
                                  {t("inquiry.adminReply")}
                                </span>
                              </div>
                              <div
                                className="text-[#f8f1fb] text-sm whitespace-pre-wrap leading-relaxed border-t border-[#a68cff]/15 pt-2"
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
                                            className="w-20 h-20 object-cover rounded-xl border border-[#a68cff]/20 hover:opacity-80 transition"
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
        <div className="min-h-screen bg-[#0f0d13] flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff88b5]"></div>
        </div>
      }
    >
      <InquiryContent />
    </Suspense>
  );
}
