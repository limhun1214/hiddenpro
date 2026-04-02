"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui/Toast";
import QuoteDetailModal from "@/components/customer/QuoteDetailModal";
import { useTranslations } from "next-intl";

export const runtime = "edge";

export default function ChatRoomPage({
  params,
}: {
  params: { room_id: string };
}) {
  const t = useTranslations();
  const router = useRouter();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [customerId, setCustomerId] = useState<string>("");

  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [roomStatus, setRoomStatus] = useState<string>("OPEN");
  const [userRole, setUserRole] = useState<string>("");
  const [proId, setProId] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");

  const [proName, setProName] = useState<string>("");
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [proPhoneVerified, setProPhoneVerified] = useState(false);
  const [proFacebookUrl, setProFacebookUrl] = useState("");

  // 실제 견적 금액
  const [quotePrice, setQuotePrice] = useState<number | null>(null);

  // 견적/요청 상세 모달 상태
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [requestData, setRequestData] = useState<any>(null);

  // 신고 기능 state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState<
    "none" | "pending" | "reviewed"
  >("none");
  const [isSuspended, setIsSuspended] = useState(false);
  const [isBlockedInRoom, setIsBlockedInRoom] = useState(false);
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  // ✅ 추가: 서비스 확정 확인 모달 state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // ✅ 추가: 서비스 확정 완료 모달 state
  const [showMatchSuccessModal, setShowMatchSuccessModal] = useState(false);

  // 페이지네이션
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestMessageId, setOldestMessageId] = useState<string | null>(null);
  const isInitialLoad = React.useRef(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  // 1. 현재 사용자 세션 획득 및 초기 메시지 로드, 실시간 구독 설정
  useEffect(() => {
    let messageChannel: any;
    let statusChannel: any;
    let isMounted = true;

    const initChat = async () => {
      // [인증 기반 식별] 실제 Supabase 세션 철저 확인
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (!isMounted) return;

      if (userId) {
        setCurrentUser({ id: userId });
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("user_id", userId)
          .single();
        if (userData) {
          setUserRole(userData.role);
        }

        // 정지 상태 체크
        const { data: suspendData } = await supabase
          .from("users")
          .select("status, suspended_until")
          .eq("user_id", userId)
          .single();
        if (
          suspendData?.status === "SUSPENDED" &&
          (suspendData?.suspended_until === null ||
            new Date(suspendData.suspended_until) > new Date())
        ) {
          setIsSuspended(true);
        }

        // 이 채팅방에서 내가 신고한 내역 조회
        const { data: myReport } = await supabase
          .from("reports")
          .select("status")
          .eq("room_id", params.room_id)
          .eq("reporter_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (myReport) {
          setReportStatus(
            myReport.status === "reviewed" ? "reviewed" : "pending",
          );
        }

        // 이 채팅방에서 본인이 피신고자로 제재 처리됐는지 확인
        const { data: blockedReport } = await supabase
          .from("reports")
          .select("status")
          .eq("room_id", params.room_id)
          .eq("reported_user_id", userId)
          .eq("status", "reviewed")
          .limit(1)
          .maybeSingle();
        if (blockedReport) {
          setIsBlockedInRoom(true);
        }
      } else {
        console.warn("챗 라우트: 로그인된 사용자만 메시지를 보낼 수 있습니다.");
        // 비로그인 유저는 읽기 전용 상태가 되거나, 상위 layout에서 튕겨냄
      }

      // 방 상태 불러오기
      const { data: roomData } = await supabase
        .from("chat_rooms")
        .select("status, pro_id, customer_id, request_id")
        .eq("room_id", params.room_id)
        .single();
      if (roomData) {
        setRoomStatus(roomData.status);
        if (roomData.status === "CLOSED") setIsRoomClosed(true);
        setProId(roomData.pro_id);
        setCustomerId(roomData.customer_id);
        setRequestId(roomData.request_id);

        // 요청 데이터 조회
        const { data: requestRes } = await supabase
          .from("match_requests")
          .select("*")
          .eq("request_id", roomData.request_id)
          .single();
        if (requestRes) {
          setRequestData(requestRes);
        }

        // 고수 프로필 정보 조회 (헤더 트러스트 배지) — FK JOIN 미설정 대비 독립 쿼리
        if (roomData.pro_id) {
          const partnerId =
            userId === roomData.pro_id ? roomData.customer_id : roomData.pro_id;

          if (partnerId) {
            // 1. 상대방(Partner) 기본 이름/닉네임 조회
            const { data: partnerUserData } = await supabase
              .from("users")
              .select("name, nickname, avatar_url")
              .eq("user_id", partnerId)
              .single();

            if (partnerUserData) {
              setProName(
                partnerUserData.nickname &&
                  partnerUserData.nickname.trim() !== ""
                  ? partnerUserData.nickname
                  : partnerUserData.name || t("common.unknown"),
              );
              setPartnerAvatar(partnerUserData.avatar_url);
            }

            // 2. 상대방이 고수일 때만 트러스트 배지(전화번호, 페이스북) 활성화
            if (partnerId === roomData.pro_id) {
              const { data: proProfile } = await supabase
                .from("pro_profiles")
                .select("*")
                .eq("pro_id", partnerId)
                .single();
              if (proProfile) {
                setProPhoneVerified(proProfile.is_phone_verified === true);
                setProFacebookUrl(proProfile.facebook_url || "");
              }
            } else {
              // 상대방이 고객인 경우 배지 숨김 처리
              setProPhoneVerified(false);
              setProFacebookUrl("");
            }

            // 견적 금액 및 정보 전체 조회 (이 방의 견적 유지)
            const { data: quoteRes } = await supabase
              .from("match_quotes")
              .select("*, pro_profiles(*, users(name, nickname, avatar_url))")
              .eq("request_id", roomData.request_id)
              .eq("pro_id", roomData.pro_id)
              .single();
            if (quoteRes) {
              setQuotePrice(quoteRes.price);
              setQuoteData(quoteRes);
            }
          }
        }
      }

      // 최신 30개 메시지만 로드 (커서 기반 페이지네이션)
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", params.room_id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        console.error("초기 대화 내역 불러오기 실패:", error);
      } else if (data && isMounted) {
        // 내림차순으로 받아온 것을 오름차순으로 역정렬
        const sorted = [...data].reverse();

        const mappedMessages = sorted.map((msg) => ({
          ...msg,
          isMine: msg.sender_id === userId,
          hidden:
            msg.message_type === "SYSTEM_PRIVATE" && msg.receiver_id !== userId,
        }));

        const filtered = mappedMessages
          .filter((m) => !m.hidden)
          .map((m) => ({ ...m, id: m.message_id }));
        setMessages(filtered);

        // 커서 설정 — 가장 오래된 메시지의 created_at 저장
        if (data.length > 0) {
          setOldestMessageId(data[data.length - 1].created_at);
        }
        if (data.length < 30) {
          setHasMore(false);
        }

        // [읽음 처리] 로드 범위 무관 — 방 전체 미읽음 메시지 조건부 UPDATE
        if (userId) {
          await supabase
            .from("chat_messages")
            .update({ is_read: true })
            .eq("room_id", params.room_id)
            .neq("sender_id", userId)
            .eq("is_read", false);

          window.dispatchEvent(new Event("chat-read"));

          // 입장 시 방 관련 알림 모두 읽음 처리
          await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("user_id", userId)
            .eq("type", "CHAT")
            .eq("reference_id", params.room_id)
            .eq("is_read", false);

          window.dispatchEvent(new Event("notifications-updated"));
        }
      }

      // 1. 메시지 수신 전용 채널
      messageChannel = supabase
        .channel(`room_msgs:${params.room_id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${params.room_id}`,
          },
          (payload) => {
            const newMsg = payload.new as any;

            // ✅ 추가: 제재 특수 메시지 감지 — 기존 로직 위에 삽입
            if (newMsg.message_type === "SYSTEM_CLOSE") {
              setIsRoomClosed(true);
              return;
            }
            if (newMsg.message_type === "SYSTEM_REVIEWED") {
              if (newMsg.receiver_id === userId) {
                setIsBlockedInRoom(true); // 피신고자 입력창 차단
              } else {
                setReportStatus("reviewed"); // 신고자 처리완료 뱃지
              }
              return;
            }

            setMessages((prev) => {
              if (!newMsg.message_id) return prev;
              const isDuplicate = prev.some(
                (msg) => msg.id === newMsg.message_id,
              );
              if (isDuplicate) return prev;
              // SYSTEM_PRIVATE 메시지는 receiver_id가 본인일 때만 표시
              const isHidden =
                newMsg.message_type === "SYSTEM_PRIVATE" &&
                newMsg.receiver_id !== userId;
              if (isHidden) return prev;
              return [
                ...prev,
                {
                  ...newMsg,
                  id: newMsg.message_id,
                  isMine: newMsg.sender_id === userId,
                },
              ];
            });

            // [추가 로직] 내가 보낸 메시지가 아니면 (상대가 보낸 새 메시지를 활성 방에서 받은 거라면) 즉시 DB 읽음 처리
            if (userId && newMsg.sender_id !== userId) {
              supabase
                .from("chat_messages")
                .update({ is_read: true })
                .eq("message_id", newMsg.message_id)
                .then(() => {
                  window.dispatchEvent(new Event("chat-read")); // GNB 배지 동기화
                });
            }

            // [핵심 추가] 확정 시스템 메시지 도착 시 룸 상태 즉각 동기화 (방어 로직)
            if (
              newMsg.content &&
              newMsg.content.includes("진행하기로 확정하셨습니다")
            ) {
              setRoomStatus("MATCHED");

              // [추가] 고수가 채팅방에서 확정 메시지를 실시간으로 본 경우, 관련 매칭 성공 알림도 즉시 읽음 처리
              if (userId && roomData?.request_id) {
                supabase
                  .from("notifications")
                  .update({ is_read: true })
                  .eq("user_id", userId)
                  .eq("type", "MATCH_SUCCESS")
                  .eq("reference_id", roomData.request_id)
                  .eq("is_read", false)
                  .then(() => {
                    window.dispatchEvent(new Event("notifications-updated")); // GNB 알림 배지 즉각 소멸
                  });
              }
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${params.room_id}`,
          },
          (payload) => {
            const updatedMsg = payload.new as any;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === updatedMsg.message_id
                  ? { ...msg, is_read: updatedMsg.is_read }
                  : msg,
              ),
            );
          },
        )
        .subscribe();

      // 2. 요청서 상태 변경 실시간 감지 전용 채널 — 다른 채팅방에서 확정 시 확정 버튼 즉각 비활성화
      statusChannel = supabase
        .channel(`room_status:${params.room_id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "match_requests",
            filter: `request_id=eq.${roomData?.request_id}`,
          },
          (payload) => {
            const updatedRequest = payload.new as any;
            if (updatedRequest) {
              setRequestData((prev: any) => ({ ...prev, ...updatedRequest }));
            }
          },
        )
        .subscribe();
    };

    initChat();

    return () => {
      isMounted = false;
      if (messageChannel) supabase.removeChannel(messageChannel);
      if (statusChannel) supabase.removeChannel(statusChannel);
    };
  }, [params.room_id]);

  const loadMoreMessages = async () => {
    if (!oldestMessageId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    const container = messageContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("room_id", params.room_id)
      .lt("created_at", oldestMessageId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) {
      const sorted = [...data].reverse();
      const mappedMessages = sorted
        .map((msg) => ({
          ...msg,
          id: msg.message_id,
          isMine: msg.sender_id === currentUser?.id,
          hidden:
            msg.message_type === "SYSTEM_PRIVATE" &&
            msg.receiver_id !== currentUser?.id,
        }))
        .filter((m) => !m.hidden);

      setMessages((prev) => [...mappedMessages, ...prev]);

      if (data.length > 0) {
        setOldestMessageId(data[data.length - 1].created_at);
      }
      if (data.length < 30) {
        setHasMore(false);
      }

      // 스크롤 위치 유지 — 과거 메시지 로드 후 기존 위치 복원
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - prevScrollHeight;
        }
      });
    }

    setIsLoadingMore(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSuspended || isBlockedInRoom || isRoomClosed) {
      showToast(
        isSuspended
          ? t("chatRoom.suspendedToast")
          : isRoomClosed
            ? t("chatRoom.roomClosedToast")
            : t("chatRoom.blockedToast"),
        "error",
        true,
      );
      return;
    }
    if (!newMessage.trim() || !currentUser?.id) return;

    const currentMsg = newMessage;
    setNewMessage(""); // UI 입력창 즉시 비우기

    // 선제적 고유 ID(client_message_id) 발급
    // DB 테이블 설계 상 message_id 컬럼을 UUID PRIMARY KEY로 사용하므로 이에 맞춰 생성
    const clientMessageId = crypto.randomUUID
      ? crypto.randomUUID()
      : Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

    // 낙관적 UI(Optimistic UI) 업데이트: 서버 응답을 기다리지 않고 화면에 즉시 렌더링
    const optimisticMsg = {
      id: clientMessageId, // 로컬 UI 매핑용 id
      message_id: clientMessageId, // DB 컬럼 대응
      room_id: params.room_id,
      sender_id: currentUser.id,
      message_type: "TEXT",
      content: currentMsg,
      created_at: new Date().toISOString(),
      isMine: true,
      is_read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const recipientId = userRole === "PRO" ? customerId : proId;

    // 실제 메시지 DB INSERT 시 선제 발급한 clientMessageId를 기본키에 명시적 삽입
    const { error } = await supabase.from("chat_messages").insert({
      message_id: clientMessageId, // 클라이언트가 발급한 ID 고정 주입
      room_id: params.room_id,
      sender_id: currentUser.id,
      receiver_id: recipientId,
      message_type: "TEXT",
      content: currentMsg,
    });

    if (error) {
      console.error("메시지 전송 실패:", error);
      alert(t("chatRoom.sendError") + error.message);
      // 실패 시 로컬에서 미리 그려둔 메시지만 제거 (롤백 복원)
      setMessages((prev) => prev.filter((msg) => msg.id !== clientMessageId));
    } else {
      // [기획 핵심] 메시지 전송 성공 시 상대방에게 알림 전송
      if (recipientId) {
        await supabase.from("notifications").insert({
          user_id: recipientId,
          sender_id: currentUser.id,
          type: "CHAT",
          message: "You have a new chat message.",
          reference_id: params.room_id,
          is_read: false,
        });
      }
    }
  };

  const handleMatchConfirm = async () => {
    try {
      // confirm_match_and_close_others:
      // 1) match_requests MATCHED
      // 2) 낙찰 견적 ACCEPTED
      // 3) 현재 채팅방 MATCHED
      // 4) 나머지 견적 REJECTED
      // 5) 나머지 채팅방 CLOSED (고아 방 원천 차단)
      // 6) 고수 MATCH_SUCCESS 알림 발송
      // 7) 시스템 채팅 메시지 발송
      // — 위 7단계가 DB 단 단일 트랜잭션으로 원자적 처리됨
      const { data, error } = await supabase.rpc(
        "confirm_match_and_close_others",
        {
          p_room_id: params.room_id,
          p_customer_id: currentUser?.id,
        },
      );

      if (error) throw error;

      // RPC는 RAISE EXCEPTION 방식으로 에러를 반환하므로
      // error가 없으면 성공으로 간주
      setRoomStatus("MATCHED");
      setShowMatchSuccessModal(true);
    } catch (error: any) {
      console.error("매칭 확정 에러:", error);
      alert(t("chatRoom.matchError") + error.message);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportReason.trim() || !currentUser?.id) return;
    setReportSubmitting(true);
    const reportedId = userRole === "PRO" ? customerId : proId;
    const { error } = await supabase.from("reports").insert({
      room_id: params.room_id,
      reporter_id: currentUser.id,
      reported_user_id: reportedId,
      reason: reportReason.trim(),
      status: "pending",
    });
    setReportSubmitting(false);
    if (error) {
      showToast(t("chatRoom.reportError"), "error");
    } else {
      setShowReportModal(false);
      setReportReason("");
      setReportStatus("pending");
      showToast(t("chatRoom.reportSuccess"), "success", true);
    }
  };

  const messageContainerRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const container = messageContainerRef.current;
    if (!container) return;

    // 최초 로드 시 무조건 최하단
    if (isInitialLoad.current) {
      container.scrollTop = container.scrollHeight;
      isInitialLoad.current = false;
      return;
    }

    const lastMsg = messages[messages.length - 1];
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      300;

    if (lastMsg?.isMine) {
      // 내가 보낸 메시지: 항상 최하단
      container.scrollTop = container.scrollHeight;
      setHasNewMessage(false);
    } else if (isNearBottom) {
      // 상대 메시지 + 하단 300px 이내: 자동 스크롤
      container.scrollTop = container.scrollHeight;
      setHasNewMessage(false);
    } else {
      // 상대 메시지 + 스크롤 올라간 상태: 배지 표시
      setHasNewMessage(true);
    }
  }, [messages]);

  const renderMessageWithLinks = (text: string, isMine: boolean) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (!text) return "";
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all transition-colors ${isMine ? "text-white font-bold hover:text-blue-200" : "text-blue-600 font-bold hover:text-blue-800"}`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative w-full flex flex-col h-[calc(100dvh-72px)] lg:h-[calc(100dvh-56px)] lg:max-w-3xl lg:mx-auto bg-white overflow-hidden">
      {/* ▶ 상단 고정 헤더 (절대로 스크롤에 밀리지 않음) */}
      <header className="flex-none bg-white border-b border-gray-100 px-4 pt-3 pb-2 shadow-sm z-50">
        {/* 1행: 뒤로가기 + 아바타 + 이름/배지 + 우측 액션 버튼 */}
        <div className="flex items-center">
          <button
            onClick={() => router.back()}
            className="p-2 mr-2 text-gray-500 hover:bg-gray-100 rounded-full transition flex-shrink-0"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* 아바타 */}
          <div className="flex-shrink-0 mr-3">
            {partnerAvatar ? (
              <img
                src={partnerAvatar}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 border border-gray-200 shadow-sm">
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>

          {/* 이름 + 배지 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base font-bold text-gray-800 truncate">
                {proName
                  ? `${proName}${t("chatRoom.proSuffix")}`
                  : t("chatRoom.defaultRoom")}
              </h1>
              {proPhoneVerified && (
                <span className="inline-flex items-center text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap flex-shrink-0">
                  {t("chatRoom.phoneVerified")}
                </span>
              )}
              {proFacebookUrl && (
                <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap flex-shrink-0">
                  {t("chatRoom.facebookLinked")}
                </span>
              )}
            </div>
          </div>

          {/* 우측 액션 버튼 묶음 */}
          <div className="flex items-center gap-[6px] flex-shrink-0 ml-2">
            <button
              onClick={() => setIsQuoteModalOpen(true)}
              className="w-8 h-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center transition shadow-sm"
              title={t("chatRoom.quoteDetailBtn")}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "15px" }}
              >
                description
              </span>
            </button>
            {reportStatus === "none" && (
              <button
                onClick={() => setShowReportModal(true)}
                className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 hover:bg-red-100 flex items-center justify-center transition"
                title={t("chatRoom.reportBtn")}
              >
                <span
                  className="material-symbols-outlined text-red-400"
                  style={{ fontSize: "15px" }}
                >
                  priority_high
                </span>
              </button>
            )}
            {reportStatus === "pending" && (
              <span className="text-[11px] text-yellow-500 border border-yellow-300 px-2.5 py-1 rounded-lg">
                {t("chatRoom.reportPending")}
              </span>
            )}
            {reportStatus === "reviewed" && (
              <span className="text-[11px] text-green-500 border border-green-300 px-2.5 py-1 rounded-lg">
                {t("chatRoom.reportReviewed")}
              </span>
            )}
          </div>
        </div>

        {/* 2행: 견적 금액(좌) + 상태 버튼/배지(우) */}
        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-100">
          <div>
            <span className="text-[10px] text-gray-400 block leading-none mb-0.5">
              {t("chatRoom.proposedQuote")}
            </span>
            <span className="text-sm font-bold text-blue-600">
              {quotePrice !== null
                ? `${quotePrice.toLocaleString()}`
                : t("chatRoom.noPrice")}
            </span>
          </div>
          {roomStatus === "MATCHED" || requestData?.status === "MATCHED" ? (
            <span className="bg-green-100 text-green-700 text-xs font-bold py-1 px-2.5 rounded-lg">
              {roomStatus === "MATCHED"
                ? t("chatRoom.matchConfirmed")
                : t("chatRoom.matchedOther")}
            </span>
          ) : userRole === "CUSTOMER" ? (
            <button
              onClick={() => setShowConfirmModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm transition"
            >
              {t("chatRoom.confirmBtn")}
            </button>
          ) : (
            <span className="bg-gray-100 text-gray-500 text-xs font-bold py-1 px-2.5 rounded-lg border border-gray-200">
              {t("chatRoom.waitingConfirm")}
            </span>
          )}
        </div>
      </header>

      {/* 새 메시지 알림 배지 */}
      {hasNewMessage && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => {
              const container = messageContainerRef.current;
              if (container) container.scrollTop = container.scrollHeight;
              setHasNewMessage(false);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg transition flex items-center gap-1.5"
          >
            {t("chatRoom.newMessage")}
          </button>
        </div>
      )}

      {/* ▶ 중앙 채팅 메시지 영역 (이 영역만 독립 스크롤) */}
      <div
        ref={messageContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
        onScroll={(e) => {
          const el = e.currentTarget;
          // 최상단 50px 이내 진입 시 과거 메시지 추가 로드
          if (el.scrollTop < 50 && hasMore && !isLoadingMore) {
            loadMoreMessages();
          }
        }}
      >
        {/* 과거 메시지 로딩 인디케이터 */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400">
              {t("chatRoom.loadingMore")}
            </span>
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-300">
              {t("chatRoom.startOfChat")}
            </span>
          </div>
        )}
        {isRoomClosed && (
          <div className="flex justify-center my-4">
            <div className="bg-gray-700/50 border border-gray-500/30 text-gray-400 text-xs px-4 py-2 rounded-xl text-center">
              {t("chatRoom.roomClosed")}
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-300">
            <svg
              className="w-16 h-16 mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm">{t("chatRoom.emptyChat1")}</p>
            <p className="text-sm">{t("chatRoom.emptyChat2")}</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // 날짜 구분선 렌더링 조건 계산 (한국어 형식: YYYY년 M월 D일 dddd)
            const currentDateStr = new Date(msg.created_at).toLocaleDateString(
              "en-US",
              {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              },
            );
            let showDateDivider = false;

            if (index === 0) {
              showDateDivider = true;
            } else {
              const prevDateStr = new Date(
                messages[index - 1].created_at,
              ).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              });
              if (currentDateStr !== prevDateStr) showDateDivider = true;
            }

            return (
              <div key={msg.id} className="flex flex-col">
                {/* 날짜 구분선 배지 */}
                {showDateDivider && (
                  <div className="flex justify-center my-5">
                    <span className="bg-slate-400/20 text-slate-500 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                      {currentDateStr}
                    </span>
                  </div>
                )}

                {msg.message_type === "SYSTEM_PRIVATE" ||
                msg.message_type === "SYSTEM" ? (
                  <div className="flex justify-center my-3">
                    <div className="bg-red-500/10 border border-red-300/30 text-red-400 text-xs font-medium px-4 py-2 rounded-xl max-w-[85%] text-center whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex ${msg.isMine ? "justify-end" : "justify-start"} mb-2`}
                  >
                    {!msg.isMine && (
                      <div className="flex-shrink-0 mr-3 mt-1">
                        {partnerAvatar ? (
                          <img
                            src={partnerAvatar}
                            alt="Profile"
                            className="w-9 h-9 rounded-full object-cover border border-gray-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shadow-sm">
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      className={`flex flex-col ${msg.isMine ? "items-end" : "items-start"} max-w-[75%]`}
                    >
                      {!msg.isMine && (
                        <span className="text-xs text-gray-600 mb-1 ml-1 font-bold">
                          {proName}
                        </span>
                      )}

                      <div
                        className={`rounded-2xl px-4 py-2 shadow-sm ${msg.isMine ? "bg-blue-600 text-white rounded-tr-none" : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"}`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {renderMessageWithLinks(msg.content, msg.isMine)}
                        </p>
                      </div>

                      {/* 기존의 시간 및 읽음 표시 렌더링 영역 유지 */}
                      <span
                        className={`text-[10px] flex items-center gap-1 mt-1 ${msg.isMine ? "text-gray-400 justify-end" : "text-gray-400 justify-start"}`}
                      >
                        {msg.isMine && !msg.is_read && (
                          <span className="text-yellow-500 font-bold">1</span>
                        )}
                        {new Date(msg.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ▶ 하단 고정 입력창 (스크롤 독립) */}
      <div className="flex-none bg-white border-t border-gray-100 p-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              isSuspended
                ? t("chatRoom.suspendedPlaceholder")
                : isRoomClosed
                  ? t("chatRoom.roomClosedPlaceholder")
                  : isBlockedInRoom
                    ? t("chatRoom.blockedPlaceholder")
                    : t("chatRoom.messagePlaceholder")
            }
            disabled={isSuspended || isBlockedInRoom || isRoomClosed}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={
              !newMessage.trim() ||
              isSuspended ||
              isBlockedInRoom ||
              isRoomClosed
            }
            className="bg-blue-600 text-white rounded-full p-2 h-10 w-10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
          >
            <svg
              className="w-5 h-5 ml-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>

      {/* 견적 상세 모달 렌더링 */}
      {isQuoteModalOpen && quoteData && requestData && (
        <QuoteDetailModal
          quote={quoteData}
          request={requestData}
          requestId={requestData.request_id}
          isReadOnly={true}
          onClose={() => setIsQuoteModalOpen(false)}
          onStartChat={() => {}}
        />
      )}

      {/* 신고 모달 */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {t("chatRoom.reportTitle")}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {t("chatRoom.reportDesc")}
            </p>
            <div className="bg-yellow-500/10 border border-yellow-400/30 text-yellow-400 text-xs px-3 py-2 rounded-lg mb-3">
              {t("chatRoom.reportWarning")}
            </div>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t("chatRoom.reportPlaceholder")}
              className="w-full border border-gray-200 rounded-xl p-3 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
                className="flex-1 border border-gray-200 text-gray-600 font-bold py-2 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                {t("chatRoom.reportCancel")}
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={reportSubmitting || !reportReason.trim()}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50 transition"
              >
                {reportSubmitting
                  ? t("chatRoom.reportSubmitting")
                  : t("chatRoom.reportSubmitBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 정지 유저 팝업 — isSuspended true 시 전체 화면 차단 */}
      {isSuspended && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-500 text-3xl">🚫</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("chatRoom.suspendedTitle")}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {t("chatRoom.suspendedDesc")}
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl text-sm hover:bg-black transition"
            >
              {t("chatRoom.suspendedBtn")}
            </button>
          </div>
        </div>
      )}
      {/* 서비스 확정 확인 모달 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🎉</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
              {t("chatRoom.confirmModalTitle")}
            </h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              {t("chatRoom.confirmModalDesc")}
            </p>
            <p className="text-xs text-red-400 text-center mb-6">
              {t("chatRoom.confirmModalWarn")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-bold py-3 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                {t("chatRoom.confirmCancel")}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  handleMatchConfirm();
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
              >
                {t("chatRoom.confirmBtn2")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 서비스 확정 완료 모달 */}
      {showMatchSuccessModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🎉</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {t("chatRoom.successTitle")}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {t("chatRoom.successDesc")}
            </p>
            <button
              onClick={() => {
                setShowMatchSuccessModal(false);
                router.push("/quotes/received?tab=CLOSED");
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition shadow-sm"
            >
              {t("chatRoom.successBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
