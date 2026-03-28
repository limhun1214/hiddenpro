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
    const link = `${window.location.origin}/?ref=${referralCode}&banner=${bannerId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => showToast(t("referral.copied"), "success"));
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 pb-24 pt-4">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {/* 시스템 OFF 배너 */}
        {!referralEnabled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center text-sm text-yellow-700 font-medium">
            {t("referral.systemOff")}
          </div>
        )}

        {/* A. 내 추천 코드 + 공유 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            🎁 {t("referral.pageTitle")}
          </h1>
          <p className="text-sm text-gray-400 mb-4">{t("referral.myCode")}</p>
          <div className="bg-blue-50 rounded-xl py-3 px-6 inline-block mb-4">
            <span className="text-2xl font-black text-blue-600 tracking-widest">
              {referralCode}
            </span>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={handleCopyLink}
              disabled={!referralEnabled}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition"
            >
              {t("referral.copyLink")}
            </button>
            <button
              onClick={handleShare}
              disabled={!referralEnabled}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition"
            >
              {t("referral.share")}
            </button>
          </div>
        </div>

        {/* B. 보상 요약 카드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-gray-900">
              {rewards.length}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("referral.statsTotal")}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-green-600">
              {completedCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("referral.statsCompleted")}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className="text-2xl font-black text-yellow-500">
              {pendingCount}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {t("referral.statsPending")}
            </p>
          </div>
        </div>

        {/* C. 내 추천 리스트 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-4 border-b border-gray-100">
            {t("referral.listTitle")}
          </h2>
          {rewards.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {t("referral.listEmpty")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {rewards.map((r) => (
                <li
                  key={r.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {maskEmail(r.referred?.email)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {r.referred_role === "PRO" ? "🔧 Pro" : "👤 Customer"}
                      <span className="mx-1">·</span>
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {r.status === "COMPLETED" ? (
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        ✅{" "}
                        {r.referrer_reward_type === "BONUS_CREDITS"
                          ? `+${r.referrer_reward_amount} Credits`
                          : `Coupon ${r.referrer_reward_amount}`}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
                        ⏳ {t("referral.statusPending")}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* D. 보유 쿠폰 (고객만) */}
        {!isPro && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-sm font-bold text-gray-700 p-4 border-b border-gray-100">
              🎟️ {t("referral.couponsTitle")}
            </h2>
            {coupons.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                {t("referral.couponsEmpty")}
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {coupons.map((c) => (
                  <li
                    key={c.coupon_id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-lg font-black text-blue-600">
                        {c.discount_amount} {t("referral.couponOff")}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t("referral.couponCode")}:{" "}
                        <span className="font-mono">{c.coupon_code}</span>
                      </p>
                      <p className="text-xs text-gray-400">
                        {t("referral.couponExpires")}:{" "}
                        {new Date(c.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        c.status === "ACTIVE"
                          ? "bg-green-50 text-green-600"
                          : c.status === "USED"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-red-50 text-red-500"
                      }`}
                    >
                      {c.status === "ACTIVE"
                        ? t("referral.couponActive")
                        : c.status === "USED"
                          ? t("referral.couponUsed")
                          : t("referral.couponExpired")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* E. 쿠폰 등록 (고수만) */}
        {isPro && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">
              🎟️ {t("referral.redeemTitle")}
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder={t("referral.redeemPlaceholder")}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm font-mono uppercase bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={12}
              />
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemCode.trim()}
                className="px-5 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold rounded-xl text-sm transition"
              >
                {redeeming ? "..." : t("referral.redeemBtn")}
              </button>
            </div>
          </div>
        )}

        {/* Banner Share */}
        {banners.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-sm font-bold text-gray-700 p-4 border-b border-gray-100">
              📥 {t("referral.bannerTitle")}
            </h2>
            <div className="p-4 space-y-4">
              {banners.map((b) => (
                <div
                  key={b.id}
                  className="border border-gray-100 rounded-xl overflow-hidden"
                >
                  <div className="bg-gray-50 p-3 flex items-center justify-center">
                    <img
                      src={b.image_url}
                      alt={b.title}
                      className="w-full max-h-[200px] object-contain rounded-lg"
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {b.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        📐 {b.width}×{b.height} · 📱 {b.platform_hint}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyBannerLink(b.id)}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition"
                      >
                        Copy Link
                      </button>
                      <button
                        onClick={() => handleShareBanner(b.id)}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition"
                      >
                        Share
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <p className="text-xs text-gray-400 text-center">
                ✅ {t("referral.bannerIncluded")}
              </p>
            </div>
          </div>
        )}

        {/* F. 추천 구조 안내 (접기/펼치기) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowHowItWorks((prev) => !prev)}
            className="w-full flex items-center justify-between p-4 text-sm font-bold text-gray-700 hover:bg-gray-50 transition"
          >
            <span>ℹ️ {t("referral.howItWorks")}</span>
            <span
              className={`transition-transform duration-200 ${showHowItWorks ? "rotate-180" : ""}`}
            >
              ▼
            </span>
          </button>
          {showHowItWorks && (
            <div className="px-4 pb-4 space-y-3 text-sm text-gray-600 border-t border-gray-100 pt-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="font-bold text-blue-700 text-xs mb-1">
                  🔧→🔧 Pro invites Pro
                </p>
                <p>{t("referral.howProToPro")}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-3">
                <p className="font-bold text-purple-700 text-xs mb-1">
                  👤→🔧 Customer invites Pro
                </p>
                <p>{t("referral.howCustToPro")}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="font-bold text-green-700 text-xs mb-1">
                  👤→👤 Customer invites Customer
                </p>
                <p>{t("referral.howCustToCust")}</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-3">
                <p className="font-bold text-orange-700 text-xs mb-1">
                  🔧→👤 Pro invites Customer
                </p>
                <p>{t("referral.howProToCust")}</p>
              </div>
            </div>
          )}
        </div>

        {/* Coupon Usage Guide */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h2 className="text-sm font-bold text-gray-700 p-4 border-b border-gray-100">
            🎟️ {t("referral.couponGuideTitle")}
          </h2>
          <div className="p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                1
              </span>
              <p className="text-sm text-gray-600">
                {t("referral.couponStep1")}
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                2
              </span>
              <p className="text-sm text-gray-600">
                {t("referral.couponStep2")}
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                3
              </span>
              <p className="text-sm text-gray-600">
                {t("referral.couponStep3")}
              </p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="bg-blue-100 text-blue-600 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0">
                4
              </span>
              <p className="text-sm text-gray-600">
                {t("referral.couponStep4")}
              </p>
            </div>
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
        </div>

        {/* Legal Disclaimer */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3 text-xs text-gray-400 leading-relaxed">
          <p>
            📌 <span className="font-bold text-gray-500">Validity:</span>{" "}
            {t("referral.legalExpiry")}
          </p>
          <p>
            🚫 <span className="font-bold text-gray-500">No Cash Value:</span>{" "}
            {t("referral.legalNoCash")}
          </p>
          <p>
            ✅ <span className="font-bold text-gray-500">Reward Issuance:</span>{" "}
            {t("referral.legalTrigger")}
          </p>
          <p>
            🎟️ <span className="font-bold text-gray-500">Coupon Usage:</span>{" "}
            {t("referral.legalCouponUsage")}
          </p>
          <p>
            ⚠️ <span className="font-bold text-gray-500">Anti-Fraud:</span>{" "}
            {t("referral.legalAntiFraud")}
          </p>
          <p className="text-[10px] text-gray-300 pt-2 border-t border-gray-200">
            {t("referral.legalPermit")}
          </p>
        </div>
      </div>
    </div>
  );
}
