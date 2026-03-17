'use client';
export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { useTranslations } from 'next-intl';

export default function ProWalletPage() {
    const t = useTranslations();
    const router = useRouter();
    const [balance, setBalance] = useState<number | null>(null);
    const [bonusBalance, setBonusBalance] = useState<number>(0);
    const [ledger, setLedger] = useState<any[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [filterType, setFilterType] = useState<'ALL' | 'CHARGE' | 'USAGE'>('ALL');
    const [loading, setLoading] = useState(true);
    const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
    const { showToast } = useToast();
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutBankName, setPayoutBankName] = useState('');
    const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
    const [payoutAccountHolder, setPayoutAccountHolder] = useState('');
    const [isPayoutLoading, setIsPayoutLoading] = useState(false);
    const [payoutHistory, setPayoutHistory] = useState<any[]>([]);
    const [infoModal, setInfoModal] = useState<{ title: string; message: string; icon: string } | null>(null);
    const [chargeAmountPending, setChargeAmountPending] = useState<number | null>(null);

    useEffect(() => {
        const fetchWalletData = async () => {
            const { data: authData } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (!sessionUser) {
                setErrorMsg(t('wallet.loginRequired'));
                setLoading(false);
                return;
            }
            setCurrentUser({ id: sessionUser.id });

            // 잔액 조회
            const { data: profileData, error: profileError } = await supabase
                .from('pro_profiles')
                .select('current_cash, bonus_cash')
                .eq('pro_id', sessionUser.id)
                .single();

            if (profileError) {
                console.error("지갑 데이터 패칭 에러: ", profileError);
                setErrorMsg(profileError.message);
            } else if (profileData) {
                setBalance(profileData.current_cash);
                setBonusBalance(profileData.bonus_cash || 0);
            }

            // 원장 내역 조회
            const { data: ledgerData, error: ledgerError } = await supabase
                .from('cash_ledger')
                .select('*')
                .eq('pro_id', sessionUser.id)
                .order('created_at', { ascending: false });

            if (ledgerError) {
                console.error("원장 데이터 패칭 에러:", ledgerError);
            } else if (ledgerData) {
                setLedger(ledgerData);
            }

            // 출금 신청 내역 조회
            const { data: payoutData } = await supabase
                .from('payout_requests')
                .select('*')
                .eq('pro_id', sessionUser.id)
                .order('requested_at', { ascending: false })
                .limit(10);
            if (payoutData) setPayoutHistory(payoutData);

            setLoading(false);
        };
        fetchWalletData();

        const handleWalletUpdate = () => fetchWalletData();
        window.addEventListener('wallet-updated', handleWalletUpdate);
        return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
    }, []);

    const handleChargeMock = async (amount: number) => {
        if (!currentUser?.id || balance === null) return;

        // 1단계: 결제 안내 모달 표시 후 실제 충전은 확인 콜백에서 처리
        setChargeAmountPending(amount);
        setInfoModal({
            icon: '💳',
            title: t('wallet.chargePaymentTitle'),
            message: t('wallet.chargePaymentMsg'),
        });
    };

    const handleChargeMockConfirm = async () => {
        const amount = chargeAmountPending;
        if (!amount || !currentUser?.id || balance === null) { setInfoModal(null); return; }
        setInfoModal(null);
        setChargeAmountPending(null);

        const { data: newBalance, error } = await supabase.rpc('charge_pro_cash', {
            p_pro_id: currentUser.id,
            p_amount: amount
        });

        if (error) {
            setInfoModal({ icon: '❌', title: t('wallet.chargeFailTitle'), message: error.message });
            return;
        }

        setIsChargeModalOpen(false);
        setBalance(newBalance);
        window.dispatchEvent(new Event('wallet-updated'));
        setInfoModal({ icon: '✅', title: t('wallet.chargeSuccessTitle'), message: t('wallet.chargeSuccessMsg').replace('{amount}', amount.toLocaleString()) });
    };

    const handlePayoutRequest = async () => {
        if (!currentUser?.id) return;
        const amt = parseInt(payoutAmount.replace(/,/g, ''));
        if (!amt || amt <= 0) { showToast(t('wallet.payoutAmountError'), 'error'); return; }
        if (!payoutBankName.trim()) { showToast(t('wallet.payoutBankError'), 'error'); return; }
        if (!payoutAccountNumber.trim()) { showToast(t('wallet.payoutAccountError'), 'error'); return; }
        if (!payoutAccountHolder.trim()) { showToast(t('wallet.payoutHolderError'), 'error'); return; }
        if (balance !== null && amt > balance) { showToast(t('wallet.payoutBalanceError'), 'error'); return; }

        setIsPayoutLoading(true);
        try {
            const { data, error } = await supabase.rpc('request_payout', {
                p_pro_id: currentUser.id,
                p_amount: amt,
                p_bank_name: payoutBankName.trim(),
                p_account_number: payoutAccountNumber.trim(),
                p_account_holder: payoutAccountHolder.trim(),
            });
            if (error) throw error;

            if (data?.status === 'HELD') {
                showToast(t('wallet.payoutHeld') + data.hold_reason + t('wallet.payoutHeldSuffix'), 'error');
            } else {
                showToast(t('wallet.payoutSuccess'), 'success');
            }
            setIsPayoutModalOpen(false);
            setPayoutAmount(''); setPayoutBankName(''); setPayoutAccountNumber(''); setPayoutAccountHolder('');

            // 출금 내역 갱신
            const { data: payoutData } = await supabase
                .from('payout_requests')
                .select('*')
                .eq('pro_id', currentUser.id)
                .order('requested_at', { ascending: false })
                .limit(10);
            if (payoutData) setPayoutHistory(payoutData);

        } catch (e: any) {
            showToast(t('wallet.payoutError') + e.message, 'error');
        } finally {
            setIsPayoutLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-screen bg-gray-50 p-4 pt-4 sm:pt-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-sm text-center border">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                        <circle cx="18" cy="18" r="13" fill="#3B82F6" opacity="0.12"/>
                        <circle cx="18" cy="18" r="13" stroke="#3B82F6" strokeWidth="1.5" fill="none"/>
                        <circle cx="18" cy="18" r="9" stroke="#3B82F6" strokeWidth="1" fill="none" opacity="0.4"/>
                        <path d="M13.5 14v8M22.5 14v8M13.5 18h9" stroke="#1D4ED8" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{t('wallet.title')}</h1>
                <p className="text-gray-500 mb-6">{t('wallet.subtitle')}</p>
                {errorMsg && (
                    <div className="text-red-500 font-bold mb-4 bg-red-50 p-3 rounded-lg border border-red-200">
                        {errorMsg}
                    </div>
                )}
                <div className="bg-gray-50 p-4 rounded-xl mb-2 border border-gray-100">
                    <span className="text-3xl font-black text-blue-600">
                        {loading ? '...' : (balance !== null ? (balance + bonusBalance).toLocaleString() : '0')} <span className="text-lg">{t('wallet.cashUnit')}</span>
                    </span>
                </div>
                {!loading && bonusBalance > 0 && (
                    <div className="flex justify-center gap-3 mb-4 text-xs">
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-bold border border-blue-100">{t('wallet.realBalance')} {(balance || 0).toLocaleString()}</span>
                        <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold border border-green-100">{t('wallet.bonusBalance')} {bonusBalance.toLocaleString()}</span>
                    </div>
                )}
                {/* 추천인 초대 배너 */}
                <div
                    onClick={() => router.push('/referral')}
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl p-4 mb-4 cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md"
                >
                    <p className="font-bold text-sm">🎁 {t('referral.inviteBanner')}</p>
                    <p className="text-xs text-blue-100 mt-0.5">Tap to invite friends →</p>
                </div>
                <button
                    onClick={() => setIsChargeModalOpen(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition mb-3"
                >
                    {t('wallet.chargeBtn')}
                </button>
                {false && (
                <button
                    onClick={() => setIsPayoutModalOpen(true)}
                    disabled={!balance || (balance ?? 0) <= 0}
                    className={`w-full font-bold py-4 rounded-xl transition mb-6 ${!balance || (balance ?? 0) <= 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                >
                    {t('wallet.payoutBtn')}
                </button>
                )}

                {/* 출금 신청 내역 */}
                {payoutHistory.length > 0 && (
                    <div className="text-left border-t border-gray-100 pt-4 mb-4">
                        <h2 className="text-sm font-bold text-gray-700 mb-3">{t('wallet.payoutHistoryTitle')}</h2>
                        <ul className="space-y-2">
                            {payoutHistory.map(p => (
                                <li key={p.id} className="bg-gray-50 border border-gray-100 p-3 rounded-lg flex justify-between items-center">
                                    <div>
                                        <p className="text-xs text-gray-400">{new Date(p.requested_at).toLocaleDateString()}</p>
                                        <p className="text-sm font-bold text-gray-800">{p.bank_name} {p.account_number}</p>
                                        <p className="text-xs text-gray-500">{p.account_holder}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-base font-bold text-green-600">{p.amount.toLocaleString()} {t('wallet.cashUnit')}</p>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'APPROVED' ? 'bg-green-100 text-green-600' :
                                                p.status === 'REJECTED' ? 'bg-red-100 text-red-500' :
                                                    p.status === 'HELD' ? 'bg-yellow-100 text-yellow-600' :
                                                        'bg-blue-100 text-blue-500'
                                            }`}>
                                            {p.status === 'APPROVED' ? t('wallet.statusApproved') : p.status === 'REJECTED' ? t('wallet.statusRejected') : p.status === 'HELD' ? t('wallet.statusHeld') : t('wallet.statusPending')}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* 원장 내역(Ledger) 영역 */}
                <div className="text-left border-t border-gray-100 pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800">{t('wallet.ledgerTitle')}</h2>
                    </div>

                    {/* 누적 합계 지표 */}
                    {!loading && ledger.length > 0 && (() => {
                        const filtered = ledger.filter(item => {
                            if (filterType === 'ALL') return true;
                            if (filterType === 'CHARGE') return item.amount > 0;
                            if (filterType === 'USAGE') return item.amount < 0;
                            return true;
                        });
                        const totalIn = filtered.filter(i => i.amount > 0).reduce((s, i) => s + Number(i.amount), 0);
                        const totalOut = filtered.filter(i => i.amount < 0).reduce((s, i) => s + Math.abs(Number(i.amount)), 0);
                        return (
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 text-center">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase mb-0.5">{t('wallet.totalCharged')}</p>
                                    <p className="text-base font-black text-blue-600">+{totalIn.toLocaleString()}</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3 border border-red-100 text-center">
                                    <p className="text-[10px] font-bold text-red-400 uppercase mb-0.5">{t('wallet.totalUsed')}</p>
                                    <p className="text-base font-black text-red-500">-{totalOut.toLocaleString()}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 필터 탭 */}
                    <div className="flex space-x-2 mb-4 bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('wallet.filterAll')}
                        </button>
                        <button
                            onClick={() => setFilterType('CHARGE')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === 'CHARGE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('wallet.filterCharge')}
                        </button>
                        <button
                            onClick={() => setFilterType('USAGE')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${filterType === 'USAGE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {t('wallet.filterUsage')}
                        </button>
                    </div>

                    {loading ? (
                        <p className="text-center text-gray-400 py-4">{t('wallet.loading')}</p>
                    ) : ledger.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                            <p className="text-sm text-gray-500">{t('wallet.noLedger')}</p>
                        </div>
                    ) : (
                        <ul className="space-y-3">
                            {(() => {
                                const filteredLedger = ledger.filter(item => {
                                    if (filterType === 'ALL') return true;
                                    if (filterType === 'CHARGE') return item.amount > 0;
                                    if (filterType === 'USAGE') return item.amount < 0;
                                    return true;
                                });

                                const filteredWithBalance = ledger.filter(item => {
                                    if (filterType === 'ALL') return true;
                                    if (filterType === 'CHARGE') return item.amount > 0;
                                    if (filterType === 'USAGE') return item.amount < 0;
                                    return true;
                                });

                                if (filteredWithBalance.length === 0) {
                                    return (
                                        <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-sm text-gray-500">{t('wallet.noFiltered')}</p>
                                        </div>
                                    );
                                }

                                return filteredWithBalance.map(item => {
                                    const isPositive = item.amount > 0;
                                    const operator = isPositive ? '+' : '';
                                    const colorClass = isPositive ? 'text-blue-600' : 'text-red-500';

                                    let txLabel = item.tx_type;
                                    if (item.tx_type === 'CHARGE') txLabel = t('wallet.txCharge');
                                    else if (item.tx_type === 'DEDUCT_QUOTE') txLabel = t('wallet.txDeductQuote');
                                    else if (item.tx_type === 'REFUND') txLabel = t('wallet.txRefund');
                                    else if (item.tx_type === 'BONUS') txLabel = t('wallet.txBonus');
                                    else if (item.tx_type === 'BONUS_REFUND') txLabel = t('wallet.txBonusRefund');
                                    else if (item.tx_type === 'ADMIN_CHARGE') txLabel = t('wallet.txAdminCharge');
                                    else if (item.tx_type === 'ADMIN_REFUND') txLabel = t('wallet.txAdminRefund');
                                    else if (item.tx_type === 'DEDUCT_BONUS_QUOTE') txLabel = t('wallet.txDeductBonusQuote');
                                    else if (item.tx_type === 'ADMIN_BONUS_CHARGE') txLabel = t('wallet.txAdminBonusCharge');
                                    else if (item.tx_type === 'ADMIN_BONUS_REFUND') txLabel = t('wallet.txAdminBonusRefund');
                                    else if (item.tx_type === 'SIGNUP_BONUS') txLabel = t('wallet.txSignupBonus');

                                    return (
                                        <li key={item.transaction_id} className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm flex justify-between items-center">
                                            <div>
                                                <p className="text-xs text-gray-400 mb-1">{new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-sm font-bold text-gray-800">{txLabel}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-base font-bold ${colorClass}`}>
                                                    {operator}{Math.abs(item.amount).toLocaleString()}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">{t('wallet.balanceLabel')}{item.balance_snapshot?.toLocaleString()}</p>
                                            </div>
                                        </li>
                                    );
                                })
                            })()}
                        </ul>
                    )}
                </div>
            </div>

            {/* 캐시 충전 선택 모달 */}
            {isChargeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 p-4 sm:items-center">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
                        <h2 className="text-xl font-bold text-center text-gray-800 mb-2">{t('wallet.chargeModalTitle')}</h2>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleChargeMock(100)}
                                className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-4 rounded-xl border border-blue-200 transition text-lg"
                            >
                                100 Credits
                            </button>
                            <button
                                onClick={() => handleChargeMock(300)}
                                className="w-full bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold py-4 rounded-xl border border-blue-300 transition text-lg"
                            >
                                300 Credits
                            </button>
                            <button
                                onClick={() => handleChargeMock(500)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition text-lg"
                            >
                                500 Credits <span className="text-sm bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full ml-1">BEST</span>
                            </button>
                        </div>
                        <button
                            onClick={() => setIsChargeModalOpen(false)}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition mt-2"
                        >
                            {t('wallet.chargeClose')}
                        </button>
                    </div>
                </div>
            )}

            {/* 출금 신청 모달 */}
            {isPayoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 p-4 sm:items-center">
                    <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl flex flex-col gap-4">
                        <h2 className="text-xl font-bold text-center text-gray-800 mb-2">{t('wallet.payoutModalTitle')}</h2>
                        <p className="text-xs text-gray-500 text-center -mt-2">{t('wallet.payoutAvailable')}<span className="font-bold text-blue-600">{(balance || 0).toLocaleString()} {t('wallet.cashUnit')}</span></p>
                        <div className="flex flex-col gap-3">
                            <input
                                type="number"
                                value={payoutAmount}
                                onChange={e => setPayoutAmount(e.target.value)}
                                placeholder={t('wallet.payoutAmountPlaceholder')}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <input
                                type="text"
                                value={payoutBankName}
                                onChange={e => setPayoutBankName(e.target.value)}
                                placeholder={t('wallet.payoutBankPlaceholder')}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <input
                                type="text"
                                value={payoutAccountNumber}
                                onChange={e => setPayoutAccountNumber(e.target.value)}
                                placeholder={t('wallet.payoutAccountPlaceholder')}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <input
                                type="text"
                                value={payoutAccountHolder}
                                onChange={e => setPayoutAccountHolder(e.target.value)}
                                placeholder={t('wallet.payoutHolderPlaceholder')}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-yellow-600 bg-yellow-50 p-3 rounded-xl border border-yellow-200">
                                {t('wallet.payoutWarning')}
                            </p>
                        </div>
                        <button
                            onClick={handlePayoutRequest}
                            disabled={isPayoutLoading}
                            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-md transition"
                        >
                            {isPayoutLoading ? t('wallet.payoutSubmitting') : t('wallet.payoutSubmitBtn')}
                        </button>
                        <button
                            onClick={() => setIsPayoutModalOpen(false)}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-4 rounded-xl transition"
                        >
                            {t('wallet.payoutClose')}
                        </button>
                    </div>
                </div>
            )}

            {/* 커스텀 인포 모달 */}
            {infoModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-3">
                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-4xl mb-1">
                                {infoModal.icon}
                            </div>
                            <h3 className="text-lg font-black text-gray-800">{infoModal.title}</h3>
                            <p className="text-sm text-gray-500 text-center whitespace-pre-line leading-relaxed">
                                {infoModal.message}
                            </p>
                        </div>
                        <div className="px-6 pb-6 flex flex-col gap-2">
                            {chargeAmountPending ? (
                                <>
                                    <button
                                        onClick={handleChargeMockConfirm}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition"
                                    >
                                        {t('wallet.chargeConfirmBtn')}
                                    </button>
                                    <button
                                        onClick={() => { setInfoModal(null); setChargeAmountPending(null); }}
                                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-3 rounded-xl transition"
                                    >
                                        {t('wallet.chargeCancelBtn')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setInfoModal(null)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition"
                                >
                                    {t('wallet.infoConfirmBtn')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
