"use client";
export const runtime = "edge";

import React, { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import LandingExperience from "@/components/landing/LandingExperience";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { NavStateContext } from "@/context/NavStateContext";

export default function HomePage() {
  const t = useTranslations();
  const router = useRouter();
  const { isLoggedIn, isAdminUser, isProUser } = useContext(NavStateContext);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const authDialogRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!showLoginModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => Array.from(authDialogRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex="0"]') || []).filter(el => !el.hasAttribute('disabled'));
    focusables()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setShowLoginModal(false); setAuthError(""); }
      if (event.key === "Tab") {
        const elements = focusables();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", handleKey); previousFocus?.focus(); };
  }, [showLoginModal]);
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
  const [authError, setAuthError] = useState("");
  const authLock = React.useRef(false);
  // ── [확장] 정지 계정 경고 배너 ──
  const [showSuspendedBanner, setShowSuspendedBanner] = useState(false);
  const [showWithdrawnBanner, setShowWithdrawnBanner] = useState(false);
  // ── [확장] 탈퇴 계정 재가입 확인 모달 ──
  const [showReregisterModal, setShowReregisterModal] = useState(false);
  const [isReregistering, setIsReregistering] = useState(false);
  // ── [확장] 영구 이용 불가 모달 ──
  const [showPermanentBanModal, setShowPermanentBanModal] = useState(false);
  // ── [확장] 신규 가입 웰컴 모달 ──
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeRole, setWelcomeRole] = useState<"CUSTOMER" | "PRO">(
    "CUSTOMER",
  );

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
      // ── [확장] 탈퇴 계정 재가입 감지 ──
      if (params.get("reregister") === "true") {
        setShowReregisterModal(true);
      }
      // ── [확장] 영구 이용 불가 감지 ──
      if (params.get("permanent_ban") === "true") {
        setShowPermanentBanModal(true);
      }

      // ── [확장] 신규 가입 웰컴 모달 감지 ──
      const pendingWelcome = localStorage.getItem("pending_welcome");
      if (pendingWelcome) {
        localStorage.removeItem("pending_welcome");
        setWelcomeRole(
          pendingWelcome.toUpperCase() === "PRO" ? "PRO" : "CUSTOMER",
        );
        setShowWelcomeModal(true);
      }

      // ── [확장] 인증 에러 감지 → Alert 표출 ──
      const error = params.get("error");
      if (error) {
        setAuthError(error);
        setShowLoginModal(true);
      }

      // URL에서 파라미터 제거 (선택 사항: 사용자 경험을 위해 유지하거나 제거)
      if (
        params.get("suspended") === "true" ||
        params.get("withdrawn") === "true" ||
        params.get("reregister") === "true" ||
        params.get("permanent_ban") === "true" ||
        params.get("error")
      ) {
        window.history.replaceState({}, "", "/");
      }
    }
  }, [router]);

  const handleReregister = async () => {
    setIsReregistering(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) throw new Error("No active session.");

      const { error } = await supabase
        .from("users")
        .update({
          status: "ACTIVE",
          name: user.email?.split("@")[0] || "user",
          nickname: null,
          email: user.email ?? null,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // JWT user_metadata의 status도 ACTIVE로 복구 (미들웨어 DELETED 차단 해제)
      await supabase.auth.updateUser({ data: { status: "ACTIVE" } });

      setShowReregisterModal(false);
      window.location.href = "/";
    } catch (e: any) {
      alert("An error occurred during re-registration: " + e.message);
      setIsReregistering(false);
    }
  };

  const handleReregisterDecline = async () => {
    await supabase.auth.signOut();
    setShowReregisterModal(false);
  };

  const handleSocialLogin = async (provider: "google" | "facebook") => {
    if (authLock.current) return;
    authLock.current = true;
    setIsLoggingIn(true);
    setAuthError("");
    try {
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
    if (error) throw error;
    } catch {
      setAuthError(t("landing.socialLoginError"));
      authLock.current = false;
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="bg-[#f7f8f2] text-[#142522] antialiased min-h-screen">
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
      {/* ── 탈퇴 계정 재가입 확인 모달 ── */}
      {showReregisterModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-4xl block mb-2">👋</span>
              <h3 className="text-lg font-black text-gray-800">
                {t("landing.reregisterTitle")}
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {t("landing.reregisterDesc")}
              </p>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={handleReregisterDecline}
                disabled={isReregistering}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
              >
                {t("landing.reregisterDecline")}
              </button>
              <button
                onClick={handleReregister}
                disabled={isReregistering}
                className="flex-1 py-3 rounded-xl bg-[#173e31] hover:bg-[#245d47] text-white font-bold text-sm transition disabled:opacity-50"
              >
                {isReregistering
                  ? t("landing.reregistering")
                  : t("landing.reregisterConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 영구 이용 불가 모달 ── */}
      {showPermanentBanModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-4xl block mb-2">🚫</span>
              <h3 className="text-lg font-black text-gray-800">
                {t("landing.permanentBanTitle")}
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {t("landing.permanentBanDesc")}
              </p>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                setShowPermanentBanModal(false);
              }}
              className="w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm transition"
            >
              {t("landing.permanentBanBtn")}
            </button>
          </div>
        </div>
      )}

      {/* ── 신규 가입 웰컴 모달 ── */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-center">
              <span className="text-4xl block mb-2">🎉</span>
              <h3 className="text-lg font-black text-gray-800">
                {welcomeRole === "PRO"
                  ? t("landing.welcomeProTitle")
                  : t("landing.welcomeCustomerTitle")}
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-line">
                {welcomeRole === "PRO"
                  ? t("landing.welcomeProDesc")
                  : t("landing.welcomeCustomerDesc")}
              </p>
            </div>
            <button
              onClick={() => setShowWelcomeModal(false)}
              className="w-full py-3 rounded-xl bg-[#173e31] hover:bg-[#245d47] text-white font-bold text-sm transition"
            >
              {welcomeRole === "PRO"
                ? t("landing.welcomeProBtn")
                : t("landing.welcomeCustomerBtn")}
            </button>
          </div>
        </div>
      )}

      <LandingExperience
        isLoggedIn={isLoggedIn}
        isProUser={isProUser}
        isAdminUser={isAdminUser}
        onLogin={() => { setAuthMode("login"); setShowLoginModal(true); }}
        onJoinPro={() => { setAuthMode("pro_signup"); setShowLoginModal(true); }}
      />

      {/* 로그인/가입 모달 */}
      {showLoginModal && (
        <div className="hp-auth-backdrop">
          <div role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" ref={authDialogRef} className="hp-auth-dialog">
            {/* 헤더 */}
            <div className="hp-auth-header">
              <div className="hp-auth-brand" aria-hidden="true">
                <span className="hp-auth-mark">h<span>.</span></span>
                <span>Hidden<span className="font-medium">Pro</span></span>
              </div>
              <h3 id="auth-dialog-title">
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
                aria-label={t("common.close")} className="hp-auth-close"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>

            <div className="hp-auth-body" aria-busy={isLoggingIn}>
              {authError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{authError}</p>}
              {/* 고수 가입 모드일 때 안내 문구 */}
              {authMode === "pro_signup" && (
                <div className="hp-auth-note">
                  <p className="text-sm font-bold text-[#173e31]">
                    {t("landing.proSignupDesc")}
                  </p>
                  <p className="text-xs text-[#5c7062] mt-1 leading-relaxed">
                    {t("landing.proSignupDescSub")}
                  </p>
                </div>
              )}

              {/* 소셜 로그인 */}
              <div className="space-y-3">
                <button
                  onClick={() => handleSocialLogin("google")}
                  disabled={isLoggingIn}
                  className="hp-auth-provider hp-auth-provider-light"
                >
                  <svg aria-hidden="true" className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                  disabled={isLoggingIn}
                  className="hp-auth-provider hp-auth-provider-dark"
                >
                  <svg
                    aria-hidden="true"
                    className="w-5 h-5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  {t("landing.facebookLogin")}
                </button>
              </div>

              {isLoggingIn && <p role="status" className="hp-auth-status">{t("authComplete.processing")}</p>}
              <p className="hp-auth-terms">
                {t("landing.termsAgreement")}{" "}
                <Link href="/legal/TERMS" className="underline text-[#176b57]">{t("landing.termsLink")}</Link>{" "}
                {t("landing.termsAnd")}{" "}
                <Link href="/legal/PRIVACY" className="underline text-[#176b57]">{t("landing.privacyLink")}</Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
