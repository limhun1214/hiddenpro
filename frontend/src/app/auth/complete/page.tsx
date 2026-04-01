"use client";
export const runtime = "edge";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useTranslations } from "next-intl";

/**
 * 소셜 로그인 완료 페이지
 *
 * OAuth 리다이렉트 → /auth/callback(서버 세션 교환) → 여기로 도착.
 * localStorage에 저장된 pending_auth_role을 복원하여 역할 처리.
 *
 * [핵심] 서버 권한 우선주의:
 * - 기존 유저: DB role 사용, localStorage role 완전 무시
 * - 신규 유저: localStorage role로 INSERT
 */
export default function AuthCompletePage() {
  const t = useTranslations();
  const [status, setStatus] = useState("");
  const hasRun = useRef(false);

  useEffect(() => {
    const completeAuth = async () => {
      if (hasRun.current) return;
      hasRun.current = true;

      // pending_show_login은 auth/complete 도달 시 무조건 삭제
      // (auth 성공/실패·예외 발생과 무관하게 모달 재출현 방지)
      localStorage.removeItem("pending_show_login");

      try {
        // 1. 세션 확인
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        const sessionUser = authData?.user;

        if (authError || !sessionUser) {
          setStatus(t("authComplete.authFailed"));
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
          return;
        }

        // 2. localStorage에서 선택된 역할 및 모드 복원 (removeItem은 라우팅 직전으로 이동)
        const pendingRole =
          localStorage.getItem("pending_auth_role") || "CUSTOMER";
        const pendingAuthMode = localStorage.getItem("pending_auth_mode") || "";
        const pendingReferralCode =
          localStorage.getItem("pending_referral_code") || "";

        // 3. 서버 권한 우선주의: 기존 유저 여부 확인
        const { data: existingUser } = await supabase
          .from("users")
          .select("role, created_at, status")
          .eq("user_id", sessionUser.id)
          .single();

        let finalRole: string;
        let isNewUser = false;

        if (existingUser) {
          // ▶ 탈퇴 계정 감지: 탈퇴 횟수 확인 후 분기 (세션 유지)
          if (String(existingUser.status).toUpperCase() === "DELETED") {
            localStorage.removeItem("pending_auth_role");
            localStorage.removeItem("pending_auth_mode");
            localStorage.removeItem("pending_referral_code");

            const { count: withdrawCount } = await supabase
              .from("withdrawal_logs")
              .select("user_id", { count: "exact", head: true })
              .eq("user_id", sessionUser.id);

            if ((withdrawCount ?? 0) >= 3) {
              window.location.href = "/?permanent_ban=true";
            } else {
              window.location.href = "/?reregister=true";
            }
            return;
          }

          // ▶ 트리거 신규 판정: created_at이 30초 이내이면 handle_user_sync()가 방금 만든 레코드
          const createdAt = new Date(existingUser.created_at).getTime();
          const isTriggerFreshRecord = Date.now() - createdAt < 30_000;

          if (isTriggerFreshRecord) {
            isNewUser = true;
            // 추천인 코드로 추천인 ID 공통 조회
            let referredByUserId: string | null = null;
            if (pendingReferralCode) {
              const { data: referrerData } = await supabase
                .from("users")
                .select("user_id")
                .eq("referral_code", pendingReferralCode)
                .single();
              if (referrerData && referrerData.user_id !== sessionUser.id) {
                referredByUserId = referrerData.user_id;
              }
            }

            if (pendingRole.toUpperCase() !== "CUSTOMER") {
              // ▶ PRO 가입: 트리거가 CUSTOMER로 생성한 레코드를 PRO로 UPDATE
              finalRole = pendingRole.toUpperCase();

              const { error: updateErr } = await supabase
                .from("users")
                .update({ role: finalRole, referred_by: referredByUserId })
                .eq("user_id", sessionUser.id);
              if (updateErr)
                console.error(
                  "Role UPDATE Error (trigger fresh record):",
                  updateErr,
                );

              // PRO 가입 시 pro_profiles 초기 레코드 생성 (재시도 로직 포함)
              let proInsertSuccess = false;
              for (let attempt = 0; attempt < 3; attempt++) {
                const { error: proErr } = await supabase
                  .from("pro_profiles")
                  .insert({ pro_id: sessionUser.id, current_cash: 0 });
                if (!proErr) {
                  proInsertSuccess = true;
                  break;
                }
                console.error(
                  `Pro Profile Insert 시도 ${attempt + 1}/3 실패:`,
                  proErr,
                );
                await new Promise((r) => setTimeout(r, 1000));
                await supabase.auth.refreshSession();
              }
              if (!proInsertSuccess) {
                console.error(
                  "Pro Profile Insert 최종 실패 — 관리자 확인 필요",
                );
              }
            } else {
              // ▶ CUSTOMER 가입: role은 CUSTOMER 유지, referred_by만 저장
              finalRole = "CUSTOMER";
              if (referredByUserId) {
                const { error: updateErr } = await supabase
                  .from("users")
                  .update({ referred_by: referredByUserId })
                  .eq("user_id", sessionUser.id);
                if (updateErr)
                  console.error(
                    "Referral UPDATE Error (customer trigger fresh):",
                    updateErr,
                  );
              }
            }
          } else {
            // ▶ 기존 유저: DB 역할 절대 사용. localStorage 역할 무시.
            finalRole = String(existingUser.role).toUpperCase();

            // ▶ 역할 충돌 감지 (ADMIN 계열 및 로그인 모드는 예외 — 어느 버튼에서든 로그인 허용)
            const isAdminRole = [
              "ADMIN",
              "ADMIN_OPERATION",
              "ADMIN_VIEWER",
            ].includes(finalRole);
            const isLoginMode = pendingAuthMode === "login";
            if (
              !isAdminRole &&
              !isLoginMode &&
              pendingRole.toUpperCase() !== finalRole
            ) {
              // 역할 충돌: 로그아웃하지 않고 기존 역할로 정상 로그인 처리
              // 프로필 페이지에서 토스트로 안내
              const msg =
                finalRole === "CUSTOMER"
                  ? t("authComplete.roleConflictCustomer")
                  : t("authComplete.roleConflictPro");
              try {
                sessionStorage.setItem("role_conflict_msg", msg);
              } catch {}
              // signOut 하지 않음 — 아래 정상 라우팅 로직으로 계속 진행
            }
          }
        } else {
          // ▶ 신규 유저: 선택한 역할로 INSERT
          isNewUser = true;
          finalRole = pendingRole.toUpperCase();
          const userName = sessionUser.email?.split("@")[0] || "user";

          // 추천인 코드로 추천인 ID 조회
          let referredByUserId: string | null = null;
          if (pendingReferralCode) {
            const { data: referrerData } = await supabase
              .from("users")
              .select("user_id")
              .eq("referral_code", pendingReferralCode)
              .single();
            if (referrerData && referrerData.user_id !== sessionUser.id) {
              referredByUserId = referrerData.user_id;
            }
          }

          const { error: userErr } = await supabase.from("users").insert({
            user_id: sessionUser.id,
            role: finalRole,
            name: userName,
            status: "ACTIVE",
            referred_by: referredByUserId,
          });
          if (userErr) console.error("Users DB Insert Error:", userErr);

          // PRO 가입 시 pro_profiles 초기 레코드 생성 (재시도 로직 포함)
          if (finalRole === "PRO") {
            let proInsertSuccess = false;
            for (let attempt = 0; attempt < 3; attempt++) {
              const { error: proErr } = await supabase
                .from("pro_profiles")
                .insert({ pro_id: sessionUser.id, current_cash: 0 });
              if (!proErr) {
                proInsertSuccess = true;
                break;
              }
              console.error(
                `Pro Profile Insert 시도 ${attempt + 1}/3 실패:`,
                proErr,
              );
              // 세션 토큰 갱신 대기 후 재시도
              await new Promise((r) => setTimeout(r, 1000));
              await supabase.auth.refreshSession();
            }
            if (!proInsertSuccess) {
              console.error("Pro Profile Insert 최종 실패 — 관리자 확인 필요");
            }
          }
        }

        // 4. 서버 역할(finalRole) 기준 라우팅
        localStorage.removeItem("pending_auth_role");
        localStorage.removeItem("pending_auth_mode");
        localStorage.removeItem("pending_referral_code");
        localStorage.removeItem("pending_show_login");
        setStatus(t("authComplete.loginSuccess"));

        // [pending 견적 처리] 로그인 후 미완료 견적 처리
        const pendingRequestRaw = localStorage.getItem("pendingRequestData");

        // [PRO 계정] pending 견적 차단 — localStorage 정리 후 프로필로 이동
        if (finalRole === "PRO" && pendingRequestRaw) {
          localStorage.removeItem("pendingRequestData");
          sessionStorage.setItem(
            "pro_quote_blocked_msg",
            t("authComplete.proQuoteBlocked"),
          );
          window.location.href = "/profile";
          return;
        }

        // [CUSTOMER 계정] pending 견적 자동 등록
        if (finalRole === "CUSTOMER" && pendingRequestRaw) {
          try {
            localStorage.removeItem("pendingRequestData");
            const pendingAnswers = JSON.parse(pendingRequestRaw);

            // 전화번호 인증 여부 확인
            const { data: userRow } = await supabase
              .from("users")
              .select("is_phone_verified")
              .eq("user_id", sessionUser.id)
              .single();

            if (!userRow?.is_phone_verified) {
              // 전화번호 미인증: 첫 번째 견적 포함 항상 인증 유도
              localStorage.setItem(
                "pendingRequestData",
                JSON.stringify(pendingAnswers),
              );
              sessionStorage.setItem(
                "pending_phone_verify_msg",
                t("authComplete.pendingPhoneVerify"),
              );
              const categoryId = pendingAnswers.depth1 || "";
              window.location.href = `/request?categoryId=${encodeURIComponent(categoryId)}&pendingSubmit=1`;
              return;
            }

            // 전화번호 인증 완료 또는 첫 번째 견적 → DB 등록
            const expiresAt = new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString();
            const finalRegion = `${pendingAnswers.region_reg}, ${pendingAnswers.region_city}`;

            let realCategoryId = null;
            let serviceTypeEn = pendingAnswers.service_type;
            if (pendingAnswers.service_type) {
              const { data: catData } = await supabase
                .from("categories")
                .select("id, name_en")
                .eq("name", pendingAnswers.service_type)
                .single();
              if (catData) {
                realCategoryId = catData.id;
                serviceTypeEn = catData.name_en ?? pendingAnswers.service_type;
              }
            }

            const { error: insertError } = await supabase
              .from("match_requests")
              .insert({
                customer_id: sessionUser.id,
                category_id: realCategoryId,
                region_id: 1,
                service_type: serviceTypeEn,
                region: finalRegion,
                dynamic_answers: pendingAnswers,
                status: "OPEN",
                expires_at: expiresAt,
              });

            if (insertError) {
              console.error("Pending 견적 자동 등록 실패:", insertError);
              window.location.href = "/quotes/received";
              return;
            }

            // ── [추천인 보상] 첫 견적 요청 판별 → 보상 트리거 (fire-and-forget) ──
            try {
              const { count } = await supabase
                .from("match_requests")
                .select("request_id", { count: "exact", head: true })
                .eq("customer_id", sessionUser.id);
              if (count === 1) {
                supabase
                  .rpc("process_referral_reward", {
                    p_referred_user_id: sessionUser.id,
                  })
                  .then(
                    (res) => {
                      if (res.data?.success)
                        console.log("[Referral] Reward processed:", res.data);
                    },
                    () => {},
                  );
              }
            } catch {}

            setStatus(t("authComplete.quoteSuccess"));
            window.location.href = "/quotes/received";
            return;
          } catch (e) {
            console.error("Pending 견적 처리 오류:", e);
            window.location.href = "/quotes/received";
            return;
          }
        }

        // 비관리자 계정은 locale을 en으로 강제
        if (!["ADMIN", "ADMIN_OPERATION", "ADMIN_VIEWER"].includes(finalRole)) {
          document.cookie = "locale=en; path=/; max-age=31536000; SameSite=Lax";
        }

        // 신규 가입 시 웰컴 모달 플래그 설정
        if (isNewUser) {
          localStorage.setItem("pending_welcome", finalRole);
        }

        window.location.href = "/";
      } catch (err) {
        console.error("Auth Complete Error:", err);
        setStatus(t("authComplete.error"));
        setTimeout(() => {
          window.location.href = "/";
        }, 2000);
      }
    };

    completeAuth();
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 font-medium text-sm">
          {status || t("authComplete.processing")}
        </p>
      </div>
    </div>
  );
}
