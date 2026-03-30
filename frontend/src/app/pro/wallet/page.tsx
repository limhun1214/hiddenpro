"use client";
export const runtime = "edge";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

export default function ProWalletPage() {
  const t = useTranslations();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [bonusBalance, setBonusBalance] = useState<number>(0);
  const [ledger, setLedger] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "CHARGE" | "USAGE">(
    "ALL",
  );
  const [loading, setLoading] = useState(true);
  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const { showToast } = useToast();
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountHolder, setPayoutAccountHolder] = useState("");
  const [isPayoutLoading, setIsPayoutLoading] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
  const [infoModal, setInfoModal] = useState<{
    title: string;
    message: string;
    icon: string;
  } | null>(null);
  const [chargeAmountPending, setChargeAmountPending] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const fetchWalletData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const sessionUser = authData?.user;

      if (!sessionUser) {
        setErrorMsg(t("wallet.loginRequired"));
        setLoading(false);
        return;
      }
      setCurrentUser({ id: sessionUser.id });

      const { data: profileData, error: profileError } = await supabase
        .from("pro_profiles")
        .select("current_cash, bonus_cash")
        .eq("pro_id", sessionUser.id)
        .single();

      if (profileError) {
        console.error("지갑 데이터 패칭 에러: ", profileError);
        setErrorMsg(profileError.message);
      } else if (profileData) {
        setBalance(profileData.current_cash);
        setBonusBalance(profileData.bonus_cash || 0);
      }

      const { data: ledgerData, error: ledgerError } = await supabase
        .from("cash_ledger")
        .select("*")
        .eq("pro_id", sessionUser.id)
        .order("created_at", { ascending: false });

      if (ledgerError) {
        console.error("원장 데이터 패칭 에러:", ledgerError);
      } else if (ledgerData) {
        setLedger(ledgerData);
      }

      const { data: payoutData } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("pro_id", sessionUser.id)
        .order("requested_at", { ascending: false })
        .limit(10);
      if (payoutData) setPayoutHistory(payoutData);

      setLoading(false);
    };
    fetchWalletData();

    const handleWalletUpdate = () => fetchWalletData();
    window.addEventListener("wallet-updated", handleWalletUpdate);
    return () =>
      window.removeEventListener("wallet-updated", handleWalletUpdate);
  }, []);

  const handleChargeMock = async (amount: number) => {
    if (!currentUser?.id || balance === null) return;
    setChargeAmountPending(amount);
    setInfoModal({
      icon: "💳",
      title: t("wallet.chargePaymentTitle"),
      message: t("wallet.chargePaymentMsg"),
    });
  };

  const handleChargeMockConfirm = async () => {
    const amount = chargeAmountPending;
    if (!amount || !currentUser?.id || balance === null) {
      setInfoModal(null);
      return;
    }
    setInfoModal(null);
    setChargeAmountPending(null);

    const { data: newBalance, error } = await supabase.rpc("charge_pro_cash", {
      p_pro_id: currentUser.id,
      p_amount: amount,
    });

    if (error) {
      setInfoModal({
        icon: "❌",
        title: t("wallet.chargeFailTitle"),
        message: error.message,
      });
      return;
    }

    setIsChargeModalOpen(false);
    setBalance(newBalance);
    window.dispatchEvent(new Event("wallet-updated"));
    setInfoModal({
      icon: "✅",
      title: t("wallet.chargeSuccessTitle"),
      message: t("wallet.chargeSuccessMsg").replace(
        "{amount}",
        amount.toLocaleString(),
      ),
    });
  };

  const handlePayoutRequest = async () => {
    if (!currentUser?.id) return;
    const amt = parseInt(payoutAmount.replace(/,/g, ""));
    if (!amt || amt <= 0) {
      showToast(t("wallet.payoutAmountError"), "error");
      return;
    }
    if (!payoutBankName.trim()) {
      showToast(t("wallet.payoutBankError"), "error");
      return;
    }
    if (!payoutAccountNumber.trim()) {
      showToast(t("wallet.payoutAccountError"), "error");
      return;
    }
    if (!payoutAccountHolder.trim()) {
      showToast(t("wallet.payoutHolderError"), "error");
      return;
    }
    if (balance !== null && amt > balance) {
      showToast(t("wallet.payoutBalanceError"), "error");
      return;
    }

    setIsPayoutLoading(true);
    try {
      const { data, error } = await supabase.rpc("request_payout", {
        p_pro_id: currentUser.id,
        p_amount: amt,
        p_bank_name: payoutBankName.trim(),
        p_account_number: payoutAccountNumber.trim(),
        p_account_holder: payoutAccountHolder.trim(),
      });
      if (error) throw error;

      if (data?.status === "HELD") {
        showToast(
          t("wallet.payoutHeld") +
            data.hold_reason +
            t("wallet.payoutHeldSuffix"),
          "error",
        );
      } else {
        showToast(t("wallet.payoutSuccess"), "success");
      }
      setIsPayoutModalOpen(false);
      setPayoutAmount("");
      setPayoutBankName("");
      setPayoutAccountNumber("");
      setPayoutAccountHolder("");

      const { data: payoutData } = await supabase
        .from("payout_requests")
        .select("*")
        .eq("pro_id", currentUser.id)
        .order("requested_at", { ascending: false })
        .limit(10);
      if (payoutData) setPayoutHistory(payoutData);
    } catch (e: any) {
      showToast(t("wallet.payoutError") + e.message, "error");
    } finally {
      setIsPayoutLoading(false);
    }
  };

  const getTxMeta = (
    item: any,
  ): { label: string; icon: string; iconColor: string } => {
    const type = item.tx_type;
    if (type === "CHARGE")
      return {
        label: t("wallet.txCharge"),
        icon: "payments",
        iconColor: "text-[#0020A0]",
      };
    if (type === "DEDUCT_QUOTE")
      return {
        label: t("wallet.txDeductQuote"),
        icon: "shopping_bag",
        iconColor: "text-gray-500",
      };
    if (type === "REFUND")
      return {
        label: t("wallet.txRefund"),
        icon: "undo",
        iconColor: "text-[#0020A0]",
      };
    if (type === "BONUS") {
      const label = item.description?.includes("Coupon")
        ? t("wallet.txCouponRedeemed")
        : item.description?.includes("Referral")
          ? t("wallet.txReferralBonus")
          : t("wallet.txBonus");
      return { label, icon: "add_circle", iconColor: "text-[#0020A0]" };
    }
    if (type === "BONUS_REFUND")
      return {
        label: t("wallet.txBonusRefund"),
        icon: "undo",
        iconColor: "text-[#0020A0]",
      };
    if (type === "ADMIN_CHARGE")
      return {
        label: t("wallet.txAdminCharge"),
        icon: "admin_panel_settings",
        iconColor: "text-[#0020A0]",
      };
    if (type === "ADMIN_REFUND")
      return {
        label: t("wallet.txAdminRefund"),
        icon: "undo",
        iconColor: "text-[#0020A0]",
      };
    if (type === "DEDUCT_BONUS_QUOTE")
      return {
        label: t("wallet.txDeductBonusQuote"),
        icon: "shopping_bag",
        iconColor: "text-gray-500",
      };
    if (type === "ADMIN_BONUS_CHARGE")
      return {
        label: t("wallet.txAdminBonusCharge"),
        icon: "admin_panel_settings",
        iconColor: "text-[#0020A0]",
      };
    if (type === "ADMIN_BONUS_REFUND")
      return {
        label: t("wallet.txAdminBonusRefund"),
        icon: "undo",
        iconColor: "text-[#0020A0]",
      };
    if (type === "SIGNUP_BONUS")
      return {
        label: t("wallet.txSignupBonus"),
        icon: "card_giftcard",
        iconColor: "text-[#0020A0]",
      };
    return { label: type, icon: "receipt", iconColor: "text-gray-500" };
  };

  const filteredLedger = ledger.filter((item) => {
    if (filterType === "ALL") return true;
    if (filterType === "CHARGE") return item.amount > 0;
    if (filterType === "USAGE") return item.amount < 0;
    return true;
  });

  const totalIn = ledger
    .filter((i) => i.amount > 0)
    .reduce((s, i) => s + Number(i.amount), 0);
  const totalOut = ledger
    .filter((i) => i.amount < 0)
    .reduce((s, i) => s + Math.abs(Number(i.amount)), 0);

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-gray-900 pb-32 font-body">
      <main className="px-6 space-y-8 pt-6">
        {/* ── Balance Hero ── */}
        <section className="flex flex-col items-center text-center space-y-3 py-6">
          <p className="text-[#454653] font-bold uppercase tracking-widest text-xs">
            {t("wallet.title")}
          </p>
          <h2 className="font-headline font-extrabold text-5xl text-[#0020A0] tracking-tighter">
            {loading
              ? "..."
              : balance !== null
                ? (balance + bonusBalance).toLocaleString()
                : "0"}{" "}
            <span className="font-headline font-extrabold text-5xl">
              {t("wallet.cashUnit")}
            </span>
          </h2>

          {!loading && bonusBalance > 0 && (
            <div className="flex justify-center gap-3 text-xs">
              <span className="bg-[#c2c9fe]/20 text-[#4c5381] px-3 py-1 rounded-full font-bold border border-[#c2c9fe]/30">
                {t("wallet.realBalance")} {(balance || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1 bg-[#c2c9fe]/20 text-green-600 px-3 py-1 rounded-full font-bold border border-[#c2c9fe]/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-3.5 h-3.5 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M20 7h-1.382a3 3 0 0 0 .382-1.5C19 3.57 17.43 2 15.5 2c-1.03 0-1.96.42-2.64 1.1L12 4l-.86-.9A3.49 3.49 0 0 0 8.5 2C6.57 2 5 3.57 5 5.5 5 6.04 5.14 6.55 5.382 7H4c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-8 0h-2.59C8.83 7 8 6.17 8 5.5 8 4.67 8.67 4 9.5 4c.4 0 .78.16 1.06.44L12 6l-.06.06-.94.94zm4.5 0H14l-.94-.94L13 6l1.44-1.56C14.72 4.16 15.1 4 15.5 4c.83 0 1.5.67 1.5 1.5C17 6.17 16.17 7 15.5 7zM4 13v7c0 1.1.9 2 2 2h5v-9H4zm9 9h5c1.1 0 2-.9 2-2v-7h-7v9z" />
                </svg>
                {t("wallet.bonusBalance")} {bonusBalance.toLocaleString()}
              </span>
            </div>
          )}

          <div className="pt-2 w-full flex justify-center">
            <button
              onClick={() => setIsChargeModalOpen(true)}
              className="w-full max-w-[300px] py-4 bg-[#0020A0] hover:bg-[#001880] text-white font-bold text-lg rounded-xl shadow-[0_32px_64px_-15px_rgba(0,15,93,0.18)] active:scale-[0.96] transition-all flex items-center justify-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
              </svg>
              {t("wallet.chargeBtn")}
            </button>
          </div>
        </section>

        {/* ── Error ── */}
        {errorMsg && (
          <div className="text-red-500 font-bold p-3 rounded-xl border border-red-300 bg-red-50">
            {errorMsg}
          </div>
        )}

        {/* ── Credit Summary (Bento Grid) ── */}
        {!loading && (
          <section className="grid grid-cols-2 gap-4">
            <div
              className="p-5 rounded-xl bg-white"
              style={{ boxShadow: "0 -4px 20px rgba(0,15,93,0.04)" }}
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-green-600 text-[20px]">
                  arrow_downward
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#454653] mb-1">
                {t("wallet.totalCharged")}
              </p>
              <p className="font-extrabold text-xl text-green-600">
                +{totalIn.toLocaleString()}
              </p>
            </div>
            <div
              className="p-5 rounded-xl bg-white"
              style={{ boxShadow: "0 -4px 20px rgba(0,15,93,0.04)" }}
            >
              <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-red-500 text-[20px]">
                  arrow_upward
                </span>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#454653] mb-1">
                {t("wallet.totalUsed")}
              </p>
              <p className="font-extrabold text-xl text-gray-900">
                -{totalOut.toLocaleString()}
              </p>
            </div>
          </section>
        )}

        {/* ── Referral Banner (Bento Style) ── */}
        <section className="relative overflow-hidden rounded-xl bg-[#c2c9fe]/30 p-6 cursor-pointer">
          <div className="absolute top-1/2 right-3 -translate-y-1/2 opacity-20 pointer-events-none">
            {/* card_giftcard: 리본 달린 직사각형 선물 카드 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="140"
              height="140"
              viewBox="0 0 24 24"
            >
              {/* 카드 본체 */}
              <rect
                x="1"
                y="8"
                width="22"
                height="13"
                rx="1.5"
                fill="#0020A0"
              />
              {/* 가로 리본 줄무늬 */}
              <rect
                x="1"
                y="12"
                width="22"
                height="3"
                fill="white"
                fillOpacity="0.3"
              />
              {/* 리본 왼쪽 루프 */}
              <path d="M12 8 Q9 2 5 5 Q3 8 7 9 Z" fill="#0020A0" />
              {/* 리본 오른쪽 루프 */}
              <path d="M12 8 Q15 2 19 5 Q21 8 17 9 Z" fill="#0020A0" />
              {/* 리본 매듭 */}
              <ellipse cx="12" cy="8" rx="1.8" ry="1.5" fill="#0020A0" />
            </svg>
          </div>
          <div className="relative z-10 space-y-4">
            <div className="space-y-1">
              <h3 className="font-headline font-bold text-xl leading-tight text-[#191c1e]">
                {t("referral.inviteBanner")}
              </h3>
              <p className="text-[#454653] text-sm max-w-[240px]">
                Share the Sapphire experience with your network and grow your
                ledger.
              </p>
            </div>
            <button
              onClick={() => router.push("/referral")}
              className="px-6 py-3 bg-[#4c5381] hover:bg-[#3d4270] text-white font-bold text-sm rounded-xl transition-colors"
            >
              Send Invite
            </button>
          </div>
        </section>

        {/* ── Credit History ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-lg text-[#191c1e] tracking-tight">
              {t("wallet.ledgerTitle")}
            </h3>
            <div className="flex gap-2">
              {(["ALL", "CHARGE", "USAGE"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    filterType === type
                      ? "bg-[#0020A0] text-white"
                      : "bg-[#f2f4f7] text-[#454653] hover:bg-[#e8eaf0]"
                  }`}
                >
                  {type === "ALL"
                    ? t("wallet.filterAll")
                    : type === "CHARGE"
                      ? t("wallet.filterCharge")
                      : t("wallet.filterUsage")}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-center text-gray-500 py-6">
              {t("wallet.loading")}
            </p>
          ) : ledger.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-[#c5c5d6]/30">
              <p className="text-sm text-gray-500">{t("wallet.noLedger")}</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-[#c5c5d6]/30">
              <p className="text-sm text-gray-500">{t("wallet.noFiltered")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLedger.map((item) => {
                const isPositive = item.amount > 0;
                const operator = isPositive ? "+" : "";
                const amountColor = isPositive
                  ? "text-green-600"
                  : "text-red-500";
                const {
                  label: txLabel,
                  icon: txIcon,
                  iconColor,
                } = getTxMeta(item);

                return (
                  <div
                    key={item.transaction_id}
                    className="flex items-center justify-between p-5 rounded-xl bg-white border border-[#c5c5d6]/30 hover:border-[#c5c5d6]/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                        <span
                          className={`material-symbols-outlined text-[#0020A0]`}
                        >
                          {txIcon}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-[#191c1e] text-sm">
                          {txLabel}
                        </p>
                        <p className="text-xs text-[#454653]">
                          {new Date(item.created_at).toLocaleDateString(
                            "en-US",
                            { year: "numeric", month: "short", day: "numeric" },
                          )}{" "}
                          {new Date(item.created_at).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                        {item.description && (
                          <p className="text-xs text-[#454653] mt-0.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`font-bold text-base ${amountColor}`}>
                        {operator}
                        {Math.abs(item.amount).toLocaleString()}
                      </p>
                      <p className="text-xs text-[#454653] mt-1">
                        {t("wallet.balanceLabel")}
                        {item.balance_snapshot?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Payout History ── */}
        {payoutHistory.length > 0 && (
          <section className="space-y-3 border-t border-gray-200 pt-6">
            <h3 className="font-bold text-lg">
              {t("wallet.payoutHistoryTitle")}
            </h3>
            <div className="space-y-2">
              {payoutHistory.map((p) => (
                <div
                  key={p.id}
                  className="bg-white border border-[#c5c5d6]/30 p-4 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <p className="text-xs text-gray-500">
                      {new Date(p.requested_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {p.bank_name} {p.account_number}
                    </p>
                    <p className="text-xs text-gray-500">{p.account_holder}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-green-600">
                      {p.amount.toLocaleString()} {t("wallet.cashUnit")}
                    </p>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.status === "APPROVED"
                          ? "bg-green-50 text-green-600"
                          : p.status === "REJECTED"
                            ? "bg-red-50 text-red-500"
                            : p.status === "HELD"
                              ? "bg-yellow-50 text-yellow-600"
                              : "bg-[#0020A0]/10 text-[#0020A0]"
                      }`}
                    >
                      {p.status === "APPROVED"
                        ? t("wallet.statusApproved")
                        : p.status === "REJECTED"
                          ? t("wallet.statusRejected")
                          : p.status === "HELD"
                            ? t("wallet.statusHeld")
                            : t("wallet.statusPending")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── Charge Modal ── */}
      {isChargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
              {t("wallet.chargeModalTitle")}
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleChargeMock(100)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-[#0020A0] font-bold py-4 rounded-xl border border-gray-200 transition text-lg"
              >
                100 Credits
              </button>
              <button
                onClick={() => handleChargeMock(300)}
                className="w-full bg-gray-50 hover:bg-gray-100 text-[#0020A0] font-bold py-4 rounded-xl border border-[#0020A0]/20 transition text-lg"
              >
                300 Credits
              </button>
              <button
                onClick={() => handleChargeMock(500)}
                className="w-full bg-[#0020A0] hover:bg-[#001880] text-white font-bold py-4 rounded-xl shadow-[0_32px_64px_-15px_rgba(0,15,93,0.18)] transition text-lg"
              >
                500 Credits{" "}
                <span className="text-sm bg-green-400 text-white px-2 py-0.5 rounded-full ml-1">
                  BEST
                </span>
              </button>
            </div>
            <button
              onClick={() => setIsChargeModalOpen(false)}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold py-4 rounded-xl transition mt-2"
            >
              {t("wallet.chargeClose")}
            </button>
          </div>
        </div>
      )}

      {/* ── Payout Modal ── */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:items-center">
          <div className="bg-white border border-gray-200 rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-gray-900 mb-2">
              {t("wallet.payoutModalTitle")}
            </h2>
            <p className="text-xs text-gray-500 text-center -mt-2">
              {t("wallet.payoutAvailable")}
              <span className="font-bold text-[#0020A0]">
                {(balance || 0).toLocaleString()} {t("wallet.cashUnit")}
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={t("wallet.payoutAmountPlaceholder")}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0020A0]/50"
              />
              <input
                type="text"
                value={payoutBankName}
                onChange={(e) => setPayoutBankName(e.target.value)}
                placeholder={t("wallet.payoutBankPlaceholder")}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0020A0]/50"
              />
              <input
                type="text"
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                placeholder={t("wallet.payoutAccountPlaceholder")}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0020A0]/50"
              />
              <input
                type="text"
                value={payoutAccountHolder}
                onChange={(e) => setPayoutAccountHolder(e.target.value)}
                placeholder={t("wallet.payoutHolderPlaceholder")}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0020A0]/50"
              />
              <p className="text-xs text-yellow-600 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                {t("wallet.payoutWarning")}
              </p>
            </div>
            <button
              onClick={handlePayoutRequest}
              disabled={isPayoutLoading}
              className="w-full bg-green-400 hover:opacity-90 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-md transition"
            >
              {isPayoutLoading
                ? t("wallet.payoutSubmitting")
                : t("wallet.payoutSubmitBtn")}
            </button>
            <button
              onClick={() => setIsPayoutModalOpen(false)}
              className="w-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold py-4 rounded-xl transition"
            >
              {t("wallet.payoutClose")}
            </button>
          </div>
        </div>
      )}

      {/* ── Info Modal ── */}
      {infoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-4xl mb-1">
                {infoModal.icon}
              </div>
              <h3 className="text-lg font-black text-gray-900">
                {infoModal.title}
              </h3>
              <p className="text-sm text-gray-500 text-center whitespace-pre-line leading-relaxed">
                {infoModal.message}
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              {chargeAmountPending ? (
                <>
                  <button
                    onClick={handleChargeMockConfirm}
                    className="w-full bg-[#0020A0] hover:bg-[#001880] text-white font-bold py-3.5 rounded-xl transition"
                  >
                    {t("wallet.chargeConfirmBtn")}
                  </button>
                  <button
                    onClick={() => {
                      setInfoModal(null);
                      setChargeAmountPending(null);
                    }}
                    className="w-full bg-gray-50 hover:bg-gray-100 text-gray-500 font-bold py-3 rounded-xl transition"
                  >
                    {t("wallet.chargeCancelBtn")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setInfoModal(null)}
                  className="w-full bg-[#0020A0] hover:bg-[#001880] text-white font-bold py-3.5 rounded-xl transition"
                >
                  {t("wallet.infoConfirmBtn")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
