"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import BadgeCleaner from "@/components/BadgeCleaner";
import ProProfileDetailModal from "@/components/customer/ProProfileDetailModal";
import QuoteDetailModal from "@/components/customer/QuoteDetailModal";
import { useTranslations } from "next-intl";

export default function CustomerQuotesClient() {
  const t = useTranslations();
  const locale =
    typeof document !== "undefined"
      ? (document.cookie
          .split("; ")
          .find((r) => r.startsWith("locale="))
          ?.split("=")[1] ?? "en")
      : "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"IN_PROGRESS" | "CLOSED">(
    searchParams?.get("tab") === "CLOSED" ? "CLOSED" : "IN_PROGRESS",
  );
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [reviewedRoomIds, setReviewedRoomIds] = useState<Set<string>>(
    new Set(),
  );
  const [quoteRoomMap, setQuoteRoomMap] = useState<Record<string, string>>({});

  // 고수 프로필 상세 모달 상태
  const [profileModal, setProfileModal] = useState<{
    proId: string;
    requestId: string;
    isCompleted?: boolean;
  } | null>(null);

  // 견적 상세 모달 상태
  const [quoteDetailModal, setQuoteDetailModal] = useState<{
    quote: any;
    requestId: string;
    request?: any;
  } | null>(null);

  // URL 파라미터 기반 모달 오픈을 1회로 제한하는 플래그 (새로고침 시 자동 팝업 방지)
  const [initialParamConsumed, setInitialParamConsumed] = useState(false);

  // 리뷰 모달 상태
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  // ── [확장] 내 요청서 보기 모달 ──
  const [viewRequestModal, setViewRequestModal] = useState<{
    request: any;
  } | null>(null);
  // ── [확장] 요청 취소 확인 모달 ──
  const [cancelConfirmModal, setCancelConfirmModal] = useState<{
    request: any;
  } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleGnbReset = () => setActiveTab("IN_PROGRESS");
    window.addEventListener("gnb-tab-reset", handleGnbReset);
    return () => window.removeEventListener("gnb-tab-reset", handleGnbReset);
  }, []);

  useEffect(() => {
    const fetchRequests = async () => {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      const sessionUser = authData?.user;

      if (authError || !sessionUser) {
        router.replace("/");
        return;
      }

      const customerId = sessionUser.id;
      setCustomerId(sessionUser.id);

      // 1. 내가(고수 권한으로) 견적을 보낸/매칭된 request_id 목록 조회
      const { data: myQuotes } = await supabase
        .from("match_quotes")
        .select("request_id")
        .eq("pro_id", customerId);

      const proRequestIds = myQuotes?.map((q) => q.request_id) || [];

      let query = supabase
        .from("match_requests")
        .select(
          `
                    request_id, status, dynamic_answers, customer_id, quote_count, created_at, updated_at,
                    service_type, region, category_id,
                    categories ( name, name_en ),
                    match_quotes (
                        quote_id, pro_id, created_at, status, price, description, image_url, is_read,
                        pro_profiles (pro_id, average_rating, review_count, is_phone_verified, facebook_url, intro, detailed_intro, users (name, nickname, avatar_url))
                    )
                `,
        )
        // ── [핫픽스] 취소된 요청을 리패치에서 원천 차단 ──
        .not("status", "eq", "CANCELED")
        // ── [확장] DB 레벨 55일 버퍼 필터 (7일 숨김 + 여유 버퍼) — 불필요한 데이터 전송 차단 ──
        .gte(
          "created_at",
          new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
        );

      if (proRequestIds.length > 0) {
        // 고수로서 견적을 보낸 요청 OR 고객으로서 본인이 작성한 요청
        query = query.or(
          `customer_id.eq.${customerId},request_id.in.(${proRequestIds.join(",")})`,
        );
      } else {
        query = query.eq("customer_id", customerId);
      }

      const { data: customerRequests, error } = await query.order(
        "created_at",
        { ascending: false },
      );

      if (error) {
        console.error("요청서 패칭 에러:", error);
        setErrorMsg(error.message);
      } else if (customerRequests) {
        setRequests(customerRequests);
      }

      // 채팅방 매핑 조회: (request_id + pro_id) → room_id
      const { data: rooms } = await supabase
        .from("chat_rooms")
        .select("room_id, request_id, pro_id")
        .eq("customer_id", customerId);
      const roomMap: Record<string, string> = {};
      if (rooms) {
        rooms.forEach((r) => {
          roomMap[`${r.request_id} | ${r.pro_id}`] = r.room_id;
        });
        setQuoteRoomMap(roomMap);
      }

      // 이미 작성한 리뷰의 room_id 목록 조회 (개별 매칭 건 기준)
      const { data: myReviews } = await supabase
        .from("reviews")
        .select("room_id")
        .eq("customer_id", customerId);
      if (myReviews) {
        setReviewedRoomIds(new Set(myReviews.map((r) => r.room_id)));
      }

      setLoading(false);
    };

    fetchRequests();
  }, [refreshTrigger]);

  useEffect(() => {
    const channel = supabase
      .channel("match_quotes_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_quotes" },
        (payload) => {
          console.log("새로운 견적이 도착했습니다!", payload);
          setRefreshTrigger((prev) => prev + 1);
        },
      )
      // ── [확장] 요청 상태 변경(MATCHED) 실시간 감지 — 전체 리패치 대신 부분 state 업데이트 ──
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_requests" },
        (payload) => {
          const updated = payload.new as any;
          if (!updated?.request_id) return;
          // 전체 리패치 대신 해당 request만 부분 업데이트 (is_read 낙관적 UI 보호)
          setRequests((prev) =>
            prev.map((r) =>
              r.request_id === updated.request_id
                ? {
                    ...r,
                    status: updated.status,
                    quote_count: updated.quote_count,
                  }
                : r,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleMarkAsRead = async (quoteId: string, requestId: string) => {
    // 롤백을 위한 이전 상태 백업
    const previousRequests = [...requests];

    // 1. 낙관적 UI 업데이트 (즉시 로컬 state만 변경 — 이벤트는 RPC 완료 후 발송)
    setRequests((prev) =>
      prev.map((req) => ({
        ...req,
        match_quotes: req.match_quotes?.map((q: any) =>
          q.quote_id === quoteId ? { ...q, is_read: true } : q,
        ),
      })),
    );

    // DB 업데이트 (RPC 호출)
    const { data, error } = await supabase.rpc("mark_quote_as_read", {
      p_quote_id: quoteId,
    });

    // 네트워크 에러이거나, 실제 업데이트된 행이 0개(false)일 경우 롤백
    if (error || data !== true) {
      console.error(
        "견적 읽음 DB 반영 실패 (타입 불일치 또는 데이터 없음):",
        error || "Updated rows: 0",
      );
      setRequests(previousRequests);
    } else {
      // ✅ RPC 성공 후에만 GNB 배지 소멸 이벤트 발송 (타이밍 보장)
      window.dispatchEvent(new Event("quotes-read"));
      window.dispatchEvent(new Event("notifications-updated"));
      if (customerId) {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", customerId)
          .eq("type", "QUOTE")
          .eq("is_read", false);
      }
    }
  };

  useEffect(() => {
    // 이미 소비된 파라미터면 무시 (새로고침 시 모달 자동 오픈 방지)
    if (initialParamConsumed) return;

    const targetRequestId = searchParams?.get("requestId");
    if (targetRequestId && requests.length > 0) {
      const targetReq = requests.find((r) => r.request_id === targetRequestId);
      if (targetReq && targetReq.match_quotes?.length > 0) {
        // 안 읽은 견적을 우선적으로 찾고, 없으면 첫 번째 견적을 선택
        const targetQuote =
          targetReq.match_quotes.find((q: any) => !q.is_read) ||
          targetReq.match_quotes[0];

        // 모달 오픈 및 읽음 처리 상태 연동
        setQuoteDetailModal({
          quote: targetQuote,
          requestId: targetRequestId,
          request: targetReq,
        });
        if (!targetQuote.is_read) {
          handleMarkAsRead(targetQuote.quote_id, targetRequestId);
        }
      }
      // 파라미터 소비 완료: URL에서 requestId 제거하여 새로고침 시 재오픈 방지
      setInitialParamConsumed(true);
      router.replace("/quotes/received", { scroll: false });
    }
  }, [searchParams, requests, initialParamConsumed]); // requests가 로드되거나 파라미터가 바뀔 때 실행

  const handleStartChat = async (quote: any) => {
    try {
      // State에 저장된 customerId 사용
      if (!customerId) throw new Error(t("customerQuotes.customerIdError"));

      const { data: existingRoom, error: fetchError } = await supabase
        .from("chat_rooms")
        .select("room_id")
        .eq("request_id", quote.request_id)
        .eq("customer_id", customerId) // currentCustomerId -> customerId로 변경
        .eq("pro_id", quote.pro_id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingRoom) {
        router.push(`/chat/${existingRoom.room_id}`);
        return;
      }

      const { data: room, error: roomError } = await supabase
        .from("chat_rooms")
        .insert({
          request_id: quote.request_id,
          customer_id: customerId, // currentCustomerId -> customerId로 변경
          pro_id: quote.pro_id,
          status: "OPEN",
        })
        .select("room_id")
        .single();

      if (roomError) throw roomError;

      router.push(`/chat/${room.room_id}`);
    } catch (error: any) {
      console.error("채팅방 입장 에러:", error);
      alert(t("customerQuotes.chatError") + error.message);
    }
  };

  const openReviewModal = async (quote: any, request_id: string) => {
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("room_id")
      .eq("request_id", request_id)
      .eq("pro_id", quote.pro_id)
      .single();
    if (!room) return alert(t("customerQuotes.reviewRoomError"));

    setReviewTarget({
      request_id,
      pro_id: quote.pro_id,
      room_id: room.room_id,
    });
    setReviewRating(5);
    setReviewComment("");
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!reviewTarget) return;
    if (!reviewComment.trim()) return alert(t("customerQuotes.reviewEmpty"));

    const { data: authData } = await supabase.auth.getUser();

    const { error } = await supabase.from("reviews").insert({
      room_id: reviewTarget.room_id,
      pro_id: reviewTarget.pro_id,
      customer_id: authData?.user?.id,
      rating: reviewRating,
      comment: reviewComment,
    });

    if (error) {
      if (error.code === "23505") {
        alert(t("customerQuotes.reviewDuplicate"));
      } else {
        alert(t("customerQuotes.reviewSubmitError") + error.message);
      }
    } else {
      await supabase.from("notifications").insert({
        user_id: reviewTarget.pro_id,
        sender_id: authData?.user?.id,
        type: "SYSTEM",
        reference_id: reviewTarget.request_id,
        message: `고객님이 ⭐${reviewRating}점의 리뷰를 남겼습니다.`,
      });

      alert(t("customerQuotes.reviewSubmitSuccess"));
      setIsReviewModalOpen(false);
      setReviewedRoomIds((prev) => new Set(prev).add(reviewTarget.room_id));
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  // ── [v2] 요청 취소 핸들러 (RPC 기반 단일 트랜잭션 + True Optimistic UI) ──
  const handleCancelRequest = async (request: any) => {
    setCancelLoading(true);

    // ── True Optimistic UI: 서버 응답 전에 즉시 UI 반영 ──
    const prevRequests = requests; // 롤백용 스냅샷
    setRequests((prev) =>
      prev.filter((r) => r.request_id !== request.request_id),
    );
    setCancelConfirmModal(null);

    // 취소되는 요청의 미읽음 견적 수를 로컬에서 사전 계산
    const canceledUnreadCount = (request.match_quotes || []).filter(
      (q: any) => !q.is_read,
    ).length;

    // 나머지 요청들의 미읽음 견적 수 (현재 requests에서 취소 대상을 제외)
    const remainingUnread = prevRequests
      .filter((r) => r.request_id !== request.request_id)
      .reduce((sum: number, r: any) => {
        return (
          sum + (r.match_quotes || []).filter((q: any) => !q.is_read).length
        );
      }, 0);

    // ── Optimistic GNB 배지 즉시 반영 (DB 조회 없음) ──
    window.dispatchEvent(
      new CustomEvent("gnb-badge-sync", {
        detail: { hasNewQuotes: remainingUnread > 0 },
      }),
    );

    try {
      // ── 단일 RPC 호출: 취소 + 종속 알림 무효화 + 잔여 카운트 반환 ──
      const { data, error } = await supabase.rpc(
        "cancel_request_and_invalidate",
        {
          p_request_id: request.request_id,
          p_customer_id: customerId,
        },
      );

      if (error) throw error;

      // ── 서버 확정 카운트로 GNB 최종 보정 (Reconciliation) ──
      if (data) {
        window.dispatchEvent(
          new CustomEvent("gnb-badge-sync", {
            detail: {
              hasNewQuotes: (data.remaining_unread_quotes || 0) > 0,
              unreadNotifsCount: data.remaining_unread_notifs || 0,
            },
          }),
        );
      }

      // ── Supabase Broadcast: 고수 화면 실시간 동기화 (기존 유지) ──
      const broadcastChannel = supabase.channel("request-status-sync");
      broadcastChannel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          broadcastChannel
            .send({
              type: "broadcast",
              event: "request-canceled",
              payload: { request_id: request.request_id },
            })
            .then(() => {
              supabase.removeChannel(broadcastChannel);
            });
        }
      });
      alert(t("customerQuotes.cancelSuccess"));
    } catch (err: any) {
      // ── 실패 시 Optimistic UI 롤백 ──
      setRequests(prevRequests);
      window.dispatchEvent(
        new CustomEvent("gnb-badge-sync", {
          detail: {
            hasNewQuotes: canceledUnreadCount > 0 || remainingUnread > 0,
          },
        }),
      );
      console.error("요청 취소 실패:", err);
      alert(t("customerQuotes.cancelError") + err.message);
    } finally {
      setCancelLoading(false);
    }
  };
  /* ── [원본 백업: handleCancelRequest v1] 롤백 시 위 함수를 삭제하고 아래 주석을 해제 ──
    const handleCancelRequest = async (request: any) => {
        setCancelLoading(true);
        try {
            const { error } = await supabase
                .from('match_requests')
                .update({ status: 'CANCELED' })
                .eq('request_id', request.request_id)
                .eq('customer_id', customerId);
            if (error) throw error;
            setRequests(prev => prev.filter(r => r.request_id !== request.request_id));
            setCancelConfirmModal(null);
            window.dispatchEvent(new Event('notifications-updated'));
            window.dispatchEvent(new Event('requests-read'));
            window.dispatchEvent(new Event('quotes-read'));
            const broadcastChannel = supabase.channel('request-status-sync');
            broadcastChannel.subscribe((status: string) => {
                if (status === 'SUBSCRIBED') {
                    broadcastChannel.send({ type: 'broadcast', event: 'request-canceled', payload: { request_id: request.request_id } })
                    .then(() => { supabase.removeChannel(broadcastChannel); });
                }
            });
            alert('요청이 취소되었습니다.');
        } catch (err: any) {
            console.error('요청 취소 실패:', err);
            alert('요청 취소 중 오류가 발생했습니다: ' + err.message);
        } finally { setCancelLoading(false); }
    };
    ── 원본 백업 끝 ── */

  if (loading)
    return (
      <div className="p-4 text-center mt-20 text-[#aea9b2] bg-[#0f0d13] min-h-screen">
        {t("customerQuotes.loading")}
      </div>
    );

  const categorizeRequest = (req: any) => {
    const isCanceled = req?.status === "CANCELED";
    const isExpired = req?.created_at
      ? new Date(req.created_at).getTime() + 48 * 60 * 60 * 1000 <= currentTime
      : false;

    // MATCHED: 리뷰 작성 완료 또는 확정 후 30일 경과 시 CLOSED, 그 전까지는 IN_PROGRESS 유지
    const isMatched = req?.status === "MATCHED";
    if (isMatched) {
      // ACCEPTED 고수 견적의 room_id 조회
      const acceptedQuote = (req.match_quotes || []).find(
        (q: any) => q.status === "ACCEPTED",
      );
      const roomKey = acceptedQuote
        ? `${req.request_id} | ${acceptedQuote.pro_id}`
        : null;
      const roomId = roomKey ? quoteRoomMap[roomKey] : null;

      // 리뷰 작성 완료 여부
      const isReviewed = roomId ? reviewedRoomIds.has(roomId) : false;

      // 확정 후 30일 경과 여부 (updated_at 기준, 없을 시 created_at 폴백)
      const matchedAt = req?.updated_at
        ? new Date(req.updated_at).getTime()
        : new Date(req.created_at).getTime();
      const is30DaysOver = currentTime - matchedAt > 30 * 24 * 60 * 60 * 1000;

      return isReviewed || is30DaysOver ? "CLOSED" : "IN_PROGRESS";
    }

    return isCanceled || isExpired ? "CLOSED" : "IN_PROGRESS";
  };

  const displayRequests = requests
    .filter((r) => {
      const status = categorizeRequest(r);
      if (status !== activeTab) return false;
      if (activeTab === "CLOSED") {
        // ── [확장] 7일 숨김 기준: updated_at 우선, 없을 시 created_at 폴백 (DB 레벨 이중 방어) ──
        const baseTime = r.updated_at
          ? new Date(r.updated_at).getTime()
          : new Date(r.created_at).getTime();
        if (currentTime - baseTime > 7 * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // ── 동적 정렬: 견적 도착 여부 우선, 그 안에서 미읽음 우선 ──
      const aHasUnread =
        Array.isArray(a.match_quotes) &&
        a.match_quotes.some((q: any) => !q.is_read);
      const bHasUnread =
        Array.isArray(b.match_quotes) &&
        b.match_quotes.some((q: any) => !q.is_read);
      const aHasQuotes = (a.quote_count || 0) > 0;
      const bHasQuotes = (b.quote_count || 0) > 0;

      // 1순위: 미읽음 견적 보유 여부 (미읽음이 위로)
      if (aHasUnread && !bHasUnread) return -1;
      if (!aHasUnread && bHasUnread) return 1;

      // 2순위: 견적 도착 여부 (견적 1건 이상이 위로)
      if (aHasQuotes && !bHasQuotes) return -1;
      if (!aHasQuotes && bHasQuotes) return 1;

      // 3순위 (동일 상태): 요청 생성 시간 내림차순 (최신 우선)
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  return (
    <div
      className="flex flex-col flex-1 min-h-0 w-full overflow-y-auto bg-[#0f0d13] p-4 lg:p-10 space-y-4 lg:px-8 lg:py-8"
      style={{
        background:
          "radial-gradient(circle at top right, #1a171e 0%, #0f0d13 100%)",
      }}
    >
      <BadgeCleaner type="quotes-read" />
      <div className="lg:text-left lg:mb-8">
        <h1 className="text-2xl lg:text-2xl font-['Plus_Jakarta_Sans'] font-bold tracking-tight bg-[#0f0d13]/90 backdrop-blur-sm p-4 rounded-xl border border-[#4a474e]/30 flex items-center justify-between sticky top-0 z-10 text-center lg:text-left text-[#ff88b5]">
          {t("customerQuotes.pageTitle")}
        </h1>
      </div>

      <div className="flex p-1 bg-[#1b1820] rounded-lg max-w-md mx-auto relative overflow-hidden border border-[#4a474e]/20 w-full">
        <button
          onClick={() => setActiveTab("IN_PROGRESS")}
          className={`flex-1 py-3 text-sm font-['Plus_Jakarta_Sans'] font-bold relative z-10 transition-all duration-300 ${activeTab === "IN_PROGRESS" ? "text-[#ff88b5]" : "text-[#aea9b2]/60 hover:text-[#aea9b2]"}`}
        >
          {t("customerQuotes.tabInProgress")}
          {activeTab === "IN_PROGRESS" && (
            <div
              className="absolute inset-x-2 bottom-1 h-0.5 bg-[#ff88b5] rounded-full"
              style={{ boxShadow: "0 0 8px rgba(255,136,181,0.6)" }}
            ></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab("CLOSED")}
          className={`flex-1 py-3 text-sm font-['Plus_Jakarta_Sans'] font-bold relative z-10 transition-all duration-300 ${activeTab === "CLOSED" ? "text-[#ff88b5]" : "text-[#aea9b2]/60 hover:text-[#aea9b2]"}`}
        >
          {t("customerQuotes.tabClosed")}
          {activeTab === "CLOSED" && (
            <div
              className="absolute inset-x-2 bottom-1 h-0.5 bg-[#ff88b5] rounded-full"
              style={{ boxShadow: "0 0 8px rgba(255,136,181,0.6)" }}
            ></div>
          )}
        </button>
      </div>

      {activeTab === "CLOSED" && (
        <div className="bg-[#1b1820] border border-[#4a474e]/30 text-[#aea9b2] text-sm font-medium p-4 rounded-xl leading-relaxed">
          {t("customerQuotes.closedBanner")}
        </div>
      )}

      {errorMsg && (
        <div className="text-[#ff6e84] font-bold mb-4 bg-[#a70138]/20 p-4 rounded-xl border border-[#a70138]/40">
          {t("customerQuotes.dataError")}
          {errorMsg}
        </div>
      )}

      {!errorMsg && displayRequests.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center max-w-lg mx-auto py-16">
          {activeTab === "IN_PROGRESS" ? (
            <>
              <div className="relative mb-10 group">
                <div className="absolute inset-0 bg-[#ff88b5]/20 blur-[60px] rounded-full group-hover:bg-[#ff88b5]/30 transition-all duration-500"></div>
                <div className="relative w-40 h-40 flex items-center justify-center bg-[#211e26] rounded-xl border border-[#4a474e]/10 shadow-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#ff88b5]/10 to-transparent"></div>
                  <span
                    className="material-symbols-outlined text-[80px] text-[#ff88b5] opacity-40 select-none"
                    style={{ fontVariationSettings: "'wght' 200" }}
                  >
                    content_paste
                  </span>
                </div>
              </div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-2xl text-[#f8f1fb] mb-3 tracking-tight">
                {t("customerQuotes.noInProgress")}
              </h2>
              <p className="text-[#aea9b2] leading-relaxed mb-10 text-sm">
                {t("customerQuotes.noInProgressSub")}
              </p>
              <button
                onClick={() => router.push("/request")}
                className="group relative w-full py-5 rounded-full overflow-hidden transition-all duration-300 active:scale-95"
                style={{ boxShadow: "0 10px 40px -10px rgba(255,136,181,0.5)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#ff88b5] to-[#ff69a7] transition-transform duration-300 group-hover:scale-105"></div>
                <div className="relative flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[#610034] text-xl">
                    add_circle
                  </span>
                  <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-[#610034] tracking-wide text-sm">
                    {t("customerQuotes.newRequestBtn")}
                  </span>
                </div>
              </button>
            </>
          ) : (
            <p className="text-[#aea9b2]">{t("customerQuotes.noClosed")}</p>
          )}
        </div>
      ) : (
        displayRequests.map((request) => {
          const isMatched = request?.status === "MATCHED";
          const isFull = (request?.quote_count || 0) >= 5;

          const expirationTime = request?.created_at
            ? new Date(request.created_at).getTime() + 48 * 60 * 60 * 1000
            : 0;
          const timeRemainingMs = expirationTime - currentTime;
          const isExpired = timeRemainingMs <= 0;

          const hoursRemaining = Math.max(
            0,
            Math.floor(timeRemainingMs / (1000 * 60 * 60)),
          );
          const minutesRemaining = Math.max(
            0,
            Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60)),
          );
          const isHurry = hoursRemaining < 24 && !isExpired;

          let statusLabel = t("customerQuotes.statusRecruiting");
          let statusColor = "bg-blue-50 text-blue-600";
          if (isMatched) {
            statusLabel = t("customerQuotes.statusMatched");
            statusColor =
              "bg-[#b5ffc2]/10 text-[#b5ffc2] border border-[#b5ffc2]/30";
          } else if (isFull || isExpired) {
            statusLabel = t("customerQuotes.statusClosed");
            statusColor =
              "bg-[#27242d] text-[#aea9b2] border border-[#4a474e]/30";
          }

          const reqQuotes = (
            Array.isArray(request.match_quotes) ? request.match_quotes : []
          )
            .slice()
            .sort((a: any, b: any) => {
              // 1순위: 미확인(is_read=false) 우선
              if (!a.is_read && b.is_read) return -1;
              if (a.is_read && !b.is_read) return 1;
              // 2순위: 최신순(created_at DESC)
              return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
              );
            });

          return (
            <div
              key={request.request_id}
              className={`bg-[#1b1820] p-5 rounded-2xl border mt-4 ${activeTab === "CLOSED" ? "border-[#4a474e]/20" : "border-[#ff88b5]/10"}`}
            >
              <div className="flex justify-between items-start mb-3 border-b pb-3 border-[#4a474e]/30">
                <div>
                  <h2 className="text-base font-bold text-[#f8f1fb]">
                    {(locale === "en" ? request.categories?.name_en : null) ||
                      request.categories?.name ||
                      request.service_type ||
                      t("customerQuotes.defaultService")}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 font-medium">
                    <span className="text-sm text-[#aea9b2] flex items-center gap-1">
                      📍 {request.region || t("customerQuotes.noRegion")}
                    </span>
                    <span className="text-xs text-[#aea9b2]/60">
                      {t("customerQuotes.requestDate")}
                      {new Date(request.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span
                    className={`${statusColor} font-bold px-2 py-1 rounded text-xs whitespace-nowrap`}
                  >
                    {statusLabel}
                  </span>
                  {activeTab === "IN_PROGRESS" && (
                    <div
                      className={`text-xs mt-2 font-bold ${isHurry ? "text-[#ff6e84] animate-pulse" : "text-[#a68cff]"}`}
                    >
                      {t("customerQuotes.timeLeft")}
                      {hoursRemaining}
                      {t("customerQuotes.hours")} {minutesRemaining}
                      {t("customerQuotes.minutes")}
                    </div>
                  )}
                </div>
              </div>

              {/* ── [확장] 요청 통제 버튼: 내 요청서 보기 ── */}
              {activeTab === "IN_PROGRESS" && (
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setViewRequestModal({ request })}
                    className="flex-1 bg-[#211e26] hover:bg-[#27242d] text-[#aea9b2] font-bold py-2 rounded-lg text-xs border border-[#4a474e]/30 transition flex items-center justify-center gap-1"
                  >
                    {t("customerQuotes.viewMyRequest")}
                  </button>
                </div>
              )}

              {activeTab === "IN_PROGRESS" && (
                <div className="mb-4 bg-[#a68cff]/5 p-3 rounded-xl border border-[#a68cff]/20 flex items-center justify-between">
                  <span className="text-sm text-[#a68cff] font-medium">
                    🚀 {request.quote_count || 0} / 5{" "}
                    {t("customerQuotes.quoteCount")}
                  </span>
                  {(request.quote_count || 0) === 0 && (
                    <span className="text-xs text-[#a68cff]/70 animate-pulse">
                      {t("customerQuotes.waitingPros")}
                    </span>
                  )}
                </div>
              )}

              {reqQuotes.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#aea9b2]/60 uppercase tracking-wider">
                    {t("customerQuotes.quotesArrived")} ({reqQuotes.length})
                  </h3>
                  {reqQuotes.map((quote: any) => {
                    const profilesArray = Array.isArray(quote.pro_profiles)
                      ? quote.pro_profiles
                      : [quote.pro_profiles];
                    const proUser =
                      profilesArray.find(
                        (p: any) =>
                          p?.user_id === quote.pro_id ||
                          p?.pro_id === quote.pro_id,
                      ) || profilesArray[0];
                    const proName =
                      proUser?.users?.nickname &&
                      proUser.users.nickname.trim() !== ""
                        ? proUser.users.nickname
                        : proUser?.users?.name || "전문가";
                    const avatarUrl = proUser?.users?.avatar_url || null;
                    const avgRating = proUser?.average_rating || 0.0;
                    const reviewCount = proUser?.review_count || 0;

                    // ── [확장] MATCHED 상태에서 미확정 고수 카드 축소 표시 ──
                    if (
                      request.status === "MATCHED" &&
                      quote.status !== "ACCEPTED"
                    ) {
                      return (
                        <div
                          key={quote.quote_id}
                          className="bg-[#211e26] p-3 rounded-xl border border-[#4a474e]/20 opacity-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-[#27242d] rounded-full flex items-center justify-center flex-shrink-0">
                                <svg
                                  className="w-3.5 h-3.5 text-[#aea9b2]"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <span className="font-medium text-[#aea9b2] text-sm">
                                {proName}님
                              </span>
                            </div>
                            <span className="text-xs text-[#aea9b2] bg-[#27242d] px-2 py-0.5 rounded-full">
                              {t("customerQuotes.notSelected")}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={quote.quote_id}
                        className="bg-[#211e26] p-4 rounded-xl border border-[#4a474e]/20 flex flex-col space-y-3"
                      >
                        {/* 상단 터치 존: 전체 클릭 시 프로필 모달 오픈 */}
                        <div
                          onClick={() => {
                            if (!quote.is_read)
                              handleMarkAsRead(
                                quote.quote_id,
                                request.request_id,
                              );
                            const roomId =
                              quoteRoomMap[
                                `${request.request_id} | ${quote.pro_id}`
                              ];
                            const isCompleted = roomId
                              ? reviewedRoomIds.has(roomId)
                              : false;
                            setProfileModal({
                              proId: quote.pro_id,
                              requestId: request.request_id,
                              isCompleted,
                            });
                          }}
                          className="cursor-pointer hover:bg-gray-100 -m-1 p-2 rounded-lg transition active:bg-gray-200 mt-1 space-y-1.5"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center flex-wrap gap-1.5">
                              {/* 고수 아바타 아이콘 */}
                              <div className="w-7 h-7 bg-[#27242d] rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#4a474e]/40">
                                {avatarUrl ? (
                                  <img
                                    src={avatarUrl}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <svg
                                    className="w-4 h-4 text-[#ff88b5]/60"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="font-bold text-[#ff88b5]">
                                {proName}님
                              </span>
                              {proUser?.is_phone_verified && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#b5ffc2]/10 text-[#b5ffc2] font-bold px-1.5 py-0.5 rounded-full border border-[#b5ffc2]/30 whitespace-nowrap flex-shrink-0">
                                  {t("customerQuotes.phoneVerified")}
                                </span>
                              )}
                              {proUser?.facebook_url && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] bg-[#a68cff]/10 text-[#a68cff] font-bold px-1.5 py-0.5 rounded-full border border-[#a68cff]/30 whitespace-nowrap flex-shrink-0">
                                  {t("customerQuotes.facebookLinked")}
                                </span>
                              )}
                              <span className="text-xs font-bold text-yellow-400">
                                ⭐ {Number(avgRating).toFixed(1)}
                              </span>
                              <span className="text-xs text-[#aea9b2]/60">
                                ({reviewCount}개)
                              </span>
                            </div>
                            <span className="text-xs text-[#aea9b2]/60 flex-shrink-0">
                              {new Date(quote.created_at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-[#aea9b2]/50 text-right">
                            {t("customerQuotes.viewProfile")}
                          </p>
                        </div>

                        {activeTab === "IN_PROGRESS" ? (
                          // ── [확장] 이미 다른 고수와 MATCHED된 요청건의 미확정 고수 카드 버튼 비활성화 ──
                          request.status === "MATCHED" &&
                          quote.status !== "ACCEPTED" ? (
                            <div className="mt-2 bg-[#27242d] text-[#aea9b2] font-bold py-2.5 rounded-lg text-sm text-center border border-[#4a474e]/30">
                              {t("customerQuotes.matchedOther")}
                            </div>
                          ) : (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!quote.is_read)
                                    handleMarkAsRead(
                                      quote.quote_id,
                                      request.request_id,
                                    );
                                  setQuoteDetailModal({
                                    quote: { ...quote },
                                    requestId: request.request_id,
                                    request,
                                  });
                                }}
                                className={`flex-1 font-bold py-2.5 rounded-lg shadow-sm transition text-sm border ${
                                  !quote.is_read
                                    ? "bg-gradient-to-r from-[#ff88b5] to-[#ff69a7] text-[#610034] border-transparent animate-pulse"
                                    : "bg-[#211e26] text-[#aea9b2] border-[#4a474e]/30 hover:bg-[#27242d]"
                                }`}
                                style={
                                  !quote.is_read
                                    ? {
                                        boxShadow:
                                          "0 0 20px rgba(255,136,181,0.3)",
                                      }
                                    : {}
                                }
                              >
                                {!quote.is_read
                                  ? t("customerQuotes.newQuoteBtn")
                                  : t("customerQuotes.viewQuoteBtn")}
                              </button>
                              <button
                                onClick={() =>
                                  handleStartChat({
                                    ...quote,
                                    request_id: request.request_id,
                                  })
                                }
                                className="flex-1 bg-[#a68cff] hover:bg-[#7e51ff] text-[#25006b] font-bold py-2.5 rounded-lg shadow-sm transition text-sm"
                              >
                                {t("customerQuotes.chatBtn")}
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="mt-2 text-center">
                            {quote.status === "ACCEPTED" ? (
                              (() => {
                                const roomId =
                                  quoteRoomMap[
                                    `${request.request_id} | ${quote.pro_id}`
                                  ];
                                const isReviewed = roomId
                                  ? reviewedRoomIds.has(roomId)
                                  : false;

                                return (
                                  <div className="flex flex-col gap-2">
                                    <div className="bg-[#b5ffc2]/10 text-[#b5ffc2] py-2 rounded-lg text-sm font-bold border border-[#b5ffc2]/30">
                                      {t("customerQuotes.finalMatch")}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!quote.is_read)
                                          handleMarkAsRead(
                                            quote.quote_id,
                                            request.request_id,
                                          );
                                        setQuoteDetailModal({
                                          quote: { ...quote },
                                          requestId: request.request_id,
                                          request,
                                        });
                                      }}
                                      className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#a68cff] font-bold py-2.5 rounded-lg shadow-sm transition text-sm border border-[#a68cff]/30 flex items-center justify-center gap-2"
                                    >
                                      {t("customerQuotes.viewQuoteDetail")}
                                    </button>

                                    {isReviewed ? (
                                      <button
                                        disabled
                                        className="w-full bg-[#27242d] text-[#aea9b2] font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-[#4a474e]/20"
                                      >
                                        {t("customerQuotes.dealDone")}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          handleStartChat({
                                            ...quote,
                                            request_id: request.request_id,
                                          })
                                        }
                                        className="w-full bg-[#a68cff] hover:bg-[#7e51ff] text-[#25006b] font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2"
                                      >
                                        {t("customerQuotes.chatRoomBtn")}
                                      </button>
                                    )}

                                    {isReviewed ? (
                                      <button
                                        disabled
                                        className="w-full bg-[#27242d] text-[#aea9b2] font-bold py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-[#4a474e]/20"
                                      >
                                        {t("customerQuotes.reviewDone")}
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() =>
                                          openReviewModal(
                                            quote,
                                            request.request_id,
                                          )
                                        }
                                        className="w-full bg-gradient-to-r from-[#ff88b5] to-[#ff69a7] hover:opacity-90 text-[#610034] font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2"
                                      >
                                        {t("customerQuotes.leaveReview")}
                                      </button>
                                    )}
                                  </div>
                                );
                              })()
                            ) : quote.status === "REJECTED" ||
                              request.status === "MATCHED" ? (
                              <div className="bg-[#27242d] text-[#aea9b2] py-2 rounded-lg text-sm font-bold border border-[#4a474e]/30">
                                {request.status === "MATCHED"
                                  ? t("customerQuotes.matchFailed")
                                  : t("customerQuotes.rejected")}
                              </div>
                            ) : (
                              /* 입찰만 마감(5명 도달 또는 48h 경과)되었지만 아직 매칭 미확정 → 고객이 검토·채팅·매칭 확정 가능 */
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!quote.is_read)
                                      handleMarkAsRead(
                                        quote.quote_id,
                                        request.request_id,
                                      );
                                    setQuoteDetailModal({
                                      quote: { ...quote },
                                      requestId: request.request_id,
                                      request,
                                    });
                                  }}
                                  className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#a68cff] font-bold py-2.5 rounded-lg shadow-sm transition text-sm border border-[#a68cff]/30 flex items-center justify-center gap-2"
                                >
                                  {t("customerQuotes.viewQuoteDetail2")}
                                </button>
                                <button
                                  onClick={() =>
                                    handleStartChat({
                                      ...quote,
                                      request_id: request.request_id,
                                    })
                                  }
                                  className="w-full bg-[#a68cff] hover:bg-[#7e51ff] text-[#25006b] font-bold py-2.5 rounded-lg shadow-sm transition text-sm flex items-center justify-center gap-2"
                                >
                                  {t("customerQuotes.consultChat")}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-[#1b1820] rounded-xl border border-[#4a474e]/20 border-dashed text-sm">
                  {activeTab === "IN_PROGRESS" ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <div className="w-28 h-28 rounded-full border-2 border-[#ff88b5]/40 flex items-center justify-center">
                        <div className="w-20 h-20 bg-[#2a2630] rounded-2xl flex items-center justify-center shadow-lg shadow-black/20">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#ff88b5"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.7"
                          >
                            <rect
                              x="8"
                              y="2"
                              width="8"
                              height="4"
                              rx="1"
                              ry="1"
                            />
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                            <path d="M9 12h6" />
                            <path d="M9 16h6" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <p className="text-white font-semibold text-base">
                          {t("customerQuotes.noActiveRequests")}
                        </p>
                        <p className="text-[#aea9b2]/60 text-xs">
                          {t("customerQuotes.noQuotesInProgress")}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push("/request")}
                        className="bg-[#ff88b5] text-white rounded-full px-6 py-3 font-semibold text-sm flex items-center gap-2"
                      >
                        <span className="text-lg">⊕</span>{" "}
                        {t("customerQuotes.createNewRequest")}
                      </button>
                      <button
                        onClick={() => router.push("/")}
                        className="text-[#ff88b5] text-xs font-bold tracking-wider uppercase"
                      >
                        {t("customerQuotes.browseProfessionals")}
                      </button>
                    </div>
                  ) : (
                    <span className="text-[#aea9b2]/50">
                      {t("customerQuotes.noQuotesClosed")}
                    </span>
                  )}
                </div>
              )}

              {activeTab === "CLOSED" && (
                <button
                  disabled
                  className="w-full mt-4 bg-[#1b1820] text-[#4a474e] font-bold py-3 rounded-xl shadow-none cursor-not-allowed text-sm border border-[#4a474e]/20"
                >
                  {t("customerQuotes.closedRequest")}
                </button>
              )}
            </div>
          );
        })
      )}

      {/* 리뷰 모달 */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
            <h2 className="text-lg font-bold text-center text-[#f8f1fb] font-['Plus_Jakarta_Sans']">
              {t("customerQuotes.reviewTitle")}
            </h2>
            <div className="flex flex-col items-center">
              <span className="text-sm text-[#aea9b2] mb-2">
                {t("customerQuotes.reviewRatingLabel")}
              </span>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className={`text-3xl transition ${star <= reviewRating ? "text-[#ff88b5]" : "text-[#4a474e]"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder={t("customerQuotes.reviewPlaceholder")}
              className="w-full bg-[#27242d] border border-[#4a474e]/30 rounded-xl p-3 text-sm text-[#f8f1fb] placeholder-[#aea9b2]/40 focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/30 min-h-[100px]"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="flex-1 bg-[#27242d] hover:bg-[#2e2a36] text-[#aea9b2] font-bold py-3 rounded-xl transition text-sm border border-[#4a474e]/20"
              >
                {t("customerQuotes.reviewCancel")}
              </button>
              <button
                onClick={handleReviewSubmit}
                className="flex-1 bg-gradient-to-r from-[#ff88b5] to-[#ff69a7] hover:opacity-90 text-[#610034] font-bold py-3 rounded-xl transition text-sm"
              >
                {t("customerQuotes.reviewSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 견적 상세 모달 */}
      {quoteDetailModal && (
        <QuoteDetailModal
          quote={quoteDetailModal.quote}
          requestId={quoteDetailModal.requestId}
          request={quoteDetailModal.request}
          onClose={() => setQuoteDetailModal(null)}
          onStartChat={(q) => {
            setQuoteDetailModal(null);
            handleStartChat(q);
          }}
        />
      )}

      {/* 고수 프로필 상세 모달 */}
      {profileModal && (
        <ProProfileDetailModal
          proId={profileModal.proId}
          requestId={profileModal.requestId}
          hideChat={profileModal.isCompleted === true}
          onClose={() => setProfileModal(null)}
          onStartChat={(q) => {
            setProfileModal(null);
            handleStartChat(q);
          }}
        />
      )}

      {/* ── [확장] 내 요청서 보기 모달 ── */}
      {viewRequestModal &&
        (() => {
          const req = viewRequestModal.request;
          const hasQuotes = (req.quote_count || 0) > 0;
          let answers: Record<string, any> = {};
          try {
            answers =
              typeof req.dynamic_answers === "string"
                ? JSON.parse(req.dynamic_answers)
                : req.dynamic_answers || {};
          } catch {
            answers = {};
          }
          const historyData: { stepText: string; userAnswer: any }[] =
            answers._history || [];
          const baseKeys = [
            "depth1",
            "depth2",
            "service_type",
            "region_reg",
            "region_city",
            "_history",
          ];
          const fallbackEntries = Object.entries(answers).filter(
            ([key]) => !baseKeys.includes(key),
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-[#1b1820] p-5 pb-3 border-b border-[#4a474e]/20 rounded-t-2xl">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-[#f8f1fb] font-['Plus_Jakarta_Sans']">
                      {t("customerQuotes.viewRequestTitle")}
                    </h2>
                    <button
                      onClick={() => setViewRequestModal(null)}
                      className="text-[#aea9b2] hover:text-[#f8f1fb] text-xl transition"
                    >
                      ✕
                    </button>
                  </div>
                  {hasQuotes && (
                    <div className="mt-3 bg-[#ff88b5]/10 border border-[#ff88b5]/20 text-[#ff88b5] text-xs font-bold p-3 rounded-lg">
                      {t("customerQuotes.quoteLocked")}
                    </div>
                  )}
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-3">
                    <div className="bg-[#27242d] p-3 rounded-lg border border-[#4a474e]/10">
                      <span className="text-xs font-bold text-[#aea9b2]/60">
                        {t("customerQuotes.serviceLabel")}
                      </span>
                      <p className="text-sm font-bold text-[#f8f1fb] mt-1">
                        {(locale === "en" ? req.categories?.name_en : null) ||
                          req.categories?.name ||
                          req.service_type ||
                          "-"}
                      </p>
                    </div>
                    <div className="bg-[#27242d] p-3 rounded-lg border border-[#4a474e]/10">
                      <span className="text-xs font-bold text-[#aea9b2]/60">
                        {t("customerQuotes.regionLabel")}
                      </span>
                      <p className="text-sm font-bold text-[#f8f1fb] mt-1">
                        📍 {req.region || "-"}
                      </p>
                    </div>
                    <div className="bg-[#27242d] p-3 rounded-lg border border-[#4a474e]/10">
                      <span className="text-xs font-bold text-[#aea9b2]/60">
                        {t("customerQuotes.requestDateLabel")}
                      </span>
                      <p className="text-sm font-bold text-[#f8f1fb] mt-1">
                        {new Date(req.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* _history가 있으면 질문-답변 형식, 없으면 기존 fallback */}
                  {historyData.length > 0 ? (
                    <div className="space-y-3 border-t pt-4 border-[#4a474e]/20">
                      <h3 className="text-xs font-bold text-[#aea9b2]/50 uppercase tracking-wider">
                        {t("customerQuotes.detailedAnswers")}
                      </h3>
                      {historyData
                        .filter((item) => {
                          const text = item.stepText || "";
                          const skipTexts = [
                            "What type of professional are you looking for?",
                            "What service do you need?",
                            "Please select the detailed service.",
                            "Please select the region where you need the service.",
                            "Please select the city.",
                            "어떤 전문가를 찾고 계신가요?",
                            "어떤 서비스가 필요하신가요?",
                            "상세 서비스를 선택해주세요.",
                            "서비스 지역을 선택해주세요.",
                            "도시를 선택해주세요.",
                          ];
                          return !skipTexts.some((s) => text.includes(s));
                        })
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-[#27242d] p-3 rounded-lg border border-[#4a474e]/10"
                          >
                            <span className="text-xs font-bold text-[#a68cff]">
                              Q. {item.stepText}
                            </span>
                            <p className="text-sm text-[#f8f1fb] mt-1 font-medium">
                              {Array.isArray(item.userAnswer)
                                ? item.userAnswer.join(", ")
                                : String(item.userAnswer)}
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : fallbackEntries.length > 0 ? (
                    <div className="space-y-3 border-t pt-4 border-[#4a474e]/20">
                      <h3 className="text-xs font-bold text-[#aea9b2]/50 uppercase tracking-wider">
                        {t("customerQuotes.detailedAnswers")}
                      </h3>
                      {fallbackEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-[#27242d] p-3 rounded-lg border border-[#4a474e]/10"
                        >
                          <span className="text-xs font-bold text-[#aea9b2]/60">
                            {key}
                          </span>
                          <p className="text-sm text-[#f8f1fb] mt-1">
                            {Array.isArray(value)
                              ? value.join(", ")
                              : String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="sticky bottom-0 bg-[#1b1820] p-5 pt-3 border-t border-[#4a474e]/20 rounded-b-2xl">
                  <button
                    onClick={() => setViewRequestModal(null)}
                    className="w-full bg-[#27242d] hover:bg-[#2e2a36] text-[#aea9b2] font-bold py-3 rounded-xl transition text-sm border border-[#4a474e]/20"
                  >
                    {t("customerQuotes.closeBtn")}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ── [확장] 요청 취소 확인 모달 ── */}
      {cancelConfirmModal &&
        (() => {
          const req = cancelConfirmModal.request;
          const hasQuotes = (req.quote_count || 0) > 0;
          // ── [확장] 미열람 견적 수 계산 (환불 안내용) ──
          const unreadQuoteCount = (req.match_quotes || []).filter(
            (q: any) => !q.is_read,
          ).length;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
                <h2 className="text-lg font-bold text-center text-[#f8f1fb] font-['Plus_Jakarta_Sans']">
                  {t("customerQuotes.cancelTitle")}
                </h2>
                <div className="text-sm text-[#aea9b2] text-center space-y-2">
                  <p>
                    <strong className="text-[#f8f1fb]">
                      {(locale === "en" ? req.categories?.name_en : null) ||
                        req.categories?.name ||
                        req.service_type ||
                        t("customerQuotes.defaultService")}
                    </strong>
                    {t("customerQuotes.cancelConfirm")}
                  </p>
                  {hasQuotes && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold p-3 rounded-lg mt-3 text-left">
                      {t("customerQuotes.cancelHasQuotes")}
                    </div>
                  )}
                  {/* ── [확장] 미열람 견적 환불 안내 ── */}
                  {unreadQuoteCount > 0 && (
                    <div className="bg-[#a68cff]/10 border border-[#a68cff]/20 text-[#a68cff] text-xs font-bold p-3 rounded-lg mt-2 text-left">
                      {t("customerQuotes.cancelUnreadRefund").replace(
                        "{count}",
                        String(unreadQuoteCount),
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setCancelConfirmModal(null)}
                    disabled={cancelLoading}
                    className="flex-1 bg-[#27242d] hover:bg-[#2e2a36] text-[#aea9b2] font-bold py-3 rounded-xl transition text-sm border border-[#4a474e]/20 disabled:opacity-50"
                  >
                    {t("customerQuotes.cancelBack")}
                  </button>
                  <button
                    onClick={() => handleCancelRequest(req)}
                    disabled={cancelLoading}
                    className="flex-1 bg-red-500/80 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition text-sm disabled:opacity-50"
                  >
                    {cancelLoading
                      ? t("customerQuotes.cancelLoading")
                      : t("customerQuotes.cancelConfirmBtn")}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
