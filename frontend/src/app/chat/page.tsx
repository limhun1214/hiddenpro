"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function ChatListPage() {
  const t = useTranslations();
  const router = useRouter();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lastMessageMap, setLastMessageMap] = useState<Record<string, string>>(
    {},
  );

  const formatChatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else if (isYesterday) {
      return t("chatList.yesterday");
    } else {
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  const fetchChatRooms = React.useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const sessionUser = authData?.user;

    if (authError || !sessionUser) {
      router.replace("/");
      return;
    }

    const userId = sessionUser.id;
    setCurrentUserId(userId);

    // [사용자 요구사항]: 렌더링 시 현재 로그인된 사용자의 명확한 role 확인
    const { data: roleData } = await supabase
      .from("users")
      .select("role")
      .eq("user_id", userId)
      .single();
    console.log(
      "Current Verified Role:",
      roleData?.role?.toUpperCase() || "UNKNOWN",
    );

    const { data: roomsData, error: roomsError } = await supabase
      .from("chat_rooms")
      .select(`room_id, status, created_at, customer_id, pro_id`)
      .or(`customer_id.eq.${userId},pro_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (roomsError) {
      console.error("채팅방 목록 로드 실패:", roomsError);
      setErrorMsg(roomsError.message);
      setLoading(false);
      return;
    }

    if (roomsData && roomsData.length > 0) {
      const userIds = new Set<string>();
      roomsData.forEach((r) => {
        if (r.customer_id) userIds.add(r.customer_id);
        if (r.pro_id) userIds.add(r.pro_id);
      });

      const { data: usersData } = await supabase
        .from("users")
        .select("user_id, name, nickname, avatar_url") // avatar_url 추가
        .in("user_id", Array.from(userIds));

      const userMap: Record<string, string> = {};
      const avatarMap: Record<string, string | null> = {}; // 아바타 맵 추가
      if (usersData) {
        usersData.forEach((u) => {
          userMap[u.user_id] =
            u.nickname && u.nickname.trim() !== ""
              ? u.nickname
              : u.name || t("chatList.unknown");
          avatarMap[u.user_id] = u.avatar_url || null; // 아바타 저장
        });
      }

      // [추가 로직] 안 읽은 메시지 개수를 단일 쿼리로 일괄 조회
      const roomIds = roomsData.map((r) => r.room_id);

      const { data: unreadData } = await supabase
        .from("chat_messages")
        .select("room_id")
        .in("room_id", roomIds)
        .neq("sender_id", userId)
        .eq("is_read", false);

      const unreadMap: Record<string, number> = {};
      if (unreadData) {
        unreadData.forEach((msg) => {
          unreadMap[msg.room_id] = (unreadMap[msg.room_id] || 0) + 1;
        });
      }

      const mappedRooms = roomsData.map((room) => ({
        ...room,
        customer_name:
          userMap[room.customer_id] || t("chatList.defaultCustomer"),
        pro_name: userMap[room.pro_id] || t("chatList.defaultPro"),
        customer_avatar: avatarMap[room.customer_id] || null, // 고객 아바타 추가
        pro_avatar: avatarMap[room.pro_id] || null, // 고수 아바타 추가
        unread_count: unreadMap[room.room_id] || 0,
      }));

      // 각 채팅방의 마지막 메시지 일괄 조회 (N+1 방지)
      const { data: lastMsgsData } = await supabase
        .from("chat_messages")
        .select("room_id, content, message_type, created_at")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false });

      const lastMsgMap: Record<string, string> = {};
      if (lastMsgsData) {
        lastMsgsData.forEach((msg) => {
          if (!lastMsgMap[msg.room_id]) {
            // 시스템 메시지는 별도 표시
            if (
              msg.message_type === "SYSTEM" ||
              msg.message_type === "SYSTEM_CLOSE" ||
              msg.message_type === "SYSTEM_REVIEWED" ||
              msg.message_type === "SYSTEM_PRIVATE"
            ) {
              lastMsgMap[msg.room_id] = t("chatList.systemMessage");
            } else if (msg.content === "IMAGE") {
              lastMsgMap[msg.room_id] = t("chatList.imageMessage");
            } else {
              lastMsgMap[msg.room_id] = msg.content || "";
            }
          }
        });
      }
      setLastMessageMap(lastMsgMap);

      mappedRooms.sort((a, b) => {
        if (a.unread_count > 0 && b.unread_count === 0) return -1;
        if (a.unread_count === 0 && b.unread_count > 0) return 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

      console.log("Mapped Rooms Result:", JSON.stringify(mappedRooms, null, 2));
      setRooms(mappedRooms);
    } else {
      setRooms([]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchChatRooms();
  }, [fetchChatRooms]);

  // [추가 로직] 채팅방에서 읽고 목록으로 복귀 시 unread_count 갱신
  useEffect(() => {
    const handleChatRead = () => {
      fetchChatRooms();
    };
    window.addEventListener("chat-read", handleChatRead);
    return () => {
      window.removeEventListener("chat-read", handleChatRead);
    };
  }, [fetchChatRooms]);

  // [추가 로직] 실시간 새 메시지 감지 및 UI 자동 재정렬
  useEffect(() => {
    if (!currentUserId || rooms.length === 0) return;

    const chatListChannel = supabase
      .channel("realtime:chat_list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;

          setRooms((prevRooms) => {
            // 1. 해당 방의 unread_count 증가
            const updatedRooms = prevRooms.map((room) => {
              if (room.room_id === newMsg.room_id) {
                return { ...room, unread_count: (room.unread_count || 0) + 1 };
              }
              return room;
            });

            // 2. 안 읽은 방을 최상단으로 즉시 재정렬
            return updatedRooms.sort((a, b) => {
              if (a.unread_count > 0 && b.unread_count === 0) return -1;
              if (a.unread_count === 0 && b.unread_count > 0) return 1;
              return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
              );
            });
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatListChannel);
    };
  }, [currentUserId, rooms.length]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#0020A0] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400">{t("chatList.loading")}</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl shadow-[0_32px_64px_-15px_rgba(0,15,93,0.06)]">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-black text-[#0020A0] tracking-tight">
            {t("chatList.title")}
          </h1>
        </div>
        <div className="h-px w-full bg-[#c5c5d6]/40" />
      </div>

      {errorMsg && (
        <div className="mx-4 mt-3 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-200">
          {t("chatList.dataError")}
          {errorMsg}
        </div>
      )}

      {/* 채팅방 목록 */}
      {!errorMsg && rooms.length === 0 ? (
        <div className="flex-1 flex flex-col px-6 pt-8 pb-20">
          {/* Security Notice 배너 — empty state 내부 상단 */}
          <div className="bg-[#c2c9fe]/30 rounded-lg p-5 flex items-start gap-4 mb-10">
            <div className="bg-[#0020A0] p-2 rounded-lg flex items-center justify-center flex-shrink-0">
              <span
                className="material-symbols-outlined text-white text-xl"
                style={{ fontVariationSettings: "'FILL' 1, 'wght' 400" }}
              >
                lightbulb
              </span>
            </div>
            <div className="flex flex-col">
              <p className="text-[#4c5381] text-[10px] font-bold uppercase tracking-widest mb-1">
                {t("chatList.bannerLabel")}
              </p>
              <p className="text-[#454653] text-sm leading-relaxed">
                {t("chatList.banner")}
              </p>
            </div>
          </div>

          {/* 아이콘 + 텍스트 + CTA */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative mb-8">
              {/* 배경 블러 */}
              <div className="absolute inset-0 bg-[#c2c9fe]/20 blur-3xl rounded-full scale-150" />
              {/* 아이콘 컨테이너 */}
              <div
                className="relative bg-white w-44 h-44 rounded-3xl flex items-center justify-center"
                style={{ boxShadow: "0 32px 64px -15px rgba(0, 15, 93, 0.06)" }}
              >
                <span
                  className="material-symbols-outlined text-[#0020A0]"
                  style={{
                    fontSize: "80px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  chat_bubble
                </span>
              </div>
            </div>
            <div className="text-center max-w-xs">
              <h2 className="font-black text-2xl text-[#191c1e] mb-3 tracking-tight">
                {t("chatList.noRooms")}
              </h2>
              <p className="text-[#454653] text-sm px-4 leading-relaxed">
                {t("chatList.noRoomsSub")}
              </p>
            </div>
            <button
              onClick={() => router.push("/request")}
              className="mt-10 bg-[#0020A0] hover:bg-[#001880] text-white font-bold text-xs uppercase tracking-widest px-8 py-4 rounded-lg flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-indigo-900/10"
            >
              {t("chatList.exploreServices")}
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-[#c5c5d6]/30 px-3 py-2 space-y-1">
          {rooms.map((room) => {
            const partnerName =
              room.pro_id === currentUserId
                ? room.customer_name || t("chatList.unknown")
                : room.pro_name || t("chatList.unknown");
            const partnerAvatar =
              room.pro_id === currentUserId
                ? room.customer_avatar
                : room.pro_avatar;
            const unread = room.unread_count || 0;
            const isClosed = room.status === "CLOSED";

            return (
              <li key={room.room_id}>
                <Link
                  href={`/chat/${room.room_id}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white active:bg-white/80 transition-colors duration-200"
                  style={{ boxShadow: "none" }}
                >
                  {/* 아바타 */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                      {partnerAvatar ? (
                        <img
                          src={partnerAvatar}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      )}
                    </div>
                    {/* 종료됨 오버레이 */}
                    {isClosed && (
                      <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">
                          {t("chatList.closedOverlay")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 이름 + 마지막 메시지 영역 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[15px] font-bold truncate ${isClosed ? "text-gray-300" : "text-[#1F2937]"}`}
                      >
                        {partnerName}
                        {t("chatList.proSuffix")}
                      </span>
                      {isClosed && (
                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {t("chatList.closedBadge")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {isClosed
                        ? lastMessageMap[room.room_id] ||
                          t("chatList.closedMsg")
                        : lastMessageMap[room.room_id] ||
                          (room.status === "MATCHED"
                            ? t("chatList.matched")
                            : t("chatList.startChat"))}
                    </p>
                  </div>

                  {/* 시간 + 뱃지 */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-[11px] text-gray-400">
                      {formatChatTime(room.created_at)}
                    </span>
                    {unread > 0 ? (
                      <span className="min-w-[20px] h-5 bg-[#0020A0] text-white text-[11px] font-black px-1.5 rounded-full flex items-center justify-center">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    ) : room.status === "MATCHED" ? (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        {t("chatList.matchedBadge")}
                      </span>
                    ) : !isClosed ? (
                      <span className="text-[10px] font-bold text-[#0020A0] bg-[#0020A0]/10 px-2 py-0.5 rounded-full">
                        {t("chatList.inProgress")}
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
