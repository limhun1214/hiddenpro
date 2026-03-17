'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const fmtNum = (n: number) => n.toLocaleString();
const fmtDate = (d: string) => new Date(d).toLocaleString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function AdminReferralTab() {
    // Settings
    const [settings, setSettings] = useState<Record<string, number>>({
        referral_enabled: 1,
        referral_bonus_credits: 150,
        referral_coupon_amount: 200,
        coupon_expiry_days: 1095,
        bonus_credit_expiry_days: 1095,
    });
    const [settingsInputs, setSettingsInputs] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);

    // Stats
    const [stats, setStats] = useState({ totalReferrals: 0, completed: 0, pending: 0, activeCoupons: 0, usedCoupons: 0, expiredCoupons: 0 });

    // Referral list
    const [rewards, setRewards] = useState<any[]>([]);
    const [rewardsLoading, setRewardsLoading] = useState(false);
    const [rewardFilter, setRewardFilter] = useState<'all' | 'COMPLETED' | 'PENDING'>('all');

    // Coupon list
    const [coupons, setCoupons] = useState<any[]>([]);
    const [couponsLoading, setCouponsLoading] = useState(false);
    const [couponFilter, setCouponFilter] = useState<'all' | 'ACTIVE' | 'USED' | 'EXPIRED'>('all');

    // Sub-tab
    const [subTab, setSubTab] = useState<'overview' | 'referrals' | 'coupons'>('overview');

    const loadSettings = useCallback(async () => {
        const { data } = await supabase.from('platform_settings').select('key, value');
        if (data) {
            const referralKeys = ['referral_enabled', 'referral_bonus_credits', 'referral_coupon_amount', 'coupon_expiry_days', 'bonus_credit_expiry_days'];
            const map: Record<string, number> = {};
            const inputs: Record<string, string> = {};
            data.filter(s => referralKeys.includes(s.key)).forEach((s: any) => {
                map[s.key] = Number(s.value);
                inputs[s.key] = String(Number(s.value));
            });
            setSettings(prev => ({ ...prev, ...map }));
            setSettingsInputs(prev => ({ ...prev, ...inputs }));
        }
    }, []);

    const loadStats = useCallback(async () => {
        const { count: totalReferrals } = await supabase.from('referral_rewards').select('*', { count: 'exact', head: true });
        const { count: completed } = await supabase.from('referral_rewards').select('*', { count: 'exact', head: true }).eq('status', 'COMPLETED');
        const { count: pending } = await supabase.from('referral_rewards').select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
        const { count: activeCoupons } = await supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE');
        const { count: usedCoupons } = await supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('status', 'USED');
        const { count: expiredCoupons } = await supabase.from('coupons').select('*', { count: 'exact', head: true }).eq('status', 'EXPIRED');
        setStats({
            totalReferrals: totalReferrals || 0,
            completed: completed || 0,
            pending: pending || 0,
            activeCoupons: activeCoupons || 0,
            usedCoupons: usedCoupons || 0,
            expiredCoupons: expiredCoupons || 0,
        });
    }, []);

    const loadReferrals = useCallback(async () => {
        setRewardsLoading(true);
        let q = supabase.from('referral_rewards')
            .select('*, referrer:referrer_id(email, role, name), referred:referred_id(email, role, name)')
            .order('created_at', { ascending: false })
            .limit(100);
        if (rewardFilter !== 'all') q = q.eq('status', rewardFilter);
        const { data } = await q;
        if (data) setRewards(data);
        setRewardsLoading(false);
    }, [rewardFilter]);

    const loadCoupons = useCallback(async () => {
        setCouponsLoading(true);
        let q = supabase.from('coupons')
            .select('*, owner:owner_id(email, name), pro:used_by_pro_id(email, name)')
            .order('created_at', { ascending: false })
            .limit(100);
        if (couponFilter !== 'all') q = q.eq('status', couponFilter);
        const { data } = await q;
        if (data) setCoupons(data);
        setCouponsLoading(false);
    }, [couponFilter]);

    useEffect(() => { loadSettings(); loadStats(); }, []);
    useEffect(() => { if (subTab === 'referrals') loadReferrals(); }, [subTab, rewardFilter]);
    useEffect(() => { if (subTab === 'coupons') loadCoupons(); }, [subTab, couponFilter]);

    const handleSaveSetting = async (key: string, label: string) => {
        const val = Number(settingsInputs[key]);
        if (isNaN(val) || val < 0) { alert('Please enter a valid value.'); return; }
        setSavingKey(key);
        const { error } = await supabase.rpc('update_platform_setting', { p_key: key, p_value: val });
        if (error) {
            alert('Save failed: ' + error.message);
        } else {
            setSettings(prev => ({ ...prev, [key]: val }));
            alert(`${label} saved as ${fmtNum(val)}.`);
        }
        setSavingKey(null);
    };

    const settingsConfig = [
        { key: 'referral_enabled', t: 'Referral System ON/OFF', d: 'Set to 1 to enable, 0 to disable' },
        { key: 'referral_bonus_credits', t: 'Bonus Credits per Referral', d: 'Credits given for successful pro referral' },
        { key: 'referral_coupon_amount', t: 'Coupon Discount Amount', d: 'Discount amount for customer coupons' },
        { key: 'coupon_expiry_days', t: 'Coupon Expiry (Days)', d: 'Days before coupon expires (new issues only)' },
        { key: 'bonus_credit_expiry_days', t: 'Bonus Credit Expiry (Days)', d: 'Days before bonus credits expire (new issues only)' },
    ];

    const statusColor = (s: string) => ({
        COMPLETED: 'bg-green-900/50 text-green-300',
        PENDING: 'bg-yellow-900/50 text-yellow-300',
        CANCELLED: 'bg-gray-700/50 text-gray-400',
        ACTIVE: 'bg-green-900/50 text-green-300',
        USED: 'bg-blue-900/50 text-blue-300',
        EXPIRED: 'bg-red-900/50 text-red-300',
    }[s] || 'bg-gray-700/50 text-gray-400');

    return (
        <div>
            <h1 className="text-2xl font-black mb-6">🎁 Referral Management</h1>

            {/* Sub-tabs */}
            <div className="flex gap-2 mb-6">
                {(['overview', 'referrals', 'coupons'] as const).map(t => (
                    <button key={t} onClick={() => setSubTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${subTab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {t === 'overview' ? '📊 Overview & Settings' : t === 'referrals' ? '👥 Referral History' : '🎟️ Coupon Management'}
                    </button>
                ))}
            </div>

            {/* ═══ OVERVIEW & SETTINGS ═══ */}
            {subTab === 'overview' && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Total Referrals</p>
                            <p className="text-2xl font-black text-white">{fmtNum(stats.totalReferrals)}</p>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Rewards Completed</p>
                            <p className="text-2xl font-black text-green-400">{fmtNum(stats.completed)}</p>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Pending</p>
                            <p className="text-2xl font-black text-yellow-400">{fmtNum(stats.pending)}</p>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Active Coupons</p>
                            <p className="text-2xl font-black text-blue-400">{fmtNum(stats.activeCoupons)}</p>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Used Coupons</p>
                            <p className="text-2xl font-black text-purple-400">{fmtNum(stats.usedCoupons)}</p>
                        </div>
                        <div className="bg-[#1e2433] rounded-2xl p-5 border border-gray-700/50">
                            <p className="text-gray-400 text-sm">Expired Coupons</p>
                            <p className="text-2xl font-black text-red-400">{fmtNum(stats.expiredCoupons)}</p>
                        </div>
                    </div>

                    {/* Referral Settings */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">
                        <h2 className="text-lg font-bold text-white mb-2">⚙️ Referral Settings</h2>
                        {settingsConfig.map((s, i) => (
                            <div key={s.key} className={i > 0 ? 'border-t border-gray-700 pt-6' : ''}>
                                <h3 className="text-base font-bold mb-1">{s.t}</h3>
                                <p className="text-gray-400 text-sm mb-3">{s.d} (Current: <span className="text-white font-bold">{fmtNum(settings[s.key] ?? 0)}</span>)</p>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        value={settingsInputs[s.key] ?? String(settings[s.key] ?? 0)}
                                        onChange={e => setSettingsInputs(prev => ({ ...prev, [s.key]: e.target.value }))}
                                        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        disabled={savingKey === s.key}
                                        onClick={() => handleSaveSetting(s.key, s.t)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                                    >
                                        {savingKey === s.key ? 'Saving...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ═══ REFERRAL HISTORY ═══ */}
            {subTab === 'referrals' && (
                <>
                    <div className="flex gap-2 mb-4">
                        {(['all', 'COMPLETED', 'PENDING'] as const).map(f => (
                            <button key={f} onClick={() => setRewardFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${rewardFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase whitespace-nowrap">
                                    <th className="p-3 text-left">Referrer</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-left">Referred</th>
                                    <th className="p-3 text-left">Role</th>
                                    <th className="p-3 text-center">Trigger</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-right">Referrer Reward</th>
                                    <th className="p-3 text-right">Referred Reward</th>
                                    <th className="p-3 text-center">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rewardsLoading ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">Loading...</td></tr>
                                ) : rewards.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">No referral records.</td></tr>
                                ) : rewards.map(r => (
                                    <tr key={r.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 whitespace-nowrap">
                                        <td className="p-3 text-white font-medium">{r.referrer?.name || r.referrer?.email?.split('@')[0] || '—'}</td>
                                        <td className="p-3 text-gray-400 text-xs">{r.referrer_role}</td>
                                        <td className="p-3 text-blue-300 font-medium">{r.referred?.name || r.referred?.email?.split('@')[0] || '—'}</td>
                                        <td className="p-3 text-gray-400 text-xs">{r.referred_role}</td>
                                        <td className="p-3 text-center text-xs text-gray-400">{r.trigger_event === 'FIRST_QUOTE_SENT' ? '📋 1st Quote' : '📝 1st Request'}</td>
                                        <td className="p-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{r.status}</span></td>
                                        <td className="p-3 text-right text-sm font-bold">{r.referrer_reward_type === 'BONUS_CREDITS' ? `+${r.referrer_reward_amount} Credits` : `Coupon ${r.referrer_reward_amount}`}</td>
                                        <td className="p-3 text-right text-sm font-bold">{r.referred_reward_type === 'BONUS_CREDITS' ? `+${r.referred_reward_amount} Credits` : `Coupon ${r.referred_reward_amount}`}</td>
                                        <td className="p-3 text-center text-gray-400 text-xs">{fmtDate(r.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ═══ COUPON MANAGEMENT ═══ */}
            {subTab === 'coupons' && (
                <>
                    <div className="flex gap-2 mb-4">
                        {(['all', 'ACTIVE', 'USED', 'EXPIRED'] as const).map(f => (
                            <button key={f} onClick={() => setCouponFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${couponFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                                {f === 'all' ? 'All' : f}
                            </button>
                        ))}
                    </div>
                    <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase whitespace-nowrap">
                                    <th className="p-3 text-left">Code</th>
                                    <th className="p-3 text-left">Owner</th>
                                    <th className="p-3 text-right">Amount</th>
                                    <th className="p-3 text-center">Status</th>
                                    <th className="p-3 text-left">Redeemed By</th>
                                    <th className="p-3 text-center">Source</th>
                                    <th className="p-3 text-center">Issued</th>
                                    <th className="p-3 text-center">Expires</th>
                                    <th className="p-3 text-center">Used At</th>
                                </tr>
                            </thead>
                            <tbody>
                                {couponsLoading ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">Loading...</td></tr>
                                ) : coupons.length === 0 ? (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">No coupons.</td></tr>
                                ) : coupons.map(c => (
                                    <tr key={c.coupon_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 whitespace-nowrap">
                                        <td className="p-3 font-mono text-white text-xs">{c.coupon_code}</td>
                                        <td className="p-3 text-gray-300">{c.owner?.name || c.owner?.email?.split('@')[0] || '—'}</td>
                                        <td className="p-3 text-right font-bold text-blue-400">{fmtNum(c.discount_amount)}</td>
                                        <td className="p-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(c.status)}`}>{c.status}</span></td>
                                        <td className="p-3 text-gray-400">{c.pro?.name || c.pro?.email?.split('@')[0] || '—'}</td>
                                        <td className="p-3 text-center text-xs text-gray-400">{c.source}</td>
                                        <td className="p-3 text-center text-gray-400 text-xs">{fmtDate(c.created_at)}</td>
                                        <td className="p-3 text-center text-gray-400 text-xs">{new Date(c.expires_at).toLocaleDateString()}</td>
                                        <td className="p-3 text-center text-gray-400 text-xs">{c.used_at ? fmtDate(c.used_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
