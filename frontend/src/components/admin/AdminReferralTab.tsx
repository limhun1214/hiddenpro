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

    // Banner management
    const [banners, setBanners] = useState<any[]>([]);
    const [bannersLoading, setBannersLoading] = useState(false);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [newBannerTitle, setNewBannerTitle] = useState('');
    const [newBannerType, setNewBannerType] = useState<'horizontal' | 'vertical' | 'square' | 'custom'>('horizontal');
    const [newBannerPlatform, setNewBannerPlatform] = useState('Facebook, Viber, Blog');
    const bannerFileRef = React.useRef<HTMLInputElement>(null);

    // Sub-tab
    const [subTab, setSubTab] = useState<'overview' | 'referrals' | 'coupons' | 'banners'>('overview');

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

    const loadBanners = useCallback(async () => {
        setBannersLoading(true);
        const { data } = await supabase
            .from('referral_banners')
            .select('*')
            .order('sort_order', { ascending: true });
        if (data) setBanners(data);
        setBannersLoading(false);
    }, []);

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

    useEffect(() => { loadSettings(); loadStats(); loadBanners(); }, []);
    useEffect(() => { if (subTab === 'referrals') loadReferrals(); }, [subTab, rewardFilter]);
    useEffect(() => { if (subTab === 'coupons') loadCoupons(); }, [subTab, couponFilter]);
    useEffect(() => { if (subTab === 'banners') loadBanners(); }, [subTab]);

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

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !newBannerTitle.trim()) { alert('Please enter a title and select an image.'); return; }
        setBannerUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `referral_banners/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
            const { error: upErr } = await supabase.storage.from('quote_images').upload(filePath, file, { upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = supabase.storage.from('quote_images').getPublicUrl(filePath);

            const img = new Image();
            img.onload = async () => {
                const { error: insertErr } = await supabase.from('referral_banners').insert({
                    title: newBannerTitle.trim(),
                    image_url: urlData.publicUrl,
                    banner_type: newBannerType,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    platform_hint: newBannerPlatform,
                    is_active: true,
                    sort_order: banners.length,
                });
                if (insertErr) { alert('Save failed: ' + insertErr.message); }
                else {
                    setNewBannerTitle('');
                    loadBanners();
                }
                setBannerUploading(false);
            };
            img.onerror = () => { alert('Image load failed'); setBannerUploading(false); };
            img.src = urlData.publicUrl;
        } catch (err: any) {
            alert('Upload failed: ' + err.message);
            setBannerUploading(false);
        }
        if (bannerFileRef.current) bannerFileRef.current.value = '';
    };

    const toggleBannerActive = async (id: number, currentActive: boolean) => {
        await supabase.from('referral_banners').update({ is_active: !currentActive }).eq('id', id);
        loadBanners();
    };

    const toggleBannerDefault = async (id: number) => {
        await supabase.from('referral_banners').update({ is_default: false }).neq('id', 0);
        await supabase.from('referral_banners').update({ is_default: true }).eq('id', id);
        loadBanners();
    };

    const deleteBanner = async (id: number) => {
        if (!confirm('Delete this banner?')) return;
        await supabase.from('referral_banners').delete().eq('id', id);
        loadBanners();
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
                {(['overview', 'referrals', 'coupons', 'banners'] as const).map(t => (
                    <button key={t} onClick={() => setSubTab(t)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${subTab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {t === 'overview' ? '📊 Overview & Settings' : t === 'referrals' ? '👥 Referral History' : t === 'coupons' ? '🎟️ Coupon Management' : '🖼️ Banner Management'}
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
            {/* ═══ BANNER MANAGEMENT ═══ */}
            {subTab === 'banners' && (
                <>
                    {/* Upload form */}
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 mb-6 space-y-4">
                        <h3 className="text-sm font-bold text-white">Upload New Banner (Max 4)</h3>
                        {banners.length >= 4 ? (
                            <p className="text-yellow-400 text-sm">Maximum 4 banners reached. Delete one to upload a new banner.</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-400 font-bold block mb-1">Title</label>
                                        <input type="text" value={newBannerTitle} onChange={e => setNewBannerTitle(e.target.value)} placeholder="e.g. Facebook Banner" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 font-bold block mb-1">Type</label>
                                        <select value={newBannerType} onChange={e => setNewBannerType(e.target.value as any)} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                            <option value="horizontal">Horizontal (1200×628)</option>
                                            <option value="vertical">Vertical (1080×1920)</option>
                                            <option value="square">Square (1080×1080)</option>
                                            <option value="custom">Custom</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 font-bold block mb-1">Platform Hint</label>
                                    <input type="text" value={newBannerPlatform} onChange={e => setNewBannerPlatform(e.target.value)} placeholder="e.g. Facebook, Viber, Blog" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <input ref={bannerFileRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" id="banner-upload" />
                                    <label htmlFor="banner-upload" className={`px-5 py-2.5 rounded-lg font-bold text-sm cursor-pointer transition ${bannerUploading || !newBannerTitle.trim() ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                                        {bannerUploading ? 'Uploading...' : '📤 Select Image & Upload'}
                                    </label>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Banner list */}
                    <div className="space-y-4">
                        {bannersLoading ? (
                            <p className="text-center text-gray-500 py-8">Loading...</p>
                        ) : banners.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No banners uploaded yet.</p>
                        ) : banners.map(b => (
                            <div key={b.id} className={`bg-gray-800 rounded-xl border ${b.is_default ? 'border-yellow-500' : 'border-gray-700'} overflow-hidden`}>
                                <div className="p-3 bg-gray-900/50">
                                    <img src={b.image_url} alt={b.title} className="w-full max-h-[200px] object-contain rounded-lg" />
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-bold text-white">{b.title} {b.is_default && <span className="text-yellow-400 text-xs ml-1">⭐ DEFAULT OG</span>}</p>
                                        <p className="text-xs text-gray-400">📐 {b.width}×{b.height} · 📱 {b.platform_hint} · {b.banner_type}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => toggleBannerDefault(b.id)} className={`text-xs px-2 py-1 rounded font-bold ${b.is_default ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                            {b.is_default ? '⭐ Default' : 'Set Default'}
                                        </button>
                                        <button onClick={() => toggleBannerActive(b.id, b.is_active)} className={`text-xs px-2 py-1 rounded font-bold ${b.is_active ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                            {b.is_active ? 'Active' : 'Hidden'}
                                        </button>
                                        <button onClick={() => deleteBanner(b.id)} className="text-xs px-2 py-1 rounded font-bold bg-red-600 text-white hover:bg-red-500">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
