"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function NotificationsPage() {
  const t = useTranslations();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    let notifChannel: any;

    const fetchNotifications = async () => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const sessionUser = authData?.user;

      if (authError || !sessionUser) {
        router.replace("/");
        return;
      }
      setCurrentUser({ id: sessionUser.id });

      const threeDaysAgo = new Date();
      threeDaysAgo.setHours(threeDaysAgo.getHours() - 72);

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", sessionUser.id)
        .not("type", "in", '("CHAT","MATCH","QUOTE")')
        .gte("created_at", threeDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const senderIds = Array.from(
          new Set(data.map((n) => n.sender_id).filter(Boolean)),
        );

        if (senderIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("user_id, name, nickname, avatar_url")
            .in("user_id", senderIds);

          if (usersData) {
            const senderMap: Record<string, any> = {};

            usersData.forEach((u) => {
              senderMap[u.user_id] = {
                name:
                  u.nickname && u.nickname.trim() !== ""
                    ? u.nickname
                    : u.name || "Unknown",
                avatar: u.avatar_url || null,
              };
            });

            const enrichedData = data.map((n) => ({
              ...n,
              sender: n.sender_id ? senderMap[n.sender_id] : null,
            }));

            setNotifications(enrichedData);
            setLoading(false);
            return;
          }
        }

        setNotifications(data);
      }
      setLoading(false);

      // Supabase 구독: UPDATE만 수신 (INSERT는 ClientLayout의 CustomEvent로 수신 → 이중 구독 방지)
      notifChannel = supabase
        .channel("realtime:notifications_page")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${sessionUser.id}`,
          },
          (payload) => {
            const updatedNotif = payload.new as any;
            setNotifications((prev) =>
              prev.map((n) =>
                n.id === updatedNotif.id ? { ...n, ...updatedNotif } : n,
              ),
            );
          },
        )
        .subscribe();
    };

    // ClientLayout에서 브로드캐스트된 새 알림 수신 (단일 이벤트 소스 패턴)
    const handleNewNotification = async (e: Event) => {
      const newNotif = (e as CustomEvent).detail;
      if (!newNotif || ["CHAT", "MATCH", "QUOTE"].includes(newNotif.type))
        return;

      // sender_id가 있고 아직 sender 객체가 매핑되지 않은 경우 DB에서 즉시 조회
      if (newNotif.sender_id && !newNotif.sender) {
        const { data: userData } = await supabase
          .from("users")
          .select("name, nickname, avatar_url")
          .eq("user_id", newNotif.sender_id)
          .single();

        if (userData) {
          newNotif.sender = {
            name:
              userData.nickname && userData.nickname.trim() !== ""
                ? userData.nickname
                : userData.name || "Unknown",
            avatar: userData.avatar_url || null,
          };
        }
      }

      setNotifications((prev) => {
        // 중복 방지
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
    };

    window.addEventListener("notification-inserted", handleNewNotification);
    fetchNotifications();

    return () => {
      if (notifChannel) {
        supabase.removeChannel(notifChannel);
      }
      window.removeEventListener(
        "notification-inserted",
        handleNewNotification,
      );
    };
  }, []);

  const markAsRead = async (id: string) => {
    if (!currentUser) return;

    await supabase.from("notifications").update({ is_read: true }).eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await markAsRead(notif.id);
    }

    // [핵심] 알림 클릭 시 관련 GNB 뱃지도 연동 소멸
    if (notif.type === "MATCH") {
      window.dispatchEvent(new Event("requests-read")); // 받은요청 뱃지 소멸
    } else if (notif.type === "QUOTE") {
      window.dispatchEvent(new Event("quotes-read")); // 받은견적 뱃지 소멸
    }

    if (!notif.reference_id) {
      console.error(
        "Routing failed: reference_id is missing for notification",
        notif.id,
      );
      return;
    }

    // 라우팅 로직
    if (notif.type === "MATCH") {
      router.push(`/pro/requests/${notif.reference_id}`);
    } else if (notif.type === "QUOTE") {
      router.push(`/quotes/received?requestId=${notif.reference_id}`);
    } else if (notif.type === "MATCH_SUCCESS") {
      // reference_id = request_id → 해당 채팅방 조회 후 이동
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("room_id")
        .eq("request_id", notif.reference_id)
        .single();
      if (room?.room_id) {
        router.push(`/chat/${room.room_id}`);
      } else {
        router.push("/chat");
      }
    } else if (
      notif.type === "SYSTEM" &&
      notif.message?.includes("리뷰를 남겼습니다")
    ) {
      router.push("/pro/reviews");
    } else if (
      notif.type === "SYSTEM" &&
      notif.message?.includes("1:1 문의 답변")
    ) {
      router.push("/support/inquiry?tab=history");
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);
    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
    setOpenMenuId(null);
  };

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "MATCH":
        return "📋";
      case "QUOTE":
        return "📩";
      case "SYSTEM":
      case "BILLING":
        return "⚙️";
      case "MATCH_SUCCESS":
        return "🎉";
      default:
        return "🔔";
    }
  };

  return (
    <div
      className="min-h-screen bg-white flex flex-col"
      onClick={() => setOpenMenuId(null)}
    >
      {/* 헤더 */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200 shadow-[0_8px_32px_rgba(211,45,125,0.05)] sticky top-0 z-10 flex justify-between items-center px-6 h-16">
        <h1 className="text-xl font-black text-[#0020A0] tracking-tight">
          {t("notifications.title")}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-[#0020A0] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">
              {t("notifications.loading")}
            </p>
          </div>
        ) : !currentUser ? (
          <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-2xl border border-gray-200 mt-4">
            <p>{t("notifications.loginRequired")}</p>
          </div>
        ) : notifications.length === 0 ? (
          /* 빈 상태 */
          <div className="flex flex-col items-center justify-center py-16 px-6 relative overflow-hidden">
            {/* 배경 블러 */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
              style={{
                filter: "blur(40px)",
                background: "linear-gradient(45deg, #0020A0, #ff6ea9)",
                opacity: 0.1,
              }}
            />
            <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
              {/* 벨 아이콘 */}
              <div className="mb-8 relative">
                <div className="absolute inset-0 bg-[#0020A0]/10 blur-3xl rounded-full" />
                <div className="w-40 h-40 rounded-full bg-gray-100 flex items-center justify-center relative border border-gray-200 shadow-sm overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0020A0]/10 to-transparent" />
                  <span
                    className="material-symbols-outlined text-[#0020A0]"
                    style={{
                      fontSize: "80px",
                      fontVariationSettings: "'FILL' 1, 'wght' 400",
                    }}
                  >
                    notifications
                  </span>
                </div>
              </div>
              <h2 className="font-black text-3xl tracking-tight mb-4 text-gray-900">
                {t("notifications.empty")}
              </h2>
              <p className="text-gray-500 text-base leading-relaxed">
                {t("notifications.emptySubtext")}
              </p>
            </div>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`relative p-4 rounded-2xl border transition-colors duration-200 cursor-pointer flex gap-3 ${
                notif.is_read
                  ? "bg-gray-50 border-gray-200"
                  : "bg-[#0020A0]/5 border-[#0020A0]/20 border-l-4"
              }`}
            >
              <div className="flex-shrink-0 relative mt-1">
                {notif.sender?.avatar ? (
                  <img
                    src={notif.sender.avatar}
                    alt="Profile"
                    className="w-12 h-12 rounded-full object-cover border border-gray-200 shadow-sm"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 shadow-sm">
                    <span className="text-xl">{getIcon(notif.type)}</span>
                  </div>
                )}

                {!notif.is_read && (
                  <div className="absolute top-0 right-0 w-3 h-3 bg-[#0020A0] rounded-full border-2 border-white" />
                )}
              </div>

              <div className="flex-1 min-w-0 pl-1 pr-6">
                {notif.sender && (
                  <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">
                    {notif.sender.name}
                  </p>
                )}

                <p
                  className={`text-sm line-clamp-2 ${
                    notif.is_read
                      ? "text-gray-400"
                      : "text-gray-700 font-medium"
                  }`}
                >
                  {notif.message}
                </p>

                <p className="text-xs text-gray-400 mt-1.5">
                  {new Date(notif.created_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {/* 점 3개 메뉴 버튼 */}
              <button
                onClick={(e) => toggleMenu(e, notif.id)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 transition-colors"
              >
                ⋮
              </button>

              {/* 삭제 팝업 */}
              {openMenuId === notif.id && (
                <div className="absolute top-10 right-4 bg-white border border-gray-200 shadow-xl rounded-xl py-1 z-20 backdrop-blur-xl">
                  <button
                    onClick={(e) => deleteNotification(e, notif.id)}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-100 font-medium transition-colors"
                  >
                    {t("notifications.delete")}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
