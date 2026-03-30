"use client";
export const runtime = "edge";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PROFILE_IMAGE_COOLDOWN_DAYS,
  PROFILE_IMAGE_MAX_SIZE_BYTES,
  NICKNAME_COOLDOWN_DAYS,
} from "@/lib/constants";
import Link from "next/link";
import { PHILIPPINES_REGIONS } from "@/lib/constants";
import { mockVerifyProPhone, mockLinkFacebook } from "@/lib/mockAuth";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

const DEPTH1_EN: Record<string, string> = {
  "이사/청소": "Moving & Cleaning",
  "설치/수리": "Installation & Repair",
  "인테리어/시공": "Interior & Construction",
  "비즈니스/외주": "Business & Outsourcing",
  "이벤트/파티": "Events & Parties",
  "레슨/튜터링": "Lessons & Tutoring",
};

const DEPTH2_EN: Record<string, string> = {
  "가사/메이드": "Housekeeping & Maid",
  "에어컨 청소": "AC Cleaning",
  "이사 및 운송": "Moving & Transport",
  "집 청소": "House Cleaning",
  "특수 청소 및 방역": "Special Cleaning & Pest Control",
  "폐기물 처리": "Waste Disposal",
  "가전/기기 수리": "Appliance & Device Repair",
  "기타 수리": "Other Repairs",
  "문/창문 및 조립": "Doors, Windows & Assembly",
  "수도/배관": "Plumbing",
  전기: "Electrical",
  "부분 시공": "Partial Construction",
  "야외 시공": "Outdoor Construction",
  "종합 시공": "General Construction",
  "가상 비서 및 BPO": "Virtual Assistant & BPO",
  "디자인/개발": "Design & Development",
  "번역/통역": "Translation & Interpretation",
  "행정/세무 대행": "Administrative & Tax Services",
  "대여/렌탈": "Rental",
  "음식 및 케이터링": "Food & Catering",
  "촬영 및 섭외": "Photography & Talent Booking",
  "행사 기획": "Event Planning",
  "시험 준비": "Exam Preparation",
  "어학 레슨": "Language Lessons",
  "예체능/취미": "Arts, Sports & Hobbies",
  "취업/직무 준비": "Career & Job Preparation",
};

// ─────────────────────────────────────────────
// 메인 프로필 페이지
// ─────────────────────────────────────────────
export default function ProfilePage() {
  const t = useTranslations();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<"CUSTOMER" | "PRO" | null>(null);
  const { showToast } = useToast();
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawConfirmText, setWithdrawConfirmText] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const fetchUserRole = async () => {
      let { data: authData, error: authError } = await supabase.auth.getUser();
      let user = authData?.user;

      // getUser 실패 시 세션 리프레시 후 1회 재시도
      if (authError || !user) {
        console.warn(
          "Profile: getUser 첫 시도 실패, 세션 리프레시 후 재시도",
          authError?.message,
        );
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const retry = await supabase.auth.getUser();
          authData = retry.data;
          authError = retry.error;
          user = authData?.user;
        }
      }

      if (authError || !user) {
        console.error(
          "Profile: getUser 최종 실패, 메인으로 이동",
          authError?.message,
        );
        router.replace("/");
        return;
      }
      setSessionUser(user);

      let role = user.user_metadata?.role?.toUpperCase();

      if (!role) {
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (userData) {
          role = userData.role.toUpperCase();
        } else {
          role = "CUSTOMER"; // fallback
        }
      }

      console.log("Current Profile Role:", role);
      setUserRole(role as "CUSTOMER" | "PRO");
      setLoading(false);
    };
    fetchUserRole();
  }, [router]);

  // 역할 충돌 안내 토스트 (auth/complete에서 전달)
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("role_conflict_msg");
      if (msg) {
        sessionStorage.removeItem("role_conflict_msg");
        // 페이지 렌더링 완료 후 토스트 표시
        setTimeout(() => showToast(msg, "warning", true), 500);
      }
    } catch {}
  }, [showToast]);

  // PRO 계정 견적 차단 안내 토스트 (auth/complete에서 전달)
  useEffect(() => {
    const msg = sessionStorage.getItem("pro_quote_blocked_msg");
    if (msg) {
      sessionStorage.removeItem("pro_quote_blocked_msg");
      showToast(msg, "error");
    }
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const handleWithdraw = async () => {
    if (
      withdrawConfirmText !== t("profile.withdrawConfirmKeyword") ||
      !sessionUser
    )
      return;
    setWithdrawing(true);
    try {
      // 1. withdrawal_logs에 개인정보 보존
      const { error: logErr } = await supabase.from("withdrawal_logs").insert({
        user_id: sessionUser.id,
        real_name: sessionUser.user_metadata?.name || sessionUser.name || null,
        email: sessionUser.email || null,
        phone: sessionUser.user_metadata?.phone || null,
        role: userRole,
        reason: withdrawReason || "No reason provided",
      });
      if (logErr)
        throw new Error(t("profile.withdrawLogError") + logErr.message);

      // 2. users 테이블 개인정보 마스킹 + DELETED 처리 (핵심 단계 — 실패 시 즉시 중단)
      const { error: updateErr } = await supabase
        .from("users")
        .update({
          name: "Deleted User",
          nickname: `deleted_${sessionUser.id}`,
          phone: null,
          email: `deleted_${sessionUser.id}@deleted.com`,
          status: "DELETED",
          device_token: null,
        })
        .eq("user_id", sessionUser.id);
      if (updateErr)
        throw new Error(t("profile.withdrawUpdateError") + updateErr.message);

      // 2-1. JWT user_metadata에도 DELETED 기록 (middleware 차단용)
      const { error: metaErr } = await supabase.auth.updateUser({
        data: { status: "DELETED" },
      });
      if (metaErr)
        throw new Error(t("profile.withdrawMetaError") + metaErr.message);

      // 3. Supabase Auth 계정 비활성화 (관리자 API로 banned_until 영구 설정)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.auth as any).admin
        ?.updateUserById?.(sessionUser.id, {
          ban_duration: "876000h", // 100년 = 사실상 영구 차단
        })
        ?.catch?.(() => {
          // admin API 미지원 환경 무시 — middleware에서 DELETED 상태 체크로 2차 차단
        });

      // 4. 로그아웃 후 홈으로 (탈퇴 안내 배너 표시)
      await supabase.auth.signOut();
      window.location.href = "/?withdrawn=true";
    } catch (e: any) {
      showToast(t("profile.withdrawError") + e.message, "error");
      setWithdrawing(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#0f0d13] p-10 text-center text-[#aea9b2]">
        {t("profile.loading")}
      </div>
    );
  if (!userRole)
    return (
      <div className="min-h-screen bg-[#0f0d13] p-10 text-center text-[#ff6e84]">
        {t("profile.error")}
      </div>
    );

  // [기획 핵심] 강제 Early Return (고객일 경우 고수 DB 조회 원천 차단)
  if (userRole === "CUSTOMER") {
    return (
      <div className="min-h-screen bg-[#0f0d13] flex flex-col w-full lg:px-8 lg:py-8 lg:items-stretch">
        <header className="w-full bg-[#151219] p-4 border-b border-[#2a2730] flex justify-center lg:justify-start items-center lg:text-left lg:mb-8 lg:bg-transparent lg:border-none lg:p-0 lg:mt-8">
          <h1 className="text-xl lg:text-2xl lg:font-bold text-[#f8f1fb]">
            {t("profile.title")}
          </h1>
        </header>
        <main className="flex-1 w-full space-y-6 mt-4 bg-[#0f0d13]">
          <div className="px-4">
            <ProfileHeader
              user={sessionUser}
              role="CUSTOMER"
              tableName="users"
              idColumn="user_id"
              onLogout={handleLogout}
            />
          </div>
          <div className="px-4">
            <CustomerProfile user={sessionUser} />
          </div>
          <div className="px-4">
            <CustomerSupportSection />
          </div>

          {/* Invite & Earn */}
          <div className="px-4">
            <div className="relative overflow-hidden flex items-center justify-between w-full px-6 py-5 rounded-xl bg-gradient-to-br from-[#591adc] to-[#211e26]">
              <div className="flex flex-col gap-1">
                <span className="text-base font-extrabold text-[#e4daff]">
                  Invite &amp; Earn
                </span>
                <span className="text-xs text-[#e4daff]/70">
                  Get $20 for every friend you invite to the curated platform.
                </span>
                <button
                  onClick={() => router.push("/referral")}
                  className="mt-2 self-start bg-[#ff88b5] text-black rounded-full px-4 py-1.5 text-xs font-bold hover:bg-[#ff6ea3] transition"
                >
                  Send Invite
                </button>
              </div>
              <span className="material-symbols-outlined text-[22px] text-[#a68cff]">
                card_giftcard
              </span>
            </div>
          </div>

          {/* 로그아웃 + 탈퇴 버튼 (가로) */}
          <div className="pt-6 pb-2 flex justify-center gap-6">
            <button
              onClick={handleLogout}
              className="text-sm text-white/70 hover:text-[#ff88b5] transition"
            >
              {t("profile.logout")}
            </button>
            <button
              onClick={() => {
                setShowWithdrawModal(true);
                setWithdrawReason("");
                setWithdrawConfirmText("");
              }}
              className="text-sm text-[#ff6e84]/60 hover:text-[#ff6e84] transition"
            >
              {t("profile.withdraw")}
            </button>
          </div>

          {/* Legal Links */}
          <div className="px-4 pt-2 pb-12 flex flex-wrap justify-center gap-x-3 gap-y-1">
            <Link
              href="/legal/TERMS"
              className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
            >
              {t("footer.terms")}
            </Link>
            <span className="text-xs text-[#aea9b2]/30">|</span>
            <Link
              href="/legal/PRIVACY"
              className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
            >
              {t("footer.privacy")}
            </Link>
            <span className="text-xs text-[#aea9b2]/30">|</span>
            <Link
              href="/legal/REFUND"
              className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
            >
              {t("footer.refund")}
            </Link>
            <span className="text-xs text-[#aea9b2]/30">|</span>
            <Link
              href="/support/inquiry"
              className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
            >
              {t("footer.contactUs")}
            </Link>
            <span className="text-xs text-[#aea9b2]/30">|</span>
            <Link
              href="/support/business-info"
              className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
            >
              {t("footer.businessInfo")}
            </Link>
          </div>
        </main>

        {/* ── 회원 탈퇴 모달 (CUSTOMER) ── */}
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
              <div className="text-center">
                <span className="text-4xl block mb-2">😢</span>
                <h3 className="text-lg font-black text-gray-800">
                  {t("profile.withdrawModalTitle")}
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {t("profile.withdrawModalDesc")}
                </p>
              </div>

              {/* 탈퇴 사유 선택 */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">
                  {t("profile.withdrawReasonLabel")}
                </p>
                <select
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <option value="">
                    {t("profile.withdrawReasonPlaceholder")}
                  </option>
                  <option value="서비스 불만족">
                    {t("profile.withdrawReason1")}
                  </option>
                  <option value="이용 빈도 낮음">
                    {t("profile.withdrawReason2")}
                  </option>
                  <option value="개인정보 우려">
                    {t("profile.withdrawReason3")}
                  </option>
                  <option value="다른 서비스 이용">
                    {t("profile.withdrawReason4")}
                  </option>
                  <option value="기타">{t("profile.withdrawReason5")}</option>
                </select>
              </div>

              {/* 확인 텍스트 입력 */}
              <div>
                <p className="text-xs font-bold text-gray-600 mb-2">
                  {t("profile.withdrawConfirmLabel")}{" "}
                  <span className="text-red-500">
                    {t("profile.withdrawConfirmHighlight")}
                  </span>
                  {t("profile.withdrawConfirmSuffix")}
                </p>
                <input
                  type="text"
                  value={withdrawConfirmText}
                  onChange={(e) => setWithdrawConfirmText(e.target.value)}
                  placeholder={t("profile.withdrawConfirmPlaceholder")}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-300"
                  disabled={withdrawing}
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={withdrawing}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
                >
                  {t("profile.withdrawCancelBtn")}
                </button>
                <button
                  onClick={handleWithdraw}
                  disabled={
                    withdrawConfirmText !==
                      t("profile.withdrawConfirmKeyword") || withdrawing
                  }
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                    withdrawConfirmText ===
                      t("profile.withdrawConfirmKeyword") && !withdrawing
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  {withdrawing
                    ? t("profile.withdrawing")
                    : t("profile.withdrawSubmitBtn")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0d13] flex flex-col w-full lg:px-8 lg:py-8 lg:items-stretch">
      <header className="w-full bg-[#151219] p-4 border-b border-[#2a2730] flex justify-center lg:justify-start items-center lg:text-left lg:mb-8 lg:bg-transparent lg:border-none lg:p-0 lg:mt-8">
        <h1 className="text-xl lg:text-2xl lg:font-bold text-[#f8f1fb]">
          {t("profile.title")}
        </h1>
      </header>

      <main className="flex-1 w-full space-y-6 mt-4 bg-[#0f0d13]">
        <div className="px-4">
          <ProfileHeader
            user={sessionUser}
            role="PRO"
            tableName="pro_profiles"
            idColumn="pro_id"
            onLogout={handleLogout}
            reviewHref="/pro/reviews"
          />
        </div>
        <div className="px-4">
          <ProProfile user={sessionUser} />
        </div>
        <div className="px-4">
          <CustomerSupportSection />
        </div>

        {/* Invite & Earn */}
        <div className="px-4">
          <div className="relative overflow-hidden flex items-center justify-between w-full px-6 py-5 rounded-xl bg-gradient-to-br from-[#591adc] to-[#211e26]">
            <div className="flex flex-col gap-1">
              <span className="text-base font-extrabold text-[#e4daff]">
                Invite &amp; Earn
              </span>
              <span className="text-xs text-[#e4daff]/70">
                Get $20 for every friend you invite to the curated platform.
              </span>
              <button
                onClick={() => router.push("/referral")}
                className="mt-2 self-start bg-[#ff88b5] text-black rounded-full px-4 py-1.5 text-xs font-bold hover:bg-[#ff6ea3] transition"
              >
                Send Invite
              </button>
            </div>
            <span className="material-symbols-outlined text-[22px] text-[#a68cff]">
              card_giftcard
            </span>
          </div>
        </div>

        {/* 로그아웃 + 탈퇴 버튼 (가로) */}
        <div className="pt-6 pb-2 flex justify-center gap-6">
          <button
            onClick={handleLogout}
            className="text-sm text-white/70 hover:text-[#ff88b5] transition"
          >
            {t("profile.logout")}
          </button>
          <button
            onClick={() => {
              setShowWithdrawModal(true);
              setWithdrawReason("");
              setWithdrawConfirmText("");
            }}
            className="text-sm text-[#ff6e84]/60 hover:text-[#ff6e84] transition"
          >
            {t("profile.withdraw")}
          </button>
        </div>

        {/* Legal Links */}
        <div className="px-4 pt-2 pb-12 flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link
            href="/legal/TERMS"
            className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
          >
            {t("footer.terms")}
          </Link>
          <span className="text-xs text-[#aea9b2]/30">|</span>
          <Link
            href="/legal/PRIVACY"
            className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
          >
            {t("footer.privacy")}
          </Link>
          <span className="text-xs text-[#aea9b2]/30">|</span>
          <Link
            href="/legal/REFUND"
            className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
          >
            {t("footer.refund")}
          </Link>
          <span className="text-xs text-[#aea9b2]/30">|</span>
          <Link
            href="/support/inquiry"
            className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
          >
            {t("footer.contactUs")}
          </Link>
          <span className="text-xs text-[#aea9b2]/30">|</span>
          <Link
            href="/support/business-info"
            className="text-xs text-[#aea9b2]/60 hover:text-[#aea9b2] transition"
          >
            {t("footer.businessInfo")}
          </Link>
        </div>
      </main>

      {/* ── 회원 탈퇴 모달 (PRO) ── */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-4xl block mb-2">😢</span>
              <h3 className="text-lg font-black text-gray-800">
                {t("profile.withdrawModalTitle")}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {t("profile.withdrawModalDesc")}
              </p>
            </div>

            {/* 탈퇴 사유 선택 */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">
                {t("profile.withdrawReasonLabel")}
              </p>
              <select
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <option value="">
                  {t("profile.withdrawReasonPlaceholder")}
                </option>
                <option value="서비스 불만족">
                  {t("profile.withdrawReason1")}
                </option>
                <option value="이용 빈도 낮음">
                  {t("profile.withdrawReason2")}
                </option>
                <option value="개인정보 우려">
                  {t("profile.withdrawReason3")}
                </option>
                <option value="다른 서비스 이용">
                  {t("profile.withdrawReason4")}
                </option>
                <option value="기타">{t("profile.withdrawReason5")}</option>
              </select>
            </div>

            {/* 확인 텍스트 입력 */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">
                {t("profile.withdrawConfirmLabel")}{" "}
                <span className="text-red-500">
                  {t("profile.withdrawConfirmHighlight")}
                </span>
                {t("profile.withdrawConfirmSuffix")}
              </p>
              <input
                type="text"
                value={withdrawConfirmText}
                onChange={(e) => setWithdrawConfirmText(e.target.value)}
                placeholder={t("profile.withdrawConfirmPlaceholder")}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-300"
                disabled={withdrawing}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={withdrawing}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
              >
                {t("profile.withdrawCancelBtn")}
              </button>
              <button
                onClick={handleWithdraw}
                disabled={
                  withdrawConfirmText !== t("profile.withdrawConfirmKeyword") ||
                  withdrawing
                }
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                  withdrawConfirmText === t("profile.withdrawConfirmKeyword") &&
                  !withdrawing
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              >
                {withdrawing
                  ? t("profile.withdrawing")
                  : t("profile.withdrawSubmitBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 프로필 헤더 (사진 + 이름 + 역할 + 계정 설정)
// ─────────────────────────────────────────────
function ProfileHeader({
  user,
  role,
  tableName,
  idColumn,
  onLogout,
  reviewHref,
}: {
  user: any;
  role: "CUSTOMER" | "PRO";
  tableName: string;
  idColumn: string;
  onLogout: () => void;
  reviewHref?: string;
}) {
  const t = useTranslations();
  const { showToast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [reviewStats, setReviewStats] = useState<{
    avg: number;
    count: number;
  }>({ avg: 0, count: 0 });

  // 계정 설정 폼 상태
  const [newNickname, setNewNickname] = useState("");
  const [nicknameStatus, setNicknameStatus] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [nicknameMsg, setNicknameMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageUpdatedAt, setImageUpdatedAt] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [nicknameUpdatedAt, setNicknameUpdatedAt] = useState<string | null>(
    null,
  );
  const [nicknameCooldown, setNicknameCooldown] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // DB에서 프로필 정보 로드
  useEffect(() => {
    const load = async () => {
      // [수술 핵심] 닉네임과 아바타는 무조건 users 테이블을 Single Source of Truth로 바라보게 강제
      const { data } = await supabase
        .from("users")
        .select(
          "nickname, avatar_url, profile_image_updated_at, nickname_updated_at",
        )
        .eq("user_id", user.id)
        .single();

      if (data) {
        setNickname(data.nickname || "");
        setNewNickname(data.nickname || "");
        setAvatarUrl(data.avatar_url || null);
        setImageUpdatedAt(data.profile_image_updated_at || null);
        if (data.profile_image_updated_at) {
          const updatedAt = new Date(data.profile_image_updated_at);
          const now = new Date();
          const diffDays =
            (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          const remaining = Math.ceil(PROFILE_IMAGE_COOLDOWN_DAYS - diffDays);
          setCooldownRemaining(remaining > 0 ? remaining : 0);
        }
        setNicknameUpdatedAt(data.nickname_updated_at || null);
        if (data.nickname_updated_at) {
          const updatedAt = new Date(data.nickname_updated_at);
          const now = new Date();
          const diffDays =
            (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
          const remaining = Math.ceil(NICKNAME_COOLDOWN_DAYS - diffDays);
          setNicknameCooldown(remaining > 0 ? remaining : 0);
        }
      }

      // PRO: 평점/리뷰 수 로드
      if (role === "PRO") {
        const { data: proData } = await supabase
          .from("pro_profiles")
          .select("average_rating, review_count")
          .eq("pro_id", user.id)
          .single();
        if (proData) {
          setReviewStats({
            avg: Number(proData.average_rating) || 0,
            count: proData.review_count || 0,
          });
        }
      }
    };
    load();
  }, [user.id, tableName, idColumn, role]);

  // 닉네임 중복 체크 (디바운스 300ms)
  const checkNickname = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setNicknameStatus("idle");
        setNicknameMsg("");
        return;
      }

      if (value.trim() === nickname) {
        setNicknameStatus("available");
        setNicknameMsg(t("profile.nicknameCurrent"));
        return;
      }

      if (value.trim().length < 2) {
        setNicknameStatus("error");
        setNicknameMsg(t("profile.nicknameTooShort"));
        return;
      }

      if (value.trim().length > 20) {
        setNicknameStatus("error");
        setNicknameMsg(t("profile.nicknameTooLong"));
        return;
      }

      setNicknameStatus("checking");
      setNicknameMsg(t("profile.nicknameChecking"));

      debounceRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.rpc(
            "check_nickname_duplicate",
            {
              p_nickname: value.trim(),
              p_user_id: user.id,
            },
          );

          if (error) throw error;

          if (data === true) {
            setNicknameStatus("taken");
            setNicknameMsg(t("profile.nicknameTaken"));
          } else {
            setNicknameStatus("available");
            setNicknameMsg(t("profile.nicknameAvailable"));
          }
        } catch {
          setNicknameStatus("error");
          setNicknameMsg(t("profile.nicknameCheckFailed"));
        }
      }, 300);
    },
    [user.id, nickname],
  );

  // 프로필 사진 업로드
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // [방어 1] 쿨다운 체크 (DB Single Source of Truth 기준)
    if (cooldownRemaining > 0) {
      showToast(
        t("profile.photoCooldownToast").replace(
          "{days}",
          String(cooldownRemaining),
        ),
        "error",
      );
      return;
    }

    // [방어 2] 이미지 파일만 허용
    if (!file.type.startsWith("image/")) {
      showToast(t("profile.photoTypeError"), "error");
      return;
    }

    // [방어 3] 파일 크기 5MB 이하
    if (file.size > PROFILE_IMAGE_MAX_SIZE_BYTES) {
      showToast(t("profile.photoSizeError"), "error");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      const now = new Date().toISOString();

      // DB 업데이트: avatar_url + profile_image_updated_at 동시 저장
      const { error: dbError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl, profile_image_updated_at: now })
        .eq("user_id", user.id);

      if (dbError) throw dbError;

      if (role === "PRO") {
        await supabase
          .from("pro_profiles")
          .update({ avatar_url: publicUrl })
          .eq("pro_id", user.id);
      }

      setAvatarUrl(publicUrl);
      setImageUpdatedAt(now);
      setCooldownRemaining(PROFILE_IMAGE_COOLDOWN_DAYS);
      showToast(t("profile.photoSuccess"), "success");
    } catch (err: any) {
      showToast(
        t("profile.photoUploadError") + (err.message || t("common.unknown")),
        "error",
      );
    } finally {
      setUploading(false);
    }
  };

  // 활동명 저장
  const handleSaveNickname = async () => {
    if (nicknameStatus !== "available") {
      showToast(t("profile.nicknameCheckError"), "error");
      return;
    }

    // 쿨다운 체크 (DB Single Source of Truth 기준)
    if (nicknameCooldown > 0) {
      showToast(
        t("profile.nicknameCooldownToast").replace(
          "{days}",
          String(nicknameCooldown),
        ),
        "error",
      );
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("update_nickname", {
        p_user_id: user.id,
        p_nickname: newNickname.trim(),
        p_is_admin: false,
      });

      if (error) throw error;

      if (data.success === false) {
        if (data.error === "cooldown") {
          showToast(
            t("profile.nicknameCooldownToast").replace(
              "{days}",
              String(data.remaining_days),
            ),
            "error",
          );
          setNicknameCooldown(data.remaining_days);
        } else if (data.error === "duplicate") {
          showToast(t("profile.nicknameTaken"), "error");
          setNicknameStatus("taken");
          setNicknameMsg(t("profile.nicknameTaken"));
        }
        return;
      }

      const now = new Date().toISOString();
      setNickname(newNickname.trim());
      setNicknameUpdatedAt(now);
      setNicknameCooldown(NICKNAME_COOLDOWN_DAYS);
      showToast(t("profile.nicknameSuccess"), "success");
      setShowSettings(false);
    } catch (err: any) {
      showToast(
        t("profile.nicknameSaveError") + (err.message || t("common.unknown")),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const roleLabel =
    role === "CUSTOMER" ? t("profile.roleCustomer") : t("profile.rolePro");
  const displayName =
    nickname || user.email?.split("@")[0] || t("profile.proDefaultName");

  return (
    <div className="bg-[#211e26] rounded-2xl border border-[#2a2730] overflow-hidden">
      {/* 프로필 헤더 영역 */}
      <div className="p-6 flex items-center gap-4">
        {/* 원형 프로필 사진 */}
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-tr from-[#ff88b5] to-[#a68cff] rounded-full blur opacity-25"></div>
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#2a2730] to-[#211e26] flex items-center justify-center border-2 border-[#211e26] shadow-md">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={t("profile.avatarAlt")}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-8 h-8 text-[#aea9b2]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* 이름 + 이메일 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-[#f8f1fb] truncate">
              {displayName}
            </h2>
            <span className="text-sm text-[#aea9b2] flex-shrink-0">
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-[#aea9b2]">✉️</span>
            <span className="text-sm text-[#aea9b2] truncate">
              {user.email || t("profile.noEmail")}
            </span>
          </div>
        </div>

        {/* 계정 설정 버튼 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${
            showSettings
              ? "bg-[#a68cff] text-[#0f0d13] shadow-md"
              : "bg-[#2a2730] text-[#a68cff] hover:bg-[#33303a]"
          }`}
        >
          {t("profile.accountSettings")}
        </button>
      </div>

      {/* 평점/리뷰 링크 바 (Pro 전용) */}
      {reviewHref && (
        <div className="px-6 pb-4 flex items-center gap-2">
          <button
            onClick={() => (window.location.href = reviewHref)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#2a2730] hover:bg-[#33303a] text-[#b5ffc2] font-semibold py-2.5 rounded-xl border border-[#33303a] transition text-sm"
          >
            <span>⭐</span>
            <span>{reviewStats.avg.toFixed(1)}</span>
            <span className="text-[#b5ffc2]/70 text-xs">
              ({reviewStats.count}
              {t("profile.proReviewCount")})
            </span>
          </button>
        </div>
      )}

      {/* 계정 설정 패널 (슬라이드 다운) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${showSettings ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-6 pb-6 space-y-5 border-t border-[#2a2730] pt-5">
          {/* 프로필 사진 변경 */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#f8f1fb] flex items-center gap-2">
              {t("profile.photoLabel")}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#2a2730] to-[#211e26] flex items-center justify-center border-2 border-[#2a2730] shadow-inner">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="프로필"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-10 h-10 text-[#aea9b2]"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || cooldownRemaining > 0}
                  className="bg-[#2a2730] hover:bg-[#33303a] text-[#f8f1fb] font-medium text-sm px-4 py-2.5 rounded-xl border border-[#33303a] transition disabled:opacity-50"
                >
                  {uploading
                    ? t("profile.photoUploading")
                    : cooldownRemaining > 0
                      ? `${cooldownRemaining} ${t("profile.photoCooldown")}`
                      : t("profile.photoUploadBtn")}
                </button>
                <span className="text-[11px] text-[#aea9b2]">
                  {t("profile.proPhotoSpec")}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* 활동명 수정 */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-[#f8f1fb] flex items-center gap-2">
              ✏️ {t("profile.nicknameLabel")}
              <span className="text-xs text-[#aea9b2] font-normal">
                {t("profile.proNicknameRule")}
              </span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => {
                    setNewNickname(e.target.value);
                    checkNickname(e.target.value);
                  }}
                  placeholder={t("profile.nicknamePlaceholder")}
                  maxLength={20}
                  className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 transition text-sm bg-[#151219] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 ${
                    nicknameStatus === "taken" || nicknameStatus === "error"
                      ? "border-[#ff6e84] focus:ring-[#ff6e84]"
                      : nicknameStatus === "available"
                        ? "border-[#b5ffc2] focus:ring-[#b5ffc2]"
                        : "border-[#2a2730] focus:ring-[#a68cff]"
                  }`}
                />
                {nicknameStatus === "checking" && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#a68cff] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveNickname}
                disabled={
                  saving ||
                  nicknameStatus !== "available" ||
                  nicknameCooldown > 0
                }
                className="bg-[#a68cff] hover:bg-[#9070ff] text-[#0f0d13] font-bold px-5 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:bg-[#2a2730] disabled:text-[#aea9b2] disabled:cursor-not-allowed"
              >
                {saving
                  ? t("profile.nicknameSaving")
                  : nicknameCooldown > 0
                    ? t("profile.nicknameCooldownBtn").replace(
                        "{days}",
                        String(nicknameCooldown),
                      )
                    : t("profile.nicknameSaveBtn")}
              </button>
            </div>
            {/* 중복 체크 메시지 */}
            {nicknameMsg && (
              <p
                className={`text-xs font-medium pl-1 ${
                  nicknameStatus === "taken" || nicknameStatus === "error"
                    ? "text-[#ff6e84]"
                    : nicknameStatus === "available"
                      ? "text-[#b5ffc2]"
                      : "text-[#aea9b2]"
                }`}
              >
                {nicknameMsg}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 고객 프로필 (기본 정보)
// ─────────────────────────────────────────────
function CustomerProfile({ user }: { user: any }) {
  const t = useTranslations();
  const { showToast } = useToast();
  const [phoneData, setPhoneData] = useState<{
    is_phone_verified: boolean;
    phone: string;
  } | null>(null);
  const [joinDate, setJoinDate] = useState<string>("");
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [phoneInput, setPhoneInput] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 전화번호 + 가입일
        const { data } = await supabase
          .from("users")
          .select("is_phone_verified, phone, created_at")
          .eq("user_id", user.id)
          .single();
        if (data) {
          setPhoneData(data);
          if (data.created_at) {
            setJoinDate(
              new Date(data.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }),
            );
          }
        }

        // 리뷰 수
        const { count } = await supabase
          .from("reviews")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", user.id)
          .eq("is_hidden", false);
        if (count !== null) setReviewCount(count);
      } catch (e) {
        console.warn("CustomerProfile data fetch failed (ignorable)");
      }
    };
    fetchData();
  }, [user.id]);

  const handlePhoneVerify = async () => {
    if (!phoneInput.trim()) {
      showToast(t("profile.phoneInputError"), "error");
      return;
    }
    setVerifyingPhone(true);
    try {
      const { mockVerifyCustomerPhone } = await import("@/lib/mockAuth");
      await mockVerifyCustomerPhone(user.id, phoneInput);
      setPhoneData((prev) => ({
        ...prev!,
        is_phone_verified: true,
        phone: phoneInput.replace(/[\s\-]/g, ""),
      }));
      setPhoneInput("");
      showToast(t("profile.phoneVerifySuccess"), "success");
    } catch (e: any) {
      showToast(t("profile.phoneVerifyError") + e.message, "error");
    } finally {
      setVerifyingPhone(false);
    }
  };

  return (
    <div className="bg-[#211e26] p-6 rounded-2xl border border-[#2a2730] space-y-4">
      <h2 className="text-sm font-bold text-[#ff88b5] tracking-widest uppercase border-b border-[#2a2730] pb-2">
        {t("profile.basicInfo")}
      </h2>
      <div className="space-y-3">
        <div className="flex flex-col">
          <span className="text-xs text-[#aea9b2] font-medium mb-1">
            {t("profile.emailLabel")}
          </span>
          <span className="text-[#f8f1fb] font-medium bg-[#151219] p-3 rounded-lg border border-[#2a2730]">
            {user.email || t("profile.noEmailInfo")}
          </span>
        </div>
        {phoneData?.is_phone_verified && phoneData?.phone ? (
          <div className="flex flex-col">
            <span className="text-xs text-[#aea9b2] font-medium mb-1">
              {t("profile.verifiedPhone")}
            </span>
            <span className="text-[#b5ffc2] font-medium bg-[#b5ffc2]/10 p-3 rounded-lg border border-[#b5ffc2]/30 flex items-center gap-2">
              <span className="text-sm">✅</span>
              {phoneData.phone}
            </span>
          </div>
        ) : (
          <div className="flex flex-col">
            <span className="text-xs text-[#aea9b2] font-medium mb-1">
              {t("profile.phoneVerification")}
            </span>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder={t("profile.phonePlaceholder")}
                className="flex-1 p-3 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 rounded-lg text-sm focus:ring-2 focus:ring-[#a68cff] focus:outline-none"
                disabled={verifyingPhone}
              />
              <button
                onClick={handlePhoneVerify}
                disabled={verifyingPhone || !phoneInput.trim()}
                className="bg-[#a68cff] hover:bg-[#9070ff] text-[#0f0d13] font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 whitespace-nowrap"
              >
                {verifyingPhone
                  ? t("profile.phoneVerifying")
                  : t("profile.phoneVerifyBtn")}
              </button>
            </div>
            <span className="text-xs text-[#aea9b2] mt-1">
              {t("profile.phoneNote")}
            </span>
          </div>
        )}
        {joinDate && (
          <div className="flex flex-col">
            <span className="text-xs text-[#aea9b2] font-medium mb-1">
              {t("profile.joinDate")}
            </span>
            <span className="text-[#f8f1fb] font-medium bg-[#151219] p-3 rounded-lg border border-[#2a2730] flex items-center gap-2">
              <span className="text-[#aea9b2] text-sm">📅</span>
              {joinDate}
            </span>
          </div>
        )}
        <div
          className="flex flex-col cursor-pointer group"
          onClick={() => (window.location.href = "/customer/my-reviews")}
        >
          <span className="text-xs text-[#aea9b2] font-medium mb-1">
            {t("profile.myReviewsLabel")}
          </span>
          <span className="text-[#f8f1fb] font-medium bg-[#151219] p-3 rounded-lg border border-[#2a2730] flex items-center gap-2 group-hover:border-[#b5ffc2]/30 transition">
            <span className="text-sm">⭐</span>
            {reviewCount} {t("profile.reviewsCount")}
            <span className="ml-auto text-[#aea9b2] text-xs group-hover:text-[#b5ffc2] transition">
              {t("profile.viewBtn")}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 고수 프로필 (전문가 정보 관리)
// ─────────────────────────────────────────────
function ProProfile({ user }: { user: any }) {
  const t = useTranslations();
  const locale =
    typeof document !== "undefined"
      ? (document.cookie
          .split("; ")
          .find((r) => r.startsWith("locale="))
          ?.split("=")[1] ?? "en")
      : "en";
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [isAcceptingRequests, setIsAcceptingRequests] = useState(true);

  const [formData, setFormData] = useState({
    intro: "",
    detailed_intro: "",
    services: [] as string[],
    region: "",
  });

  // 인증 상태
  const [facebookUrl, setFacebookUrl] = useState("");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [proPhone, setProPhone] = useState("");
  const [facebookInput, setFacebookInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [linkingFb, setLinkingFb] = useState(false);
  const [editingFb, setEditingFb] = useState(false);

  const [selectedDepth1, setSelectedDepth1] = useState<string>("");
  const [selectedDepth2, setSelectedDepth2] = useState<string>("");

  const [selectedReg, setSelectedReg] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");

  const [serviceCategories, setServiceCategories] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [koToEnService, setKoToEnService] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    const loadCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, name_en, depth1, depth1_en, depth2, depth2_en")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (data) {
        const tree: Record<string, Record<string, string[]>> = {};
        const enMap: Record<string, string> = {};
        data.forEach((item) => {
          if (!item.depth1 || !item.depth2) return;
          if (!tree[item.depth1]) tree[item.depth1] = {};
          if (!tree[item.depth1][item.depth2])
            tree[item.depth1][item.depth2] = [];
          tree[item.depth1][item.depth2].push(item.name);
          if (item.name_en) {
            enMap[item.name] = item.name_en;
          }
        });
        setServiceCategories(tree);
        setKoToEnService(enMap);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    const fetchProData = async () => {
      try {
        const { data, error } = await supabase
          .from("pro_profiles")
          .select("*")
          .eq("pro_id", user.id)
          .single();

        if (error) {
          console.warn("pro_profiles fetch error (무시 가능):", error.message);
        }

        if (data) {
          let loadedRegion = data.region || "";
          let reg = "";
          let city = "";
          if (loadedRegion.includes(", ")) {
            [reg, city] = loadedRegion.split(", ");
          }

          setFormData({
            intro: data.intro || "",
            detailed_intro: data.detailed_intro || "",
            services: Array.isArray(data.services)
              ? data.services.slice(0, 5)
              : [],
            region: loadedRegion,
          });
          setSelectedReg(reg);
          setSelectedCity(city);
          setIsAcceptingRequests(data.is_accepting_requests ?? true);

          // 인증 상태 로드 (컬럼이 없으면 기본값 유지)
          setFacebookUrl(data.facebook_url || "");
          setIsPhoneVerified(data.is_phone_verified === true);
          setProPhone(data.phone || "");
          setFacebookInput(data.facebook_url || "");
          setPhoneInput(data.phone || "");
        }
      } catch (e) {
        console.error("ProProfile fetch 예외:", e);
      }
      setLoading(false);
    };
    fetchProData();
  }, [user.id]);

  const handleToggleAccepting = async () => {
    const newVal = !isAcceptingRequests;
    setIsAcceptingRequests(newVal);
    const { error } = await supabase
      .from("pro_profiles")
      .update({ is_accepting_requests: newVal })
      .eq("pro_id", user.id);
    if (error) {
      showToast(t("profile.proStatusUpdateError"), "error");
      setIsAcceptingRequests(!newVal);
    }
  };

  const handleServiceToggle = (service: string) => {
    const enService = koToEnService[service] ?? service;
    setFormData((prev) => {
      const isSelected = prev.services.includes(enService);
      if (isSelected) {
        return {
          ...prev,
          services: prev.services.filter((s) => s !== enService),
        };
      } else {
        if (prev.services.length >= 5) {
          showToast(t("profile.maxServices"), "error");
          return prev;
        }
        return { ...prev, services: [...prev.services, enService] };
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalRegion = "";
    if (selectedReg && selectedCity) {
      finalRegion = `${selectedReg}, ${selectedCity}`;
    } else if (selectedReg) {
      finalRegion = selectedReg;
    }

    if (formData.services.length > 5) {
      showToast(t("profile.maxServices"), "error");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("pro_profiles").upsert(
      {
        pro_id: user.id,
        intro: formData.intro,
        detailed_intro: formData.detailed_intro,
        region: finalRegion,
        services: formData.services,
      },
      { onConflict: "pro_id" },
    );

    setSaving(false);

    if (error) {
      showToast(t("profile.proSaveError") + error.message, "error");
    } else {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
      showToast(t("profile.proSaveSuccess"), "success");
    }
  };

  if (loading)
    return (
      <div className="text-center p-4 text-gray-500">
        {t("profile.loading")}
      </div>
    );

  const depth1Keys = Object.keys(serviceCategories);
  const depth2Keys = selectedDepth1
    ? Object.keys(serviceCategories[selectedDepth1] || {})
    : [];
  const depth3Items =
    selectedDepth1 && selectedDepth2
      ? serviceCategories[selectedDepth1][selectedDepth2] || []
      : [];

  const regionKeys = Object.keys(PHILIPPINES_REGIONS);
  const cityItems = selectedReg ? PHILIPPINES_REGIONS[selectedReg] || [] : [];

  const handleFbLink = async () => {
    if (!facebookInput.trim()) {
      showToast(t("profile.facebookUrlRequired"), "error");
      return;
    }
    setLinkingFb(true);
    try {
      await mockLinkFacebook(user.id, facebookInput);
      setFacebookUrl(facebookInput);
      // DB 업데이트 성공 시에만 여기 도달
    } catch (e: any) {
      showToast(e.message, "error");
    }
    setLinkingFb(false);
  };

  const handlePhoneVerify = async () => {
    if (!phoneInput.trim()) {
      showToast(t("profile.proPhoneRequired"), "error");
      return;
    }
    setVerifyingPhone(true);
    try {
      await mockVerifyProPhone(user.id, phoneInput);
      setIsPhoneVerified(true);
      setProPhone(phoneInput);
      // DB 업데이트 성공 시에만 여기 도달
    } catch (e: any) {
      showToast(e.message, "error");
    }
    setVerifyingPhone(false);
  };

  return (
    <div className="bg-[#211e26] p-6 rounded-2xl border border-[#2a2730]">
      <h2 className="text-sm font-bold text-[#ff88b5] tracking-widest uppercase border-b border-[#2a2730] pb-4 mb-4">
        {t("profile.proProfileTitle")}
      </h2>

      {/* 매칭 일시 정지 토글 섹션 */}
      <div className="bg-[#151219] p-5 rounded-xl border border-[#2a2730] mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-[#f8f1fb] flex items-center gap-2">
            {isAcceptingRequests
              ? t("profile.proAcceptingOn")
              : t("profile.proAcceptingOff")}
          </h3>
          <p className="text-sm text-[#aea9b2] mt-1">
            {t("profile.proAcceptingDesc")}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={isAcceptingRequests}
            onChange={handleToggleAccepting}
          />
          <div className="w-14 h-7 bg-[#2a2730] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#33303a] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#a68cff]"></div>
        </label>
      </div>

      {/* 인증 배지 영역 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {isPhoneVerified && (
          <span className="inline-flex items-center bg-[#b5ffc2]/10 text-[#b5ffc2] text-xs font-bold px-3 py-1.5 rounded-full border border-[#b5ffc2]/30">
            ✅ Phone Verified
          </span>
        )}
        {facebookUrl && (
          <span className="inline-flex items-center bg-[#a68cff]/10 text-[#a68cff] text-xs font-bold px-3 py-1.5 rounded-full border border-[#a68cff]/30">
            🔵 Facebook Linked
          </span>
        )}
        {!isPhoneVerified && !facebookUrl && (
          <span className="text-xs text-[#aea9b2]">
            {t("profile.proNoBadges")}
          </span>
        )}
      </div>

      {/* 전화번호 인증 섹션 */}
      <div className="bg-[#151219] p-4 rounded-xl border border-[#2a2730] mb-4 space-y-3">
        <label className="text-sm font-bold text-[#f8f1fb] flex items-center gap-2">
          {t("profile.proPhoneVerifyLabel")}
          {isPhoneVerified && (
            <span className="text-[#b5ffc2] text-xs">
              {t("profile.proPhoneVerified")}
            </span>
          )}
        </label>
        {isPhoneVerified ? (
          <div className="bg-[#b5ffc2]/10 text-[#b5ffc2] p-3 rounded-lg text-sm font-medium border border-[#b5ffc2]/30">
            {t("profile.proPhoneVerifiedText")} {proPhone}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder={t("profile.proPhonePlaceholder")}
              className="flex-1 p-3 bg-[#0f0d13] border border-[#2a2730] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 rounded-xl focus:ring-2 focus:ring-[#b5ffc2] focus:outline-none transition text-sm"
            />
            <button
              type="button"
              onClick={handlePhoneVerify}
              disabled={verifyingPhone}
              className="bg-[#b5ffc2] hover:bg-[#9ff0af] text-[#0f0d13] font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:opacity-50"
            >
              {verifyingPhone
                ? t("profile.proPhoneProcessing")
                : t("profile.proPhoneVerifyBtn")}
            </button>
          </div>
        )}
      </div>

      {/* Facebook 연동 섹션 */}
      <div className="bg-[#151219] p-4 rounded-xl border border-[#2a2730] mb-4 space-y-3">
        <label className="text-sm font-bold text-[#f8f1fb] flex items-center gap-2">
          {t("profile.proFbLinkLabel")}
          {facebookUrl && (
            <span className="text-[#a68cff] text-xs">
              {t("profile.proFbLinked")}
            </span>
          )}
        </label>
        {facebookUrl && !editingFb ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#a68cff]/10 text-[#a68cff] p-3 rounded-lg text-sm font-medium border border-[#a68cff]/30 break-all truncate">
              🔵 {facebookUrl}
            </div>
            <button
              type="button"
              onClick={() => setEditingFb(true)}
              className="flex-shrink-0 text-xs font-bold text-[#a68cff] hover:text-[#c0a8ff] bg-[#a68cff]/10 px-3 py-2 rounded-lg border border-[#a68cff]/30 hover:bg-[#a68cff]/20 transition"
            >
              {t("profile.proFbEditBtn")}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="url"
              value={facebookInput}
              onChange={(e) => setFacebookInput(e.target.value)}
              placeholder="https://facebook.com/yourname"
              className="flex-1 p-3 bg-[#0f0d13] border border-[#2a2730] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 rounded-xl focus:ring-2 focus:ring-[#a68cff] focus:outline-none transition text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                await handleFbLink();
                setEditingFb(false);
              }}
              disabled={linkingFb}
              className="bg-[#a68cff] hover:bg-[#9070ff] text-[#0f0d13] font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:opacity-50"
            >
              {linkingFb
                ? t("profile.proFbProcessing")
                : t("profile.proFbLinkBtn")}
            </button>
            {facebookUrl && (
              <button
                type="button"
                onClick={() => {
                  setFacebookInput(facebookUrl);
                  setEditingFb(false);
                }}
                className="text-[#aea9b2] hover:text-[#f8f1fb] font-bold px-2 transition text-sm"
              >
                {t("profile.proFbCancelBtn")}
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm font-bold text-[#f8f1fb]">
            {t("profile.proIntroLabel")}{" "}
            <span className="text-xs text-[#aea9b2] font-normal ml-1">
              {t("profile.proIntroLimit")}
            </span>
          </label>
          <input
            type="text"
            value={formData.intro}
            onChange={(e) =>
              setFormData({ ...formData, intro: e.target.value })
            }
            maxLength={50}
            placeholder={t("profile.proIntroPlaceholder")}
            className="p-3 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 rounded-xl focus:ring-2 focus:ring-[#a68cff] focus:outline-none transition"
            required
          />
          <span className="text-xs text-[#aea9b2] text-right">
            {formData.intro.length}/50
          </span>
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-sm font-bold text-[#f8f1fb]">
            {t("profile.proDetailedLabel")}{" "}
            <span className="text-xs text-[#aea9b2] font-normal ml-1">
              {t("profile.proDetailedLimit")}
            </span>
          </label>
          <textarea
            value={formData.detailed_intro}
            onChange={(e) =>
              setFormData({ ...formData, detailed_intro: e.target.value })
            }
            rows={5}
            placeholder={t("profile.proDetailedPlaceholder")}
            className="p-3 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] placeholder:text-[#aea9b2]/50 rounded-xl focus:ring-2 focus:ring-[#a68cff] focus:outline-none transition resize-none text-sm"
          />
        </div>

        <div className="flex flex-col space-y-3">
          <label className="text-sm font-bold text-[#f8f1fb]">
            {t("profile.proRegionLabel")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedReg}
              onChange={(e) => {
                setSelectedReg(e.target.value);
                setSelectedCity("");
              }}
              className="p-3 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] rounded-xl focus:ring-2 focus:ring-[#a68cff] focus:outline-none transition"
              required
            >
              <option value="" disabled>
                {t("profile.proRegionPlaceholder")}
              </option>
              {regionKeys.map((r) => (
                <option key={r} value={r}>
                  {locale === "en" && r === "전체" ? "All Regions" : r}
                </option>
              ))}
            </select>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="p-3 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] rounded-xl focus:ring-2 focus:ring-[#a68cff] focus:outline-none transition disabled:opacity-40 disabled:text-[#aea9b2]"
              required
              disabled={!selectedReg}
            >
              <option value="" disabled>
                {t("profile.proCityPlaceholder")}
              </option>
              {cityItems.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col space-y-3 border-t pt-4 border-[#2a2730]">
          <div className="flex justify-between items-end">
            <label className="text-sm font-bold text-[#f8f1fb]">
              {t("profile.proServicesLabel")}
            </label>
            <span className="text-xs font-bold text-[#a68cff]">
              {formData.services.length} / 5
            </span>
          </div>

          {/* 카테고리 뎁스 브라우저 */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <select
              value={selectedDepth1}
              onChange={(e) => {
                setSelectedDepth1(e.target.value);
                setSelectedDepth2("");
              }}
              className="p-2 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] rounded-lg text-sm"
            >
              <option value="">{t("profile.depth1Placeholder")}</option>
              {depth1Keys.map((k) => (
                <option key={k} value={k}>
                  {locale === "en" ? (DEPTH1_EN[k] ?? k) : k}
                </option>
              ))}
            </select>
            <select
              value={selectedDepth2}
              onChange={(e) => setSelectedDepth2(e.target.value)}
              className="p-2 bg-[#151219] border border-[#2a2730] text-[#f8f1fb] rounded-lg text-sm disabled:opacity-40"
              disabled={!selectedDepth1}
            >
              <option value="">{t("profile.depth2Placeholder")}</option>
              {depth2Keys.map((k) => (
                <option key={k} value={k}>
                  {locale === "en" ? (DEPTH2_EN[k] ?? k) : k}
                </option>
              ))}
            </select>
          </div>

          {/* 3뎁스 선택 영역 */}
          {depth3Items.length > 0 ? (
            <div className="bg-[#0f0d13] p-3 rounded-xl border border-[#2a2730] max-h-48 overflow-y-auto flex flex-col space-y-2">
              {depth3Items.map((service) => {
                const isSelected = formData.services.includes(
                  koToEnService[service] ?? service,
                );
                const displayName =
                  locale === "en" && koToEnService[service]
                    ? koToEnService[service]
                    : service;
                return (
                  <label
                    key={service}
                    className="flex items-center space-x-3 p-2 hover:bg-[#211e26] rounded-lg cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(service)}
                      className="w-5 h-5 text-[#a68cff] rounded border-[#2a2730] focus:ring-[#a68cff] bg-[#151219]"
                    />
                    <span
                      className={`text-sm ${isSelected ? "font-bold text-[#a68cff]" : "text-[#aea9b2]"}`}
                    >
                      {displayName}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-4 bg-[#0f0d13] rounded-xl border border-[#2a2730] text-xs text-[#aea9b2]">
              {t("profile.selectParentFirst")}
            </div>
          )}

          {/* 선택된 서비스 태그 표시 */}
          {formData.services.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 p-3 border border-[#a68cff]/30 bg-[#a68cff]/5 rounded-xl">
              {formData.services.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center bg-[#211e26] border border-[#a68cff]/40 text-[#a68cff] text-xs px-2 py-1.5 rounded-md"
                >
                  {locale === "en" && koToEnService[s] ? koToEnService[s] : s}
                  <button
                    type="button"
                    onClick={() => handleServiceToggle(s)}
                    className="ml-1.5 text-[#aea9b2] hover:text-[#ff6e84] font-bold px-1"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition mt-4 ${
            isSaved
              ? "bg-[#b5ffc2] text-[#0f0d13] hover:bg-[#9ff0af]"
              : "bg-[#a68cff] text-[#0f0d13] hover:bg-[#9070ff] disabled:bg-[#2a2730] disabled:text-[#aea9b2]"
          }`}
        >
          {saving
            ? t("profile.savingBtn")
            : isSaved
              ? t("profile.savedBtn")
              : t("profile.saveBtn")}
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────
// 고객 지원 (Customer Support)
// ─────────────────────────────────────────────
function CustomerSupportSection() {
  const t = useTranslations();
  const [categories, setCategories] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [expandedCatId, setExpandedCatId] = useState<number | null>(null);

  useEffect(() => {
    const fetchCms = async () => {
      const { data: cats } = await supabase
        .from("support_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (cats) setCategories(cats);

      const { data: pgs } = await supabase
        .from("support_pages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (pgs) setPages(pgs);
    };
    fetchCms();
  }, []);

  const toggleCat = (id: number) => {
    setExpandedCatId((prev) => (prev === id ? null : id));
  };

  const getCatIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("platform")) return "menu_book";
    if (lower.includes("customer")) return "description";
    if (lower.includes("pro")) return "verified";
    if (lower.includes("faq")) return "help";
    return "article";
  };

  return (
    <div className="bg-[#211e26] rounded-2xl border border-[#2a2730] overflow-hidden">
      <h2 className="text-sm font-bold text-[#ff88b5] tracking-widest uppercase p-6 pb-2 border-b border-[#2a2730]">
        {t("profile.customerSupport")}
      </h2>
      <ul className="flex flex-col">
        <li className="border-b border-[#2a2730] last:border-0 hover:bg-[#2a2730] transition cursor-pointer">
          <Link
            href="/support/inquiry"
            className="w-full flex justify-between items-center p-4"
          >
            <div className="flex items-center gap-3">
              <span className="bg-[#2a2730] rounded-full p-2 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ff88b5] text-[20px] leading-none">
                  headset_mic
                </span>
              </span>
              <span className="text-sm font-medium text-white">
                {t("profile.inquiryLink")}
              </span>
            </div>
            <span className="material-symbols-outlined text-white/40 text-[20px]">
              chevron_right
            </span>
          </Link>
        </li>
        {categories.map((cat) => {
          const catPages = pages.filter((p) => p.category_id === cat.id);
          const isExpanded = expandedCatId === cat.id;
          return (
            <li
              key={cat.id}
              className="border-b border-[#2a2730] last:border-0 hover:bg-[#2a2730] transition"
            >
              <button
                type="button"
                onClick={() => toggleCat(cat.id)}
                className="w-full flex justify-between items-center p-4 transition text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-[#2a2730] rounded-full p-2 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#aea9b2] text-[20px] leading-none">
                      {getCatIcon(cat.title)}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-white">
                    {cat.title}
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-white/40 text-[20px] transition-transform duration-200"
                  style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                >
                  chevron_right
                </span>
              </button>
              {isExpanded && (
                <ul className="bg-[#151219] flex flex-col pt-1 pb-3 px-4">
                  {catPages.length === 0 ? (
                    <li className="text-xs text-[#aea9b2] py-2 pl-2">
                      {t("profile.noPages")}
                    </li>
                  ) : (
                    catPages.map((page) => (
                      <li key={page.id} className="py-1">
                        <Link
                          href={`/support/${cat.slug}/${page.slug}`}
                          className="flex items-center text-sm text-[#aea9b2] hover:text-[#ff88b5] hover:font-bold transition pl-2 py-2 border-l-2 border-transparent hover:border-[#ff88b5]"
                        >
                          📄 {page.title}
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
