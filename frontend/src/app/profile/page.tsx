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
      <div className="min-h-screen bg-[#f7f9fc] p-10 text-center text-[#757685]">
        {t("profile.loading")}
      </div>
    );
  if (!userRole)
    return (
      <div className="min-h-screen bg-[#f7f9fc] p-10 text-center text-red-500">
        {t("profile.error")}
      </div>
    );

  // [기획 핵심] 강제 Early Return (고객일 경우 고수 DB 조회 원천 차단)
  if (userRole === "CUSTOMER") {
    return (
      <div
        className="min-h-screen bg-[#f7f9fc] flex flex-col"
        onClick={() => {}}
      >
        {/* 배경 장식 */}
        <div className="fixed top-0 right-0 -z-10 w-1/2 h-1/2 bg-gradient-to-bl from-[#001269]/5 to-transparent blur-3xl pointer-events-none" />
        <div className="fixed bottom-0 left-0 -z-10 w-2/3 h-1/2 bg-gradient-to-tr from-[#c2c9fe]/10 to-transparent blur-3xl pointer-events-none" />

        {/* 헤더 */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm sticky top-0 z-10 h-16 flex items-center px-6">
          <h1 className="font-headline font-bold text-lg tracking-tight text-indigo-900">
            {t("profile.title")}
          </h1>
        </header>

        <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-8 space-y-8 pb-24">
          <ProfileHeader
            user={sessionUser}
            role="CUSTOMER"
            tableName="users"
            idColumn="user_id"
            onLogout={handleLogout}
          />
          <CustomerProfile user={sessionUser} />
          <CustomerSupportSection />

          {/* Invite & Earn */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0020A0] to-[#3e52c9] rounded-2xl p-8 shadow-xl">
            {/* 장식 원 */}
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-[#c2c9fe]/20 rounded-full blur-xl pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-4">
              <span className="material-symbols-outlined text-[32px] text-white/80">
                featured_seasonal
              </span>
              <div>
                <p className="font-bold text-lg text-white leading-snug">
                  Invite your friends &amp; earn credits together
                </p>
                <p className="text-sm text-white/70 mt-1">
                  Get $20 for every friend you invite to the curated platform.
                </p>
              </div>
              <button
                onClick={() => router.push("/referral")}
                className="self-start bg-white text-[#0020A0] px-5 py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition"
              >
                Send Invite
              </button>
            </div>
          </div>

          {/* 로그아웃 + 탈퇴 버튼 (가로) */}
          <div className="pt-4 pb-2 flex justify-center items-center gap-4">
            <button
              onClick={handleLogout}
              className="text-sm text-[#ba1a1a] font-medium hover:text-[#ba1a1a]/80 transition"
            >
              {t("profile.logout")}
            </button>
            <span className="w-[1px] h-3 bg-[#c5c5d6]" />
            <button
              onClick={() => {
                setShowWithdrawModal(true);
                setWithdrawReason("");
                setWithdrawConfirmText("");
              }}
              className="text-sm text-[#ba1a1a] font-medium hover:text-[#ba1a1a]/80 transition"
            >
              {t("profile.withdraw")}
            </button>
          </div>

          {/* Legal Links */}
          <div className="pt-1 pb-12 flex flex-wrap justify-center gap-x-3 gap-y-1">
            <Link
              href="/legal/TERMS"
              className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
            >
              {t("footer.terms")}
            </Link>
            <span className="text-[11px] text-[#c5c5d6]">·</span>
            <Link
              href="/legal/PRIVACY"
              className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
            >
              {t("footer.privacy")}
            </Link>
            <span className="text-[11px] text-[#c5c5d6]">·</span>
            <Link
              href="/support/customer/refund"
              className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
            >
              {t("footer.refund")}
            </Link>
            <span className="text-[11px] text-[#c5c5d6]">·</span>
            <Link
              href="/support/inquiry"
              className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
            >
              {t("footer.contactUs")}
            </Link>
            <span className="text-[11px] text-[#c5c5d6]">·</span>
            <Link
              href="/support/business-info"
              className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
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
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col">
      {/* 배경 장식 */}
      <div className="fixed top-0 right-0 -z-10 w-1/2 h-1/2 bg-gradient-to-bl from-[#001269]/5 to-transparent blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 left-0 -z-10 w-2/3 h-1/2 bg-gradient-to-tr from-[#c2c9fe]/10 to-transparent blur-3xl pointer-events-none" />

      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm sticky top-0 z-10 h-16 flex items-center px-6">
        <h1 className="font-headline font-bold text-lg tracking-tight text-indigo-900">
          {t("profile.title")}
        </h1>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 pt-8 space-y-8 pb-24">
        <ProfileHeader
          user={sessionUser}
          role="PRO"
          tableName="pro_profiles"
          idColumn="pro_id"
          onLogout={handleLogout}
          reviewHref="/pro/reviews"
        />
        <ProProfile user={sessionUser} />
        <CustomerSupportSection />

        {/* Invite & Earn */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0020A0] to-[#3e52c9] rounded-2xl p-8 shadow-xl">
          {/* 장식 원 */}
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-6 w-32 h-32 bg-[#c2c9fe]/20 rounded-full blur-xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4">
            <span className="material-symbols-outlined text-[32px] text-white/80">
              featured_seasonal
            </span>
            <div>
              <p className="font-bold text-lg text-white leading-snug">
                Invite your friends &amp; earn credits together
              </p>
              <p className="text-sm text-white/70 mt-1">
                Get $20 for every friend you invite to the curated platform.
              </p>
            </div>
            <button
              onClick={() => router.push("/referral")}
              className="self-start bg-white text-[#0020A0] px-5 py-3 rounded-xl text-sm font-bold hover:bg-white/90 transition"
            >
              Send Invite
            </button>
          </div>
        </div>

        {/* 로그아웃 + 탈퇴 버튼 (가로) */}
        <div className="pt-4 pb-2 flex justify-center items-center gap-4">
          <button
            onClick={handleLogout}
            className="text-sm text-[#ba1a1a] font-medium hover:text-[#ba1a1a]/80 transition"
          >
            {t("profile.logout")}
          </button>
          <span className="w-[1px] h-3 bg-[#c5c5d6]" />
          <button
            onClick={() => {
              setShowWithdrawModal(true);
              setWithdrawReason("");
              setWithdrawConfirmText("");
            }}
            className="text-sm text-[#ba1a1a] font-medium hover:text-[#ba1a1a]/80 transition"
          >
            {t("profile.withdraw")}
          </button>
        </div>

        {/* Legal Links */}
        <div className="pt-1 pb-12 flex flex-wrap justify-center gap-x-3 gap-y-1">
          <Link
            href="/legal/TERMS"
            className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
          >
            {t("footer.terms")}
          </Link>
          <span className="text-[11px] text-[#c5c5d6]">·</span>
          <Link
            href="/legal/PRIVACY"
            className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
          >
            {t("footer.privacy")}
          </Link>
          <span className="text-[11px] text-[#c5c5d6]">·</span>
          <Link
            href="/support/customer/refund"
            className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
          >
            {t("footer.refund")}
          </Link>
          <span className="text-[11px] text-[#c5c5d6]">·</span>
          <Link
            href="/support/inquiry"
            className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
          >
            {t("footer.contactUs")}
          </Link>
          <span className="text-[11px] text-[#c5c5d6]">·</span>
          <Link
            href="/support/business-info"
            className="text-[11px] text-[#454653] font-medium hover:text-[#001269] transition"
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
    <div
      className="bg-white rounded-2xl p-8 text-center space-y-6"
      style={{ boxShadow: "0 32px 64px -15px rgba(0, 15, 93, 0.06)" }}
    >
      {/* 아바타 */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[#001269]/5 bg-gradient-to-br from-[#eceef1] to-[#e6e8eb] flex items-center justify-center shadow-sm">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={t("profile.avatarAlt")}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-12 h-12 text-[#757685]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          {uploading && (
            <div className="absolute inset-0 w-24 h-24 rounded-full bg-black/40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* 이름 + 역할 + 이메일 */}
        <div className="space-y-1">
          <h2 className="font-headline font-extrabold text-2xl text-[#001269]">
            {displayName}
          </h2>
          <p className="text-[#454653] text-sm opacity-70">
            {user.email || t("profile.noEmail")}
          </p>
          {reviewHref && reviewStats.count > 0 && (
            <button
              onClick={() => (window.location.href = reviewHref)}
              className="inline-flex items-center gap-1.5 bg-amber-400/10 text-amber-600 text-xs font-bold px-3 py-1 rounded-full mt-1 hover:bg-amber-400/20 transition"
            >
              <span>★</span>
              <span>{reviewStats.avg.toFixed(1)}</span>
              <span className="opacity-70">
                ({reviewStats.count}
                {t("profile.proReviewCount")})
              </span>
            </button>
          )}
        </div>

        {/* 계정 설정 버튼 */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="border border-[#001269] text-[#001269] px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-[#001269]/5 transition"
        >
          {t("profile.accountSettings")}
        </button>
      </div>

      {/* 계정 설정 패널 (슬라이드 다운) */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${showSettings ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="text-left space-y-5 border-t border-[#c5c5d6]/40 pt-6">
          {/* 프로필 사진 변경 */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
              {t("profile.photoLabel")}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-[#eceef1] flex items-center justify-center ring-2 ring-[#c5c5d6]/30">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="프로필"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-10 h-10 text-[#757685]"
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
                  className="bg-[#f2f4f7] hover:bg-[#eceef1] text-[#191c1e] font-medium text-sm px-4 py-2.5 rounded-xl border border-[#c5c5d6]/50 transition disabled:opacity-50"
                >
                  {uploading
                    ? t("profile.photoUploading")
                    : cooldownRemaining > 0
                      ? `${cooldownRemaining} ${t("profile.photoCooldown")}`
                      : t("profile.photoUploadBtn")}
                </button>
                <span className="text-[11px] text-[#454653]">
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
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
              {t("profile.nicknameLabel")}
              <span className="ml-2 text-[10px] text-[#757685] font-normal normal-case tracking-normal">
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
                  className={`w-full bg-[#f2f4f7] border-b-2 px-4 py-3 rounded-t-lg focus:outline-none transition text-sm text-[#191c1e] placeholder:text-[#757685]/50 ${
                    nicknameStatus === "taken" || nicknameStatus === "error"
                      ? "border-[#ba1a1a]"
                      : nicknameStatus === "available"
                        ? "border-green-500"
                        : "border-transparent focus:border-[#001269]"
                  }`}
                />
                {nicknameStatus === "checking" && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-[#001269] border-t-transparent rounded-full animate-spin"></div>
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
                className="bg-[#0020a0] hover:bg-[#001269] text-white font-bold px-5 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:bg-[#eceef1] disabled:text-[#757685] disabled:cursor-not-allowed"
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
                    ? "text-[#ba1a1a]"
                    : nicknameStatus === "available"
                      ? "text-green-600"
                      : "text-[#454653]"
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
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 32px 64px -15px rgba(0, 15, 93, 0.06)" }}
    >
      <div className="divide-y divide-[#c5c5d6]/20">
        {/* 이메일 */}
        <div className="flex flex-col p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] mb-1">
            {t("profile.emailLabel")}
          </span>
          <span className="text-[#191c1e] font-medium text-sm">
            {user.email || t("profile.noEmailInfo")}
          </span>
        </div>

        {/* 전화번호 */}
        {phoneData?.is_phone_verified && phoneData?.phone ? (
          <div className="flex items-center p-5 gap-3">
            <div className="flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] block mb-1">
                {t("profile.verifiedPhone")}
              </span>
              <span className="text-[#191c1e] font-medium text-sm">
                {phoneData.phone}
              </span>
            </div>
            <span className="text-green-600 text-lg font-bold">✓</span>
          </div>
        ) : (
          <div className="flex flex-col p-5 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
              {t("profile.phoneVerification")}
            </span>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder={t("profile.phonePlaceholder")}
                className="flex-1 bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] placeholder:text-[#757685]/50 focus:outline-none transition"
                disabled={verifyingPhone}
              />
              <button
                onClick={handlePhoneVerify}
                disabled={verifyingPhone || !phoneInput.trim()}
                className="bg-[#0020a0] hover:bg-[#001269] text-white font-bold px-4 py-2 rounded-xl text-sm transition disabled:opacity-50 whitespace-nowrap"
              >
                {verifyingPhone
                  ? t("profile.phoneVerifying")
                  : t("profile.phoneVerifyBtn")}
              </button>
            </div>
            <span className="text-xs text-[#757685]">
              {t("profile.phoneNote")}
            </span>
          </div>
        )}

        {/* 가입일 */}
        {joinDate && (
          <div className="flex flex-col p-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] mb-1">
              {t("profile.joinDate")}
            </span>
            <span className="text-[#191c1e] font-medium text-sm">
              {joinDate}
            </span>
          </div>
        )}

        {/* 내 리뷰 */}
        <div
          className="flex items-center p-5 cursor-pointer group hover:bg-slate-50 transition"
          onClick={() => (window.location.href = "/customer/my-reviews")}
        >
          <div className="flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] block mb-1">
              {t("profile.myReviewsLabel")}
            </span>
            <span className="text-[#191c1e] font-medium text-sm">
              {reviewCount} {t("profile.reviewsCount")}
            </span>
          </div>
          <span className="material-symbols-outlined text-[20px] text-[#c5c5d6] group-hover:text-[#001269] transition">
            chevron_right
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
    <div
      className="bg-white rounded-2xl p-6 space-y-6"
      style={{ boxShadow: "0 32px 64px -15px rgba(0, 15, 93, 0.06)" }}
    >
      {/* 매칭 수락 토글 */}
      <div className="bg-[#eceef1] rounded-lg px-4 py-2 flex items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-[#191c1e]">
            {isAcceptingRequests
              ? t("profile.proAcceptingOn")
              : t("profile.proAcceptingOff")}
          </span>
          <p className="text-xs text-[#454653] mt-0.5">
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
          <div className="w-14 h-7 bg-[#c5c5d6] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c5c5d6] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-[#0020a0]"></div>
        </label>
      </div>

      {/* 인증 배지 */}
      <div className="flex flex-wrap gap-2">
        {isPhoneVerified && (
          <span className="inline-flex items-center bg-[#c2c9fe]/30 text-[#001269] text-xs font-bold px-3 py-1.5 rounded-full">
            ✓ Phone Verified
          </span>
        )}
        {facebookUrl && (
          <span className="inline-flex items-center bg-[#c2c9fe]/30 text-[#001269] text-xs font-bold px-3 py-1.5 rounded-full">
            ● Facebook Linked
          </span>
        )}
        {!isPhoneVerified && !facebookUrl && (
          <span className="text-xs text-[#757685]">
            {t("profile.proNoBadges")}
          </span>
        )}
      </div>

      {/* 전화번호 인증 */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] flex items-center gap-2">
          {t("profile.proPhoneVerifyLabel")}
          {isPhoneVerified && (
            <span className="text-green-600 text-[10px] font-bold normal-case tracking-normal">
              {t("profile.proPhoneVerified")}
            </span>
          )}
        </label>
        {isPhoneVerified ? (
          <div className="bg-[#f2f4f7] text-[#191c1e] px-4 py-3 rounded-t-lg border-b-2 border-green-500 text-sm font-medium">
            {t("profile.proPhoneVerifiedText")} {proPhone}
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder={t("profile.proPhonePlaceholder")}
              className="flex-1 bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] placeholder:text-[#757685]/50 focus:outline-none transition"
            />
            <button
              type="button"
              onClick={handlePhoneVerify}
              disabled={verifyingPhone}
              className="bg-[#0020a0] hover:bg-[#001269] text-white font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:opacity-50"
            >
              {verifyingPhone
                ? t("profile.proPhoneProcessing")
                : t("profile.proPhoneVerifyBtn")}
            </button>
          </div>
        )}
      </div>

      {/* Facebook 연동 */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653] flex items-center gap-2">
          {t("profile.proFbLinkLabel")}
          {facebookUrl && (
            <span className="text-[#001269] text-[10px] font-bold normal-case tracking-normal">
              {t("profile.proFbLinked")}
            </span>
          )}
        </label>
        {facebookUrl && !editingFb ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#f2f4f7] border-b-2 border-[#0020a0] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] truncate">
              {facebookUrl}
            </div>
            <button
              type="button"
              onClick={() => setEditingFb(true)}
              className="flex-shrink-0 text-xs font-bold text-[#001269] hover:text-[#0020a0] bg-[#dee0ff] px-3 py-2 rounded-lg hover:bg-[#c2c9fe] transition"
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
              className="flex-1 bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] placeholder:text-[#757685]/50 focus:outline-none transition"
            />
            <button
              type="button"
              onClick={async () => {
                await handleFbLink();
                setEditingFb(false);
              }}
              disabled={linkingFb}
              className="bg-[#0020a0] hover:bg-[#001269] text-white font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:opacity-50"
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
                className="text-[#757685] hover:text-[#191c1e] font-bold px-2 transition text-sm"
              >
                {t("profile.proFbCancelBtn")}
              </button>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 한줄 소개 */}
        <div className="flex flex-col space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
            {t("profile.proIntroLabel")}{" "}
            <span className="text-[10px] text-[#757685] font-normal normal-case tracking-normal ml-1">
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
            className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] placeholder:text-[#757685]/50 focus:outline-none transition"
            required
          />
          <span className="text-xs text-[#757685] text-right">
            {formData.intro.length}/50
          </span>
        </div>

        {/* 상세 소개 */}
        <div className="flex flex-col space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
            {t("profile.proDetailedLabel")}{" "}
            <span className="text-[10px] text-[#757685] font-normal normal-case tracking-normal ml-1">
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
            className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] placeholder:text-[#757685]/50 focus:outline-none transition resize-none"
          />
        </div>

        {/* 활동 지역 */}
        <div className="flex flex-col space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
            {t("profile.proRegionLabel")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedReg}
              onChange={(e) => {
                setSelectedReg(e.target.value);
                setSelectedCity("");
              }}
              className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] focus:outline-none transition"
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
              className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] focus:outline-none transition disabled:opacity-40"
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

        {/* 서비스 선택 */}
        <div className="flex flex-col space-y-3 border-t border-[#c5c5d6]/30 pt-4">
          <div className="flex justify-between items-end">
            <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#454653]">
              {t("profile.proServicesLabel")}
            </label>
            <span className="text-xs font-bold text-[#001269]">
              {formData.services.length} / 5
            </span>
          </div>

          {/* 카테고리 뎁스 브라우저 */}
          <div className="grid grid-cols-2 gap-3">
            <select
              value={selectedDepth1}
              onChange={(e) => {
                setSelectedDepth1(e.target.value);
                setSelectedDepth2("");
              }}
              className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] focus:outline-none transition"
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
              className="bg-[#f2f4f7] border-b-2 border-transparent focus:border-[#001269] px-4 py-3 rounded-t-lg text-sm text-[#191c1e] focus:outline-none transition disabled:opacity-40"
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
            <div className="bg-[#f2f4f7] rounded-xl p-3 max-h-48 overflow-y-auto flex flex-col space-y-1">
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
                    className="flex items-center space-x-3 px-3 py-2 hover:bg-white rounded-lg cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleServiceToggle(service)}
                      className="w-5 h-5 text-[#0020a0] rounded border-[#c5c5d6] focus:ring-[#0020a0] bg-white"
                    />
                    <span
                      className={`text-sm ${isSelected ? "font-bold text-[#001269]" : "text-[#454653]"}`}
                    >
                      {displayName}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-center p-4 bg-[#f2f4f7] rounded-xl text-xs text-[#757685]">
              {t("profile.selectParentFirst")}
            </div>
          )}

          {/* 선택된 서비스 칩 */}
          {formData.services.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {formData.services.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center bg-[#0020a0] text-white text-xs font-bold px-4 py-2 rounded-full"
                >
                  {locale === "en" && koToEnService[s] ? koToEnService[s] : s}
                  <button
                    type="button"
                    onClick={() => handleServiceToggle(s)}
                    className="ml-2 text-white/70 hover:text-white font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full font-bold py-4 rounded-xl transition ${
            isSaved
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-[#0020a0] text-white hover:bg-[#001269] disabled:bg-[#eceef1] disabled:text-[#757685]"
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
    <div
      className="bg-white rounded-2xl overflow-hidden"
      style={{ boxShadow: "0 32px 64px -15px rgba(0, 15, 93, 0.06)" }}
    >
      <ul className="flex flex-col divide-y divide-[#c5c5d6]/20">
        <li className="hover:bg-slate-50 transition cursor-pointer group">
          <Link
            href="/support/inquiry"
            className="w-full flex justify-between items-center p-5"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-indigo-900 text-[22px] leading-none">
                headset_mic
              </span>
              <span className="text-sm font-medium text-[#191c1e]">
                {t("profile.inquiryLink")}
              </span>
            </div>
            <span className="material-symbols-outlined text-[#c5c5d6] group-hover:text-[#001269] text-[20px] transition-colors">
              chevron_right
            </span>
          </Link>
        </li>
        {categories.map((cat) => {
          const catPages = pages.filter((p) => p.category_id === cat.id);
          const isExpanded = expandedCatId === cat.id;
          return (
            <li key={cat.id} className="hover:bg-slate-50 transition group">
              <button
                type="button"
                onClick={() => toggleCat(cat.id)}
                className="w-full flex justify-between items-center p-5 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-900 text-[22px] leading-none">
                    {getCatIcon(cat.title)}
                  </span>
                  <span className="text-sm font-medium text-[#191c1e]">
                    {cat.title}
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-[#c5c5d6] group-hover:text-[#001269] text-[20px] transition-all duration-200"
                  style={{ transform: isExpanded ? "rotate(90deg)" : "none" }}
                >
                  chevron_right
                </span>
              </button>
              {isExpanded && (
                <ul className="bg-[#f7f9fc] flex flex-col pt-1 pb-3 px-5">
                  {catPages.length === 0 ? (
                    <li className="text-xs text-[#757685] py-2 pl-2">
                      {t("profile.noPages")}
                    </li>
                  ) : (
                    catPages.map((page) => (
                      <li key={page.id} className="py-1">
                        <Link
                          href={`/support/${cat.slug}/${page.slug}`}
                          className="flex items-center text-sm text-[#454653] hover:text-[#001269] hover:font-semibold transition pl-2 py-2 border-l-2 border-transparent hover:border-[#001269]"
                        >
                          {page.title}
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
