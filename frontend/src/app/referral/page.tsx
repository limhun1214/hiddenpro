"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

export default function ReferralPage() {
  const t = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("CUSTOMER");
  const [referralCode, setReferralCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [referralEnabled, setReferralEnabled] = useState(true);

  // 추천 리스트
  const [rewards, setRewards] = useState<any[]>([]);

  // 쿠폰 (고객만)
  const [coupons, setCoupons] = useState<any[]>([]);

  // 쿠폰 등록 (고수만)
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  // 배너
  const [banners, setBanners] = useState<any[]>([]);

  // 안내 접기/펼치기
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        showToast(t("referral.loginRequired"), "error");
        router.push("/");
        return;
      }
      const uid = session.user.id;
      setUserId(uid);

      // 유저 정보
      const { data: userData } = await supabase
        .from("users")
        .select("role, referral_code")
        .eq("user_id", uid)
        .single();
      if (userData) {
        setUserRole(String(userData.role).toUpperCase());
        setReferralCode(userData.referral_code || "");
      }

      // 추천 시스템 ON/OFF
      const { data: settingData } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "referral_enabled")
        .single();
      if (settingData && Number(settingData.value) === 0) {
        setReferralEnabled(false);
      }

      // 추천 이력
      const { data: rewardsData } = await supabase
        .from("referral_rewards")
        .select(
          "*, referred:referred_id(email, role), referrer:referrer_id(email, role)",
        )
        .eq("referrer_id", uid)
        .order("created_at", { ascending: false });
      if (rewardsData) setRewards(rewardsData);

      // 쿠폰 (고객)
      if (String(userData?.role).toUpperCase() === "CUSTOMER") {
        const { data: couponData } = await supabase
          .from("coupons")
          .select("*")
          .eq("owner_id", uid)
          .order("created_at", { ascending: false });
        if (couponData) setCoupons(couponData);
      }

      // 배너 로드
      const { data: bannerData } = await supabase
        .from("referral_banners")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (bannerData) setBanners(bannerData);

      setLoading(false);
    };
    init();
  }, []);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast(t("referral.copied"), "success");
    });
  };

  const handleShare = async () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "HiddenPro",
          text: t("referral.inviteBanner"),
          url: link,
        });
      } catch {}
    } else {
      handleCopyLink();
    }
  };

  const handleRedeem = async () => {
    if (!redeemCode.trim() || !userId) return;
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_coupon", {
      p_pro_id: userId,
      p_coupon_code: redeemCode.trim(),
    });
    setRedeeming(false);
    if (error || !data?.success) {
      const reason = data?.reason;
      if (reason === "own_coupon") {
        showToast(t("referral.redeemOwn"), "error");
      } else {
        showToast(t("referral.redeemError"), "error");
      }
      return;
    }
    showToast(t("referral.redeemSuccess"), "success");
    setRedeemCode("");
    window.dispatchEvent(new CustomEvent("wallet-updated"));
  };

  const handleShareBanner = (bannerId: number) => {
    const link = `${window.location.origin}/?ref=${referralCode}&banner=${bannerId}`;
    if (navigator.share) {
      navigator
        .share({
          title: "HiddenPro",
          text: "Get a FREE Discount Coupon!",
          url: link,
        })
        .catch(() => {});
    } else {
      navigator.clipboard
        .writeText(link)
        .then(() => showToast(t("referral.copied"), "success"));
    }
  };

  const handleCopyBannerLink = (bannerId: number) => {
    const banner = banners.find((b: any) => b.id === bannerId);
    const link = `${window.location.origin}/?ref=${referralCode}&banner=${bannerId}`;
    const imageUrl = banner?.image_url || "";
    const embedCode = `<a href="${link}" target="_blank" rel="noopener noreferrer"><img src="${imageUrl}" alt="HiddenPro Referral Banner" style="max-width:100%;height:auto;border:none;" /></a>`;
    navigator.clipboard
      .writeText(embedCode)
      .then(() => showToast(t("referral.copiedEmbed"), "success"));
  };

  const maskEmail = (email: string) => {
    if (!email) return "***";
    const [name, domain] = email.split("@");
    return name.substring(0, 3) + "***@" + domain;
  };

  const completedCount = rewards.filter((r) => r.status === "COMPLETED").length;
  const pendingCount = rewards.filter((r) => r.status === "PENDING").length;
  const isPro = userRole === "PRO";

  if (loading)
    return (
      <div className="min-h-screen bg-[#0f0d13] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#ff88b5]"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0f0d13] text-[#f8f1fb] pb-32">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* 시스템 OFF 배너 */}
        {!referralEnabled && (
          <div className="bg-yellow-900/30 border border-yellow-600/40 rounded-xl p-4 text-center text-sm text-yellow-400 font-medium">
            {t("referral.systemOff")}
          </div>
        )}

        {/* A. 추천 코드 히어로 카드 */}
        <section className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#ff88b5] to-[#a68cff] rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-[#211e26] rounded-xl p-8 flex flex-col items-center text-center space-y-6">
            <div className="space-y-2">
              <p className="text-[#aea9b2] font-bold uppercase tracking-widest text-xs">
                {t("referral.myCode")}
              </p>
              <h2 className="text-3xl font-extrabold text-[#f8f1fb] tracking-tight">
                {referralCode}
              </h2>
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={handleCopyLink}
                disabled={!referralEnabled}
                className="flex-1 bg-[#ff88b5] text-[#610034] py-4 rounded-full font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">
                  content_copy
                </span>
                {t("referral.copyLink")}
              </button>
              <button
                onClick={handleShare}
                disabled={!referralEnabled}
                className="flex-1 bg-[#27242d] text-[#f8f1fb] py-4 rounded-full font-bold text-sm border border-[#4a474e]/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">share</span>
                {t("referral.share")}
              </button>
            </div>
          </div>
        </section>

        {/* B. 보상 요약 - 벤토 그리드 */}
        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-[#1b1820] rounded-xl p-6 flex items-center justify-between border-l-4 border-[#ff88b5]">
            <div>
              <p className="text-[#aea9b2] text-xs font-semibold mb-1">
                {t("referral.statsCompleted")}
              </p>
              <p className="text-3xl font-extrabold text-[#ff88b5]">
                +{completedCount} {t("referral.statsTotal")}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[#ff88b5]/10 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[#ff88b5]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                card_giftcard
              </span>
            </div>
          </div>
          <div className="bg-[#151219] rounded-xl p-5 space-y-2">
            <p className="text-[#aea9b2] text-xs font-medium">
              {t("referral.statsTotal")}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#f8f1fb]">
                {rewards.length}
              </span>
              <span className="text-[#b5ffc2] text-xs font-bold mb-1 flex items-center">
                <span className="material-symbols-outlined text-sm">
                  trending_up
                </span>
              </span>
            </div>
          </div>
          <div className="bg-[#151219] rounded-xl p-5 space-y-2">
            <p className="text-[#aea9b2] text-xs font-medium">
              {t("referral.statsPending")}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-[#f8f1fb]">
                {pendingCount}
              </span>
              <span className="text-[#aea9b2] text-[10px] mb-1">Verifying</span>
            </div>
          </div>
        </section>

        {/* C. 내 추천 리스트 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-[#f8f1fb]">
              {t("referral.listTitle")}
            </h3>
          </div>
          {rewards.length === 0 ? (
            <div className="bg-[#1b1820] rounded-xl p-8 text-center text-[#aea9b2] text-sm">
              {t("referral.listEmpty")}
            </div>
          ) : (
            <div className="bg-[#1b1820] rounded-xl overflow-hidden divide-y divide-[#4a474e]/15">
              {rewards.map((r) => (
                <div
                  key={r.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[#f8f1fb]">
                      {maskEmail(r.referred?.email)}
                    </p>
                    <p className="text-xs text-[#aea9b2] mt-0.5">
                      {r.referred_role === "PRO" ? "Pro" : "Customer"}
                      <span className="mx-1">·</span>
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.status === "COMPLETED" ? (
                      <span className="text-xs font-bold text-[#b5ffc2] bg-[#b5ffc2]/10 px-3 py-1.5 rounded-full">
                        {r.referrer_reward_type === "BONUS_CREDITS"
                          ? `+${r.referrer_reward_amount} Credits`
                          : `Coupon ${r.referrer_reward_amount}`}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-yellow-400 bg-yellow-400/10 px-3 py-1.5 rounded-full">
                        {t("referral.statusPending")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* D. 보유 쿠폰 (고객만) */}
        {!isPro && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-base font-bold text-[#f8f1fb]">
                {t("referral.couponsTitle")}
              </h3>
            </div>
            {coupons.length === 0 ? (
              <div className="bg-[#1b1820] rounded-xl p-8 text-center text-[#aea9b2] text-sm">
                {t("referral.couponsEmpty")}
              </div>
            ) : (
              <div className="space-y-3">
                {coupons.map((c) => {
                  const isActive = c.status === "ACTIVE";
                  const isUsed = c.status === "USED";
                  return (
                    <div
                      key={c.coupon_id}
                      className={`relative overflow-hidden bg-[#1b1820] rounded-xl flex items-stretch h-24 border border-[#4a474e]/10 ${!isActive ? "opacity-60 grayscale" : ""}`}
                    >
                      <div
                        className={`w-2 ${isActive ? "bg-[#ff88b5]" : "bg-[#aea9b2]/30"}`}
                      ></div>
                      <div className="flex-1 p-4 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                          <div>
                            <p
                              className={`font-extrabold text-lg ${isActive ? "text-[#ff88b5]" : "text-[#aea9b2]"}`}
                            >
                              {c.discount_amount} {t("referral.couponOff")}
                            </p>
                            <p className="text-[#aea9b2] text-[10px] font-medium tracking-wide mt-0.5">
                              {isUsed
                                ? `${t("referral.couponUsed")} · ${new Date(c.expires_at).toLocaleDateString()}`
                                : `${t("referral.couponExpires")}: ${new Date(c.expires_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="bg-[#27242d] px-3 py-1.5 rounded-md border border-[#4a474e]/20">
                            <span className="text-[#f8f1fb] font-mono font-bold text-xs">
                              {c.coupon_code}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* 티켓 노치 효과 */}
                      <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0f0d13] rounded-full"></div>
                      <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0f0d13] rounded-full"></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* E. 쿠폰 등록 (고수만) */}
        {isPro && (
          <section className="bg-[#1b1820] rounded-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-[#f8f1fb]">
              {t("referral.redeemTitle")}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder={t("referral.redeemPlaceholder")}
                className="flex-1 bg-[#27242d] border border-[#4a474e]/30 rounded-xl px-4 py-3 text-sm font-mono uppercase text-[#f8f1fb] placeholder-[#aea9b2]/50 focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/50"
                maxLength={12}
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemCode.trim()}
                className="px-5 py-3 bg-[#b5ffc2] text-[#004820] font-bold rounded-xl text-sm transition active:scale-95 disabled:opacity-40"
              >
                {redeeming ? "..." : t("referral.redeemBtn")}
              </button>
            </div>
          </section>
        )}

        {/* F. 배너 다운로드/공유 */}
        {banners.length > 0 && (
          <section className="space-y-4">
            <div className="px-1">
              <h3 className="text-base font-bold text-[#f8f1fb]">
                {t("referral.bannerTitle")}
              </h3>
              <p className="text-[#aea9b2] text-sm mt-0.5">
                {t("referral.bannerIncluded")}
              </p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="flex-none w-48 rounded-xl overflow-hidden relative group border border-[#4a474e]/20"
                >
                  <div className="aspect-[9/16] relative">
                    <img
                      src={b.image_url}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d13] to-transparent opacity-80"></div>
                    <div className="absolute bottom-3 left-3 right-3 space-y-2">
                      <p className="text-[#f8f1fb] text-xs font-bold truncate">
                        {b.title}
                      </p>
                      <p className="text-[#aea9b2] text-[10px]">
                        {b.width}×{b.height} · {b.platform_hint}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleCopyBannerLink(b.id)}
                          className="flex-1 bg-[#27242d]/80 backdrop-blur-md text-[#f8f1fb] py-1.5 rounded-lg text-[10px] font-bold border border-white/10 active:scale-95 transition-all"
                        >
                          Copy Code
                        </button>
                        <button
                          onClick={() => handleShareBanner(b.id)}
                          className="flex-1 bg-[#ff88b5]/80 backdrop-blur-md text-[#610034] py-1.5 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center justify-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">
                            share
                          </span>
                          Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* G. 추천 구조 안내 (접기/펼치기) */}
        <section className="bg-[#1b1820] rounded-xl overflow-hidden border border-[#4a474e]/15">
          <button
            type="button"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-[#f8f1fb] hover:bg-[#211e26] transition"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#a68cff] text-lg">
                info
              </span>
              {t("referral.howItWorks")}
            </span>
            <span
              className={`material-symbols-outlined text-[#aea9b2] transition-transform duration-200 ${showHowItWorks ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </button>
          {showHowItWorks && (
            <div className="px-4 pb-4 space-y-3 text-sm text-[#aea9b2] border-t border-[#4a474e]/15 pt-3">
              <div className="bg-[#ff88b5]/10 rounded-lg p-3 border border-[#ff88b5]/20">
                <p className="font-bold text-[#ff88b5] text-xs mb-1">
                  Pro → Pro
                </p>
                <p>{t("referral.howProToPro")}</p>
              </div>
              <div className="bg-[#a68cff]/10 rounded-lg p-3 border border-[#a68cff]/20">
                <p className="font-bold text-[#a68cff] text-xs mb-1">
                  Customer → Pro
                </p>
                <p>{t("referral.howCustToPro")}</p>
              </div>
              <div className="bg-[#b5ffc2]/10 rounded-lg p-3 border border-[#b5ffc2]/20">
                <p className="font-bold text-[#b5ffc2] text-xs mb-1">
                  Customer → Customer
                </p>
                <p>{t("referral.howCustToCust")}</p>
              </div>
              <div className="bg-yellow-400/10 rounded-lg p-3 border border-yellow-400/20">
                <p className="font-bold text-yellow-400 text-xs mb-1">
                  Pro → Customer
                </p>
                <p>{t("referral.howProToCust")}</p>
              </div>
            </div>
          )}
        </section>

        {/* H. 쿠폰 사용 가이드 */}
        <section className="bg-[#1b1820] rounded-xl overflow-hidden border border-[#4a474e]/15">
          <h3 className="text-sm font-bold text-[#f8f1fb] p-4 border-b border-[#4a474e]/15 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff88b5] text-lg">
              confirmation_number
            </span>
            {t("referral.couponGuideTitle")}
          </h3>
          <div className="p-4 space-y-3">
            {[
              t("referral.couponStep1"),
              t("referral.couponStep2"),
              t("referral.couponStep3"),
              t("referral.couponStep4"),
            ].map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="bg-[#ff88b5]/15 text-[#ff88b5] font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-[#aea9b2]">{step}</p>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-[#4a474e]/15 space-y-1.5">
              <p className="text-xs text-[#aea9b2]/70">
                • {t("referral.couponNote1")}
              </p>
              <p className="text-xs text-[#aea9b2]/70">
                • {t("referral.couponNote2")}
              </p>
              <p className="text-xs text-[#aea9b2]/70">
                • {t("referral.couponNote3")}
              </p>
            </div>
          </div>
        </section>

        {/* I. 법적 고지 */}
        <section className="bg-[#151219] rounded-xl border border-[#4a474e]/20 p-5 space-y-3 text-xs text-[#aea9b2]/70 leading-relaxed">
          <p>
            <span className="font-bold text-[#aea9b2]">Validity:</span>{" "}
            {t("referral.legalExpiry")}
          </p>
          <p>
            <span className="font-bold text-[#aea9b2]">No Cash Value:</span>{" "}
            {t("referral.legalNoCash")}
          </p>
          <p>
            <span className="font-bold text-[#aea9b2]">Reward Issuance:</span>{" "}
            {t("referral.legalTrigger")}
          </p>
          <p>
            <span className="font-bold text-[#aea9b2]">Coupon Usage:</span>{" "}
            {t("referral.legalCouponUsage")}
          </p>
          <p>
            <span className="font-bold text-[#aea9b2]">Anti-Fraud:</span>{" "}
            {t("referral.legalAntiFraud")}
          </p>
          <p className="text-[10px] text-[#aea9b2]/40 pt-2 border-t border-[#4a474e]/15">
            {t("referral.legalPermit")}
          </p>
        </section>
      </div>
    </div>
  );
}
