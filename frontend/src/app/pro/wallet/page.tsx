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
        iconColor: "text-[#ff88b5]",
      };
    if (type === "DEDUCT_QUOTE")
      return {
        label: t("wallet.txDeductQuote"),
        icon: "shopping_bag",
        iconColor: "text-[#aea9b2]",
      };
    if (type === "REFUND")
      return {
        label: t("wallet.txRefund"),
        icon: "undo",
        iconColor: "text-[#ff88b5]",
      };
    if (type === "BONUS") {
      const label = item.description?.includes("Coupon")
        ? t("wallet.txCouponRedeemed")
        : item.description?.includes("Referral")
          ? t("wallet.txReferralBonus")
          : t("wallet.txBonus");
      return { label, icon: "add_circle", iconColor: "text-[#ff88b5]" };
    }
    if (type === "BONUS_REFUND")
      return {
        label: t("wallet.txBonusRefund"),
        icon: "undo",
        iconColor: "text-[#ff88b5]",
      };
    if (type === "ADMIN_CHARGE")
      return {
        label: t("wallet.txAdminCharge"),
        icon: "admin_panel_settings",
        iconColor: "text-[#a68cff]",
      };
    if (type === "ADMIN_REFUND")
      return {
        label: t("wallet.txAdminRefund"),
        icon: "undo",
        iconColor: "text-[#a68cff]",
      };
    if (type === "DEDUCT_BONUS_QUOTE")
      return {
        label: t("wallet.txDeductBonusQuote"),
        icon: "shopping_bag",
        iconColor: "text-[#aea9b2]",
      };
    if (type === "ADMIN_BONUS_CHARGE")
      return {
        label: t("wallet.txAdminBonusCharge"),
        icon: "admin_panel_settings",
        iconColor: "text-[#a68cff]",
      };
    if (type === "ADMIN_BONUS_REFUND")
      return {
        label: t("wallet.txAdminBonusRefund"),
        icon: "undo",
        iconColor: "text-[#a68cff]",
      };
    if (type === "SIGNUP_BONUS")
      return {
        label: t("wallet.txSignupBonus"),
        icon: "card_giftcard",
        iconColor: "text-[#a68cff]",
      };
    return { label: type, icon: "receipt", iconColor: "text-[#aea9b2]" };
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
    <div className="min-h-screen bg-[#0f0d13] text-[#f8f1fb] pb-32">
      <main className="px-6 space-y-8 pt-6">
        {/* ── Balance Hero ── */}
        <section className="flex flex-col items-center text-center space-y-3 py-6">
          <p className="text-[#aea9b2] font-medium tracking-wide text-sm">
            {t("wallet.title")}
          </p>
          <h2 className="font-extrabold text-5xl text-[#ff88b5] tracking-tighter">
            {loading
              ? "..."
              : balance !== null
                ? (balance + bonusBalance).toLocaleString()
                : "0"}{" "}
            <span className="text-2xl font-bold">{t("wallet.cashUnit")}</span>
          </h2>

          {!loading && bonusBalance > 0 && (
            <div className="flex justify-center gap-3 text-xs">
              <span className="bg-[#151219] text-[#aea9b2] px-3 py-1 rounded-full font-bold border border-[#4a474e]/30">
                {t("wallet.realBalance")} {(balance || 0).toLocaleString()}
              </span>
              <span className="bg-[#151219] text-[#b5ffc2] px-3 py-1 rounded-full font-bold border border-[#4a474e]/30">
                🎁 {t("wallet.bonusBalance")} {bonusBalance.toLocaleString()}
              </span>
            </div>
          )}

          <div className="pt-2 w-full">
            <button
              onClick={() => setIsChargeModalOpen(true)}
              className="w-full py-4 bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] font-bold text-lg rounded-full shadow-[0_8px_30px_rgba(255,136,181,0.25)] active:scale-[0.96] transition-transform"
            >
              {t("wallet.chargeBtn")}
            </button>
          </div>
        </section>

        {/* ── Error ── */}
        {errorMsg && (
          <div className="text-[#ff6e84] font-bold p-3 rounded-xl border border-[#d73357]/30 bg-[#d73357]/10">
            {errorMsg}
          </div>
        )}

        {/* ── Referral Banner (Bento Style) ── */}
        <section
          onClick={() => router.push("/referral")}
          className="relative overflow-hidden rounded-xl bg-[#211e26] p-6 cursor-pointer"
        >
          <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-[#a68cff]/20 blur-3xl rounded-full pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <h3 className="font-bold text-xl leading-tight">
                  {t("referral.inviteBanner")}
                </h3>
                <p className="text-[#aea9b2] text-sm max-w-[200px]">
                  Spread the word and unlock more premium experiences.
                </p>
              </div>
              <div className="bg-[#27242d] p-3 rounded-xl border border-[#4a474e]/20">
                <span className="material-symbols-outlined text-[#a68cff] text-[30px]">
                  card_giftcard
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 font-bold text-[#ff88b5]">
              <span>Invite Now</span>
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </div>
          </div>
        </section>

        {/* ── Credit Summary (Horizontal) ── */}
        {!loading && (
          <section
            className="flex gap-4 overflow-x-auto pb-2"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex-shrink-0 w-[160px] p-4 rounded-xl bg-[#151219] border-l-4 border-[#b5ffc2]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#aea9b2] mb-1">
                {t("wallet.totalCharged")}
              </p>
              <p className="font-extrabold text-xl text-[#b5ffc2]">
                +{totalIn.toLocaleString()}
              </p>
            </div>
            <div className="flex-shrink-0 w-[160px] p-4 rounded-xl bg-[#151219] border-l-4 border-[#d73357]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#aea9b2] mb-1">
                {t("wallet.totalUsed")}
              </p>
              <p className="font-extrabold text-xl text-[#f8f1fb]">
                -{totalOut.toLocaleString()}
              </p>
            </div>
          </section>
        )}

        {/* ── Credit History ── */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t("wallet.ledgerTitle")}</h3>
            <div className="flex bg-[#000000] p-1 rounded-full border border-[#4a474e]/20">
              {(["ALL", "CHARGE", "USAGE"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                    filterType === type
                      ? "bg-[#ff88b5] text-[#610034]"
                      : "text-[#aea9b2] hover:text-[#f8f1fb]"
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
            <p className="text-center text-[#aea9b2] py-6">
              {t("wallet.loading")}
            </p>
          ) : ledger.length === 0 ? (
            <div className="text-center py-8 bg-[#1b1820] rounded-xl border border-[#4a474e]/20">
              <p className="text-sm text-[#aea9b2]">{t("wallet.noLedger")}</p>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="text-center py-8 bg-[#1b1820] rounded-xl border border-[#4a474e]/20">
              <p className="text-sm text-[#aea9b2]">{t("wallet.noFiltered")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLedger.map((item) => {
                const isPositive = item.amount > 0;
                const operator = isPositive ? "+" : "";
                const amountColor = isPositive
                  ? "text-[#b5ffc2]"
                  : "text-[#ff6e84]";
                const {
                  label: txLabel,
                  icon: txIcon,
                  iconColor,
                } = getTxMeta(item);

                return (
                  <div
                    key={item.transaction_id}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#1b1820] hover:bg-[#211e26] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#27242d] flex items-center justify-center shrink-0">
                        <span
                          className={`material-symbols-outlined ${iconColor}`}
                        >
                          {txIcon}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-[#f8f1fb] text-sm">
                          {txLabel}
                        </p>
                        <p className="text-xs text-[#aea9b2]">
                          {new Date(item.created_at).toLocaleDateString()}{" "}
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {item.description && (
                          <p className="text-xs text-[#aea9b2] mt-0.5">
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
                      <p className="text-xs text-[#aea9b2] mt-1">
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
          <section className="space-y-3 border-t border-[#4a474e]/30 pt-6">
            <h3 className="font-bold text-lg">
              {t("wallet.payoutHistoryTitle")}
            </h3>
            <div className="space-y-2">
              {payoutHistory.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#1b1820] border border-[#4a474e]/20 p-3 rounded-xl flex justify-between items-center"
                >
                  <div>
                    <p className="text-xs text-[#aea9b2]">
                      {new Date(p.requested_at).toLocaleDateString()}
                    </p>
                    <p className="text-sm font-bold text-[#f8f1fb]">
                      {p.bank_name} {p.account_number}
                    </p>
                    <p className="text-xs text-[#aea9b2]">{p.account_holder}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-[#b5ffc2]">
                      {p.amount.toLocaleString()} {t("wallet.cashUnit")}
                    </p>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        p.status === "APPROVED"
                          ? "bg-[#b5ffc2]/10 text-[#b5ffc2]"
                          : p.status === "REJECTED"
                            ? "bg-[#d73357]/10 text-[#ff6e84]"
                            : p.status === "HELD"
                              ? "bg-yellow-900/20 text-yellow-400"
                              : "bg-[#a68cff]/10 text-[#a68cff]"
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
          <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-[#f8f1fb] mb-2">
              {t("wallet.chargeModalTitle")}
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleChargeMock(100)}
                className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#ff88b5] font-bold py-4 rounded-xl border border-[#4a474e]/30 transition text-lg"
              >
                100 Credits
              </button>
              <button
                onClick={() => handleChargeMock(300)}
                className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#ff88b5] font-bold py-4 rounded-xl border border-[#ff88b5]/20 transition text-lg"
              >
                300 Credits
              </button>
              <button
                onClick={() => handleChargeMock(500)}
                className="w-full bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] font-bold py-4 rounded-xl shadow-md transition text-lg"
              >
                500 Credits{" "}
                <span className="text-sm bg-[#b5ffc2] text-[#004820] px-2 py-0.5 rounded-full ml-1">
                  BEST
                </span>
              </button>
            </div>
            <button
              onClick={() => setIsChargeModalOpen(false)}
              className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#aea9b2] font-bold py-4 rounded-xl transition mt-2"
            >
              {t("wallet.chargeClose")}
            </button>
          </div>
        </div>
      )}

      {/* ── Payout Modal ── */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:items-center">
          <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-center text-[#f8f1fb] mb-2">
              {t("wallet.payoutModalTitle")}
            </h2>
            <p className="text-xs text-[#aea9b2] text-center -mt-2">
              {t("wallet.payoutAvailable")}
              <span className="font-bold text-[#ff88b5]">
                {(balance || 0).toLocaleString()} {t("wallet.cashUnit")}
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="number"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={t("wallet.payoutAmountPlaceholder")}
                className="w-full px-4 py-3 bg-[#211e26] border border-[#4a474e]/30 rounded-xl text-sm text-[#f8f1fb] placeholder:text-[#aea9b2] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/50"
              />
              <input
                type="text"
                value={payoutBankName}
                onChange={(e) => setPayoutBankName(e.target.value)}
                placeholder={t("wallet.payoutBankPlaceholder")}
                className="w-full px-4 py-3 bg-[#211e26] border border-[#4a474e]/30 rounded-xl text-sm text-[#f8f1fb] placeholder:text-[#aea9b2] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/50"
              />
              <input
                type="text"
                value={payoutAccountNumber}
                onChange={(e) => setPayoutAccountNumber(e.target.value)}
                placeholder={t("wallet.payoutAccountPlaceholder")}
                className="w-full px-4 py-3 bg-[#211e26] border border-[#4a474e]/30 rounded-xl text-sm text-[#f8f1fb] placeholder:text-[#aea9b2] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/50"
              />
              <input
                type="text"
                value={payoutAccountHolder}
                onChange={(e) => setPayoutAccountHolder(e.target.value)}
                placeholder={t("wallet.payoutHolderPlaceholder")}
                className="w-full px-4 py-3 bg-[#211e26] border border-[#4a474e]/30 rounded-xl text-sm text-[#f8f1fb] placeholder:text-[#aea9b2] focus:outline-none focus:ring-2 focus:ring-[#ff88b5]/50"
              />
              <p className="text-xs text-yellow-400 bg-yellow-900/20 p-3 rounded-xl border border-yellow-700/20">
                {t("wallet.payoutWarning")}
              </p>
            </div>
            <button
              onClick={handlePayoutRequest}
              disabled={isPayoutLoading}
              className="w-full bg-[#b5ffc2] hover:opacity-90 disabled:opacity-50 text-[#004820] font-bold py-4 rounded-xl shadow-md transition"
            >
              {isPayoutLoading
                ? t("wallet.payoutSubmitting")
                : t("wallet.payoutSubmitBtn")}
            </button>
            <button
              onClick={() => setIsPayoutModalOpen(false)}
              className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#aea9b2] font-bold py-4 rounded-xl transition"
            >
              {t("wallet.payoutClose")}
            </button>
          </div>
        </div>
      )}

      {/* ── Info Modal ── */}
      {infoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#1b1820] border border-[#4a474e]/30 rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-[#211e26] flex items-center justify-center text-4xl mb-1">
                {infoModal.icon}
              </div>
              <h3 className="text-lg font-black text-[#f8f1fb]">
                {infoModal.title}
              </h3>
              <p className="text-sm text-[#aea9b2] text-center whitespace-pre-line leading-relaxed">
                {infoModal.message}
              </p>
            </div>
            <div className="px-6 pb-6 flex flex-col gap-2">
              {chargeAmountPending ? (
                <>
                  <button
                    onClick={handleChargeMockConfirm}
                    className="w-full bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] font-bold py-3.5 rounded-xl transition"
                  >
                    {t("wallet.chargeConfirmBtn")}
                  </button>
                  <button
                    onClick={() => {
                      setInfoModal(null);
                      setChargeAmountPending(null);
                    }}
                    className="w-full bg-[#211e26] hover:bg-[#27242d] text-[#aea9b2] font-bold py-3 rounded-xl transition"
                  >
                    {t("wallet.chargeCancelBtn")}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setInfoModal(null)}
                  className="w-full bg-gradient-to-r from-[#ff88b5] to-[#ff6ea9] text-[#610034] font-bold py-3.5 rounded-xl transition"
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
