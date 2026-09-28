import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const sessionResponse = NextResponse.next();
  const jsonResponse = (body: Record<string, unknown>, status = 200) => {
    const response = NextResponse.json(body, { status });
    sessionResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "서버 인증 설정을 확인해 주세요." }, 503);
    }

    // 요청 본문의 관리자 ID 대신 Auth 서버가 검증한 쿠키 세션을 사용한다.
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            sessionResponse.cookies.set(name, value, options);
          });
        },
      },
    });
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "로그인이 필요합니다." }, 401);
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "올바른 요청 본문이 필요합니다." }, 400);
    }
    const { targetUserId, newRole } = body as Record<string, unknown>;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof targetUserId !== "string" || !uuidPattern.test(targetUserId)) {
      return jsonResponse({ error: "올바른 대상 사용자 ID가 필요합니다." }, 400);
    }

    // 1. 허용된 역할값 검증
    const allowedRoles = [
      "ADMIN",
      "ADMIN_OPERATION",
      "ADMIN_VIEWER",
      "PRO",
      "CUSTOMER",
    ];
    if (typeof newRole !== "string" || !allowedRoles.includes(newRole)) {
      return jsonResponse({ error: "허용되지 않은 역할값입니다." }, 400);
    }

    // 인증된 사용자만 Service Role 클라이언트에 도달하며, 변경 전 DB 권한을 검증한다.
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. 세션 주체가 현재 활성 상태의 ADMIN인지 DB에서 검증
    const { data: adminCheck, error: adminErr } = await supabaseAdmin
      .from("users")
      .select("role, status")
      .eq("user_id", user.id)
      .single();
    if (
      adminErr ||
      adminCheck?.role !== "ADMIN" ||
      adminCheck?.status !== "ACTIVE"
    ) {
      return jsonResponse(
        { error: "최고 관리자만 승급 처리할 수 있습니다." },
        403,
      );
    }

    // 3. 본인 계정 강등 방지
    if (targetUserId === user.id && newRole !== "ADMIN") {
      return jsonResponse(
        { error: "본인 계정의 권한은 회수할 수 없습니다." },
        400,
      );
    }

    // 4. DB users.role 업데이트
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({ role: newRole })
      .eq("user_id", targetUserId);
    if (dbError) {
      return jsonResponse(
        { error: "DB 업데이트 실패: " + dbError.message },
        500,
      );
    }

    // 5. JWT app_metadata 동기화 (핵심 — 재로그인 없이 즉시 반영)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { app_metadata: { role: newRole }, user_metadata: { role: newRole } },
    );
    if (authError) {
      return jsonResponse(
        { error: "JWT 동기화 실패: " + authError.message },
        500,
      );
    }

    // 6. 감사 로그 기록
    await supabaseAdmin.from("admin_action_logs").insert({
      target_user_id: targetUserId,
      admin_id: user.id,
      action_type:
        newRole === "PRO" || newRole === "CUSTOMER"
          ? "DEMOTE_ADMIN"
          : "PROMOTE_ADMIN",
      reason: `역할 변경: ${newRole}`,
    });

    return jsonResponse({ success: true, newRole });
  } catch (error) {
    console.error("[admin/promote] Role update failed:", error);
    return jsonResponse({ error: "권한 변경 중 서버 오류가 발생했습니다." }, 500);
  }
}
