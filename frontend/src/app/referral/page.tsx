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

  // 추천 리스트 (보상 이력 — 기존 유지)
  const [rewards, setRewards] = useState<any[]>([]);

  // 추천 가입자 목록 (가입 즉시 표시용)
  const [referrals, setReferrals] = useState<any[]>([]);

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

      // 추천 가입자 목록 (가입 즉시 표시 — SECURITY DEFINER RPC로 RLS 우회)
      const { data: referralsData } = await supabase.rpc("get_my_referrals", {
        p_referrer_id: uid,
      });
      if (referralsData) setReferrals(referralsData);

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

  const completedCount = referrals.filter(
    (r) => r.reward_status === "COMPLETED",
  ).length;
  const pendingCount = referrals.filter(
    (r) => r.reward_status === "PENDING" || r.reward_status == null,
  ).length;
  const isPro = userRole === "PRO";

  if (loading)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0020A0]"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-32">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* 시스템 OFF 배너 */}
        {!referralEnabled && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 text-center text-sm text-yellow-600 font-medium">
            {t("referral.systemOff")}
          </div>
        )}

        {/* A. 추천 코드 히어로 카드 */}
        <section className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-[#0020A0] to-[#ff6ea9] rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-gray-50 rounded-xl p-8 flex flex-col items-center text-center space-y-6">
            <div className="space-y-2">
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">
                {t("referral.myCode")}
              </p>
              <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {referralCode}
              </h2>
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={handleCopyLink}
                disabled={!referralEnabled}
                className="flex-1 bg-[#0020A0] text-white py-4 rounded-full font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">
                  content_copy
                </span>
                {t("referral.copyLink")}
              </button>
              <button
                onClick={handleShare}
                disabled={!referralEnabled}
                className="flex-1 bg-gray-100 text-gray-900 py-4 rounded-full font-bold text-sm border border-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-lg">share</span>
                {t("referral.share")}
              </button>
            </div>
          </div>
        </section>

        {/* B. 보상 요약 - 벤토 그리드 */}
        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-white rounded-xl p-6 flex items-center justify-between border-l-4 border-[#0020A0] border border-gray-200">
            <div>
              <p className="text-gray-500 text-xs font-semibold mb-1">
                {t("referral.statsCompleted")}
              </p>
              <p className="text-3xl font-extrabold text-[#0020A0]">
                +{completedCount} {t("referral.statsTotal")}
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-[#0020A0]/10 flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[#0020A0]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                card_giftcard
              </span>
            </div>
          </div>
          <div className="bg-gray-100 rounded-xl p-5 space-y-2">
            <p className="text-gray-500 text-xs font-medium">
              {t("referral.statsTotal")}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {referrals.length}
              </span>
              <span className="text-green-600 text-xs font-bold mb-1 flex items-center">
                <span className="material-symbols-outlined text-sm">
                  trending_up
                </span>
              </span>
            </div>
          </div>
          <div className="bg-gray-100 rounded-xl p-5 space-y-2">
            <p className="text-gray-500 text-xs font-medium">
              {t("referral.statsPending")}
            </p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-gray-900">
                {pendingCount}
              </span>
              <span className="text-gray-500 text-[10px] mb-1">Verifying</span>
            </div>
          </div>
        </section>

        {/* C. 내 추천 리스트 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-base font-bold text-gray-900">
              {t("referral.listTitle")}
            </h3>
          </div>
          {referrals.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center text-gray-500 text-sm border border-gray-200">
              {t("referral.listEmpty")}
            </div>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-200">
              {referrals.map((r) => (
                <div
                  key={r.referred_user_id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {maskEmail(r.email)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.referred_role === "PRO" ? "Pro" : "Customer"}
                      <span className="mx-1">·</span>
                      {new Date(r.signed_up_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.reward_status === "COMPLETED" ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
                        {r.referrer_reward_type === "BONUS_CREDITS"
                          ? `+${r.referrer_reward_amount} Credits`
                          : r.referrer_reward_type === "COUPON"
                            ? `Coupon ${r.referrer_reward_amount}`
                            : "보상 완료"}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-3 py-1.5 rounded-full">
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
              <h3 className="text-base font-bold text-gray-900">
                {t("referral.couponsTitle")}
              </h3>
            </div>
            {coupons.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500 text-sm border border-gray-200">
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
                      className={`relative overflow-hidden bg-white rounded-xl flex items-stretch h-24 border border-gray-100 ${!isActive ? "opacity-60 grayscale" : ""}`}
                    >
                      <div
                        className={`w-2 ${isActive ? "bg-[#0020A0]" : "bg-gray-300"}`}
                      ></div>
                      <div className="flex-1 p-4 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                          <div>
                            <p
                              className={`font-extrabold text-lg ${isActive ? "text-[#0020A0]" : "text-gray-500"}`}
                            >
                              {c.discount_amount} {t("referral.couponOff")}
                            </p>
                            <p className="text-gray-500 text-[10px] font-medium tracking-wide mt-0.5">
                              {isUsed
                                ? `${t("referral.couponUsed")} · ${new Date(c.expires_at).toLocaleDateString()}`
                                : `${t("referral.couponExpires")}: ${new Date(c.expires_at).toLocaleDateString()}`}
                            </p>
                          </div>
                          <div className="bg-gray-100 px-3 py-1.5 rounded-md border border-gray-200">
                            <span className="text-gray-900 font-mono font-bold text-xs">
                              {c.coupon_code}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* 티켓 노치 효과 */}
                      <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full"></div>
                      <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* E. 쿠폰 등록 (고수만) */}
        {isPro && (
          <section className="bg-white rounded-xl p-6 space-y-4 border border-gray-200">
            <h3 className="text-base font-bold text-gray-900">
              {t("referral.redeemTitle")}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder={t("referral.redeemPlaceholder")}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono uppercase text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0020A0]/50"
                maxLength={12}
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemCode.trim()}
                className="px-5 py-3 bg-green-400 text-white font-bold rounded-xl text-sm transition active:scale-95 disabled:opacity-40"
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
              <h3 className="text-base font-bold text-gray-900">
                {t("referral.bannerTitle")}
              </h3>
              <p className="text-gray-500 text-sm mt-0.5">
                {t("referral.bannerIncluded")}
              </p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="flex-none w-48 rounded-xl overflow-hidden relative group border border-gray-200"
                >
                  <div className="aspect-[9/16] relative">
                    <img
                      src={b.image_url}
                      alt={b.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80"></div>
                    <div className="absolute bottom-3 left-3 right-3 space-y-2">
                      <p className="text-white text-xs font-bold truncate">
                        {b.title}
                      </p>
                      <p className="text-white/70 text-[10px]">
                        {b.width}×{b.height} · {b.platform_hint}
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleCopyBannerLink(b.id)}
                          className="flex-1 bg-white/80 backdrop-blur-md text-gray-900 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 active:scale-95 transition-all"
                        >
                          Copy Code
                        </button>
                        <button
                          onClick={() => handleShareBanner(b.id)}
                          className="flex-1 bg-[#0020A0]/80 backdrop-blur-md text-white py-1.5 rounded-lg text-[10px] font-bold active:scale-95 transition-all flex items-center justify-center gap-0.5"
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
        <section className="bg-white rounded-xl overflow-hidden border border-gray-100">
          <button
            type="button"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-gray-900 hover:bg-gray-50 transition"
          >
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0020A0] text-lg">
                info
              </span>
              {t("referral.howItWorks")}
            </span>
            <span
              className={`material-symbols-outlined text-gray-500 transition-transform duration-200 ${showHowItWorks ? "rotate-180" : ""}`}
            >
              expand_more
            </span>
          </button>
          {showHowItWorks && (
            <div className="px-4 pb-4 space-y-3 text-sm text-gray-500 border-t border-gray-100 pt-3">
              <div className="bg-[#0020A0]/10 rounded-lg p-3 border border-[#0020A0]/20">
                <p className="font-bold text-[#0020A0] text-xs mb-1">
                  Pro → Pro
                </p>
                <p>{t("referral.howProToPro")}</p>
              </div>
              <div className="bg-[#0020A0]/10 rounded-lg p-3 border border-[#0020A0]/20">
                <p className="font-bold text-[#0020A0] text-xs mb-1">
                  Customer → Pro
                </p>
                <p>{t("referral.howCustToPro")}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <p className="font-bold text-green-600 text-xs mb-1">
                  Customer → Customer
                </p>
                <p>{t("referral.howCustToCust")}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <p className="font-bold text-yellow-600 text-xs mb-1">
                  Pro → Customer
                </p>
                <p>{t("referral.howProToCust")}</p>
              </div>
            </div>
          )}
        </section>

        {/* H. 쿠폰 사용 가이드 */}
        <section className="bg-white rounded-xl overflow-hidden border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 p-4 border-b border-gray-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0020A0] text-lg">
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
                <span className="bg-[#0020A0]/15 text-[#0020A0] font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-500">{step}</p>
              </div>
            ))}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
              <p className="text-xs text-gray-400">
                • {t("referral.couponNote1")}
              </p>
              <p className="text-xs text-gray-400">
                • {t("referral.couponNote2")}
              </p>
              <p className="text-xs text-gray-400">
                • {t("referral.couponNote3")}
              </p>
            </div>
          </div>
        </section>

        {/* I. 법적 고지 */}
        <section className="bg-gray-100 rounded-xl border border-gray-200 p-5 space-y-3 text-xs text-gray-400 leading-relaxed">
          <p>
            <span className="font-bold text-gray-500">Validity:</span>{" "}
            {t("referral.legalExpiry")}
          </p>
          <p>
            <span className="font-bold text-gray-500">No Cash Value:</span>{" "}
            {t("referral.legalNoCash")}
          </p>
          <p>
            <span className="font-bold text-gray-500">Reward Issuance:</span>{" "}
            {t("referral.legalTrigger")}
          </p>
          <p>
            <span className="font-bold text-gray-500">Coupon Usage:</span>{" "}
            {t("referral.legalCouponUsage")}
          </p>
          <p>
            <span className="font-bold text-gray-500">Anti-Fraud:</span>{" "}
            {t("referral.legalAntiFraud")}
          </p>
          <p className="text-[10px] text-gray-300 pt-2 border-t border-gray-100">
            {t("referral.legalPermit")}
          </p>
        </section>
      </div>
    </div>
  );
}
