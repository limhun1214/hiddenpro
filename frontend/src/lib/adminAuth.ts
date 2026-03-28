// src/lib/adminAuth.ts
import { createBrowserClient } from "@supabase/ssr";

export type AdminRole = "ADMIN" | "ADMIN_OPERATION" | "ADMIN_VIEWER";

export async function getAdminRoleAsync(): Promise<AdminRole | null> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (["ADMIN", "ADMIN_OPERATION", "ADMIN_VIEWER"].includes(role)) {
    return role as AdminRole;
  }
  return null;
}

// 마스킹 유틸 함수 — ADMIN_VIEWER 등급일 때만 개인정보 마스킹 적용
export function maskPrivateInfo(value: string, role: AdminRole): string {
  if (role !== "ADMIN_VIEWER") return value;
  if (!value) return value;
  if (value.includes("@")) {
    // 이메일 마스킹: ab***@gmail.com
    const [local, domain] = value.split("@");
    return local.slice(0, 2) + "***@" + domain;
  }
  // 전화번호 마스킹: 010-****-1234
  if (value.match(/^[0-9+\-\s]{8,}$/)) {
    return value.slice(0, 3) + "-****-" + value.slice(-4);
  }
  return value;
}
