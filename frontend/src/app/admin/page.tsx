'use client';
export const runtime = 'edge';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminRole, maskPrivateInfo } from '@/lib/adminAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { optimizeImage } from '@/utils/imageOptimizer';
import { useToast } from '@/components/ui/Toast';
// ─── 타입 ───
type AdminTab = 'dashboard' | 'ledger' | 'pro' | 'customer' | 'admin_mgmt' | 'quotes' | 'reviews' | 'search_logs' | 'settings' | 'cms' | 'inquiries' | 'categories' | 'abuse' | 'reports' | 'payout' | 'audit_log';
type UserDetailTab = 'info' | 'ledger' | 'quotes' | 'reviews';

const txLabel = (t: string) => ({ CHARGE: '충전', DEDUCT_QUOTE: '견적 차감', REFUND: '환불', BONUS: '보너스', ADMIN_CHARGE: '관리자 충전', ADMIN_REFUND: '관리자 환불', ADMIN_DEDUCT: '관리자 차감', BONUS_REFUND: '미열람 보상', ADMIN_BONUS_CHARGE: '관리자 보너스 지급', ADMIN_BONUS_REFUND: '관리자 보너스 차감' }[t] || t);
const txDesc = (txType: string, desc: string | null | undefined): string => {
    if (desc) return desc;
    if (['CHARGE', 'ADMIN_CHARGE', 'ADMIN_BONUS_CHARGE', 'BONUS'].includes(txType)) return '캐시 충전';
    if (txType === 'DEDUCT_QUOTE') return '견적 발송';
    if (['REFUND', 'ADMIN_REFUND', 'BONUS_REFUND'].includes(txType)) return '캐시 환불';
    return '-';
};
type LedgerCategory = 'all' | 'DEDUCT_QUOTE' | 'ADMIN_CHARGE' | 'CHARGE' | 'REFUND';
type LedgerPeriod = 'all' | 'today' | '7d' | '30d' | '90d';
const fmtDate = (d: string) => new Date(d).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const fmtNum = (n: number) => n.toLocaleString();
const statusLabel = (s: string) => ({ OPEN: '대기 중', MATCHED: '매칭 완료', EXPIRED: '만료됨', CLOSED: '종료' }[s] || s);
const statusColor = (s: string) => ({ OPEN: 'bg-green-900/50 text-green-300', MATCHED: 'bg-blue-900/50 text-blue-300', EXPIRED: 'bg-gray-700/50 text-gray-400', CLOSED: 'bg-gray-700/50 text-gray-400' }[s] || 'bg-gray-700/50 text-gray-400');

function AdminDashboardPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [authorized, setAuthorized] = useState(false);
    const [loading, setLoading] = useState(true);
    const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
    const validTabs: AdminTab[] = ['dashboard', 'ledger', 'pro', 'customer', 'admin_mgmt', 'quotes', 'reviews', 'search_logs', 'settings', 'cms', 'inquiries', 'categories', 'abuse', 'reports', 'payout', 'audit_log'];
    const initialTab = (searchParams.get('tab') as AdminTab) || 'dashboard';
    const [tab, setTab] = useState<AdminTab>(validTabs.includes(initialTab) ? initialTab : 'dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(['pro', 'customer', 'admin_mgmt'].includes(initialTab));
    const [group1Open, setGroup1Open] = useState(['dashboard', 'search_logs'].includes(initialTab) || initialTab === 'dashboard');
    const [group3Open, setGroup3Open] = useState(['ledger', 'payout'].includes(initialTab));
    const [group4Open, setGroup4Open] = useState(['quotes', 'reviews'].includes(initialTab));
    const [group5Open, setGroup5Open] = useState(['inquiries', 'abuse', 'reports'].includes(initialTab));
    const [group6Open, setGroup6Open] = useState(['categories', 'cms', 'audit_log', 'settings'].includes(initialTab));

    // Dashboard
    const [stats, setStats] = useState({ customers: 0, pros: 0, openReq: 0, closedReq: 0, charge24h: 0, deduct24h: 0, abuseCount: 0, pendingReports: 0, payoutPending: 0, payoutHeld: 0 });
    const [pendingInquiries, setPendingInquiries] = useState(0)

    // Ledger Tab
    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [ledgerTotal, setLedgerTotal] = useState(0);
    const [ledgerPage, setLedgerPage] = useState(1);
    const [ledgerCategory, setLedgerCategory] = useState<LedgerCategory>('all');
    const [ledgerPeriod, setLedgerPeriod] = useState<LedgerPeriod>('all');
    const [ledgerSearch, setLedgerSearch] = useState('');
    const [ledgerSearchInput, setLedgerSearchInput] = useState('');
    const [ledgerStats, setLedgerStats] = useState({ totalIn: 0, totalOut: 0, filtered: 0 });
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [totalProBalance, setTotalProBalance] = useState(0);
    const [drilldown, setDrilldown] = useState<{ proId: string; proName: string; proEmail: string; proPhone: string; txs: any[]; loading: boolean } | null>(null);
    const [drilldownFilter, setDrilldownFilter] = useState<'all' | 'DEDUCT_QUOTE' | 'CHARGE' | 'REFUND'>('all');
    const LEDGER_PAGE_SIZE = 50;

    // Pro Management
    const [pros, setPros] = useState<any[]>([]);
    const [proSearch, setProSearch] = useState('');
    const [proFilter, setProFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended' | 'deleted'>('all');

    // Customer Management
    const [customers, setCustomers] = useState<any[]>([]);
    const [custSearch, setCustSearch] = useState('');

    // Admin Management
    const [admins, setAdmins] = useState<any[]>([]);
    const [promoteEmail, setPromoteEmail] = useState('');
    const [promoteRole, setPromoteRole] = useState<'ADMIN_OPERATION' | 'ADMIN_VIEWER'>('ADMIN_OPERATION');
    const [promoting, setPromoting] = useState(false);
    const [revokeLoading, setRevokeLoading] = useState<string | null>(null);
    const [modal, setModal] = useState<{
        type: 'success' | 'error' | 'confirm';
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    // Suspend Reason Modal
    const [suspendReasonModal, setSuspendReasonModal] = useState<{
        isOpen: boolean;
        userId: string;
        currentStatus: string;
        isPro: boolean;
        reason: string;
    } | null>(null);

    // Cash Modal
    const [cashModal, setCashModal] = useState<{ pro: any; type: 'charge' | 'refund' } | null>(null);
    const [cashAmount, setCashAmount] = useState('');
    const [cashDesc, setCashDesc] = useState('');
    const [cashType, setCashType] = useState<'REAL' | 'BONUS'>('REAL'); // [보너스 캐시 확장] 캐시 유형 선택
    const [cashProcessing, setCashProcessing] = useState(false);

    // Quotes/Matching
    const [requests, setRequests] = useState<any[]>([]);
    const [reqFilter, setReqFilter] = useState<'all' | 'OPEN' | 'MATCHED' | 'EXPIRED'>('all');
    const [reqCategory, setReqCategory] = useState<string>('all');
    const [reqStartDate, setReqStartDate] = useState<string>('');
    const [reqEndDate, setReqEndDate] = useState<string>('');
    const [reqSearch, setReqSearch] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<any>(null);

    // CS Control Mode States
    const [csContactInfo, setCsContactInfo] = useState<{ customer: any; pro: any } | null>(null);
    const [chatLogs, setChatLogs] = useState<any[]>([]);
    const [isChatOpen, setIsChatOpen] = useState(false);

    // CS 채팅 내역 섹션
    const [csChatRoomId, setCsChatRoomId] = useState<string | null | undefined>(undefined);
    const [csChatMessages, setCsChatMessages] = useState<any[]>([]);
    const [csChatLoading, setCsChatLoading] = useState(false);
    const [csChatHasMore, setCsChatHasMore] = useState(false);
    const [csChatOffset, setCsChatOffset] = useState(0);
    const [csChatModal, setCsChatModal] = useState<{ proName: string; customerName: string; customerId: string } | null>(null);

    // Danger Zone States
    const [suspendModal, setSuspendModal] = useState<{ isOpen: boolean; userId: string; role: 'PRO' | 'CUSTOMER' | ''; currentStatus: string } | null>(null);
    const [suspendReason, setSuspendReason] = useState('');

    // CS 견적 고수 상세 팝업
    const [proDetailModal, setProDetailModal] = useState<{ proId: string } | null>(null);
    const [proDetailData, setProDetailData] = useState<any>(null);
    const [proDetailLoading, setProDetailLoading] = useState(false);
    const [proDetailTab, setProDetailTab] = useState<'info' | 'ledger' | 'quotes' | 'reviews'>('info');
    const [proDetailTabData, setProDetailTabData] = useState<{ ledger?: any[]; quotes?: any[]; reviews?: any[] }>({});
    const [proDetailTabLoading, setProDetailTabLoading] = useState(false);
    const [proDetailLedgerOffset, setProDetailLedgerOffset] = useState(0);
    const [proDetailLedgerHasMore, setProDetailLedgerHasMore] = useState(false);

    // Reviews
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewSearch, setReviewSearch] = useState('');

    // User Detail Panel
    const [userDetail, setUserDetail] = useState<{ userId: string; role: 'PRO' | 'CUSTOMER' } | null>(null);
    const [userDetailTab, setUserDetailTab] = useState<UserDetailTab>('info');
    const [detailData, setDetailData] = useState<any>({});
    const [adminId, setAdminId] = useState<string>('');

    // Platform Settings
    const [platformSettings, setPlatformSettings] = useState<Record<string, number>>({
        quote_cost: 500,
        max_quotes_per_request: 5,
        signup_bonus: 0,
    });
    const [settingsInputs, setSettingsInputs] = useState<Record<string, string>>({});
    const [savingKey, setSavingKey] = useState<string | null>(null);
    // ── [확장] 테스트 데이터 초기화 ──
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetConfirmText, setResetConfirmText] = useState('');
    const [resetting, setResetting] = useState(false);

    // CMS Management
    const [cmsBanners, setCmsBanners] = useState<any[]>([]);
    const [cmsCategories, setCmsCategories] = useState<any[]>([]);
    const [cmsUploading, setCmsUploading] = useState(false);

    // Support CMS & Legal V2
    const [supportCategories, setSupportCategories] = useState<any[]>([]);
    const [supportPages, setSupportPages] = useState<any[]>([]);
    const [legalDocs, setLegalDocs] = useState<any[]>([]);
    const [editingSupportPage, setEditingSupportPage] = useState<any | null>(null);
    const [editingLegalDoc, setEditingLegalDoc] = useState<any | null>(null);

    // Platform Categories (Differential Pricing)
    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [categoryDepth1Filter, setCategoryDepth1Filter] = useState<string>('all');
    const [categoryDepth2Filter, setCategoryDepth2Filter] = useState<string>('all');
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [deletingCategory, setDeletingCategory] = useState<any | null>(null);

    // Inquiries Management
    const [inquiries, setInquiries] = useState<any[]>([]);
    const [inquiriesFilter, setInquiriesFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
    const [inquiriesCategory, setInquiriesCategory] = useState('all');
    const [inquiriesSearch, setInquiriesSearch] = useState('');
    const [inquiriesLoading, setInquiriesLoading] = useState(false);
    const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
    const [inquiriesPage, setInquiriesPage] = useState(1);
    const [inquiriesTotalCount, setInquiriesTotalCount] = useState(0);
    const INQUIRIES_PAGE_SIZE = 20;
    const [inquiryStatusUpdating, setInquiryStatusUpdating] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [replySaving, setReplySaving] = useState(false);
    const [replyImages, setReplyImages] = useState<File[]>([]);
    const [replyImagePreviews, setReplyImagePreviews] = useState<string[]>([]);

    // Search Logs
    const [searchLogs, setSearchLogs] = useState<any[]>([]);
    const [searchLogsLoading, setSearchLogsLoading] = useState(false);
    const [selectedCategoryMapping, setSelectedCategoryMapping] = useState<Record<string, string>>({});
    const MAPPING_CATEGORIES = ['이사/청소', '설치/수리', '인테리어/시공', '비즈니스/외주', '이벤트/파티', '레슨/튜터링'];

    // ── [확장] 어뷰징/패널티 관리 ──
    const [abuseData, setAbuseData] = useState<any[]>([]);
    const [abuseLoading, setAbuseLoading] = useState(false);
    const [abuseFilter, setAbuseFilter] = useState<'flagged' | 'all'>('flagged');
    const [unflagConfirmModal, setUnflagConfirmModal] = useState<{ userId: string; nickname: string } | null>(null);
    const ABUSE_PAGE_SIZE = 50;
    // ── [확장] 제재 이력 타임라인 ──
    const [abuseTimeline, setAbuseTimeline] = useState<{ user: any; logs: any[]; loading: boolean } | null>(null);

    // 신고 관리 state
    const [reports, setReports] = useState<any[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [chatPreview, setChatPreview] = useState<{ reportId: string; messages: any[] } | null>(null);
    const [suspendType, setSuspendType] = useState<'warning' | 'temporary' | 'permanent'>('warning');
    const [suspendDays, setSuspendDays] = useState(1);
    const [suspendSubmitting, setSuspendSubmitting] = useState(false);
    const [reportSuspendModal, setReportSuspendModal] = useState<{
        userId: string;
        role: 'PRO' | 'CUSTOMER' | '';
        currentStatus: string;
    } | null>(null);
    const [reportSuspendReason, setReportSuspendReason] = useState('');
    const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'reviewed'>('all');
    const [reportSearch, setReportSearch] = useState('');
    const [reportSort, setReportSort] = useState<'latest' | 'most_reported'>('latest');

    const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
    const [payoutLoading, setPayoutLoading] = useState(false);
    const [payoutActionLoading, setPayoutActionLoading] = useState<string | null>(null);
    const [payoutNote, setPayoutNote] = useState<{ [key: string]: string }>({});
    const [payoutFilter, setPayoutFilter] = useState<'all' | 'PENDING' | 'HELD' | 'APPROVED' | 'REJECTED'>('all');

    // Audit Log
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditFilter, setAuditFilter] = useState<'all' | 'CASH_CHARGE' | 'CASH_REFUND' | 'PAYOUT_APPROVE' | 'PAYOUT_REJECT' | 'SUSPEND' | 'UNSUSPEND' | 'DELETE' | 'REVIEW_BLIND' | 'REVIEW_DELETE' | 'ADMIN_ROLE_CHANGE'>('all');
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);
    const AUDIT_PAGE_SIZE = 50;

    // ─── 비활성 자동 로그아웃 ───
    const ADMIN_TIMEOUT_MS = 30 * 60 * 1000   // 30분
    const ADMIN_WARN_BEFORE_MS = 30 * 1000    // 30초 전 경고
    const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

    // ─── Auth Guard (Race Condition 방어: 세션 복원 재시도 포함) ───
    useEffect(() => {
        let isMounted = true;
        const checkAuth = async () => {
            try {
                let session = (await supabase.auth.getSession()).data.session;
                console.log('[CG_DEBUG] Initial session:', !!session, 'user:', session?.user?.id);
                // Race Condition 방어: Supabase 초기화 전 null 반환 시 1회 재시도
                if (!session) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    if (!isMounted) return;
                    session = (await supabase.auth.getSession()).data.session;
                    console.log('[CG_DEBUG] Retried session:', !!session);
                }
                if (!isMounted) return;
                if (!session?.user) {
                    console.log('[CG_DEBUG] No session user, redirecting...');
                    router.replace('/');
                    return;
                }

                // JWT app_metadata/user_metadata에서 role 읽기 (DB 조회 제거 — N+1 방지)
                const role =
                    session.user.app_metadata?.role ||
                    session.user.user_metadata?.role ||
                    null;
                console.log('[CG_DEBUG] JWT role:', role);

                if (!isMounted) return;
                const allowedAdminRoles: AdminRole[] = ['ADMIN', 'ADMIN_OPERATION', 'ADMIN_VIEWER'];
                if (!allowedAdminRoles.includes(role as AdminRole)) {
                    console.log('[CG_DEBUG] Role not allowed, redirecting...');
                    alert('관리자 계정만 접근할 수 있습니다.');
                    router.replace('/');
                    return;
                }
                setAdminId(session.user.id);
                setAdminRole(role as AdminRole);
                setAuthorized(true);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        checkAuth();
        return () => { isMounted = false; };
    }, [router]);

    // ─── 비활성 자동 로그아웃 타이머 ───
    useEffect(() => {
        if (!authorized) return;

        let warnTimer: ReturnType<typeof setTimeout>;
        let logoutTimer: ReturnType<typeof setTimeout>;

        const resetTimers = () => {
            clearTimeout(warnTimer);
            clearTimeout(logoutTimer);
            setShowTimeoutWarning(false);
            warnTimer = setTimeout(() => {
                setShowTimeoutWarning(true);
            }, ADMIN_TIMEOUT_MS - ADMIN_WARN_BEFORE_MS);
            logoutTimer = setTimeout(async () => {
                await supabase.auth.signOut();
                router.replace('/');
            }, ADMIN_TIMEOUT_MS);
        };

        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
        events.forEach(e => window.addEventListener(e, resetTimers));
        resetTimers();

        return () => {
            clearTimeout(warnTimer);
            clearTimeout(logoutTimer);
            events.forEach(e => window.removeEventListener(e, resetTimers));
        };
    }, [authorized, router]);

    // ─── Data Loaders ───
    const loadDashboard = useCallback(async () => {
        const [{ count: cc }, { count: pc }, { count: oc }, { count: clc }, { count: ac }, { count: rc }, { count: ppending }, { count: pheld }] = await Promise.all([
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'CUSTOMER'),
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'PRO'),
            supabase.from('match_requests').select('*', { count: 'exact', head: true }).eq('status', 'OPEN'),
            supabase.from('match_requests').select('*', { count: 'exact', head: true }).neq('status', 'OPEN'),
            supabase.from('user_penalty_stats').select('*', { count: 'exact', head: true }).eq('is_flagged', true),
            supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('payout_requests').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
            supabase.from('payout_requests').select('*', { count: 'exact', head: true }).eq('status', 'HELD'),
        ]);
        const since = new Date(Date.now() - 86400000).toISOString();
        const { data: l24 } = await supabase.from('cash_ledger').select('amount').gte('created_at', since);
        let c24 = 0, d24 = 0;
        (l24 || []).forEach(t => { if (t.amount > 0) c24 += Number(t.amount); else d24 += Math.abs(Number(t.amount)); });
        setStats({ customers: cc || 0, pros: pc || 0, openReq: oc || 0, closedReq: clc || 0, charge24h: c24, deduct24h: d24, abuseCount: ac || 0, pendingReports: rc || 0, payoutPending: ppending || 0, payoutHeld: pheld || 0 });

        // 미답변 1:1 문의 수
        const { count: inquiryCount } = await supabase
          .from('inquiries')
          .select('*', { count: 'exact', head: true })
          .neq('status', 'resolved')
          .is('admin_reply', null)

        setPendingInquiries(inquiryCount || 0)
    }, []);

    const loadLedger = useCallback(async (page = 1, category: LedgerCategory = 'all', period: LedgerPeriod = 'all', search = '') => {
        setLedgerLoading(true);
        try {
            // 1. Build base query for paginated data
            let q = supabase.from('cash_ledger').select('*', { count: 'exact' });
            // Category filter
            const refundTypes = ['REFUND', 'ADMIN_REFUND'];
            if (category === 'REFUND') { q = q.in('tx_type', refundTypes); }
            else if (category !== 'all') { q = q.eq('tx_type', category); }
            // Period filter
            if (period !== 'all') {
                const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
                q = q.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());
            }
            // Search: we'll filter after join. For now, fetch more if searching.
            const offset = (page - 1) * LEDGER_PAGE_SIZE;
            q = q.order('created_at', { ascending: false });

            if (!search) {
                q = q.range(offset, offset + LEDGER_PAGE_SIZE - 1);
            }

            const { data: rawLedger, count } = await q;
            const rows = rawLedger || [];

            // 2. Join pro info (name, email, phone) from users table
            const proIds = Array.from(new Set(rows.map(r => r.pro_id).filter(Boolean)));
            let proMap: Record<string, { name: string; nickname: string; phone: string; email: string }> = {};
            if (proIds.length > 0) {
                const { data: usersData } = await supabase.from('users').select('user_id, name, nickname, phone').in('user_id', proIds);
                const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: proIds });
                const emailMap: Record<string, string> = {};
                if (emails) (emails as any[]).forEach(e => { emailMap[e.user_id] = e.email; });
                (usersData || []).forEach(u => {
                    proMap[u.user_id] = { name: u.name || '', nickname: u.nickname || '', phone: u.phone || '', email: emailMap[u.user_id] || '' };
                });
            }

            let enriched = rows.map(r => ({
                ...r,
                proName: proMap[r.pro_id]?.nickname || proMap[r.pro_id]?.name || '',
                proEmail: proMap[r.pro_id]?.email || '',
                proPhone: proMap[r.pro_id]?.phone || '',
            }));

            // 3. If search, filter then paginate client-side
            let totalCount = count || 0;
            if (search) {
                const q2 = search.toLowerCase();
                enriched = enriched.filter(r =>
                    [r.proName, r.proEmail, r.proPhone, r.pro_id].some(v => (v || '').toLowerCase().includes(q2))
                );
                totalCount = enriched.length;
                enriched = enriched.slice(offset, offset + LEDGER_PAGE_SIZE);
            }

            // 4. Compute aggregated stats for the CURRENT filter (category+period)
            let statsQ = supabase.from('cash_ledger').select('amount, tx_type');
            if (category === 'REFUND') { statsQ = statsQ.in('tx_type', refundTypes); }
            else if (category !== 'all') { statsQ = statsQ.eq('tx_type', category); }
            if (period !== 'all') {
                const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
                statsQ = statsQ.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());
            }
            const { data: statsRows } = await statsQ;
            let totalIn = 0, totalOut = 0;
            (statsRows || []).forEach(r => {
                const a = Number(r.amount);
                if (a > 0) totalIn += a; else totalOut += Math.abs(a);
            });

            // 5. Total platform liability: sum of all pro current_cash
            const { data: allProCash } = await supabase.rpc('get_all_pro_profiles');
            let tpb = 0;
            (allProCash || []).forEach((p: any) => { tpb += Number(p.current_cash || 0); });
            setTotalProBalance(tpb);

            setLedgerData(enriched);
            setLedgerTotal(totalCount);
            setLedgerStats({ totalIn, totalOut, filtered: totalCount });
        } finally {
            setLedgerLoading(false);
        }
    }, []);

    const loadPros = useCallback(async () => {
        // ① users 테이블(role='PRO')을 기준 테이블로 사용 (대시보드 카운트와 동일 소스)
        const { data: allUsers } = await supabase.from('users').select('user_id, name, nickname, phone, status, created_at').eq('role', 'PRO');
        // ② pro_profiles 보조 데이터 조회 (SECURITY DEFINER RPC로 RLS 우회)
        const { data: proData } = await supabase.rpc('get_all_pro_profiles');
        const proMap: Record<string, any> = {};
        (proData || []).forEach((p: any) => { proMap[p.pro_id] = p; });
        // ③ auth.users에서 이메일 조회 (allUsers 기반)
        const userIds = (allUsers || []).map(u => u.user_id);
        let emailMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: userIds });
            if (emails) {
                (emails as any[]).forEach(e => { emailMap[e.user_id] = e.email; });
            }
        }
        // ④ users 기준 병합: pro_profiles가 없어도 리스트에 반드시 노출
        const merged = (allUsers || []).map(u => {
            const p = proMap[u.user_id] || {};
            return {
                pro_id: u.user_id,
                name: u.name || '',
                nickname: u.nickname || '',
                status: u.status || 'ACTIVE',
                created_at: u.created_at || '',
                email: emailMap[u.user_id] || u.name || '',
                current_cash: p.current_cash ?? 0,
                bonus_cash: p.bonus_cash ?? 0,  // [보너스 캐시 확장] 관리자 모달에서 잔액 표시용
                is_verified: p.is_verified ?? false,
                is_phone_verified: p.is_phone_verified ?? false,
                phone: u.phone || p.phone || '',
                facebook_url: p.facebook_url || '',
                services: p.services || [],
                region: p.region || '',
            };
        });
        setPros(merged);
    }, []);

    const loadCustomers = useCallback(async () => {
        const { data } = await supabase.from('users').select('user_id, name, nickname, phone, status, created_at').eq('role', 'CUSTOMER');
        // auth.users에서 실제 이메일 조회 (RPC)
        const userIds = (data || []).map(c => c.user_id);
        let emailMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: userIds });
            if (emails) {
                (emails as any[]).forEach(e => { emailMap[e.user_id] = e.email; });
            }
        }
        setCustomers((data || []).map(c => ({ ...c, email: emailMap[c.user_id] || c.name || '' })));
    }, []);

    const loadAdmins = useCallback(async () => {
        const { data } = await supabase.from('users').select('user_id, name, nickname, role, status, created_at').in('role', ['ADMIN', 'ADMIN_OPERATION', 'ADMIN_VIEWER']).order('created_at', { ascending: false });
        const userIds = (data || []).map(a => a.user_id);
        let emailMap: Record<string, string> = {};
        if (userIds.length > 0) {
            const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: userIds });
            if (emails) { (emails as any[]).forEach(e => { emailMap[e.user_id] = e.email; }); }
        }
        setAdmins((data || []).map(a => ({ ...a, email: emailMap[a.user_id] || a.name || '' })));
    }, []);

    // ─── 관리자 승급 핸들러 ───
    const handlePromoteAdmin = async () => {
        if (!promoteEmail.trim()) { setModal({ type: 'error', title: '입력 오류', message: '이메일을 입력하세요.' }); return; }
        setPromoting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentAdminId = session?.user?.id;

            // 1. 이메일로 user_id 조회
            const { data: targetUser, error: findErr } = await supabase
                .from('users')
                .select('user_id, role, status')
                .eq('email', promoteEmail.trim())
                .single();
            if (findErr || !targetUser) { setModal({ type: 'error', title: '계정 없음', message: '존재하지 않는 계정입니다.' }); return; }
            if (['ADMIN', 'ADMIN_OPERATION', 'ADMIN_VIEWER'].includes(targetUser.role)) { setModal({ type: 'error', title: '승급 불가', message: '이미 관리자 계정입니다.' }); return; }
            if (targetUser.user_id === currentAdminId) { setModal({ type: 'error', title: '승급 불가', message: '본인 계정은 변경할 수 없습니다.' }); return; }

            // 2. RPC 호출 (DB role + JWT app_metadata 동시 업데이트, 감사 로그 RPC 내부 처리)
            const { error: rpcError } = await supabase.rpc('promote_admin', {
                target_email: promoteEmail.trim(),
                new_role: promoteRole,
            });
            if (rpcError) { setModal({ type: 'error', title: '승급 실패', message: rpcError.message }); return; }

            setModal({ type: 'success', title: '승급 완료', message: `${promoteEmail} 계정이 ${promoteRole === 'ADMIN_OPERATION' ? '운영 관리자' : '뷰어'}로 승급되었습니다.` });
            setPromoteEmail('');
            loadAdmins();
        } finally {
            setPromoting(false);
        }
    };

    // ─── 관리자 권한 회수 핸들러 ───
    const handleRevokeAdmin = async (targetUserId: string, targetEmail: string) => {
        setRevokeLoading(targetUserId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentAdminId = session?.user?.id;

            // 1. RPC 호출 (DB role+status + JWT app_metadata 동시 업데이트, 감사 로그 RPC 내부 처리)
            const { error: rpcError } = await supabase.rpc('revoke_admin', {
                target_user_id: targetUserId,
            });
            if (rpcError) { setModal({ type: 'error', title: '권한 회수 실패', message: rpcError.message }); return; }

            setModal({ type: 'success', title: '권한 회수 완료', message: '해당 계정의 권한이 회수되고 계정이 정지되었습니다.' });
            loadAdmins();
        } finally {
            setRevokeLoading(null);
        }
    };

    const loadRequests = useCallback(async () => {
        let q = supabase.from('match_requests').select(`
            request_id, status, service_type, region, customer_id, quote_count, created_at, expires_at, dynamic_answers,
            customer:users!match_requests_customer_id_fkey(name, nickname),
            match_quotes (
                quote_id, pro_id, price, description, status, created_at, image_url,
                pro:users!match_quotes_pro_id_users_fkey(name, nickname)
            )
        `);

        if (reqFilter !== 'all') {
            q = q.eq('status', reqFilter);
        }
        if (reqCategory !== 'all') {
            q = q.ilike('service_type', `%${reqCategory}%`);
        }
        if (reqStartDate) {
            q = q.gte('created_at', reqStartDate + 'T00:00:00.000Z');
        }
        if (reqEndDate) {
            q = q.lte('created_at', reqEndDate + 'T23:59:59.999Z');
        }

        const { data } = await q.order('created_at', { ascending: false }).limit(100);

        setRequests((data || []).map((r: any) => {
            const customerName = r.customer?.nickname || r.customer?.name || r.customer_id?.slice(0, 8);

            let matchedProName = '';
            let matchedPrice = 0;
            const acceptedQuote = (r.match_quotes || []).find((mq: any) => mq.status === 'ACCEPTED');
            if (acceptedQuote) {
                matchedProName = acceptedQuote.pro?.nickname || acceptedQuote.pro?.name || acceptedQuote.pro_id?.slice(0, 8);
                matchedPrice = acceptedQuote.price || 0;
            } else {
                matchedProName = r.status === 'OPEN' ? `대기 중 (${(r.match_quotes || []).length}명 입찰)` : '-';
            }

            return {
                ...r,
                customerName,
                matchedProName,
                matchedPrice
            };
        }));
    }, [reqFilter, reqCategory, reqStartDate, reqEndDate]);

    const loadReviews = useCallback(async () => {
        const { data } = await supabase.from('reviews').select('review_id, rating, comment, created_at, customer_id, pro_id, room_id, is_hidden, is_featured_on_main').order('created_at', { ascending: false }).limit(100);
        const userIds = Array.from(new Set([...(data || []).map(r => r.customer_id), ...(data || []).map(r => r.pro_id)].filter(Boolean)));
        const { data: usersData } = await supabase.from('users').select('user_id, name, nickname').in('user_id', userIds.length ? userIds : ['']);
        const nameMap: Record<string, string> = {};
        (usersData || []).forEach(u => { nameMap[u.user_id] = u.nickname || u.name || u.user_id.slice(0, 8); });
        setReviews((data || []).map(r => ({ ...r, customerName: nameMap[r.customer_id] || '고객', proName: nameMap[r.pro_id] || '고수' })));
    }, []);

    // ─── User Detail Loader ───
    const loadUserDetail = useCallback(async (userId: string, role: 'PRO' | 'CUSTOMER') => {
        setUserDetail({ userId, role }); setUserDetailTab('info');
        const det: any = {};
        // 기본 정보
        const { data: uData } = await supabase.from('users').select('*').eq('user_id', userId).single();
        det.user = uData;
        if (role === 'PRO') {
            const { data: allProfiles } = await supabase.rpc('get_all_pro_profiles');
            const pData = (allProfiles || []).find((p: any) => p.pro_id === userId) || null;
            det.profile = pData;
            // pro_profiles.phone fallback (users 테이블에 phone이 없는 경우 대비)
            if (pData?.phone && !det.user?.phone) {
                det.user = { ...(det.user || {}), phone: pData.phone };
            }
        }
        // Ledger
        const { data: ledger } = await supabase.from('cash_ledger').select('*').eq('pro_id', userId).order('created_at', { ascending: false }).limit(50);
        det.ledger = ledger || [];
        // 견적 요청/발송
        if (role === 'CUSTOMER') {
            const { data: reqs } = await supabase.from('match_requests').select('request_id, status, service_type, region, created_at, match_quotes(quote_id, pro_id, price, status, created_at)').eq('customer_id', userId).order('created_at', { ascending: false }).limit(30);
            det.requests = reqs || [];
        } else {
            const { data: quotes } = await supabase.from('match_quotes').select('quote_id, price, description, status, created_at, request_id').eq('pro_id', userId).order('created_at', { ascending: false }).limit(30);
            det.quotes = quotes || [];
        }
        // 리뷰
        if (role === 'CUSTOMER') {
            const { data: rvs } = await supabase.from('reviews').select('review_id, rating, comment, created_at, pro_id').eq('customer_id', userId).order('created_at', { ascending: false });
            det.reviews = rvs || [];
        } else {
            const { data: rvs } = await supabase.from('reviews').select('review_id, rating, comment, created_at, customer_id').eq('pro_id', userId).order('created_at', { ascending: false });
            det.reviews = rvs || [];
        }
        setDetailData(det);
    }, []);

    const loadSettings = useCallback(async () => {
        const { data } = await supabase.from('platform_settings').select('key, value');
        if (data) {
            const map: Record<string, number> = {};
            data.forEach((s: any) => { map[s.key] = Number(s.value); });
            setPlatformSettings(prev => ({ ...prev, ...map }));
            const inputs: Record<string, string> = {};
            data.forEach((s: any) => { inputs[s.key] = String(Number(s.value)); });
            setSettingsInputs(prev => ({ ...prev, ...inputs }));
        }
    }, []);

    const loadCms = useCallback(async () => {
        const { data: bData } = await supabase.from('cms_banners').select('*').order('sort_order', { ascending: true });
        if (bData) setCmsBanners(bData);
        const { data: cData } = await supabase.from('cms_categories').select('*').order('sort_order', { ascending: true });
        if (cData) setCmsCategories(cData);

        const { data: catData } = await supabase.from('support_categories').select('*').order('sort_order', { ascending: true });
        if (catData) setSupportCategories(catData);

        const { data: spData } = await supabase.from('support_pages').select('*').order('category_id', { ascending: true }).order('sort_order', { ascending: true });
        if (spData) setSupportPages(spData);

        const { data: lgData } = await supabase.from('legal_documents').select('*').order('document_type', { ascending: true }).order('created_at', { ascending: false });
        if (lgData) setLegalDocs(lgData);
    }, []);

    const loadInquiries = useCallback(async (page = 1) => {
        setInquiriesLoading(true);

        let q = supabase.from('inquiries').select('*');
        if (inquiriesFilter !== 'all') q = q.eq('status', inquiriesFilter);
        if (inquiriesCategory !== 'all') q = q.eq('category', inquiriesCategory);
        const from = (page - 1) * INQUIRIES_PAGE_SIZE;
        const to = from + INQUIRIES_PAGE_SIZE - 1;
        q = q.order('created_at', { ascending: false }).range(from, to);

        const { data, error } = await q;
        if (error || !data) { setInquiriesLoading(false); return; }

        // users 별도 조회 후 클라이언트 병합
        const userIds = Array.from(new Set(data.map((d: any) => d.user_id).filter(Boolean)));
        let userMap: Record<string, any> = {};
        if (userIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('user_id, name, nickname, phone')
                .in('user_id', userIds);
            (usersData || []).forEach((u: any) => { userMap[u.user_id] = u; });
        }

        const enriched = data.map((d: any) => ({
            ...d,
            users: userMap[d.user_id] || null,
        }));

        const filtered = inquiriesSearch.trim()
            ? enriched.filter((d: any) => {
                const keyword = inquiriesSearch.trim().toLowerCase();
                const nickname = (d.users?.nickname || '').toLowerCase();
                const name = (d.users?.name || '').toLowerCase();
                const email = (d.email || '').toLowerCase(); // inquiries 테이블에 email 컬럼이 있는 경우
                return nickname.includes(keyword) || name.includes(keyword) || email.includes(keyword);
            })
            : enriched;
        setInquiries(filtered);
        setInquiriesPage(page);

        // 전체 카운트 별도 조회
        let countQ = supabase.from('inquiries').select('id', { count: 'exact', head: true });
        if (inquiriesFilter !== 'all') countQ = countQ.eq('status', inquiriesFilter);
        if (inquiriesCategory !== 'all') countQ = countQ.eq('category', inquiriesCategory);
        const { count } = await countQ;
        setInquiriesTotalCount(count || 0);

        setInquiriesLoading(false);
    }, [inquiriesFilter, inquiriesCategory, inquiriesSearch]);

    const loadDbCategories = useCallback(async () => {
        const { data } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
        if (data) setDbCategories(data);
    }, []);

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isAddingCategory) {
                const { error } = await supabase.from('categories').insert({
                    name: editingCategory.name,
                    depth1: editingCategory.depth1,
                    depth2: editingCategory.depth2,
                    base_price: editingCategory.base_price,
                    is_active: editingCategory.is_active
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.from('categories').update({
                    base_price: editingCategory.base_price,
                    is_active: editingCategory.is_active
                }).eq('id', editingCategory.id);
                if (error) throw error;
            }
            setIsAddingCategory(false);
            setEditingCategory(null);
            loadDbCategories();
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        }
    };

    const handleDeleteCategory = async () => {
        if (!deletingCategory) return;
        try {
            // Check Match_Requests usage
            const { data: reqUse, error: reqErr } = await supabase
                .from('match_requests')
                .select('request_id')
                .eq('category_id', deletingCategory.id)
                .limit(1);
            if (reqErr) throw reqErr;

            // Check Pro_Profiles usage (category_ids array contains)
            const { data: proUse, error: proErr } = await supabase
                .from('pro_profiles')
                .select('pro_id')
                .contains('category_ids', [deletingCategory.id])
                .limit(1);
            if (proErr) throw proErr;

            if ((reqUse && reqUse.length > 0) || (proUse && proUse.length > 0)) {
                alert("현재 견적 요청이나 고수 프로필에서 사용 중인 카테고리이므로 삭제할 수 없습니다. 대신 [활성 상태]를 '운영 중지'로 변경해 주세요.");
                setDeletingCategory(null);
                return;
            }

            const { error } = await supabase.from('categories').delete().eq('id', deletingCategory.id);
            if (error) throw error;

            setDeletingCategory(null);
            loadDbCategories();
        } catch (e: any) {
            alert('삭제 실패: ' + e.message);
        }
    };

    // ── [확장] 어뷰징 데이터 로더 (서버사이드 필터링 + limit 방어) ──
    const loadAbuseData = useCallback(async () => {
        setAbuseLoading(true);
        try {
            let q = supabase
                .from('user_penalty_stats')
                .select('*', { count: 'exact' });

            // 서버사이드 필터링: 적발된 유저 or 어뷰징 대상자 전체
            if (abuseFilter === 'flagged') {
                q = q.eq('is_flagged', true);
            } else {
                q = q.eq('is_abuse_target', true);
            }

            const { data: flaggedUsers, error: fetchError, count } = await q
                .order('consecutive_noshow', { ascending: false })
                .limit(ABUSE_PAGE_SIZE);

            if (fetchError) {
                console.error('❌ [Abuse] user_penalty_stats 조회 실패:', fetchError);
                alert('어뷰징 데이터 조회 실패: ' + fetchError.message);
                setAbuseData([]);
                return;
            }

            console.log('✅ [Abuse] 조회된 행 수:', flaggedUsers?.length || 0, '/ 전체:', count);

            if (flaggedUsers && flaggedUsers.length > 0) {
                const customerIds = flaggedUsers.map((f: any) => f.user_id);
                const { data: usersData } = await supabase.from('users').select('user_id, name, nickname, status, suspension_reason').in('user_id', customerIds);
                let emailMap: Record<string, string> = {};
                if (customerIds.length > 0) {
                    const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: customerIds });
                    if (emails) (emails as any[]).forEach(e => { emailMap[e.user_id] = e.email; });
                }
                const userMap: Record<string, any> = {};
                (usersData || []).forEach(u => { userMap[u.user_id] = { ...u, email: emailMap[u.user_id] || '' }; });
                setAbuseData(flaggedUsers.map((f: any) => ({
                    ...f,
                    userName: f.nickname || f.name || userMap[f.user_id]?.nickname || userMap[f.user_id]?.name || f.user_id.slice(0, 8),
                    userEmail: userMap[f.user_id]?.email || '',
                    userStatus: f.status || userMap[f.user_id]?.status || 'ACTIVE',
                    suspensionReason: userMap[f.user_id]?.suspension_reason || '',
                })));
            } else {
                setAbuseData([]);
            }
        } finally { setAbuseLoading(false); }
    }, [abuseFilter]);

    const handleUnflagConfirm = async () => {
        if (!unflagConfirmModal) return;
        const { error } = await supabase.rpc('admin_unflag_abuser', {
            target_user_id: unflagConfirmModal.userId
        });
        setUnflagConfirmModal(null);
        if (error) {
            showToast('해제 실패: ' + error.message, 'error');
        } else {
            showToast('패널티가 해제되었습니다.', 'success');
            loadAbuseData();
        }
    };

    const loadSearchLogs = useCallback(async () => {
        setSearchLogsLoading(true);
        const { data, error } = await supabase.rpc('get_search_fail_stats', { limit_val: 50 });
        if (!error && data) setSearchLogs(data);
        setSearchLogsLoading(false);
    }, []);

    const loadPayoutRequests = async () => {
        setPayoutLoading(true);
        const { data, error } = await supabase
            .from('payout_requests')
            .select(`
                *,
                pro:pro_profiles!payout_requests_pro_id_fkey (
                    nickname,
                    phone,
                    users!pro_profiles_pro_id_fkey ( name, email )
                )
            `)
            .order('requested_at', { ascending: false });
        if (!error && data) setPayoutRequests(data);
        setPayoutLoading(false);
    };

    const loadAuditLogs = async (page = 1, filter = 'all') => {
        setAuditLoading(true);
        let q = supabase
            .from('admin_action_logs')
            .select(`
                *,
                admin:admin_id ( name, email ),
                target:target_user_id ( name, nickname, email )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE - 1);
        if (filter === 'ADMIN_ROLE_CHANGE') { q = q.in('action_type', ['PROMOTE_ADMIN', 'REVOKE_ADMIN']); } else if (filter !== 'all') { q = q.eq('action_type', filter); }
        const { data, error, count } = await q;
        if (!error && data) { setAuditLogs(data); setAuditTotal(count || 0); }
        setAuditLoading(false);
    };

    const fetchReports = async () => {
        setReportsLoading(true);
        const { data, error } = await supabase
            .from('reports')
            .select(`
                id,
                reason,
                status,
                created_at,
                admin_note,
                room_id,
                reporter:reporter_id (user_id, name, nickname, role),
                reported:reported_user_id (user_id, name, nickname, role, status, suspension_type)
            `)
            .order('created_at', { ascending: false })
            .limit(50);
        setReportsLoading(false);
        if (!error && data) {
            // 피신고자별 누적 신고 횟수 계산
            const countMap: Record<string, number> = {};
            data.forEach((r: any) => {
                const uid = r.reported?.user_id;
                if (uid) countMap[uid] = (countMap[uid] || 0) + 1;
            });
            // 각 report에 누적 횟수 주입
            const enriched = data.map((r: any) => ({
                ...r,
                reportedTotalCount: countMap[r.reported?.user_id] || 1,
            }));
            setReports(enriched);
        }
    };

    const fetchChatPreview = async (reportId: string, roomId: string) => {
        const { data } = await supabase
            .from('chat_messages')
            .select('content, sender_id, created_at, message_type, sender:sender_id(name, nickname)')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(30);
        setChatPreview({ reportId, messages: (data || []).reverse() });
    };

    const handleSuspend = async () => {
        if (!reportSuspendModal || !reportSuspendReason.trim()) return;
        const activeReport = reports.find(r => r.reported?.user_id === reportSuspendModal.userId && r.status === 'pending');
        const reportUserName = activeReport ? (activeReport.reported?.nickname || activeReport.reported?.name || reportSuspendModal.userId) : reportSuspendModal.userId;
        const activeReportId = activeReport?.id;
        setSuspendSubmitting(true);
        const updateData: any = {
            status: suspendType === 'warning' ? 'ACTIVE' : 'SUSPENDED',
            suspension_type: suspendType,
            suspension_reason: reportSuspendReason.trim(),
            suspended_until: suspendType === 'temporary'
                ? new Date(Date.now() + suspendDays * 24 * 60 * 60 * 1000).toISOString()
                : null,
        };
        const { error: userError } = await supabase
            .from('users')
            .update(updateData)
            .eq('user_id', reportSuspendModal.userId);
        if (userError) {
            showToast('제재 처리 실패: ' + userError.message, 'error');
            setSuspendSubmitting(false);
            return;
        }
        if (activeReportId) {
            await supabase
                .from('reports')
                .update({ status: 'reviewed', admin_note: reportSuspendReason.trim(), reviewed_at: new Date().toISOString() })
                .eq('id', activeReportId);
        }
        setSuspendSubmitting(false);
        setReportSuspendModal(null);
        setReportSuspendReason('');
        setSuspendType('warning');
        setSuspendDays(1);

        // 제재 알림 + 채팅방 시스템 메시지 발송
        const targetReport = reports.find(r => r.reported?.user_id === reportSuspendModal?.userId);
        const targetRoomId = targetReport?.room_id ?? activeReport?.room_id;
        console.log('[handleSuspend] activeReport:', activeReport);
        console.log('[handleSuspend] targetReport from reports:', targetReport);
        console.log('[handleSuspend] targetRoomId resolved:', targetRoomId);
        // 제재 완료 시 채팅방 CLOSED 처리
        if (targetRoomId) {
            const { error: roomError } = await supabase
                .from('chat_rooms')
                .update({ status: 'CLOSED' })
                .eq('room_id', targetRoomId);
            console.log('[handleSuspend] chat_rooms CLOSED result:', roomError ? roomError.message : 'success');
        }
        const targetUserId = reportSuspendModal.userId;
        const suspendLabel = suspendType === 'warning' ? '경고' : suspendType === 'temporary' ? `${suspendDays}일 임시정지` : '영구정지';

        // 1. 앱 알림 발송
        await supabase.from('notifications').insert({
            user_id: targetUserId,
            sender_id: adminId,
            type: 'SYSTEM',
            message: `[관리자] 귀하의 계정에 ${suspendLabel} 처리가 되었습니다. 사유: ${reportSuspendReason}`,
            reference_id: targetRoomId || null,
            is_read: false,
        });

        // 2. 채팅방 시스템 메시지 발송
        if (targetRoomId) {
            // ✅ 추가: SYSTEM_REVIEWED — 피신고자 차단용
            await supabase.from('chat_messages').insert({
                room_id: targetRoomId,
                sender_id: adminId,
                receiver_id: targetUserId,
                content: 'ROOM_REVIEWED_BY_ADMIN',
                message_type: 'SYSTEM_REVIEWED',
            });

            // ✅ 추가: SYSTEM_CLOSE — 채팅방 전체 종료용
            await supabase.from('chat_messages').insert({
                room_id: targetRoomId,
                sender_id: adminId,
                receiver_id: null,
                content: 'ROOM_CLOSED_BY_ADMIN',
                message_type: 'SYSTEM_CLOSE',
            });

            const systemMsg = suspendType === 'warning'
                ? `🚨 [관리자] 귀하의 계정에 경고가 부과되었습니다.\n사유: ${reportSuspendReason}\n반복 위반 시 정지 처리될 수 있습니다.`
                : suspendType === 'temporary'
                    ? `🚫 [관리자] 귀하의 계정이 ${suspendDays}일간 임시정지 처리되었습니다.\n사유: ${reportSuspendReason}`
                    : `🚫 [관리자] 귀하의 계정이 영구정지 처리되었습니다.\n사유: ${reportSuspendReason}`;

            // 피신고자에게 제재 메시지 (본인만 보임)
            await supabase.from('chat_messages').insert({
                room_id: targetRoomId,
                sender_id: adminId,
                receiver_id: targetUserId,
                content: systemMsg,
                message_type: 'SYSTEM_PRIVATE',
            });

            // 신고자에게 처리완료 메시지 (본인만 보임)
            if (activeReport?.reporter?.user_id) {
                await supabase.from('chat_messages').insert({
                    room_id: targetRoomId,
                    sender_id: adminId,
                    receiver_id: activeReport.reporter.user_id,
                    content: `✅ [관리자] 신고하신 내용이 검토되어 처리 완료되었습니다.\n해당 사용자에게 ${suspendLabel} 조치가 취해졌습니다.`,
                    message_type: 'SYSTEM_PRIVATE',
                });
            }
        }

        // 3. 신고자에게 처리 완료 알림 발송
        if (activeReport?.reporter?.user_id) {
            await supabase.from('notifications').insert({
                user_id: activeReport.reporter.user_id,
                sender_id: adminId,
                type: 'SYSTEM',
                message: `✅ 신고하신 내용이 검토되어 처리 완료되었습니다.`,
                reference_id: targetRoomId || null,
                is_read: false,
            });
        }

        showToast(`✅ ${reportUserName}님 제재 완료`, 'success', true);
        fetchReports();
    };

    useEffect(() => {
        if (!authorized) return;
        if (tab === 'dashboard') loadDashboard();
        if (tab === 'ledger') { setLedgerPage(1); loadLedger(1, ledgerCategory, ledgerPeriod, ledgerSearch); }
        if (tab === 'pro') loadPros();
        if (tab === 'customer') loadCustomers();
        if (tab === 'quotes') loadRequests();
        if (tab === 'reviews') loadReviews();
        if (tab === 'admin_mgmt') loadAdmins();
        if (tab === 'settings') loadSettings();
        if (tab === 'cms') loadCms();
        if (tab === 'inquiries') { setInquiriesPage(1); loadInquiries(1); }
        if (tab === 'categories') loadDbCategories();
        if (tab === 'search_logs') loadSearchLogs();
        if (tab === 'abuse') loadAbuseData();
        if (tab === 'reports') fetchReports();
        if (tab === 'payout') loadPayoutRequests();
        if (tab === 'audit_log') { setAuditPage(1); loadAuditLogs(1, auditFilter); }
    }, [tab, authorized, loadDashboard, loadLedger, loadPros, loadCustomers, loadRequests, loadReviews, loadAdmins, loadSettings, loadCms, loadInquiries, loadDbCategories, loadSearchLogs, loadAbuseData]);

    // CS 채팅 내역 초기 로드 (selectedRequest 변경 시)
    useEffect(() => {
        if (!selectedRequest?.request_id) return;
        const CS_CHAT_PAGE_SIZE = 30;
        setCsChatRoomId(undefined);
        setCsChatMessages([]);
        setCsChatHasMore(false);
        setCsChatOffset(0);
        setCsChatLoading(true);
        (async () => {
            try {
                const { data: roomData } = await supabase
                    .from('chat_rooms')
                    .select('room_id')
                    .eq('request_id', selectedRequest.request_id)
                    .maybeSingle();
                if (!roomData) { setCsChatRoomId(null); return; }
                setCsChatRoomId(roomData.room_id);
                const { data: msgs } = await supabase
                    .from('chat_messages')
                    .select('message_id, content, created_at, sender_id, sender:users!sender_id(name, nickname)')
                    .eq('room_id', roomData.room_id)
                    .order('created_at', { ascending: false })
                    .range(0, CS_CHAT_PAGE_SIZE - 1);
                const fetched = msgs || [];
                setCsChatMessages(fetched);
                setCsChatOffset(fetched.length);
                setCsChatHasMore(fetched.length === CS_CHAT_PAGE_SIZE);
            } finally {
                setCsChatLoading(false);
            }
        })();
    }, [selectedRequest?.request_id]);

    // ─── Actions ───

    const handleMapSearchTag = async (keyword: string) => {
        const category = selectedCategoryMapping[keyword];
        if (!category) return alert('매핑할 카테고리를 먼저 선택해주세요.');
        if (!window.confirm(`'${keyword}' 단어를 '${category}' 카테고리의 동의어(search_tags)에 추가하고 로그에서 즉시 삭제하시겠습니까?`)) return;

        const { error } = await supabase.rpc('map_search_tag_to_category', {
            target_keyword: keyword,
            target_category: category
        });

        if (error) return alert('매핑 실패: ' + error.message);

        setSearchLogs(prev => prev.filter(log => log.keyword !== keyword));
        alert('매핑 및 로그 삭제가 완료되었습니다.');
    };

    const handleIgnoreSearchKeyword = async (keyword: string) => {
        if (!window.confirm(`'${keyword}' 로그를 영구 삭제(무시)하시겠습니까?`)) return;

        const { error } = await supabase.rpc('ignore_search_fail_keyword', {
            target_keyword: keyword
        });

        if (error) return alert('삭제 실패: ' + error.message);

        setSearchLogs(prev => prev.filter(log => log.keyword !== keyword));
    };

    const handleReplyImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        const remaining = 5 - replyImages.length;
        if (remaining <= 0) { showToast('이미지는 최대 5장까지 첨부할 수 있습니다.', 'error'); return; }
        const selected = files.slice(0, remaining);
        setReplyImages(prev => [...prev, ...selected]);
        selected.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => setReplyImagePreviews(prev => [...prev, ev.target?.result as string]);
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const handleRemoveReplyImage = (index: number) => {
        setReplyImages(prev => prev.filter((_, i) => i !== index));
        setReplyImagePreviews(prev => prev.filter((_, i) => i !== index));
    };

    const uploadReplyImages = async (files: File[]): Promise<string[]> => {
        const urls: string[] = [];
        for (const file of files) {
            const optimizedFile = await optimizeImage(file, 1920, 1080, 0.8);
            const fileName = `reply_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
            const { error: upErr } = await supabase.storage
                .from('quote_images')
                .upload(`inquiries/replies/${fileName}`, optimizedFile);
            if (upErr) throw new Error('이미지 업로드 실패: ' + upErr.message);
            const { data: { publicUrl } } = supabase.storage
                .from('quote_images')
                .getPublicUrl(`inquiries/replies/${fileName}`);
            urls.push(publicUrl);
        }
        return urls;
    };

    const handleSaveInquiryReply = async () => {
        if (!selectedInquiry || !replyContent.trim()) return;
        setReplySaving(true);
        let replyImageUrls: string[] = [];
        if (replyImages.length > 0) {
            try {
                replyImageUrls = await uploadReplyImages(replyImages);
            } catch (err: any) {
                setReplySaving(false);
                showToast(err.message, 'error');
                return;
            }
        }

        const { error } = await supabase.from('inquiries').update({
            admin_reply: replyContent,
            admin_reply_images: replyImageUrls,
            status: 'resolved'
        }).eq('id', selectedInquiry.id);

        if (error) {
            setReplySaving(false);
            showToast('답변 저장에 실패했습니다.', 'error');
            return;
        }

        // 작성자에게 앱 알림 발송
        await supabase.from('notifications').insert({
            user_id: selectedInquiry.user_id,
            sender_id: adminId,
            type: 'SYSTEM',
            message: `✅ 1:1 문의 답변이 등록되었습니다. [${selectedInquiry.title}]`,
            reference_id: selectedInquiry.id,
            is_read: false,
        });

        setReplySaving(false);
        showToast('답변이 성공적으로 등록되었습니다.', 'success');
        setSelectedInquiry(null);
        setReplyContent('');
        setReplyImages([]);
        setReplyImagePreviews([]);
        loadInquiries();
    };

    const handleUpdateInquiryStatus = async (inquiryId: string, newStatus: 'pending' | 'in_progress' | 'resolved') => {
        setInquiryStatusUpdating(true);
        const { error } = await supabase
            .from('inquiries')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', inquiryId);
        if (error) {
            showToast('상태 변경에 실패했습니다.', 'error');
            setInquiryStatusUpdating(false);
            return;
        }
        setInquiries(prev => prev.map(iq => iq.id === inquiryId ? { ...iq, status: newStatus } : iq));
        if (selectedInquiry?.id === inquiryId) {
            setSelectedInquiry((prev: any) => prev ? { ...prev, status: newStatus } : prev);
        }
        showToast('상태가 변경되었습니다.', 'success');
        setInquiryStatusUpdating(false);
    };

    const handleSaveSupportPage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSupportPage) return;

        const { error } = await supabase
            .from('support_pages')
            .update({
                title: editingSupportPage.title,
                content: editingSupportPage.content,
                is_active: editingSupportPage.is_active,
                category_id: editingSupportPage.category_id,
                slug: editingSupportPage.slug
            })
            .eq('id', editingSupportPage.id);

        if (error) {
            alert('저장 중 오류 발생: ' + error.message);
        } else {
            alert('성공적으로 저장되었습니다.');
            setSupportPages(prev => prev.map(p => p.id === editingSupportPage.id ? editingSupportPage : p));
            setEditingSupportPage(null);
        }
    };

    const handleSaveLegalDoc = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLegalDoc) return;

        const isNewVersion = !editingLegalDoc.id;

        let error;
        if (isNewVersion) {
            const { error: insertErr } = await supabase
                .from('legal_documents')
                .insert({
                    document_type: editingLegalDoc.document_type,
                    version: editingLegalDoc.version,
                    title: editingLegalDoc.title,
                    content: editingLegalDoc.content,
                    effective_date: editingLegalDoc.effective_date,
                    is_active: editingLegalDoc.is_active
                });
            error = insertErr;
        } else {
            const { error: updateErr } = await supabase
                .from('legal_documents')
                .update({
                    title: editingLegalDoc.title,
                    content: editingLegalDoc.content,
                    effective_date: editingLegalDoc.effective_date,
                    is_active: editingLegalDoc.is_active,
                    version: editingLegalDoc.version
                })
                .eq('id', editingLegalDoc.id);
            error = updateErr;
        }

        if (error) {
            alert('저장 중 오류 발생: ' + error.message);
        } else {
            alert('성공적으로 저장되었습니다.');
            loadCms();
            setEditingLegalDoc(null);
        }
    };

    const toggleSuspend = (userId: string, curStatus: string, isPro: boolean) => {
        const next = curStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
        if (next === 'SUSPENDED') {
            // 정지 시 사유 입력 모달 표시
            setSuspendReasonModal({ isOpen: true, userId, currentStatus: curStatus, isPro, reason: '' });
        } else {
            // 해제 시 사유 입력 모달 표시
            setSuspendReasonModal({ isOpen: true, userId, currentStatus: curStatus, isPro, reason: '' });
        }
    };

    const executeSuspendToggle = async (userId: string, curStatus: string, isPro: boolean, reason: string) => {
        const next = curStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
        const { error } = await supabase
            .from('users')
            .update({
                status: next,
                suspension_reason: next === 'SUSPENDED' ? reason : null,
            })
            .eq('user_id', userId);

        if (error) {
            setModal({ type: 'error', title: '처리 실패', message: error.message });
            return;
        }

        // 감사 로그 기록
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from('admin_action_logs').insert({
            target_user_id: userId,
            admin_id: session?.user?.id,
            action_type: next === 'SUSPENDED' ? 'SUSPEND' : 'UNSUSPEND',
            reason: reason,
        });

        setModal({
            type: 'success',
            title: next === 'SUSPENDED' ? '정지 완료' : '정지 해제 완료',
            message: `계정이 ${next === 'SUSPENDED' ? '정지' : '활성화'} 되었습니다.`,
        });

        // 목록 상태 업데이트
        if (isPro) {
            setPros(prev => prev.map(p => p.pro_id === userId ? { ...p, status: next } : p));
        } else {
            setCustomers(prev => prev.map(c => c.user_id === userId ? { ...c, status: next } : c));
        }
    };

    const handleCashAction = async () => {
        if (!cashModal || !cashAmount || Number(cashAmount) <= 0) { setModal({ type: 'error', title: '입력 오류', message: '유효한 금액을 입력하세요.' }); return; }
        setCashProcessing(true);
        const { pro, type } = cashModal;
        const amt = Number(cashAmount);
        const txType = type === 'charge' ? 'ADMIN_CHARGE' : 'ADMIN_REFUND';

        // ── 단일 원자적 RPC 호출 (롤백 방어) ──
        const { data: rpcResult, error: rpcError } = await supabase.rpc('admin_manage_cash', {
            p_admin_id: adminId,
            p_target_pro_id: pro.pro_id,
            p_amount: amt,
            p_tx_type: txType,
            p_description: cashDesc || (type === 'charge' ? '관리자 수동 충전' : '관리자 수동 환불/차감'),
            p_cash_type: cashType  // [보너스 캐시 확장] 'REAL' 또는 'BONUS'
        });

        if (rpcError) {
            setModal({ type: 'error', title: '트랜잭션 실패', message: '전체 롤백됨: ' + rpcError.message });
            setCashProcessing(false);
            return;
        }

        const newBal = rpcResult?.new_balance ?? (pro.current_cash + (type === 'charge' ? amt : -amt));
        setPros(p => p.map(x => x.pro_id === pro.pro_id ? { ...x, current_cash: newBal } : x));

        // ── 감사 로그 기록 ──
        const { error: logErr } = await supabase.from('admin_action_logs').insert({
            target_user_id: pro.pro_id,
            admin_id: adminId,
            action_type: type === 'charge' ? 'CASH_CHARGE' : 'CASH_REFUND',
            reason: `${cashType === 'BONUS' ? '[보너스] ' : '[유상] '}₱${amt.toLocaleString()} ${type === 'charge' ? '충전' : '환불/차감'} — ${cashDesc || '사유 없음'}`,
        });
        if (logErr) console.error('❌ 캐시 감사 로그 실패:', logErr);

        setCashModal(null); setCashAmount(''); setCashDesc(''); setCashProcessing(false); setCashType('REAL');
        setModal({ type: 'success', title: '처리 완료', message: `${cashType === 'BONUS' ? '🎁 보너스 ' : ''}₱${fmtNum(amt)} ${type === 'charge' ? '충전' : '환불/차감'} 완료 (원자적 트랜잭션 + 원장 기록 완료)` });
    };

    const toggleReviewFeatured = async (reviewId: number, curFeatured: boolean) => {
        const action = curFeatured ? '메인 노출 제외' : '메인 노출';
        if (!window.confirm(`이 리뷰를 ${action} 처리하겠습니까?\n(실제 메인에는 평점 4.5 이상이고 길이가 50자 이상인 경우에만 노출됩니다.)`)) return;
        await supabase.from('reviews').update({ is_featured_on_main: !curFeatured }).eq('review_id', reviewId);
        setReviews(r => r.map(x => x.review_id === reviewId ? { ...x, is_featured_on_main: !curFeatured } : x));
        // ── 감사 로그 기록 ──
        const { error: logErr } = await supabase.from('admin_action_logs').insert({
            target_user_id: null,
            admin_id: adminId,
            action_type: 'REVIEW_FEATURE',
            reason: `리뷰 ID ${reviewId} — ${action}`,
        });
        if (logErr) console.error('❌ 리뷰 메인노출 감사 로그 실패:', logErr);
    };

    const toggleReviewHidden = async (reviewId: number, curHidden: boolean) => {
        const action = curHidden ? '복원' : '블라인드';
        if (!window.confirm(`이 리뷰를 ${action} 처리하겠습니까?`)) return;
        await supabase.from('reviews').update({ is_hidden: !curHidden }).eq('review_id', reviewId);
        setReviews(r => r.map(x => x.review_id === reviewId ? { ...x, is_hidden: !curHidden } : x));
        // ── 감사 로그 기록 ──
        const { error: logErr } = await supabase.from('admin_action_logs').insert({
            target_user_id: null,
            admin_id: adminId,
            action_type: 'REVIEW_BLIND',
            reason: `리뷰 ID ${reviewId} — ${action}`,
        });
        if (logErr) console.error('❌ 리뷰 블라인드 감사 로그 실패:', logErr);
    };

    const deleteReview = async (reviewId: number) => {
        if (!window.confirm('이 리뷰를 영구 삭제하겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        await supabase.from('reviews').delete().eq('review_id', reviewId);
        setReviews(r => r.filter(x => x.review_id !== reviewId));
        // ── 감사 로그 기록 ──
        const { error: logErr } = await supabase.from('admin_action_logs').insert({
            target_user_id: null,
            admin_id: adminId,
            action_type: 'REVIEW_DELETE',
            reason: `리뷰 ID ${reviewId} 영구 삭제`,
        });
        if (logErr) console.error('❌ 리뷰 삭제 감사 로그 실패:', logErr);
    };

    // ─── CS Control Mode Actions ───

    const handleSelectRequest = async (r: any) => {
        setSelectedRequest(r);
        setCsContactInfo(null);
        setChatLogs([]);

        // Lazy load contacts explicitly to bypass masking for admins
        const customerId = r.customer_id;
        let proId: string | null = null;
        const acceptedQuote = (r.match_quotes || []).find((mq: any) => mq.status === 'ACCEPTED');
        if (acceptedQuote) proId = acceptedQuote.pro_id;

        const idsToFetch = [customerId];
        if (proId) idsToFetch.push(proId);

        const { data: usersData } = await supabase.from('users').select('user_id, name, nickname, email, phone').in('user_id', idsToFetch);

        const cData = (usersData || []).find(u => u.user_id === customerId);
        const pData = proId ? (usersData || []).find(u => u.user_id === proId) : null;

        let pProfile = null;
        if (proId) {
            const { data: profData } = await supabase.rpc('get_all_pro_profiles');
            pProfile = (profData || []).find((p: any) => p.pro_id === proId);
        }

        setCsContactInfo({
            customer: cData || { nickname: r.customerName, email: '가져오기 실패' },
            pro: proId ? { ...(pData || {}), phone: pProfile?.phone || pData?.phone || '번호 없음' } : null
        });

        // Load Chat logs if room exists
        if (proId) {
            const { data: roomData } = await supabase.from('chat_rooms').select('room_id').eq('request_id', r.request_id).eq('customer_id', customerId).eq('pro_id', proId).maybeSingle();
            if (roomData) {
                const { data: messages } = await supabase.from('chat_messages').select('*').eq('room_id', roomData.room_id).order('created_at', { ascending: false }).limit(200);
                setChatLogs(messages || []);
            }
        }
    };

    const handleOpenProDetail = async (proId: string) => {
        setProDetailModal({ proId });
        setProDetailData(null);
        setProDetailLoading(true);
        setProDetailTab('info');
        setProDetailTabData({});
        setProDetailLedgerOffset(0);
        setProDetailLedgerHasMore(false);
        try {
            // 기본 유저 정보
            const { data: uData } = await supabase
                .from('users')
                .select('user_id, name, nickname, phone, status, created_at, avatar_url')
                .eq('user_id', proId)
                .single();

            // 프로 프로필 (RPC)
            const { data: allProfiles } = await supabase.rpc('get_all_pro_profiles');
            const pData = (allProfiles || []).find((p: any) => p.pro_id === proId) || null;

            // 이메일 (RPC)
            const { data: emails } = await supabase.rpc('get_user_emails', { p_user_ids: [proId] });
            const email = (emails as any[])?.[0]?.email || '';

            setProDetailData({
                ...uData,
                phone: uData?.phone || pData?.phone || '',  // pro_profiles.phone fallback
                email,
                current_cash: pData?.current_cash ?? 0,
                bonus_cash: pData?.bonus_cash ?? 0,
                is_verified: pData?.is_verified ?? false,
                is_phone_verified: pData?.is_phone_verified ?? false,
                services: pData?.services || [],
                region: pData?.region || '',
                facebook_url: pData?.facebook_url || '',
                average_rating: pData?.average_rating ?? 0,
                review_count: pData?.review_count ?? 0,
            });
        } finally {
            setProDetailLoading(false);
        }
    };

    const handleProDetailTabChange = async (newTab: 'info' | 'ledger' | 'quotes' | 'reviews', proId: string) => {
        setProDetailTab(newTab);
        if (newTab === 'info') return;
        if ((proDetailTabData as any)[newTab]) return; // 캐시된 데이터 재사용
        setProDetailTabLoading(true);
        try {
            if (newTab === 'ledger') {
                const PAGE = 20;
                const { data } = await supabase
                    .from('cash_ledger')
                    .select('*')
                    .eq('pro_id', proId)
                    .order('created_at', { ascending: false })
                    .limit(PAGE + 1);
                const hasMore = (data || []).length > PAGE;
                setProDetailTabData(prev => ({ ...prev, ledger: (data || []).slice(0, PAGE) }));
                setProDetailLedgerOffset(PAGE);
                setProDetailLedgerHasMore(hasMore);
            } else if (newTab === 'quotes') {
                const { data } = await supabase
                    .from('match_quotes')
                    .select('quote_id, price, description, status, created_at, request_id')
                    .eq('pro_id', proId)
                    .order('created_at', { ascending: false })
                    .limit(30);
                setProDetailTabData(prev => ({ ...prev, quotes: data || [] }));
            } else if (newTab === 'reviews') {
                const { data } = await supabase
                    .from('reviews')
                    .select('review_id, rating, comment, created_at, customer_id')
                    .eq('pro_id', proId)
                    .order('created_at', { ascending: false })
                    .limit(30);
                setProDetailTabData(prev => ({ ...prev, reviews: data || [] }));
            }
        } finally {
            setProDetailTabLoading(false);
        }
    };

    const handleProDetailLedgerMore = async (proId: string) => {
        if (!proDetailLedgerHasMore || proDetailTabLoading) return;
        setProDetailTabLoading(true);
        try {
            const PAGE = 20;
            const { data } = await supabase
                .from('cash_ledger')
                .select('*')
                .eq('pro_id', proId)
                .order('created_at', { ascending: false })
                .range(proDetailLedgerOffset, proDetailLedgerOffset + PAGE);
            const fetched = data || [];
            const hasMore = fetched.length > PAGE;
            setProDetailTabData(prev => ({ ...prev, ledger: [...(prev.ledger || []), ...fetched.slice(0, PAGE)] }));
            setProDetailLedgerOffset(prev => prev + PAGE);
            setProDetailLedgerHasMore(hasMore);
        } finally {
            setProDetailTabLoading(false);
        }
    };

    const CS_CHAT_PAGE_SIZE = 30;

    const handleOpenCsChat = async (proId: string, proName: string, requestId: string, customerId: string, customerName: string) => {
        setCsChatModal({ proName, customerName, customerId });
        setCsChatRoomId(undefined);
        setCsChatMessages([]);
        setCsChatHasMore(false);
        setCsChatOffset(0);
        setCsChatLoading(true);
        try {
            const { data: roomData } = await supabase
                .from('chat_rooms')
                .select('room_id')
                .eq('request_id', requestId)
                .eq('pro_id', proId)
                .eq('customer_id', customerId)
                .maybeSingle();
            if (!roomData) { setCsChatRoomId(null); return; }
            setCsChatRoomId(roomData.room_id);
            const { data: msgs } = await supabase
                .from('chat_messages')
                .select('message_id, content, created_at, sender_id, sender:users!sender_id(name, nickname)')
                .eq('room_id', roomData.room_id)
                .order('created_at', { ascending: false })
                .range(0, CS_CHAT_PAGE_SIZE - 1);
            const fetched = msgs || [];
            setCsChatMessages(fetched);
            setCsChatOffset(fetched.length);
            setCsChatHasMore(fetched.length === CS_CHAT_PAGE_SIZE);
        } finally {
            setCsChatLoading(false);
        }
    };

    const loadCsChatMore = async () => {
        if (!csChatRoomId || csChatLoading) return;
        setCsChatLoading(true);
        try {
            const { data: msgs } = await supabase
                .from('chat_messages')
                .select('message_id, content, created_at, sender_id, sender:users!sender_id(name, nickname)')
                .eq('room_id', csChatRoomId)
                .order('created_at', { ascending: false })
                .range(csChatOffset, csChatOffset + CS_CHAT_PAGE_SIZE - 1);
            const fetched = msgs || [];
            setCsChatMessages(prev => [...prev, ...fetched]);
            setCsChatOffset(prev => prev + fetched.length);
            setCsChatHasMore(fetched.length === CS_CHAT_PAGE_SIZE);
        } finally {
            setCsChatLoading(false);
        }
    };

    const handleForceCancelMatch = async () => {
        if (!selectedRequest) return;
        const confirmMsg = "정말로 이 매칭을 강제 취소하시겠습니까?\n이 작업은 'CANCELED_BY_ADMIN' 상태로 기록되며 복구할 수 없습니다.";
        if (!window.confirm(confirmMsg)) return;

        // DB Migration required for CANCELED_BY_ADMIN in request_status
        const { error } = await supabase.from('match_requests').update({
            status: 'CANCELED_BY_ADMIN'
        }).eq('request_id', selectedRequest.request_id);

        if (error) {
            alert('강제 취소 실패: ' + error.message);
        } else {
            alert('매칭이 강제 취소되었습니다.');
            setSelectedRequest({ ...selectedRequest, status: 'CANCELED_BY_ADMIN' });
            setRequests(prev => prev.map(req => req.request_id === selectedRequest.request_id ? { ...req, status: 'CANCELED_BY_ADMIN' } : req));
        }
    };

    const handleSuspendUserWithReason = async () => {
        if (!suspendModal || !suspendModal.isOpen) return;
        const nextStatus = suspendModal.currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

        if (nextStatus === 'SUSPENDED' && (!suspendReason || suspendReason.trim().length < 5)) {
            alert('정지 사유를 5자 이상 입력해주세요 (감사 로그용).');
            return;
        }

        const { error } = await supabase.from('users').update({
            status: nextStatus,
            suspension_reason: nextStatus === 'SUSPENDED' ? suspendReason : null
        }).eq('user_id', suspendModal.userId);

        if (error) {
            alert('유저 상태 변경 실패: ' + error.message);
        } else {
            // ── [확장] 제재 이력 Audit Log INSERT (동기 await — 에러 즉시 표출) ──
            const { error: logErr } = await supabase.from('admin_action_logs').insert({
                target_user_id: suspendModal.userId,
                admin_id: adminId,
                action_type: nextStatus === 'SUSPENDED' ? 'SUSPEND' : 'UNSUSPEND',
                reason: nextStatus === 'SUSPENDED' ? suspendReason : '관리자 정지 해제',
            });
            if (logErr) {
                console.error('❌ Audit Log INSERT 실패:', logErr);
                alert('⚠️ 정지 처리는 성공했으나 이력 기록 실패: ' + logErr.message);
            }

            alert(`계정이 ${nextStatus === 'SUSPENDED' ? '정지' : '활성화'} 되었습니다.`);
            // View Update
            if (suspendModal.role === 'PRO') {
                setPros(p => p.map(x => x.pro_id === suspendModal.userId ? { ...x, status: nextStatus } : x));
            } else if (suspendModal.role === 'CUSTOMER') {
                setCustomers(c => c.map(x => x.user_id === suspendModal.userId ? { ...x, status: nextStatus } : x));
            }
            // ── [확장] 어뷰징 탭 UI 즉시 동기화 ──
            setAbuseData(prev => prev.map(a =>
                a.user_id === suspendModal.userId ? { ...a, userStatus: nextStatus, suspensionReason: nextStatus === 'SUSPENDED' ? suspendReason : '' } : a
            ));
            setSuspendModal(null);
            setSuspendReason('');
        }
    };

    const handleDeleteUser = async (userId: string, role: 'PRO' | 'CUSTOMER') => {
        if (!window.confirm('⚠️ 이 사용자를 삭제 처리하시겠습니까?\n(소프트 삭제: 데이터는 보존되며, status가 DELETED로 변경됩니다)')) return;
        const deleteReason = window.prompt('삭제 사유를 입력하세요 (5자 이상, 감사 로그용):');
        if (!deleteReason || deleteReason.trim().length < 5) {
            setModal({ type: 'error', title: '입력 오류', message: '삭제 사유를 5자 이상 입력해야 합니다.' });
            return;
        }

        const { error } = await supabase.from('users').update({
            status: 'DELETED',
            suspension_reason: deleteReason.trim()
        }).eq('user_id', userId);

        if (error) {
            setModal({ type: 'error', title: '삭제 실패', message: '삭제 처리 실패: ' + error.message });
            return;
        }

        if (role === 'PRO') {
            await supabase.from('pro_profiles').update({ is_accepting_requests: false }).eq('pro_id', userId);
            setPros(p => p.map(x => x.pro_id === userId ? { ...x, status: 'DELETED' } : x));
        } else {
            setCustomers(c => c.map(x => x.user_id === userId ? { ...x, status: 'DELETED' } : x));
        }

        const { error: logErr } = await supabase.from('admin_action_logs').insert({
            target_user_id: userId,
            admin_id: adminId,
            action_type: 'DELETE',
            reason: deleteReason.trim(),
        });
        if (logErr) {
            console.error('❌ Audit Log INSERT 실패:', logErr);
            setModal({ type: 'error', title: '이력 기록 실패', message: '삭제 처리는 성공했으나 이력 기록 실패: ' + logErr.message });
            return;
        }

        setModal({ type: 'success', title: '삭제 완료', message: '계정이 삭제 처리되었습니다.' });
    };

    // ─── Filters ───
    const filteredPros = pros.filter(p => {
        const q = proSearch.toLowerCase();
        const match = !q || [p.name, p.nickname, p.pro_id, p.email].some(v => (v || '').toLowerCase().includes(q));
        const filt = proFilter === 'all' || (proFilter === 'suspended' && p.status === 'SUSPENDED') || (proFilter === 'deleted' && p.status === 'DELETED');
        return match && filt;
    });

    const filteredCustomers = customers.filter(c => {
        const q = custSearch.toLowerCase();
        return !q || [c.name, c.nickname, c.user_id, c.email, c.phone].some(v => (v || '').toLowerCase().includes(q));
    });

    const filteredRequests = requests.filter(r => {
        const q = reqSearch.toLowerCase();
        const matchSearch = !q || [r.service_type, r.region, r.customerName, r.request_id, r.matchedProName].some(v => (v || '').toLowerCase().includes(q));
        return matchSearch;
    });

    const filteredReviews = reviews.filter(r => {
        const q = reviewSearch.toLowerCase();
        return !q || [r.customerName, r.proName, r.comment].some(v => (v || '').toLowerCase().includes(q));
    });

    if (!authorized || loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400 text-lg">인증 확인 중...</div>;

    // 📊 대시보드 및 통계
    const menuGroup1: { key: AdminTab; icon: string; label: string }[] = [
        { key: 'dashboard', icon: '📊', label: '대시보드' },
        { key: 'search_logs', icon: '🔍', label: '검색/유입 분석' },
    ];
    // 👥 사용자 관리 (접이식 서브메뉴 — role 기반 필터링)
    const userSubMenuItems: { key: AdminTab; icon: string; label: string }[] = [
        ...(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION' ? [
            { key: 'customer' as AdminTab, icon: '👥', label: '고객 관리' },
            { key: 'pro' as AdminTab, icon: '🔧', label: '고수 관리' },
        ] : []),
        ...(adminRole === 'ADMIN' ? [
            { key: 'admin_mgmt' as AdminTab, icon: '🛡️', label: '관리자 관리' },
        ] : []),
    ];
    // 💰 재무 및 자산 관리
    const menuGroup3: { key: AdminTab; icon: string; label: string }[] = [
        { key: 'ledger', icon: '💰', label: '캐시 원장' },
        { key: 'payout', icon: '💸', label: '출금 관리' },
    ];
    // 📋 서비스 매칭 운영
    const menuGroup4: { key: AdminTab; icon: string; label: string }[] = [
        { key: 'quotes', icon: '📋', label: '견적/매칭 내역' },
        { key: 'reviews', icon: '⭐', label: '리뷰 관리' },
    ];
    // 🚨 CS 및 리스크 관리 (신고 관리는 nav JSX에서 별도 렌더링 유지)
    const menuGroup5: { key: AdminTab; icon: string; label: string }[] = [
        { key: 'inquiries', icon: '💬', label: '1:1 문의 관리' },
        { key: 'abuse', icon: '⚠️', label: '어뷰징 관리' },
    ];
    // ⚙️ 시스템 및 환경 설정
    const menuGroup6: { key: AdminTab; icon: string; label: string }[] = [
        { key: 'categories', icon: '🏷️', label: '카테고리/단가표 설정' },
        { key: 'cms', icon: '🖼️', label: 'CMS (홈/접객 관리)' },
        { key: 'audit_log', icon: '🔒', label: '감사 로그' },
        { key: 'settings', icon: '⚙️', label: '환경 설정' },
    ];

    const handleTabClick = (key: AdminTab) => { setTab(key); setUserDetail(null); setSelectedRequest(null); window.history.replaceState(null, '', `/admin?tab=${key}`); };
    const isUserTab = (key: AdminTab) => ['pro', 'customer', 'admin_mgmt'].includes(key);

    const filteredReports = reports
        .filter(r => reportFilter === 'all' || r.status === reportFilter)
        .filter(r => {
            if (!reportSearch.trim()) return true;
            const q = reportSearch.toLowerCase();
            return (
                (r.reporter?.nickname || r.reporter?.name || '').toLowerCase().includes(q) ||
                (r.reported?.nickname || r.reported?.name || '').toLowerCase().includes(q) ||
                (r.reason || '').toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            if (reportSort === 'most_reported') return (b.reportedTotalCount ?? 0) - (a.reportedTotalCount ?? 0);
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    return (
        <div className="flex min-h-screen bg-gray-900 text-white">
            {/* ─── Sidebar ─── */}
            <aside className={`${sidebarOpen ? 'w-60' : 'w-16'} bg-gray-950 border-r border-gray-800 flex flex-col shrink-0 transition-all duration-200`}>
                <div className="p-4 border-b border-gray-800 flex items-center gap-2">
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white text-lg">☰</button>
                    {sidebarOpen && <><span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">ADMIN</span><span className="text-sm font-black">HiddenPro</span></>}
                </div>
                <nav className="flex-1 p-2 overflow-y-auto">

                    {/* ── 📊 대시보드 및 통계 (접이식) ── */}
                    <div className="space-y-0.5">
                        <button onClick={() => setGroup1Open(!group1Open)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${['dashboard', 'search_logs'].includes(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">📊</span>
                            {sidebarOpen && <><span className="flex-1 text-left">대시보드 및 통계</span><span className={`text-xs transition-transform ${group1Open ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {group1Open && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {menuGroup1.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── 👥 사용자 관리 (접이식) — ADMIN, ADMIN_OPERATION만 표시 ── */}
                    {(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION') && userSubMenuItems.length > 0 && (
                    <div className="space-y-0.5">
                        <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isUserTab(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">👤</span>
                            {sidebarOpen && <><span className="flex-1 text-left">사용자 관리</span><span className={`text-xs transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {userMenuOpen && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {userSubMenuItems.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── 💰 재무 및 자산 관리 (접이식) — ADMIN만 표시 ── */}
                    {adminRole === 'ADMIN' && (
                    <div className="space-y-0.5">
                        <button onClick={() => setGroup3Open(!group3Open)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${['ledger', 'payout'].includes(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">💰</span>
                            {sidebarOpen && <><span className="flex-1 text-left">재무 및 자산 관리</span><span className={`text-xs transition-transform ${group3Open ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {group3Open && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {menuGroup3.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── 📋 서비스 매칭 운영 (접이식) — ADMIN, ADMIN_OPERATION만 표시 ── */}
                    {(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION') && (
                    <div className="space-y-0.5">
                        <button onClick={() => setGroup4Open(!group4Open)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${['quotes', 'reviews'].includes(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">📋</span>
                            {sidebarOpen && <><span className="flex-1 text-left">서비스 매칭 운영</span><span className={`text-xs transition-transform ${group4Open ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {group4Open && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {menuGroup4.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── 🚨 CS 및 리스크 관리 (접이식) — ADMIN, ADMIN_OPERATION만 표시 ── */}
                    {(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION') && (
                    <div className="space-y-0.5">
                        <button onClick={() => setGroup5Open(!group5Open)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${['inquiries', 'abuse', 'reports'].includes(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">🚨</span>
                            {sidebarOpen && <><span className="flex-1 text-left">CS 및 리스크 관리</span><span className={`text-xs transition-transform ${group5Open ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {group5Open && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {menuGroup5.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                                {/* 신고 관리 — 미처리 건수 배지 유지 */}
                                <button
                                    onClick={() => handleTabClick('reports')}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === 'reports' ? 'bg-red-500/20 text-red-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                                >
                                    <span>🚨</span>
                                    <span className="flex-1 text-left">신고 관리</span>
                                    {reports.filter(r => r.status === 'pending').length > 0 && (
                                        <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                                            {reports.filter(r => r.status === 'pending').length}
                                        </span>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── ⚙️ 시스템 및 환경 설정 (접이식) — ADMIN만 표시 ── */}
                    {adminRole === 'ADMIN' && (
                    <div className="space-y-0.5 pb-2">
                        <button onClick={() => setGroup6Open(!group6Open)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${['categories', 'cms', 'audit_log', 'settings'].includes(tab) ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                            <span className="text-base">⚙️</span>
                            {sidebarOpen && <><span className="flex-1 text-left">시스템 및 환경 설정</span><span className={`text-xs transition-transform ${group6Open ? 'rotate-180' : ''}`}>▾</span></>}
                        </button>
                        {group6Open && sidebarOpen && (
                            <div className="ml-4 border-l border-gray-700 pl-2 space-y-0.5">
                                {menuGroup6.map(m => (
                                    <button key={m.key} onClick={() => handleTabClick(m.key)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${tab === m.key ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                        <span className="text-base">{m.icon}</span>
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    )}

                    {/* ── 로그아웃 ── */}
                    <button
                        onClick={async () => { await supabase.auth.signOut(); window.location.href = '/'; }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-gray-800 transition mt-1 ${!sidebarOpen ? 'justify-center' : ''}`}
                    >
                        <span>🚪</span>
                        {sidebarOpen && <span>로그아웃</span>}
                    </button>
                </nav>
            </aside>

            {/* ─── Main ─── */}
            <main className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto p-6">

                    {/* ─── User Detail Panel ─── */}
                    {userDetail ? (
                        <div>
                            <button onClick={() => setUserDetail(null)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">← 목록으로</button>
                            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-gray-700 rounded-full flex items-center justify-center text-2xl overflow-hidden flex-shrink-0">
                                        {detailData.user?.avatar_url ? (
                                            <img src={detailData.user.avatar_url} alt="프로필" className="w-full h-full object-cover rounded-full" />
                                        ) : (
                                            userDetail.role === 'PRO' ? '🔧' : '👤'
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold">{detailData.user?.nickname || detailData.user?.name || '사용자'}</h2>
                                        <p className="text-xs text-gray-500">{userDetail.role} · {detailData.user?.status || 'ACTIVE'}</p>
                                    </div>
                                    {userDetail.role === 'PRO' && detailData.profile && (
                                        <div className="ml-auto text-right">
                                            <p className="text-2xl font-black text-blue-400">₱{fmtNum(detailData.profile.current_cash || 0)}</p>
                                            {(detailData.profile.bonus_cash || 0) > 0 && <p className="text-sm font-bold text-green-400">+🎁{fmtNum(detailData.profile.bonus_cash)} 보너스</p>}
                                            <p className="text-xs text-gray-500">캐시 잔액</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Sub-tabs */}
                            <div className="flex gap-1 mb-4 bg-gray-800/50 rounded-xl p-1">
                                {(['info', 'ledger', 'quotes', 'reviews'] as UserDetailTab[]).map(t => {
                                    const isDisabled = t === 'ledger' && userDetail.role === 'CUSTOMER';
                                    return (
                                        <button key={t} onClick={() => !isDisabled && setUserDetailTab(t)}
                                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${isDisabled ? 'text-gray-600 bg-gray-800/50 cursor-not-allowed opacity-50' : userDetailTab === t ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                                            {{ info: '기본 정보', ledger: '캐시 내역', quotes: '견적', reviews: '리뷰' }[t]}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
                                {userDetailTab === 'info' && (
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><span className="text-gray-500 block text-xs mb-1">이름</span><span className="text-white">{detailData.user?.name || '-'}</span></div>
                                        <div><span className="text-gray-500 block text-xs mb-1">활동명</span><span className="text-white">{detailData.user?.nickname || '-'}</span></div>
                                        <div><span className="text-gray-500 block text-xs mb-1">역할</span><span className="text-white">{detailData.user?.role || '-'}</span></div>
                                        <div><span className="text-gray-500 block text-xs mb-1">상태</span><span className="text-white">{detailData.user?.status || '-'}</span></div>
                                        <div><span className="text-gray-500 block text-xs mb-1">전화번호</span><span className="text-white">{detailData.user?.phone || '-'}</span></div>
                                        <div><span className="text-gray-500 block text-xs mb-1">가입일</span><span className="text-white">{detailData.user?.created_at ? fmtDate(detailData.user.created_at) : '-'}</span></div>
                                        {userDetail.role === 'PRO' && detailData.profile && (<>
                                            <div><span className="text-gray-500 block text-xs mb-1">인증 상태</span><span className='text-green-400'>자동 인증됨</span></div>
                                            <div><span className="text-gray-500 block text-xs mb-1">서비스</span><span className="text-white">{(detailData.profile.services || []).join(', ') || '-'}</span></div>
                                            <div><span className="text-gray-500 block text-xs mb-1">지역</span><span className="text-white">{detailData.profile.region || '-'}</span></div>
                                            <div><span className="text-gray-500 block text-xs mb-1">Facebook</span><span className="text-white">{detailData.profile.facebook_url || '-'}</span></div>
                                        </>)}
                                    </div>
                                )}
                                {userDetailTab === 'ledger' && (
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase"><th className="p-2 text-left">시간</th><th className="p-2 text-left">유형</th><th className="p-2 text-right">금액</th><th className="p-2 text-right">잔액</th><th className="p-2 text-left">설명</th></tr></thead>
                                        <tbody>{(detailData.ledger || []).map((tx: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-700/50">
                                                <td className="p-2 text-gray-400 text-xs">{fmtDate(tx.created_at)}</td>
                                                <td className="p-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.amount > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>{txLabel(tx.tx_type)}</span></td>
                                                <td className={`p-2 text-right font-bold ${tx.amount > 0 ? 'text-blue-400' : 'text-red-400'}`}>{tx.amount > 0 ? '+' : ''}{fmtNum(Number(tx.amount))}</td>
                                                <td className="p-2 text-right text-gray-400 text-xs">{fmtNum(Number(tx.balance_snapshot))}</td>
                                                <td className="p-2 text-gray-500 text-xs">{txDesc(tx.tx_type, tx.description)}</td>
                                            </tr>
                                        ))}{(detailData.ledger || []).length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">내역 없음</td></tr>}</tbody>
                                    </table>
                                )}
                                {userDetailTab === 'quotes' && (
                                    <div className="space-y-2">
                                        {userDetail.role === 'CUSTOMER' ? (detailData.requests || []).map((r: any) => (
                                            <div key={r.request_id} className="p-3 bg-gray-700/30 rounded-xl">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold text-sm">{r.service_type || '서비스'}</span>
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-1">{r.region} · {fmtDate(r.created_at)} · 견적 {(r.match_quotes || []).length}건</p>
                                            </div>
                                        )) : (detailData.quotes || []).map((q: any) => (
                                            <div key={q.quote_id} className="p-3 bg-gray-700/30 rounded-xl flex justify-between items-center">
                                                <div><p className="font-semibold text-sm">₱{fmtNum(q.price || 0)}</p><p className="text-xs text-gray-400">{fmtDate(q.created_at)}</p></div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor(q.status || 'OPEN')}`}>{q.status || 'PENDING'}</span>
                                            </div>
                                        ))}
                                        {((userDetail.role === 'CUSTOMER' ? detailData.requests : detailData.quotes) || []).length === 0 && <p className="text-center text-gray-500 py-6">데이터 없음</p>}
                                    </div>
                                )}
                                {userDetailTab === 'reviews' && (
                                    <div className="space-y-2">
                                        {(detailData.reviews || []).map((r: any) => (
                                            <div key={r.review_id} className="p-3 bg-gray-700/30 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex">{[1, 2, 3, 4, 5].map(s => <span key={s} className={`text-sm ${s <= r.rating ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>)}</div>
                                                    <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
                                                </div>
                                                <p className="text-sm text-gray-300 mt-1">{r.comment || '코멘트 없음'}</p>
                                            </div>
                                        ))}
                                        {(detailData.reviews || []).length === 0 && <p className="text-center text-gray-500 py-6">리뷰 없음</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (<>

                        {/* ═══ DASHBOARD ═══ */}
                        {tab === 'dashboard' && (<>
                            <h1 className="text-2xl font-black mb-6">📊 대시보드 개요</h1>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                                {/* 미답변 1:1 문의 카드 (최우선 배치) */}
                                <div
                                    className="relative bg-[#1e2433] rounded-2xl p-5 flex flex-col gap-2 border border-gray-700/50 cursor-pointer hover:border-blue-500/50 hover:bg-[#252d42] transition-all"
                                    onClick={() => handleTabClick('inquiries')}
                                >
                                  {pendingInquiries > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                                      {pendingInquiries > 99 ? '99+' : pendingInquiries}
                                    </span>
                                  )}
                                  <span className="text-gray-400 text-sm flex items-center gap-1">
                                    💬 미답변 문의
                                  </span>
                                  <span className={`text-2xl font-black ${pendingInquiries > 0 ? 'text-orange-400' : 'text-white'}`}>
                                    {pendingInquiries}
                                  </span>
                                </div>

                                {[
                                    { l: '🚨 신고 대기', v: stats.pendingReports, c: 'text-red-400', onClick: () => handleTabClick('reports') },
                                    { l: '💸 출금 신청 (검토중)', v: stats.payoutPending, c: stats.payoutPending > 0 ? 'text-blue-400' : 'text-white', onClick: () => { setPayoutFilter('PENDING'); handleTabClick('payout'); } },
                                    { l: '👥 고객', v: stats.customers, onClick: () => handleTabClick('customer') },
                                    { l: '🔧 고수', v: stats.pros, onClick: () => handleTabClick('pro') },
                                    { l: '🤝 진행 중 매칭', v: stats.openReq, c: 'text-green-400', onClick: () => { setReqFilter('OPEN'); handleTabClick('quotes'); } },
                                    { l: '✅ 마감된 매칭', v: stats.closedReq, onClick: () => { setReqFilter('all'); handleTabClick('quotes'); } },
                                    { l: '💎 24h 충전', v: stats.charge24h, c: 'text-blue-400', p: '+', onClick: () => { setLedgerCategory('CHARGE'); setLedgerPeriod('today'); setLedgerPage(1); handleTabClick('ledger'); } },
                                    { l: '🔥 24h 차감', v: stats.deduct24h, c: 'text-red-400', p: '-', onClick: () => { setLedgerCategory('DEDUCT_QUOTE'); setLedgerPeriod('today'); setLedgerPage(1); handleTabClick('ledger'); } },
                                    { l: '⚠️ 어뷰징', v: stats.abuseCount, c: 'text-orange-400', onClick: () => handleTabClick('abuse') },
                                    { l: '⏸️ 출금 홀드 (7일)', v: stats.payoutHeld, c: stats.payoutHeld > 0 ? 'text-yellow-400' : 'text-white', onClick: () => { setPayoutFilter('HELD'); handleTabClick('payout'); } },
                                ].map((s, i) => (
                                    <div
                                        key={i}
                                        onClick={s.onClick}
                                        className="bg-gray-800 rounded-xl p-4 border border-gray-700 cursor-pointer hover:border-blue-500/50 hover:bg-gray-700/60 transition-all group"
                                    >
                                        <p className="text-gray-400 text-xs font-bold uppercase mb-1 group-hover:text-gray-200 transition">{s.l}</p>
                                        <p className={`text-2xl font-black ${s.c || 'text-white'}`}>{s.p || ''}{fmtNum(s.v)}</p>
                                    </div>
                                ))}
                            </div>
                            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-800/40 p-5">
                                <p className="text-gray-300 text-sm">💡 상세 캐시 거래 내역은 좌측 메뉴의 <button onClick={() => handleTabClick('ledger')} className="text-blue-400 font-bold hover:underline">💰 캐시 원장</button> 메뉴에서 확인하세요.</p>
                            </div>
                        </>)}

                        {/* ═══ CASH LEDGER ═══ */}
                        {tab === 'ledger' && (<>
                            <h1 className="text-2xl font-black mb-6">💰 통합 캐시 거래 원장</h1>
                            {/* ── Stats Summary ── */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                                <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-xl p-4 border border-purple-700/40">
                                    <p className="text-purple-300 text-xs font-bold uppercase mb-1">🏦 총 부채 (전체 고수 잔액)</p>
                                    <p className="text-2xl font-black text-purple-400">₱{fmtNum(totalProBalance)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-900/40 to-blue-800/20 rounded-xl p-4 border border-blue-700/40">
                                    <p className="text-blue-300 text-xs font-bold uppercase mb-1">📈 유입 합계 (충전)</p>
                                    <p className="text-2xl font-black text-blue-400">+₱{fmtNum(ledgerStats.totalIn)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 rounded-xl p-4 border border-red-700/40">
                                    <p className="text-red-300 text-xs font-bold uppercase mb-1">📉 유출 합계 (차감/환불)</p>
                                    <p className="text-2xl font-black text-red-400">-₱{fmtNum(ledgerStats.totalOut)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-gray-800 to-gray-700/30 rounded-xl p-4 border border-gray-600/40">
                                    <p className="text-gray-300 text-xs font-bold uppercase mb-1">🔢 조회 건수</p>
                                    <p className="text-2xl font-black text-white">{fmtNum(ledgerStats.filtered)}건</p>
                                </div>
                            </div>
                            {/* ── Category Tabs ── */}
                            <div className="flex flex-wrap gap-1 mb-4 bg-gray-800/50 rounded-xl p-1">
                                {([['all', '전체'], ['DEDUCT_QUOTE', '견적 차감'], ['ADMIN_CHARGE', '관리자 충전'], ['CHARGE', '고수 직접 충전'], ['REFUND', '환불(운영 취소)']] as [LedgerCategory, string][]).map(([k, label]) => (
                                    <button key={k} onClick={() => { setLedgerCategory(k); setLedgerPage(1); loadLedger(1, k, ledgerPeriod, ledgerSearch); }}
                                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition whitespace-nowrap ${ledgerCategory === k ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* ── Filters Row ── */}
                            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                <div className="flex gap-2 flex-1">
                                    <input type="text" value={ledgerSearchInput} onChange={e => setLedgerSearchInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { setLedgerSearch(ledgerSearchInput); setLedgerPage(1); loadLedger(1, ledgerCategory, ledgerPeriod, ledgerSearchInput); } }}
                                        placeholder="고수 이름 / 이메일 / 전화번호 검색..."
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    <button onClick={() => { setLedgerSearch(ledgerSearchInput); setLedgerPage(1); loadLedger(1, ledgerCategory, ledgerPeriod, ledgerSearchInput); }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold">검색</button>
                                </div>
                                <select value={ledgerPeriod} onChange={e => { const v = e.target.value as LedgerPeriod; setLedgerPeriod(v); setLedgerPage(1); loadLedger(1, ledgerCategory, v, ledgerSearch); }}
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white">
                                    <option value="all">전체 기간</option><option value="today">오늘</option><option value="7d">최근 1주일</option><option value="30d">최근 1개월</option><option value="90d">최근 3개월</option>
                                </select>
                                <button onClick={() => {
                                    // CSV download
                                    const header = '시간,고수명,이메일,전화번호,유형,금액,잔액,설명\n';
                                    const csvRows = ledgerData.map(r => [
                                        r.created_at ? new Date(r.created_at).toLocaleString('ko-KR') : '',
                                        r.proName || '', r.proEmail || '', r.proPhone || '',
                                        txLabel(r.tx_type), r.amount, r.balance_snapshot, (r.description || '').replace(/,/g, ' ')
                                    ].join(',')).join('\n');
                                    const bom = '\uFEFF';
                                    const blob = new Blob([bom + header + csvRows], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a'); a.href = url;
                                    a.download = `cash_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
                                    a.click(); URL.revokeObjectURL(url);
                                }} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap">📥 CSV 다운로드</button>
                            </div>
                            {/* ── Table ── */}
                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                {ledgerLoading ? (
                                    <div className="p-12 text-center text-gray-500">불러오는 중...</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                            <th className="p-2.5 text-left">시간</th>
                                            <th className="p-2.5 text-left">고수명</th>
                                            <th className="p-2.5 text-left">이메일</th>
                                            <th className="p-2.5 text-left">전화번호</th>
                                            <th className="p-2.5 text-left">유형</th>
                                            <th className="p-2.5 text-right">금액</th>
                                            <th className="p-2.5 text-right">잔액</th>
                                            <th className="p-2.5 text-left">설명</th>
                                        </tr></thead>
                                        <tbody>
                                            {ledgerData.map(tx => (
                                                <tr key={tx.transaction_id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                                    <td className="p-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                                                    <td className="p-2.5 text-sm"><button onClick={async () => {
                                                        setDrilldown({ proId: tx.pro_id, proName: tx.proName || tx.pro_id?.slice(0, 8), proEmail: tx.proEmail || '', proPhone: tx.proPhone || '', txs: [], loading: true }); setDrilldownFilter('all');
                                                        const { data } = await supabase.from('cash_ledger').select('*').eq('pro_id', tx.pro_id).order('created_at', { ascending: false }).limit(200);
                                                        setDrilldown(prev => prev ? { ...prev, txs: data || [], loading: false } : null);
                                                    }} className="text-blue-400 hover:text-blue-300 hover:underline font-semibold transition">{tx.proName || tx.pro_id?.slice(0, 8) + '...'}</button></td>
                                                    <td className="p-2.5 text-gray-400 text-xs">{tx.proEmail || '-'}</td>
                                                    <td className="p-2.5 text-gray-400 text-xs">{tx.proPhone || '-'}</td>
                                                    <td className="p-2.5"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.amount > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>{txLabel(tx.tx_type)}</span></td>
                                                    <td className={`p-2.5 text-right font-bold ${tx.amount > 0 ? 'text-blue-400' : 'text-red-400'}`}>{tx.amount > 0 ? '+' : ''}₱{fmtNum(Math.abs(Number(tx.amount)))}</td>
                                                    <td className="p-2.5 text-right text-gray-400 text-xs">₱{fmtNum(Number(tx.balance_snapshot))}</td>
                                                    <td className="p-2.5 text-gray-500 text-xs max-w-[200px] truncate">{txDesc(tx.tx_type, tx.description)}</td>
                                                </tr>
                                            ))}
                                            {ledgerData.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-500">거래 내역이 없습니다.</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {/* ── Pagination ── */}
                            {ledgerTotal > LEDGER_PAGE_SIZE && (
                                <div className="flex items-center justify-between mt-4">
                                    <p className="text-xs text-gray-500">{fmtNum(ledgerTotal)}건 중 {(ledgerPage - 1) * LEDGER_PAGE_SIZE + 1}~{Math.min(ledgerPage * LEDGER_PAGE_SIZE, ledgerTotal)}건</p>
                                    <div className="flex gap-1">
                                        <button disabled={ledgerPage <= 1} onClick={() => { const p = ledgerPage - 1; setLedgerPage(p); loadLedger(p, ledgerCategory, ledgerPeriod, ledgerSearch); }}
                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-bold disabled:opacity-30">← 이전</button>
                                        <span className="px-3 py-1.5 text-sm text-gray-400">{ledgerPage} / {Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE)}</span>
                                        <button disabled={ledgerPage >= Math.ceil(ledgerTotal / LEDGER_PAGE_SIZE)} onClick={() => { const p = ledgerPage + 1; setLedgerPage(p); loadLedger(p, ledgerCategory, ledgerPeriod, ledgerSearch); }}
                                            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg font-bold disabled:opacity-30">다음 →</button>
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ ABUSE MANAGEMENT ═══ */}
                        {tab === 'abuse' && (<>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h1 className="text-2xl font-black text-white">⚠️ 어뷰징/패널티 관리</h1>
                                    <p className="text-sm text-gray-400 mt-1">3-15-0 룰 기반으로 자동 적발된 윈도우 쇼퍼 고객을 관리합니다.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex bg-gray-800 rounded-lg p-0.5">
                                        <button onClick={() => setAbuseFilter('flagged')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${abuseFilter === 'flagged' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>🚨 적발된 유저</button>
                                        <button onClick={() => setAbuseFilter('all')} className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${abuseFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>📊 전체 보기</button>
                                    </div>
                                    <button onClick={loadAbuseData} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition">🔄 새로고침</button>
                                </div>
                            </div>

                            {/* 요약 카드 */}
                            <div className="grid grid-cols-3 gap-4 mb-6">
                                <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-5">
                                    <p className="text-xs text-red-300/70 font-bold uppercase">총 적발 고객</p>
                                    <p className="text-3xl font-black text-red-400 mt-1">{abuseData.filter(a => a.is_flagged).length}</p>
                                </div>
                                <div className="bg-orange-900/20 border border-orange-800/30 rounded-xl p-5">
                                    <p className="text-xs text-orange-300/70 font-bold uppercase">최근 7일 신규 적발</p>
                                    <p className="text-3xl font-black text-orange-400 mt-1">{abuseData.filter(a => a.is_flagged && a.flagged_at && new Date(a.flagged_at).getTime() > Date.now() - 7 * 86400000).length}</p>
                                </div>
                                <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-5">
                                    <p className="text-xs text-green-300/70 font-bold uppercase">해제 완료</p>
                                    <p className="text-3xl font-black text-green-400 mt-1">{abuseData.filter(a => !a.is_flagged && a.total_noshow > 0).length}</p>
                                </div>
                            </div>

                            {/* 3-15-0 룰 설명 */}
                            <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 mb-6 text-sm text-gray-400">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-bold text-white">📋 3-15-0 자동 적발 조건 (AND)</p>
                                    <p className="text-xs text-orange-300 font-bold">전체 조건 달성: {abuseData.filter(a => a.is_abuse_target).length}명</p>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-gray-900/50 p-3 rounded-lg text-center">
                                        <p className="text-2xl font-black text-red-400">3</p>
                                        <p className="text-xs text-gray-500 mt-1">연속 노쇼 횟수</p>
                                        <p className="text-xs text-red-400/70 mt-1">{abuseData.filter(a => a.consecutive_noshow >= 3).length}명 달성</p>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-lg text-center">
                                        <p className="text-2xl font-black text-orange-400">15</p>
                                        <p className="text-xs text-gray-500 mt-1">누적 열람 견적</p>
                                        <p className="text-xs text-orange-400/70 mt-1">{abuseData.filter(a => a.total_read_quotes >= 15).length}명 달성</p>
                                    </div>
                                    <div className="bg-gray-900/50 p-3 rounded-lg text-center">
                                        <p className="text-2xl font-black text-gray-400">0%</p>
                                        <p className="text-xs text-gray-500 mt-1">누적 매칭률</p>
                                        <p className="text-xs text-gray-400/70 mt-1">{abuseData.filter(a => a.match_rate === 0).length}명 달성</p>
                                    </div>
                                </div>
                            </div>

                            {abuseLoading ? <div className="text-center text-gray-500 py-20">데이터를 불러오는 중...</div> : (
                                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                                <th className="p-4 text-left">고객</th>
                                                <th className="p-4 text-center">연속 노쇼</th>
                                                <th className="p-4 text-center">열람 견적</th>
                                                <th className="p-4 text-center">매칭률</th>
                                                <th className="p-4 text-center">상태</th>
                                                <th className="p-4 text-center">적발일</th>
                                                <th className="p-4 text-center">액션</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {abuseData.length === 0 ? (
                                                <tr><td colSpan={7} className="p-12 text-center text-gray-500">추적 대상 고객이 없습니다.</td></tr>
                                            ) : abuseData.map((a: any) => {
                                                const matchRateVal = a.match_rate !== null && a.match_rate !== undefined ? a.match_rate : (a.total_requests > 0 ? Math.round((a.total_matched / a.total_requests) * 100) : null);
                                                return (
                                                    <tr key={a.user_id} className={`border-b border-gray-700/50 hover:bg-gray-700/20 ${!a.is_flagged ? 'opacity-50' : ''}`}>
                                                        <td className="p-4">
                                                            <p className="font-bold text-white">{a.nickname || a.name || a.userName}</p>
                                                            <p className="text-xs text-gray-500">{a.userEmail}</p>
                                                        </td>
                                                        <td className={`p-4 text-center font-bold ${a.consecutive_noshow >= 3 ? 'text-red-400' : 'text-gray-400'}`}>{a.consecutive_noshow}회</td>
                                                        <td className={`p-4 text-center font-bold ${a.total_read_quotes >= 15 ? 'text-orange-400' : 'text-gray-400'}`}>{a.total_read_quotes}건</td>
                                                        <td className={`p-4 text-center font-bold ${matchRateVal === 0 ? 'text-red-400' : 'text-green-400'}`}>{matchRateVal !== null ? `${matchRateVal}%` : '-'}</td>
                                                        <td className="p-4 text-center">
                                                            {a.is_flagged ? (
                                                                <span className="bg-red-900/50 text-red-300 text-xs font-bold px-2 py-1 rounded-full">적발</span>
                                                            ) : (
                                                                <span className="bg-green-900/50 text-green-300 text-xs font-bold px-2 py-1 rounded-full">해제</span>
                                                            )}
                                                            {(a.status === 'SUSPENDED' || a.userStatus === 'SUSPENDED') && (
                                                                <span className="relative group ml-1">
                                                                    <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help">정지</span>
                                                                    {a.suspensionReason && (
                                                                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-white text-gray-900 text-xs rounded-lg px-3 py-2.5 whitespace-nowrap shadow-2xl z-50 max-w-xs border border-gray-200">
                                                                            <span className="block font-bold text-red-600 mb-1">📝 정지 사유</span>
                                                                            {a.suspensionReason}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            )}
                                                            {a.total_reports >= 3 && (
                                                                <span className="ml-1 bg-orange-900/50 text-orange-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">신고{a.total_reports}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center text-xs text-gray-500">{a.flagged_at ? fmtDate(a.flagged_at) : '-'}</td>
                                                        <td className="p-4 text-center">
                                                            <div className="flex gap-1 justify-center">
                                                                {a.is_flagged && (
                                                                    <button
                                                                        onClick={() => setUnflagConfirmModal({ userId: a.user_id, nickname: a.nickname || a.name || a.user_id })}
                                                                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                                                                    >해제</button>
                                                                )}
                                                                {a.userStatus !== 'SUSPENDED' ? (
                                                                    <button
                                                                        onClick={() => setSuspendModal({ isOpen: true, userId: a.user_id, role: 'CUSTOMER', currentStatus: a.userStatus })}
                                                                        className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-[0_0_8px_rgba(220,38,38,0.4)] hover:shadow-[0_0_14px_rgba(220,38,38,0.6)]"
                                                                    >정지</button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setSuspendModal({ isOpen: true, userId: a.user_id, role: 'CUSTOMER', currentStatus: 'SUSPENDED' })}
                                                                        className="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                                                                    >🔓 정지 해제</button>
                                                                )}
                                                                <button
                                                                    onClick={async () => {
                                                                        setAbuseTimeline({ user: a, logs: [], loading: true });
                                                                        const { data: logs } = await supabase
                                                                            .from('admin_action_logs')
                                                                            .select('*')
                                                                            .eq('target_user_id', a.user_id)
                                                                            .order('created_at', { ascending: false })
                                                                            .limit(50);
                                                                        setAbuseTimeline({ user: a, logs: logs || [], loading: false });
                                                                    }}
                                                                    className="bg-gray-600 hover:bg-gray-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                                                                >이력</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ── [확장] 패널티 해제 확인 모달 ── */}
                            {unflagConfirmModal && (
                                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                                    <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
                                        <h3 className="text-lg font-bold text-white mb-2">패널티 해제</h3>
                                        <p className="text-sm text-gray-400 mb-1">
                                            <span className="font-bold text-white">{unflagConfirmModal.nickname}</span>님의 패널티를 해제하시겠습니까?
                                        </p>
                                        <p className="text-xs text-gray-500 mb-6">연속 노쇼 카운트도 0으로 초기화됩니다.</p>
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => setUnflagConfirmModal(null)}
                                                className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition"
                                            >취소</button>
                                            <button
                                                onClick={handleUnflagConfirm}
                                                className="px-4 py-2 rounded-lg text-sm font-bold bg-green-600 hover:bg-green-500 text-white transition"
                                            >해제 확인</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── [확장] 제재 이력 타임라인 모달 ── */}
                            {abuseTimeline && (
                                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4" onClick={() => setAbuseTimeline(null)}>
                                    <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl border border-gray-700" onClick={e => e.stopPropagation()}>
                                        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-5 flex justify-between items-center z-10">
                                            <div>
                                                <h2 className="text-lg font-black text-white flex items-center gap-2">📋 제재 이력 타임라인</h2>
                                                <p className="text-sm text-gray-400 mt-1">{abuseTimeline.user.userName} ({abuseTimeline.user.userEmail})</p>
                                            </div>
                                            <button onClick={() => setAbuseTimeline(null)} className="text-gray-400 hover:text-white text-xl font-bold px-2">✕</button>
                                        </div>

                                        {/* 요약 카드 */}
                                        <div className="px-5 pt-4 pb-2">
                                            <div className="flex gap-3">
                                                <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border-2 border-red-500/60 rounded-xl px-4 py-3 flex-1 text-center shadow-[0_0_12px_rgba(239,68,68,0.2)]">
                                                    <p className="text-3xl font-black text-red-400 drop-shadow-lg">{abuseTimeline.logs.filter(l => l.action_type === 'SUSPEND').length}</p>
                                                    <p className="text-xs text-red-300 font-bold mt-0.5">누적 정지</p>
                                                </div>
                                                <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-2 border-green-500/60 rounded-xl px-4 py-3 flex-1 text-center shadow-[0_0_12px_rgba(34,197,94,0.2)]">
                                                    <p className="text-3xl font-black text-green-400 drop-shadow-lg">{abuseTimeline.logs.filter(l => l.action_type === 'UNSUSPEND').length}</p>
                                                    <p className="text-xs text-green-300 font-bold mt-0.5">해제 횟수</p>
                                                </div>
                                                <div className="bg-gradient-to-br from-gray-700/50 to-gray-800/30 border-2 border-gray-500/60 rounded-xl px-4 py-3 flex-1 text-center shadow-[0_0_12px_rgba(156,163,175,0.15)]">
                                                    <p className="text-3xl font-black text-white drop-shadow-lg">{abuseTimeline.logs.length}</p>
                                                    <p className="text-xs text-gray-300 font-bold mt-0.5">전체 로그</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 타임라인 */}
                                        <div className="px-5 py-4">
                                            {abuseTimeline.loading ? (
                                                <div className="text-center py-10 text-gray-500">불러오는 중...</div>
                                            ) : abuseTimeline.logs.length === 0 ? (
                                                <div className="text-center py-10 text-gray-500">제재 이력이 없습니다.</div>
                                            ) : (
                                                <div className="relative border-l-2 border-gray-700 ml-3 space-y-4">
                                                    {abuseTimeline.logs.map((log: any, i: number) => (
                                                        <div key={log.id || i} className="relative pl-6">
                                                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 ${log.action_type === 'SUSPEND' ? 'bg-red-500 border-red-300' :
                                                                log.action_type === 'UNSUSPEND' ? 'bg-green-500 border-green-300' :
                                                                    log.action_type === 'FLAG' ? 'bg-orange-500 border-orange-300' :
                                                                        'bg-blue-500 border-blue-300'
                                                                }`} />
                                                            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700/50">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${log.action_type === 'SUSPEND' ? 'bg-red-900/50 text-red-300' :
                                                                        log.action_type === 'UNSUSPEND' ? 'bg-green-900/50 text-green-300' :
                                                                            log.action_type === 'FLAG' ? 'bg-orange-900/50 text-orange-300' :
                                                                                'bg-blue-900/50 text-blue-300'
                                                                        }`}>{log.action_type === 'SUSPEND' ? '⛔ 정지' : log.action_type === 'UNSUSPEND' ? '✅ 해제' : log.action_type === 'FLAG' ? '🚨 적발' : '🔓 적발 해제'}</span>
                                                                    <span className="text-xs text-gray-500">{log.created_at ? new Date(log.created_at).toLocaleString('ko-KR') : '-'}</span>
                                                                </div>
                                                                {log.reason && <p className="text-sm text-gray-300">{log.reason}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ 신고 관리 ═══ */}
                        {tab === 'reports' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-white">🚨 신고 관리</h2>
                                        <p className="text-gray-400 text-sm mt-1">채팅방에서 접수된 신고를 검토하고 제재를 처리합니다.</p>
                                    </div>
                                    <button onClick={fetchReports} className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition">
                                        🔄 새로고침
                                    </button>
                                </div>

                                {/* 필터/검색/정렬 UI */}
                                <div className="flex flex-wrap gap-2 items-center">
                                    <div className="flex gap-1">
                                        {(['all', 'pending', 'reviewed'] as const).map(f => (
                                            <button
                                                key={f}
                                                onClick={() => setReportFilter(f)}
                                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${reportFilter === f ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
                                            >
                                                {f === 'all' ? '전체' : f === 'pending' ? '미처리' : '처리완료'}
                                            </button>
                                        ))}
                                    </div>
                                    <input
                                        type="text"
                                        value={reportSearch}
                                        onChange={e => setReportSearch(e.target.value)}
                                        placeholder="신고자/피신고자/사유 검색..."
                                        className="flex-1 min-w-[160px] bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                    <select
                                        value={reportSort}
                                        onChange={e => setReportSort(e.target.value as 'latest' | 'most_reported')}
                                        className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                                    >
                                        <option value="latest">최신순</option>
                                        <option value="most_reported">누적 신고 많은 순</option>
                                    </select>
                                </div>

                                {reportsLoading ? (
                                    <div className="text-center py-10 text-gray-400">신고 목록 로딩 중...</div>
                                ) : filteredReports.length === 0 ? (
                                    <div className="text-center py-10 text-gray-400">
                                        {reports.length === 0 ? '접수된 신고가 없습니다.' : '검색/필터 조건에 맞는 신고가 없습니다.'}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {filteredReports.map(report => (
                                            <div key={report.id} className={`rounded-xl p-4 border ${report.status === 'pending' ? 'border-red-500/30 bg-red-500/5' : 'border-white/10 bg-white/5'}`}>
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${report.status === 'pending' ? 'bg-red-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                                            {report.status === 'pending' ? '미처리' : '처리완료'}
                                                        </span>
                                                        <span className="text-xs text-gray-500">{fmtDate(report.created_at)}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => chatPreview?.reportId === report.id ? setChatPreview(null) : fetchChatPreview(report.id, report.room_id)}
                                                        className="text-xs text-blue-400 hover:text-blue-300 transition"
                                                    >
                                                        💬 채팅 내역 {chatPreview?.reportId === report.id ? '닫기' : '보기'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                                    <div>
                                                        <span className="text-gray-500 text-xs">신고자</span>
                                                        <p className="text-white font-medium">{report.reporter?.nickname || report.reporter?.name}
                                                            <span className="text-gray-500 text-xs ml-1">({report.reporter?.role})</span>
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 text-xs">피신고자</span>
                                                        <p className="text-red-400 font-medium flex items-center gap-1 flex-wrap">
                                                            {report.reported?.nickname || report.reported?.name}
                                                            <span className="text-gray-500 text-xs">({report.reported?.role})</span>
                                                            {report.reported?.status === 'SUSPENDED' && (
                                                                <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded-full">정지됨</span>
                                                            )}
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${report.reportedTotalCount >= 5 ? 'bg-red-500 text-white' :
                                                                    report.reportedTotalCount >= 3 ? 'bg-orange-500 text-white' :
                                                                        'bg-yellow-500/20 text-yellow-400'
                                                                }`}>
                                                                🚨 누적 {report.reportedTotalCount}회
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-sm text-gray-300 mb-3">
                                                    <span className="text-gray-500">신고 사유: </span>{report.reason}
                                                </div>

                                                {chatPreview?.reportId === report.id && (
                                                    <div className="bg-black/30 border border-white/10 rounded-lg p-3 mb-3 max-h-48 overflow-y-auto">
                                                        <p className="text-xs font-bold text-gray-500 mb-2">채팅 내역 (최근 30건)</p>
                                                        {chatPreview?.messages?.map((msg, i) => (
                                                            <div key={i} className="text-xs text-gray-400 mb-1">
                                                                <span className="text-gray-600">{new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                <span className="ml-2 font-bold text-blue-400">
                                                                    {(msg.sender as any)?.nickname || (msg.sender as any)?.name || msg.sender_id?.slice(0, 8)}
                                                                </span>
                                                                <span className="ml-2 text-gray-300">{msg.content}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between">
                                                    {report.status === 'pending' ? (
                                                        <button
                                                            onClick={() => setReportSuspendModal({ userId: report.reported?.user_id, role: (report.reported?.role?.toUpperCase() || '') as 'PRO' | 'CUSTOMER' | '', currentStatus: report.reported?.status || 'ACTIVE' })}
                                                            className="text-xs bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg transition"
                                                        >
                                                            ⚡ 제재 처리
                                                        </button>
                                                    ) : (
                                                        <p className="text-xs text-gray-500">처리 메모: {report.admin_note}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 신고 탭 전용 제재 모달 */}
                                {reportSuspendModal && (
                                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                                            <h3 className="text-lg font-bold text-white mb-1">⚡ 제재 처리</h3>
                                            <p className="text-sm text-gray-400 mb-4">대상: <span className="font-bold text-red-400">{reports.find(r => r.reported?.user_id === reportSuspendModal.userId && r.status === 'pending')?.reported?.nickname || reports.find(r => r.reported?.user_id === reportSuspendModal.userId && r.status === 'pending')?.reported?.name || reportSuspendModal.userId}</span></p>
                                            <div className="flex gap-2 mb-4">
                                                {(['warning', 'temporary', 'permanent'] as const).map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => setSuspendType(type)}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${suspendType === type ? 'bg-red-500 text-white border-red-500' : 'bg-white/5 text-gray-400 border-white/10 hover:border-red-400'}`}
                                                    >
                                                        {type === 'warning' ? '⚠️ 경고' : type === 'temporary' ? '⏱ 임시정지' : '🚫 영구정지'}
                                                    </button>
                                                ))}
                                            </div>
                                            {suspendType === 'temporary' && (
                                                <div className="mb-4">
                                                    <label className="block text-xs font-bold text-gray-400 mb-1">정지 기간</label>
                                                    <select
                                                        value={suspendDays}
                                                        onChange={(e) => setSuspendDays(Number(e.target.value))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                                                    >
                                                        <option value={1}>1일</option>
                                                        <option value={3}>3일</option>
                                                        <option value={7}>7일</option>
                                                    </select>
                                                </div>
                                            )}
                                            <textarea
                                                value={reportSuspendReason}
                                                onChange={(e) => setReportSuspendReason(e.target.value)}
                                                placeholder="제재 사유를 입력하세요 (유저에게 표시됩니다)"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white h-24 resize-none focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setReportSuspendModal(null); setReportSuspendReason(''); setSuspendType('warning'); }}
                                                    className="flex-1 border border-white/10 text-gray-400 font-bold py-2 rounded-xl text-sm hover:bg-white/5 transition"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={handleSuspend}
                                                    disabled={suspendSubmitting || !reportSuspendReason.trim()}
                                                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-50 transition"
                                                >
                                                    {suspendSubmitting ? '처리 중...' : '제재 확정'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ═══ DB CATEGORY MANAGEMENT ═══ */}
                        {tab === 'categories' && (<>
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h1 className="text-2xl font-black text-white">🏷️ 카테고리/단가표 관리</h1>
                                    <p className="text-sm text-gray-400 mt-1">플랫폼의 서비스 카테고리와 견적 발송 단가를 관리합니다.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <select
                                        value={categoryDepth1Filter}
                                        onChange={e => { setCategoryDepth1Filter(e.target.value); setCategoryDepth2Filter('all'); }}
                                        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="all">Depth 1 (전체)</option>
                                        {Array.from(new Set(dbCategories.map(c => c.depth1).filter(Boolean))).sort().map((d1: any) => (
                                            <option key={d1} value={d1}>{d1}</option>
                                        ))}
                                    </select>
                                    {categoryDepth1Filter !== 'all' && (
                                        <select
                                            value={categoryDepth2Filter}
                                            onChange={e => setCategoryDepth2Filter(e.target.value)}
                                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="all">Depth 2 (전체)</option>
                                            {Array.from(new Set(
                                                dbCategories
                                                    .filter(c => c.depth1 === categoryDepth1Filter)
                                                    .map(c => c.depth2)
                                                    .filter(Boolean)
                                            )).sort().map((d2: any) => (
                                                <option key={d2} value={d2}>{d2}</option>
                                            ))}
                                        </select>
                                    )}
                                    <button onClick={() => { setIsAddingCategory(true); setEditingCategory({ name: '', base_price: 500, is_active: true }); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md transition">+ 새 카테고리 추가</button>
                                </div>
                            </div>

                            {(!editingCategory && !isAddingCategory) ? (
                                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto shadow-sm">
                                    <table className="w-full text-sm text-left text-gray-400">
                                        <thead className="text-xs uppercase bg-gray-900/50 text-gray-500">
                                            <tr>
                                                <th className="px-5 py-4 font-black text-gray-300">Depth 1</th>
                                                <th className="px-5 py-4 font-black text-gray-300">Depth 2</th>
                                                <th className="px-5 py-4 font-black text-gray-300">카테고리명</th>
                                                <th className="px-5 py-4 font-black text-gray-300 text-right">기본 견적단가 (Cost)</th>
                                                <th className="px-5 py-4 font-black text-gray-300 text-center">활성 상태</th>
                                                <th className="px-5 py-4 font-black text-gray-300 text-center">수정일</th>
                                                <th className="px-5 py-4 text-right">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dbCategories.filter(cat =>
                                                (categoryDepth1Filter === 'all' || cat.depth1 === categoryDepth1Filter) &&
                                                (categoryDepth2Filter === 'all' || cat.depth2 === categoryDepth2Filter)
                                            ).map(cat => (
                                                <tr key={cat.id} className="border-b border-gray-700 hover:bg-gray-750 transition">
                                                    <td className="px-5 py-3 text-sm text-gray-400 font-medium">{cat.depth1 || '-'}</td>
                                                    <td className="px-5 py-3 text-sm text-gray-300 font-medium">{cat.depth2 || '-'}</td>
                                                    <td className="px-5 py-3 font-bold text-white text-base">{cat.name}</td>
                                                    <td className="px-5 py-3 text-right font-mono font-bold text-blue-400">₱{fmtNum(cat.base_price)}</td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${cat.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-500'}`}>
                                                            {cat.is_active ? '운영 중' : '사용 안함'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-center text-gray-500 text-xs">{fmtDate(cat.updated_at || cat.created_at)}</td>
                                                    <td className="px-5 py-3 text-right">
                                                        <button onClick={() => setEditingCategory({ ...cat })} className="text-blue-500 hover:text-blue-300 font-bold px-3 py-1 bg-blue-900/20 rounded transition text-xs mr-2">수정</button>
                                                        <button onClick={() => setDeletingCategory(cat)} className="text-red-500 hover:text-red-300 font-bold px-3 py-1 bg-red-900/20 rounded transition text-xs">삭제</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {dbCategories.filter(cat =>
                                                (categoryDepth1Filter === 'all' || cat.depth1 === categoryDepth1Filter) &&
                                                (categoryDepth2Filter === 'all' || cat.depth2 === categoryDepth2Filter)
                                            ).length === 0 && (
                                                    <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">카테고리 데이터가 없습니다. DB 마이그레이션을 확인하세요.</td></tr>
                                                )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <form onSubmit={handleSaveCategory} className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-md max-w-2xl">
                                    <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
                                        <h3 className="font-bold text-xl text-white">{isAddingCategory ? '새 카테고리 추가' : '카테고리 단가 수정'}</h3>
                                        <button type="button" onClick={() => { setEditingCategory(null); setIsAddingCategory(false); }} className="text-gray-400 hover:text-white font-bold p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition">✕</button>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex gap-4 mb-4">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-bold text-gray-300 mb-2">대분류 (Depth 1)</label>
                                                    <input type="text" value={editingCategory.depth1 || ''} onChange={e => setEditingCategory({ ...editingCategory, depth1: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" disabled={!isAddingCategory} placeholder="예: 이사/청소" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="block text-sm font-bold text-gray-300 mb-2">중분류 (Depth 2)</label>
                                                    <input type="text" value={editingCategory.depth2 || ''} onChange={e => setEditingCategory({ ...editingCategory, depth2: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" disabled={!isAddingCategory} placeholder="예: 이사" />
                                                </div>
                                            </div>
                                            <label className="block text-sm font-bold text-gray-300 mb-2">카테고리명 (리프 노드)</label>
                                            <input type="text" value={editingCategory.name} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold" required disabled={!isAddingCategory} placeholder="예: 소형 이사" />
                                            {!isAddingCategory && <p className="text-xs text-orange-400 mt-2 font-bold py-1 px-2 bg-orange-900/20 rounded inline-block">🔗 기준 카테고리명 및 분류는 시스템 매칭 무결성을 위해 수정 불가합니다.</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-300 mb-2">기본 견적단가 (캐시 차감액)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-3 text-gray-500 font-bold">₱</span>
                                                <input type="number" min="0" value={editingCategory.base_price} onChange={e => setEditingCategory({ ...editingCategory, base_price: parseInt(e.target.value) || 0 })} className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg font-bold" required />
                                            </div>
                                            <p className="text-xs text-blue-400 mt-2">이 카테고리에서 고수가 견적서를 낼 때마다 차감할 캐시 비용입니다.</p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-3 bg-gray-900 p-4 rounded-xl border border-gray-700 cursor-pointer">
                                                <input type="checkbox" checked={editingCategory.is_active} onChange={e => setEditingCategory({ ...editingCategory, is_active: e.target.checked })} className="w-5 h-5 accent-blue-600 rounded" />
                                                <span className="text-sm font-bold text-gray-200">서비스 활성화 상태 여부</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-gray-700 flex justify-end gap-3">
                                        <button type="button" onClick={() => { setEditingCategory(null); setIsAddingCategory(false); }} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition">취소</button>
                                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition">{isAddingCategory ? '저장하기' : '수정 내역 반영'}</button>
                                    </div>
                                </form>
                            )}

                            {deletingCategory && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                                    <div className="bg-gray-900 border border-red-900/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden shadow-red-900/20">
                                        <div className="bg-red-950/40 p-5 border-b border-red-900/30">
                                            <h2 className="text-red-400 font-bold text-lg mb-1">카테고리 삭제 확인</h2>
                                            <p className="text-xs text-red-300/70 leading-relaxed">
                                                정말 이 카테고리 <span className="text-red-400 font-bold">[{deletingCategory.name}]</span>를 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
                                            </p>
                                        </div>
                                        <div className="p-5 flex gap-2 justify-end">
                                            <button onClick={() => setDeletingCategory(null)} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition">취소</button>
                                            <button onClick={handleDeleteCategory} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition">영구 삭제</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ PRO MANAGEMENT ═══ */}
                        {tab === 'pro' && (<>
                            <h1 className="text-2xl font-black mb-4">🔧 고수 관리</h1>
                            <div className="flex flex-col sm:flex-row gap-2 mb-4">
                                <input type="text" value={proSearch} onChange={e => setProSearch(e.target.value)} placeholder="이름 / 활동명 / 이메일 / ID 검색..." className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                <select value={proFilter} onChange={e => setProFilter(e.target.value as any)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white"><option value="all">전체</option><option value="suspended">정지됨</option><option value="deleted">탈퇴됨</option></select>
                            </div>
                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase"><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">이메일/ID</th><th className="p-2.5 text-left">전화번호</th><th className="p-2.5 text-right">캐시</th><th className="p-2.5 text-center">상태</th><th className="p-2.5 text-center">액션</th></tr></thead>
                                    <tbody>{filteredPros.map(p => (
                                        <tr key={p.pro_id} className={`border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer ${(p.status === 'SUSPENDED' || p.status === 'DELETED') ? 'opacity-40' : ''}`}>
                                            <td className="p-2.5" onClick={() => loadUserDetail(p.pro_id, 'PRO')}><div className="font-semibold text-white hover:text-blue-400 transition">{p.nickname || p.name || '(미설정)'}</div></td>
                                            <td className="p-2.5 text-gray-400 text-xs font-mono" onClick={() => loadUserDetail(p.pro_id, 'PRO')}>{p.email || p.pro_id.slice(0, 12) + '...'}</td>
                                            <td className="p-2.5 text-gray-300 text-xs">{p.phone || '-'}</td>
                                            <td className="p-2.5 text-right">
                                                <span className="font-bold text-blue-400">₱{fmtNum(p.current_cash)}</span>
                                                {(p.bonus_cash || 0) > 0 && <span className="text-green-400 text-xs ml-1">(+🎁{fmtNum(p.bonus_cash)})</span>}
                                            </td>
                                            <td className="p-2.5 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'DELETED' ? 'bg-gray-900/50 text-gray-500 line-through' : p.status === 'SUSPENDED' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{p.status === 'DELETED' ? '삭제됨' : p.status === 'SUSPENDED' ? '정지' : '활성'}</span></td>
                                            <td className="p-2.5 text-center"><div className="flex items-center justify-center gap-1">
                                                {/* 충전/환불 버튼 — ADMIN 전용 */}
                                                {adminRole === 'ADMIN' && (<>
                                                <button onClick={() => { setCashModal({ pro: p, type: 'charge' }); setCashAmount(''); setCashDesc(''); }} disabled={p.status === 'DELETED'} className={`text-xs px-2 py-1 rounded font-bold ${p.status === 'DELETED' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>충전</button>
                                                <button onClick={() => { setCashModal({ pro: p, type: 'refund' }); setCashAmount(''); setCashDesc(''); }} disabled={p.status === 'DELETED'} className={`text-xs px-2 py-1 rounded font-bold ${p.status === 'DELETED' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}>환불</button>
                                                </>)}
                                                {/* 정지 버튼 — ADMIN, ADMIN_OPERATION 모두 표시 */}
                                                {(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION') && (
                                                <button onClick={() => toggleSuspend(p.pro_id, p.status || 'ACTIVE', true)} disabled={p.status === 'DELETED'} className={`text-xs px-2 py-1 rounded font-bold ${p.status === 'DELETED' ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : p.status === 'SUSPENDED' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{p.status === 'SUSPENDED' ? '해제' : '정지'}</button>
                                                )}
                                                {/* [운영정책] 삭제 버튼 비활성화 — 데이터 무결성 보호 (정지 기능으로 대체 운영) */}
                                            </div></td>
                                        </tr>
                                    ))}{filteredPros.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">결과 없음</td></tr>}</tbody></table>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">{filteredPros.length}명 / 전체 {pros.length}명</p>
                        </>)}

                        {/* ═══ CUSTOMER MANAGEMENT ═══ */}
                        {tab === 'customer' && (<>
                            <h1 className="text-2xl font-black mb-4">👥 고객 관리</h1>
                            <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="이름 / 활동명 / 이메일 / 전화번호 검색..." className="w-full sm:w-96 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase"><th className="p-2.5 text-left">이름</th><th className="p-2.5 text-left">이메일</th><th className="p-2.5 text-left">전화번호</th><th className="p-2.5 text-center">가입일</th><th className="p-2.5 text-center">상태</th><th className="p-2.5 text-center">액션</th></tr></thead>
                                    <tbody>{filteredCustomers.map(c => (
                                        <tr key={c.user_id} className={`border-b border-gray-700/50 hover:bg-gray-700/20 cursor-pointer ${(c.status === 'SUSPENDED' || c.status === 'DELETED') ? 'opacity-40' : ''}`}>
                                            <td className="p-2.5" onClick={() => loadUserDetail(c.user_id, 'CUSTOMER')}><div className="font-semibold text-white hover:text-blue-400">{c.nickname || c.name || '(미설정)'}</div><div className="text-xs text-gray-500 font-mono">{c.user_id.slice(0, 12)}...</div></td>
                                            <td className="p-2.5 text-gray-400 text-xs">{c.email || '-'}</td>
                                            <td className="p-2.5 text-gray-300 text-sm">{c.phone || '-'}</td>
                                            <td className="p-2.5 text-center text-gray-400 text-xs">{c.created_at ? fmtDate(c.created_at) : '-'}</td>
                                            <td className="p-2.5 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status === 'DELETED' ? 'bg-gray-900/50 text-gray-500 line-through' : c.status === 'SUSPENDED' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{c.status === 'DELETED' ? '삭제됨' : c.status === 'SUSPENDED' ? '정지' : '활성'}</span></td>
                                            <td className="p-2.5 text-center">
                                                {/* 정지 버튼 — ADMIN, ADMIN_OPERATION 모두 표시 */}
                                                {(adminRole === 'ADMIN' || adminRole === 'ADMIN_OPERATION') && (
                                                <button onClick={() => toggleSuspend(c.user_id, c.status || 'ACTIVE', false)} className={`text-xs px-3 py-1 rounded font-bold ${c.status === 'SUSPENDED' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{c.status === 'SUSPENDED' ? '해제' : '정지'}</button>
                                                )}
                                                {/* [운영정책] 삭제 버튼 비활성화 — 데이터 무결성 보호 (정지 기능으로 대체 운영) */}
                                            </td>
                                        </tr>
                                    ))}{filteredCustomers.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">결과 없음</td></tr>}</tbody></table>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">{filteredCustomers.length}명 / 전체 {customers.length}명</p>
                        </>)}

                        {/* ═══ ADMIN MANAGEMENT ═══ */}
                        {tab === 'admin_mgmt' && (<>
                            <h1 className="text-2xl font-black mb-4">🛡️ 관리자 관리</h1>

                            {/* ── 신규 관리자 승급 섹션 ── */}
                            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6">
                                <h2 className="text-sm font-bold text-gray-300 mb-3">➕ 신규 관리자 승급</h2>
                                <div className="flex flex-wrap gap-2 items-center">
                                    <input
                                        type="email"
                                        value={promoteEmail}
                                        onChange={e => setPromoteEmail(e.target.value)}
                                        placeholder="승급할 계정 이메일 입력"
                                        className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
                                    />
                                    <select
                                        value={promoteRole}
                                        onChange={e => setPromoteRole(e.target.value as 'ADMIN_OPERATION' | 'ADMIN_VIEWER')}
                                        className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ADMIN_OPERATION">🔧 운영 관리자 (ADMIN_OPERATION)</option>
                                        <option value="ADMIN_VIEWER">📊 뷰어 (ADMIN_VIEWER)</option>
                                    </select>
                                    <button
                                        onClick={handlePromoteAdmin}
                                        disabled={promoting}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold px-4 py-2 rounded-lg transition"
                                    >
                                        {promoting ? '처리 중...' : '승급'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">※ ADMIN(최고 관리자) 등급은 이 화면에서 부여할 수 없습니다.</p>
                            </div>

                            {/* ── 관리자 목록 ── */}
                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                        <th className="p-2.5 text-left">이름</th>
                                        <th className="p-2.5 text-left">이메일</th>
                                        <th className="p-2.5 text-center">등급</th>
                                        <th className="p-2.5 text-center">가입일</th>
                                        <th className="p-2.5 text-center">상태</th>
                                        <th className="p-2.5 text-center">액션</th>
                                    </tr></thead>
                                    <tbody>{admins.map(a => (
                                        <tr key={a.user_id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                            <td className="p-2.5"><div className="font-semibold text-white">{a.nickname || a.name || '(미설정)'}</div><div className="text-xs text-gray-500 font-mono">{a.user_id.slice(0, 12)}...</div></td>
                                            <td className="p-2.5 text-gray-400 text-xs">{a.email || '-'}</td>
                                            <td className="p-2.5 text-center">
                                                {a.role === 'ADMIN' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300">👑 최고 관리자</span>}
                                                {a.role === 'ADMIN_OPERATION' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-900/50 text-blue-300">🔧 운영 관리자</span>}
                                                {a.role === 'ADMIN_VIEWER' && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-700/50 text-gray-300">📊 뷰어</span>}
                                            </td>
                                            <td className="p-2.5 text-center text-gray-400 text-xs">{a.created_at ? fmtDate(a.created_at) : '-'}</td>
                                            <td className="p-2.5 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.status === 'SUSPENDED' ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>{a.status === 'SUSPENDED' ? '정지' : '활성'}</span></td>
                                            <td className="p-2.5 text-center">
                                                {/* 본인 계정 및 ADMIN 등급은 회수 불가 */}
                                                {a.user_id !== adminId && a.role !== 'ADMIN' && (
                                                    <button
                                                        onClick={() => setModal({
                                                            type: 'confirm',
                                                            title: '권한 회수',
                                                            message: '권한을 회수하면 해당 계정이 즉시 정지됩니다.\n계속하시겠습니까?',
                                                            onConfirm: () => handleRevokeAdmin(a.user_id, a.email),
                                                        })}
                                                        disabled={revokeLoading === a.user_id}
                                                        className="text-xs px-2 py-1 rounded font-bold bg-red-900/50 text-red-300 hover:bg-red-700 hover:text-white disabled:opacity-50 transition"
                                                    >
                                                        {revokeLoading === a.user_id ? '처리 중...' : '권한 회수'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}{admins.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">관리자 없음</td></tr>}</tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">{admins.length}명</p>
                        </>)}

                        {/* ═══ QUOTES/MATCHING ═══ */}
                        {tab === 'quotes' && (<>
                            {selectedRequest ? (
                                <div>
                                    <button onClick={() => setSelectedRequest(null)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">← 요청 목록</button>

                                    <h1 className="text-2xl font-black mb-6 text-yellow-400">🚨 CS 관제탑 (Control Tower)</h1>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                        {/* 기본 요청 정보 */}
                                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h2 className="text-lg font-bold text-white">{selectedRequest.service_type}</h2>
                                                    <p className="text-sm text-gray-400">{selectedRequest.region}</p>
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${statusColor(selectedRequest.status)}`}>{statusLabel(selectedRequest.status)}</span>
                                            </div>
                                            <p className="text-xs text-gray-500">생성: {fmtDate(selectedRequest.created_at)}</p>

                                            {/* 고객 요청 상세 답변 */}
                                            {selectedRequest.dynamic_answers && typeof selectedRequest.dynamic_answers === 'object' && Object.keys(selectedRequest.dynamic_answers).length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-gray-700">
                                                    <h4 className="text-xs font-bold text-gray-400 mb-2">📋 고객 요청 상세 내용</h4>
                                                    <div className="space-y-1.5">
                                                        {(() => {
                                                            const ORDERED_KEYS = [
                                                                'service_type', 'merged_region',
                                                                'move_type', 'move_date', 'from_region', 'from_floor', 'from_size', 'from_elevator',
                                                                'appliances', 'furniture', 'images', 'to_region', 'to_floor', 'to_elevator',
                                                                'house_type', 'service_frequency', 'extra_services', 'cleaning_supplies', 'has_pets',
                                                                'visit_timing', 'care_schedule', 'children_info', 'language_pref', 'extra_tasks', 'child_health_note',
                                                                'meal_headcount', 'meal_time', 'cuisine_style', 'grocery_needed', 'allergy_note',
                                                                'deep_clean_type', 'house_size', 'furnished_status', 'utilities_status', 'special_options',
                                                                'cleaning_cycle', 'focus_areas',
                                                                'pool_type', 'pool_condition', 'chemicals_supply', 'extra_repair',
                                                                'clean_items', 'item_size_qty', 'material_type', 'stain_issues',
                                                                'ac_quantity', 'ac_size', 'ac_symptoms', 'ac_height',
                                                                'ac_clean_date', 'visit_time', 'outdoor_unit_location', 'indoor_unit_access',
                                                                'work_time', 'ac_types', 'ceiling_height',
                                                                'visit_date', 'building_type', 'damage_status', 'area_size', 'treatment_method', 'children_pets',
                                                                'pest_types', 'problem_types', 'problem_locations', 'mold_severity',
                                                                'pickup_date', 'waste_items', 'waste_volume', 'floor_access', 'disassembly_needed',
                                                                'leak_problems', 'leak_locations', 'main_valve_status',
                                                                'equipment_types', 'pump_symptoms', 'pump_hp', 'pump_location',
                                                                'clog_locations', 'clog_severity', 'prior_attempts', 'clog_cause',
                                                                'service_type_wh', 'heater_type', 'heater_symptoms', 'electrical_ready',
                                                                'electrical_symptoms', 'outage_scope', 'panel_board_access',
                                                                'service_type_gen', 'fuel_type', 'gen_capacity', 'gen_symptoms',
                                                                'work_types', 'ceiling_type', 'materials_ready', 'wiring_condition',
                                                                'service_type_solar', 'system_type', 'system_capacity', 'roof_type',
                                                                'ac_hp', 'appliance_type', 'appliance_symptoms', 'appliance_brand', 'appliance_age',
                                                                'tv_size', 'install_type', 'bracket_ready', 'wall_type',
                                                                'service_type_cctv', 'camera_count', 'install_location', 'wifi_available',
                                                                'screen_locations', 'screen_qty', 'screen_material', 'screen_frame_status',
                                                                'lock_service_type', 'door_material', 'lock_type_new', 'lock_product_supply',
                                                                'furniture_types', 'furniture_brand', 'furniture_qty', 'wall_mount_needed',
                                                                'gas_service_type', 'gas_brand', 'gas_capacity', 'empty_cylinder', 'gas_symptoms',
                                                                'remodel_scope', 'remodel_start', 'permit_status', 'material_supply', 'site_infra', 'remodel_budget',
                                                                'interior_scope', 'unit_condition', 'condo_permit_status', 'work_schedule', 'interior_supply', 'interior_budget',
                                                                'commercial_space_type', 'commercial_unit_condition', 'commercial_permit_status', 'admin_requirements', 'design_status', 'commercial_budget', 'commercial_start',
                                                                'tile_spaces', 'floor_material', 'floor_condition', 'tile_material_supply', 'tile_permit_status', 'tile_site_access', 'tile_area_sqm', 'tile_work_schedule',
                                                                'paint_scope', 'paint_site_condition', 'wall_condition', 'paint_material_supply', 'paint_permit_status', 'floor_height', 'paint_work_schedule',
                                                                'carpentry_work_types', 'carpentry_material', 'design_doc', 'carpentry_site_condition', 'carpentry_permit_status', 'carpentry_work_schedule',
                                                                'drywall_purpose', 'insulation_needed', 'ceiling_height_drywall', 'finish_level', 'drywall_permit_status', 'drywall_material_supply', 'drywall_work_schedule',
                                                                'roofing_work_types', 'roof_problem_status', 'roof_material', 'roof_access', 'roof_permit_status', 'roof_work_schedule',
                                                                'landscaping_work_types', 'garden_condition', 'garden_area_sqm', 'garden_infra', 'garden_material_supply', 'garden_permit_status', 'garden_work_schedule',
                                                                'signage_types', 'signage_location', 'signage_design_status', 'signage_power', 'signage_permit_status', 'signage_size', 'signage_work_schedule',
                                                                'deck_fence_types', 'deck_material', 'deck_ground_condition', 'deck_material_supply', 'deck_permit_status', 'deck_size', 'deck_work_schedule',
                                                                'va_tasks', 'va_english_level', 'va_work_schedule', 'va_tools', 'va_wfh_infra', 'va_budget', 'va_start_date',
                                                                'cs_channels', 'cs_languages', 'cs_agent_count', 'cs_coverage', 'cs_infra', 'cs_ticket_volume', 'cs_start_date',
                                                                'tm_campaign_goal', 'tm_target_country', 'tm_script_db', 'tm_payment_type', 'tm_dialer', 'tm_agent_count', 'tm_start_date',
                                                                'bizreg_entity_type', 'bizreg_foreign_ownership', 'bizreg_scope', 'bizreg_address_status', 'bizreg_capital', 'bizreg_start_date',
                                                                'tax_service_types', 'tax_vat_status', 'tax_transaction_volume', 'tax_bir_status', 'tax_accounting_system', 'tax_start_date',
                                                                'visa_service_types', 'visa_headcount', 'visa_stay_status', 'visa_sponsor_docs', 'visa_new_or_renewal', 'visa_start_date',
                                                                'permit_types', 'permit_current_status', 'permit_biz_docs', 'permit_item_count', 'permit_inspection_ready', 'permit_start_date',
                                                                'tl_service_types', 'tl_field', 'tl_doc_volume', 'tl_interp_duration', 'tl_notarization', 'tl_location', 'tl_start_date',
                                                                'vi_service_types', 'vi_dialect', 'vi_field', 'vi_doc_volume', 'vi_interp_duration', 'vi_location', 'vi_start_date',
                                                                'en_service_types', 'en_field', 'en_target_country', 'en_doc_volume', 'en_interp_duration', 'en_apostille', 'en_start_date',
                                                                'ml_language_pair', 'ml_service_types', 'ml_field', 'ml_doc_volume', 'ml_interp_duration', 'ml_location', 'ml_start_date',
                                                                'gd_work_types', 'gd_reference_status', 'gd_usage_purpose', 'gd_source_files', 'gd_meeting_type', 'gd_start_date',
                                                                'wd_platform_types', 'wd_project_stage', 'wd_local_integration', 'wd_hosting_status', 'wd_budget', 'wd_start_date',
                                                                've_platform_purpose', 've_footage_status', 've_video_length', 've_edit_elements', 've_work_style', 've_start_date',
                                                                'sns_platforms', 'sns_target_audience', 'sns_work_scope', 'sns_ads_budget_type', 'sns_page_status', 'sns_start_date',
                                                                'debut_theme', 'debut_scope', 'debut_guest_count', 'debut_venue_status', 'debut_catering_rules', 'debut_budget', 'debut_date',
                                                                'ch_scope', 'ch_guest_count', 'ch_church_status', 'ch_reception_venue', 'ch_catering_style', 'ch_date',
                                                                'bday_party_type', 'bday_scope', 'bday_guest_count', 'bday_venue_status', 'bday_vendor_rules', 'bday_budget', 'bday_date',
                                                                'wed_service_scope', 'wed_venue_type', 'wed_guest_count', 'wed_booked_items', 'wed_logistics', 'wed_budget', 'wed_date',
                                                                'corp_event_types', 'corp_headcount', 'corp_work_scope', 'corp_venue_status', 'corp_billing_req', 'corp_setup_timing', 'corp_date',
                                                                'details'
                                                            ];
                                                            const labelMap: Record<string, string> = {
                                                                service_type: '상세 서비스', merged_region: '서비스를 받으실 지역',
                                                                move_type: '이사 서비스 종류', move_date: '이사 날짜',
                                                                from_region: '출발 지역', from_floor: '출발지 층수', from_size: '출발지 면적 / 인원', from_elevator: '출발지 현장 상황',
                                                                appliances: '이전 가전', furniture: '이전 가구', images: '첨부 사진',
                                                                to_region: '도착 지역', to_floor: '도착지 층수', to_elevator: '도착지 현장 상황',
                                                                house_type: '주거 형태 및 크기', service_frequency: '서비스 주기',
                                                                extra_services: '추가 서비스', cleaning_supplies: '청소 도구/세제 준비', has_pets: '반려동물 여부',
                                                                visit_timing: '희망 방문 시기', care_schedule: '돌봄 시간대 및 형태',
                                                                children_info: '아이 인원 및 나이', language_pref: '선호 소통 언어',
                                                                extra_tasks: '추가 업무', child_health_note: '아이 건강 특이사항',
                                                                meal_headcount: '식사 인원', meal_time: '요리 시간대/목적',
                                                                cuisine_style: '요리 스타일', grocery_needed: '식재료 장보기 대행', allergy_note: '알레르기/피해야 할 식재료',
                                                                deep_clean_type: '딥클리닝 종류', house_size: '집 규모 및 형태',
                                                                furnished_status: '가구/가전 입주 상태', utilities_status: '전기/수도 사용 여부', special_options: '추가 특수 방역/청소 옵션',
                                                                cleaning_cycle: '청소 서비스 주기', focus_areas: '집중 청소 구역',
                                                                pool_type: '수영장 종류 및 규모', pool_condition: '수질 상태',
                                                                chemicals_supply: '약품 준비 방법', extra_repair: '추가 점검/수리 설비',
                                                                clean_items: '딥클리닝 대상 품목', item_size_qty: '품목 크기 및 수량',
                                                                material_type: '제품 소재', stain_issues: '오염/문제 종류',
                                                                ac_quantity: '에어컨 수량', ac_size: '에어컨 마력(HP)',
                                                                ac_symptoms: '에어컨 증상', ac_height: '에어컨 설치 높이',
                                                                ac_clean_date: '청소/점검 희망 날짜', visit_time: '희망 방문 시간대',
                                                                outdoor_unit_location: '실외기 위치', indoor_unit_access: '실내기 하단 공간',
                                                                work_time: '작업 시간대', ac_types: '에어컨 종류', ceiling_height: '천장 층고',
                                                                visit_date: '방문 희망 날짜', building_type: '건물 형태',
                                                                damage_status: '흰개미 피해 상황', area_size: '공간 면적',
                                                                treatment_method: '흰개미 퇴치 방식', children_pets: '어린아이/반려동물 여부',
                                                                pest_types: '퇴치 대상 해충',
                                                                problem_types: '주요 문제 종류', problem_locations: '문제 발생 위치', mold_severity: '곰팡이 피해 심각도',
                                                                pickup_date: '수거 희망 날짜', waste_items: '폐기 품목',
                                                                waste_volume: '폐기물 양(부피)', floor_access: '층수 및 엘리베이터 여부', disassembly_needed: '분해 작업 필요 여부',
                                                                leak_problems: '누수/배관 문제', leak_locations: '문제 발생 위치',
                                                                main_valve_status: '메인 수도 밸브 상태',
                                                                equipment_types: '점검 대상 장비', pump_symptoms: '워터펌프 증상',
                                                                pump_hp: '워터펌프 마력(HP)', pump_location: '워터펌프/물탱크 위치',
                                                                clog_locations: '막힘 발생 위치', clog_severity: '막힘 심각도',
                                                                prior_attempts: '직접 시도한 방법', clog_cause: '이물질 원인',
                                                                service_type_wh: '온수기 서비스 종류', heater_type: '온수기 종류',
                                                                heater_symptoms: '온수기 증상', electrical_ready: '전선/차단기 준비 상태',
                                                                electrical_symptoms: '전기 증상', outage_scope: '정전 범위', panel_board_access: '메인 분전함 위치',
                                                                service_type_gen: '발전기 서비스 종류', fuel_type: '발전기 연료 타입',
                                                                gen_capacity: '발전기 용량(kVA)', gen_symptoms: '발전기 증상',
                                                                work_types: '작업 종류', ceiling_type: '천장 형태 및 높이',
                                                                materials_ready: '조명/자재 준비 여부', wiring_condition: '벽/천장 배선 상태',
                                                                service_type_solar: '태양광 서비스 종류', system_type: '태양광 시스템 방식',
                                                                system_capacity: '태양광 시스템 용량', roof_type: '지붕 형태',
                                                                ac_hp: '에어컨 마력(HP)', appliance_type: '수리 대상 가전',
                                                                appliance_symptoms: '가전 증상', appliance_brand: '가전 브랜드', appliance_age: '가전 사용 기간',
                                                                tv_size: 'TV 크기', install_type: '설치 방식',
                                                                bracket_ready: '브라켓 보유 여부', wall_type: '벽 재질',
                                                                service_type_cctv: 'CCTV 서비스 종류', camera_count: '카메라 설치 대수',
                                                                install_location: '설치 장소 형태', wifi_available: '인터넷(Wi-Fi) 연결 여부',
                                                                screen_locations: '방충망 시공 위치', screen_qty: '방충망 시공 수량',
                                                                screen_material: '방충망 재질/기능', screen_frame_status: '창문/틀 상태',
                                                                lock_service_type: '열쇠/도어락 서비스 종류', door_material: '문 재질',
                                                                lock_type_new: '자물쇠 종류', lock_product_supply: '제품 준비 방법',
                                                                furniture_types: '조립 가구 종류', furniture_brand: '가구 브랜드/구매처',
                                                                furniture_qty: '가구 수량 및 규모', wall_mount_needed: '벽 고정 작업 필요 여부',
                                                                gas_service_type: 'LPG 서비스 종류', gas_brand: '가스통 브랜드',
                                                                gas_capacity: '가스통 용량', empty_cylinder: '빈 가스통 보유 여부', gas_symptoms: '가스 증상/문제',
                                                                remodel_scope: '리모델링 범위', remodel_start: '공사 시작 시기',
                                                                permit_status: '공사 허가 상태', material_supply: '자재 수급 방식',
                                                                site_infra: '현장 인프라 상태', remodel_budget: '총 공사 예산',
                                                                interior_scope: '인테리어 범위', unit_condition: '유닛 상태',
                                                                condo_permit_status: '콘도 공사 허가 상태', work_schedule: '작업 가능 시간대',
                                                                interior_supply: '자재 수급 방식', interior_budget: '인테리어 예산',
                                                                commercial_space_type: '상업 공간 종류', commercial_unit_condition: '매장 상태',
                                                                commercial_permit_status: '공사 허가 상태', admin_requirements: '행정/안전 요건',
                                                                design_status: '디자인 도면 보유 여부', commercial_budget: '인테리어 예산',
                                                                commercial_start: '공사 시작 시기',
                                                                tile_spaces: '시공 공간', floor_material: '바닥재 종류',
                                                                floor_condition: '현재 바닥 상태', tile_material_supply: '자재 준비 방식',
                                                                tile_permit_status: '공사 허가 상태', tile_site_access: '현장 반입 환경',
                                                                tile_area_sqm: '시공 면적', tile_work_schedule: '작업 가능 시간대',
                                                                paint_scope: '페인트 시공 범위', paint_site_condition: '현장 상태',
                                                                wall_condition: '벽면 상태 및 사전 작업', paint_material_supply: '페인트 자재 준비',
                                                                paint_permit_status: '공사 허가 상태', floor_height: '층수/층고',
                                                                paint_work_schedule: '작업 가능 시간대',
                                                                carpentry_work_types: '목공 작업 종류', carpentry_material: '자재 및 마감 방식',
                                                                design_doc: '도면 보유 여부', carpentry_site_condition: '작업 장소 상태',
                                                                carpentry_permit_status: '공사 허가 상태', carpentry_work_schedule: '작업 가능 시간대',
                                                                drywall_purpose: '시공 목적', insulation_needed: '방음/단열 필요 여부',
                                                                ceiling_height_drywall: '층고', finish_level: '마감 단계',
                                                                drywall_permit_status: '공사 허가 상태', drywall_material_supply: '자재 준비 방식',
                                                                drywall_work_schedule: '작업 가능 시간대',
                                                                roofing_work_types: '지붕 공사 종류', roof_problem_status: '문제 상황',
                                                                roof_material: '지붕/바닥 재질', roof_access: '층수 및 접근성',
                                                                roof_permit_status: '공사 허가 상태', roof_work_schedule: '작업 가능 시간대',
                                                                landscaping_work_types: '조경/정원 관리 작업 종류', garden_condition: '정원 현재 상태',
                                                                garden_area_sqm: '정원 면적', garden_infra: '현장 인프라 (수도/전기)',
                                                                garden_material_supply: '자재/식물 준비 방식', garden_permit_status: '공사 허가 상태',
                                                                garden_work_schedule: '작업 가능 시간대',
                                                                signage_types: '간판/작업 종류', signage_location: '간판 설치 위치 및 높이',
                                                                signage_design_status: '디자인 시안 준비 여부', signage_power: '전기 공급 여부',
                                                                signage_permit_status: '관할 허가 상태', signage_size: '간판 크기',
                                                                signage_work_schedule: '작업 가능 시간대',
                                                                deck_fence_types: '시공 항목', deck_material: '주요 자재',
                                                                deck_ground_condition: '지면/기존 구조물 상태', deck_material_supply: '자재 준비 방식',
                                                                deck_permit_status: '공사 허가 상태', deck_size: '시공 면적 및 길이',
                                                                deck_work_schedule: '작업 가능 시간대',
                                                                va_tasks: '주요 업무', va_english_level: '영어 능통 수준',
                                                                va_work_schedule: '근무 형태 및 시간대', va_tools: '필수 소프트웨어/툴',
                                                                va_wfh_infra: '재택근무 인프라 요건', va_budget: '월간 예산/급여 수준',
                                                                va_start_date: '업무 시작 희망 날짜',
                                                                cs_channels: 'CS 지원 채널', cs_languages: '지원 언어',
                                                                cs_agent_count: '상담원 규모', cs_coverage: '서비스 제공 시간대',
                                                                cs_infra: '인프라 및 운영 방식', cs_ticket_volume: '월간 콜/티켓 볼륨',
                                                                cs_start_date: '프로젝트 시작 희망일',
                                                                tm_campaign_goal: '캠페인 주요 목적', tm_target_country: '타겟 고객 국가',
                                                                tm_script_db: '콜 리스트/스크립트 준비 여부', tm_payment_type: '보상 및 지불 방식',
                                                                tm_dialer: '다이얼러 시스템 준비 방식', tm_agent_count: '투입 인원 규모',
                                                                tm_start_date: '캠페인 시작 희망일',
                                                                bizreg_entity_type: '사업체 형태', bizreg_foreign_ownership: '외국인 지분율',
                                                                bizreg_scope: '대행 업무 범위', bizreg_address_status: '사업장 주소지 확보 여부',
                                                                bizreg_capital: '예상 자본금 규모', bizreg_start_date: '대행 업무 시작 희망일',
                                                                tax_service_types: '세무 서비스 종류', tax_vat_status: 'BIR 납세자 형태',
                                                                tax_transaction_volume: '월 평균 거래 건수', tax_bir_status: 'BIR 등록 상태',
                                                                tax_accounting_system: '회계/POS 시스템', tax_start_date: '서비스 시작 희망 날짜',
                                                                visa_service_types: '비자/이민 서류 업무 종류', visa_headcount: '수속 대상자 인원',
                                                                visa_stay_status: '현재 체류 상태', visa_sponsor_docs: '스폰서 법인 서류 상태',
                                                                visa_new_or_renewal: '신규/갱신 여부', visa_start_date: '서류 접수 대행 시작 희망일',
                                                                permit_types: '인허가/면허 종류', permit_current_status: '인허가 진행 상태',
                                                                permit_biz_docs: '기본 사업 서류 구비 상태', permit_item_count: '대상 물품/사업장 수',
                                                                permit_inspection_ready: '실사 준비 여부', permit_start_date: '대행 업무 시작 희망일',
                                                                tl_service_types: '통번역 서비스 종류', tl_field: '통번역 분야/문맥',
                                                                tl_doc_volume: '번역 분량', tl_interp_duration: '통역 소요 시간',
                                                                tl_notarization: '공증/확인서 필요 여부', tl_location: '통역 장소 형태',
                                                                tl_start_date: '희망 날짜',
                                                                vi_service_types: '통번역 서비스 종류', vi_dialect: '비사야어 방언',
                                                                vi_field: '통번역 분야/문맥', vi_doc_volume: '번역 분량',
                                                                vi_interp_duration: '통역 소요 시간', vi_location: '통역 장소 형태',
                                                                vi_start_date: '희망 날짜',
                                                                en_service_types: '통번역 서비스 종류', en_field: '전문 분야',
                                                                en_target_country: '타겟 국가/문맥', en_doc_volume: '번역 분량',
                                                                en_interp_duration: '통역 소요 시간', en_apostille: '공증/아포스티유 필요 여부',
                                                                en_start_date: '희망 날짜',
                                                                ml_language_pair: '언어 쌍', ml_service_types: '통번역 서비스 종류',
                                                                ml_field: '통번역 분야/문맥', ml_doc_volume: '번역 분량',
                                                                ml_interp_duration: '통역 소요 시간', ml_location: '장소/제출처',
                                                                ml_start_date: '희망 날짜',
                                                                gd_work_types: '디자인 작업 종류', gd_reference_status: '기획/레퍼런스 보유 상태',
                                                                gd_usage_purpose: '결과물 활용 목적', gd_source_files: '원본 파일/저작권 양도 여부',
                                                                gd_meeting_type: '소통 방식', gd_start_date: '납품 희망 날짜',
                                                                wd_platform_types: '개발 플랫폼 종류', wd_project_stage: '프로젝트 준비 단계',
                                                                wd_local_integration: '현지 결제/물류 연동', wd_hosting_status: '서버/도메인 준비 상태',
                                                                wd_budget: '프로젝트 예산', wd_start_date: '프로젝트 시작 희망일',
                                                                ve_platform_purpose: '영상 활용 플랫폼/목적', ve_footage_status: '원본 소스 상태',
                                                                ve_video_length: '완성본 길이', ve_edit_elements: '필수 편집 요소',
                                                                ve_work_style: '작업 및 소통 방식', ve_start_date: '납품 희망 날짜',
                                                                sns_platforms: '타겟 플랫폼', sns_target_audience: '타겟 고객층',
                                                                sns_work_scope: '업무 범위', sns_ads_budget_type: '광고비 처리 방식',
                                                                sns_page_status: '페이지 활성화 상태', sns_start_date: '대행 시작 희망일',
                                                                debut_theme: '파티 컨셉/테마', debut_scope: '서비스 범위',
                                                                debut_guest_count: '예상 하객 수', debut_venue_status: '베뉴 섭외 상태',
                                                                debut_catering_rules: '케이터링/레촌 반입 규정', debut_budget: '총 예상 예산',
                                                                debut_date: '행사 예정일',
                                                                ch_scope: '기획 범위', ch_guest_count: '하객 규모',
                                                                ch_church_status: '성당/교회 예약 상태', ch_reception_venue: '리셉션 장소 형태',
                                                                ch_catering_style: '케이터링 스타일', ch_date: '행사 예정일',
                                                                bday_party_type: '파티 종류', bday_scope: '기획 범위',
                                                                bday_guest_count: '예상 하객 수', bday_venue_status: '베뉴 섭외 상태',
                                                                bday_vendor_rules: '외부 업체 반입 규정', bday_budget: '총 예상 예산',
                                                                bday_date: '파티 예정일',
                                                                wed_service_scope: '플래닝 서비스 범위', wed_venue_type: '웨딩 형태 및 베뉴',
                                                                wed_guest_count: '하객 규모', wed_booked_items: '예약 완료 항목',
                                                                wed_logistics: '날씨/이동 대비', wed_budget: '총 예상 예산',
                                                                wed_date: '예식 예정일',
                                                                corp_event_types: '행사 종류', corp_headcount: '예상 참여 인원',
                                                                corp_work_scope: '업무 범위', corp_venue_status: '베뉴 준비 상태',
                                                                corp_billing_req: '결제/행정 요건', corp_setup_timing: '셋업 가능 시간',
                                                                corp_date: '행사 예정일',
                                                                details: '추가 요청사항 / 특이사항',
                                                            };
                                                            const entries = Object.entries(selectedRequest.dynamic_answers as Record<string, any>)
                                                                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                                                .sort(([a], [b]) => {
                                                                    const ia = ORDERED_KEYS.indexOf(a);
                                                                    const ib = ORDERED_KEYS.indexOf(b);
                                                                    if (ia === -1 && ib === -1) return 0;
                                                                    if (ia === -1) return 1;
                                                                    if (ib === -1) return -1;
                                                                    return ia - ib;
                                                                });
                                                            return entries.map(([key, value]: [string, any]) => (
                                                                <div key={key} className="flex gap-2 text-xs">
                                                                    <span className="text-gray-400 shrink-0">{labelMap[key] || key}:</span>
                                                                    <span className="text-gray-300 break-all">
                                                                        {Array.isArray(value) ? value.join(', ') : String(value ?? '-')}
                                                                    </span>
                                                                </div>
                                                            ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Chat Audit Button */}
                                            {chatLogs.length > 0 && (
                                                <button onClick={() => setIsChatOpen(true)} className="mt-4 w-full bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 font-bold py-2.5 rounded-lg transition text-sm flex items-center justify-center gap-2">
                                                    💬 양방향 채팅 로그 열람 ({chatLogs.length}개)
                                                </button>
                                            )}
                                        </div>

                                        {/* 당사자 연락처 강제 열람 (CS Only) */}
                                        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col justify-center">
                                            <h3 className="text-sm font-black text-gray-400 mb-4 border-b border-gray-700 pb-2">당사자 연락처 (마스킹 해제)</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                                                    <span className="text-xs font-bold text-green-400 mb-1 block">고객 (Customer)</span>
                                                    <p className="text-white font-semibold text-sm">{csContactInfo?.customer?.nickname || csContactInfo?.customer?.name || selectedRequest.customerName}</p>
                                                    <p className="text-xs text-gray-400 mt-1">{csContactInfo?.customer?.email || '이메일 없음'}</p>
                                                    <p className="text-xs text-gray-300 font-mono mt-1">{csContactInfo?.customer?.phone || '연락처 미등록'}</p>
                                                </div>
                                                <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                                                    <span className="text-xs font-bold text-blue-400 mb-1 block">매칭된 고수 (Pro)</span>
                                                    {csContactInfo?.pro ? (
                                                        <>
                                                            <p className="text-white font-semibold text-sm">{csContactInfo.pro.nickname || csContactInfo.pro.name}</p>
                                                            <p className="text-xs text-gray-400 mt-1">{csContactInfo.pro.email || '이메일 없음'}</p>
                                                            <p className="text-xs text-gray-300 font-mono mt-1 text-blue-300">{csContactInfo.pro.phone || '연락처 미등록'}</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 mt-4 flex items-center justify-center">매칭 됨/수락된 고수 없음</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-sm font-bold text-gray-300 mb-3 border-t border-gray-800 pt-6">📝 요청서에 발송된 견적 내역 ({(selectedRequest.match_quotes || []).length}건)</h3>
                                    <div className="space-y-2 mb-6">
                                        {(selectedRequest.match_quotes || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((q: any, i: number) => (
                                            <div key={q.quote_id} className={`bg-gray-800 rounded-xl border p-4 flex items-center gap-4 relative ${q.status === 'ACCEPTED' ? 'border-blue-500/50 bg-blue-900/10' : 'border-gray-700'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${q.status === 'ACCEPTED' ? 'bg-blue-600/30 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>{i + 1}</div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className={`font-bold ${q.status === 'ACCEPTED' ? 'text-blue-400' : 'text-white'}`}>₱{fmtNum(q.price || 0)}</span>
                                                        <span className="text-xs text-gray-500">{fmtDate(q.created_at)}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1">{q.description || '설명 없음'}</p>
                                                    {q.image_url && (() => {
                                                        let imgs: string[] = [];
                                                        if (q.image_url.startsWith('[')) {
                                                            try { imgs = JSON.parse(q.image_url); } catch { imgs = [q.image_url]; }
                                                        } else { imgs = [q.image_url]; }
                                                        return imgs.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                                {imgs.map((url: string, idx: number) => (
                                                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-block">
                                                                        <img src={url} alt={`견적 첨부 이미지 ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-600 hover:opacity-80 transition" />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    <div className="flex justify-between items-center mt-2">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-mono text-gray-500">고수: {q.pro?.nickname || q.pro?.name || q.pro_id?.slice(0, 12)}</p>
                                                            <button
                                                                onClick={() => handleOpenProDetail(q.pro_id)}
                                                                className="text-[10px] bg-blue-800/50 hover:bg-blue-700 text-blue-300 px-2 py-0.5 rounded font-bold transition"
                                                            >
                                                                상세 보기
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenCsChat(
                                                                    q.pro_id,
                                                                    q.pro?.nickname || q.pro?.name || 'Pro',
                                                                    selectedRequest.request_id,
                                                                    selectedRequest.customer_id,
                                                                    csContactInfo?.customer?.nickname || csContactInfo?.customer?.name || '고객'
                                                                )}
                                                                className="text-[10px] bg-green-800/50 hover:bg-green-700 text-green-300 px-2 py-0.5 rounded font-bold transition"
                                                            >
                                                                💬 채팅보기
                                                            </button>
                                                        </div>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.status === 'ACCEPTED' ? 'bg-blue-900/50 text-blue-300' : 'bg-gray-700 text-gray-400'}`}>{q.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {(selectedRequest.match_quotes || []).length === 0 && <p className="text-center text-gray-500 py-8 bg-gray-800/50 border border-gray-800 rounded-xl border-dashed">발송된 견적이 없습니다.</p>}
                                    </div>

                                    {/* Danger Zone */}
                                    <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 mb-6">
                                        <h3 className="text-red-500 font-black mb-1 flex items-center gap-2">⚠️ DANGER ZONE (관리자 강제 개입)</h3>
                                        <p className="text-xs text-red-400/80 mb-4">이 곳의 액션은 플랫폼 기록에 영구적인 영향을 미치며 감사 로그(Audit Trail)에 기록됩니다.</p>

                                        <div className="flex flex-wrap gap-3">
                                            <button
                                                onClick={handleForceCancelMatch}
                                                disabled={selectedRequest.status === 'CANCELED_BY_ADMIN'}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${selectedRequest.status === 'CANCELED_BY_ADMIN' ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed' : 'bg-red-900/40 text-red-300 border-red-800 hover:bg-red-800 hover:text-white'}`}
                                            >
                                                직권 매칭/요청 취소
                                            </button>

                                            <button
                                                onClick={() => setSuspendModal({ isOpen: true, userId: selectedRequest.customer_id, role: 'CUSTOMER', currentStatus: 'ACTIVE' })}
                                                className="px-4 py-2 bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white rounded-lg text-sm font-bold transition"
                                            >
                                                고객 계정 정지
                                            </button>

                                            {selectedRequest.matchedProName && selectedRequest.matchedProName !== '-' && !selectedRequest.matchedProName.includes('입찰') && csContactInfo?.pro && (
                                                <button
                                                    onClick={() => setSuspendModal({ isOpen: true, userId: csContactInfo.pro.user_id, role: 'PRO', currentStatus: 'ACTIVE' })}
                                                    className="px-4 py-2 bg-gray-800 text-yellow-500 border border-yellow-900/50 hover:bg-yellow-900/30 hover:border-yellow-600 rounded-lg text-sm font-bold transition"
                                                >
                                                    매칭 고수 계정 정지
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (<>
                                <h1 className="text-2xl font-black mb-4">📋 견적/매칭 관리</h1>

                                {/* Advanced Filters */}
                                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                                    <div className="flex flex-col">
                                        <label className="text-xs text-gray-500 mb-1 font-bold">검색어</label>
                                        <input type="text" value={reqSearch} onChange={e => setReqSearch(e.target.value)} placeholder="서비스 / 지역 / 이름..." className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs text-gray-500 mb-1 font-bold">진행 상태</label>
                                        <select value={reqFilter} onChange={e => setReqFilter(e.target.value as any)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"><option value="all">전체 상태</option><option value="OPEN">대기 중</option><option value="MATCHED">매칭 완료</option><option value="EXPIRED">만료됨</option></select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs text-gray-500 mb-1 font-bold">카테고리</label>
                                        <select value={reqCategory} onChange={e => setReqCategory(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                                            <option value="all">전체 분류</option>
                                            <option value="청소">청소</option>
                                            <option value="이사">이사</option>
                                            <option value="시공">인테리어/시공</option>
                                            <option value="설치">수리/설치</option>
                                            <option value="비즈니스">비즈니스</option>
                                            <option value="이벤트">이벤트</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs text-gray-500 mb-1 font-bold">시작일</label>
                                        <input type="date" value={reqStartDate} onChange={e => setReqStartDate(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                                    </div>
                                    <div className="flex flex-col">
                                        <label className="text-xs text-gray-500 mb-1 font-bold">종료일</label>
                                        <input type="date" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                                    </div>
                                </div>

                                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase whitespace-nowrap">
                                                <th className="p-3 text-left">서비스 / 지역</th>
                                                <th className="p-3 text-left">고객</th>
                                                <th className="p-3 text-left">매칭 전문가</th>
                                                <th className="p-3 text-right">견적 금액</th>
                                                <th className="p-3 text-center">상태</th>
                                                <th className="p-3 text-center">생성일</th>
                                                <th className="p-3 text-right">관리</th>
                                            </tr>
                                        </thead>
                                        <tbody>{filteredRequests.map(r => (
                                            <tr key={r.request_id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors whitespace-nowrap">
                                                <td className="p-3">
                                                    <div className="font-semibold text-white">{r.service_type || '-'}</div>
                                                    <div className="text-xs text-gray-500">{r.region || '-'}</div>
                                                </td>
                                                <td className="p-3 text-gray-300 font-medium">{r.customerName}</td>
                                                <td className="p-3 text-blue-300 font-medium">{r.matchedProName}</td>
                                                <td className="p-3 text-right font-semibold text-white">{r.status === 'MATCHED' && r.matchedPrice > 0 ? `₱${fmtNum(r.matchedPrice)}` : '-'}</td>
                                                <td className="p-3 text-center"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(r.status)}`}>{statusLabel(r.status)}</span></td>
                                                <td className="p-3 text-center text-gray-400 text-xs">{fmtDate(r.created_at)}</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => handleSelectRequest(r)} className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white px-3 py-1.5 rounded-lg font-bold transition">
                                                        상세보기
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}{filteredRequests.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">조회된 요청이 없습니다.</td></tr>}</tbody>
                                    </table>
                                </div>
                            </>)}
                        </>)}

                        {/* ═══ REVIEWS ═══ */}
                        {tab === 'reviews' && (<>
                            <h1 className="text-2xl font-black mb-4">⭐ 리뷰 관리</h1>
                            <input type="text" value={reviewSearch} onChange={e => setReviewSearch(e.target.value)} placeholder="고객명 / 고수명 / 코멘트 검색..." className="w-full sm:w-96 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm"><thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase"><th className="p-2.5 text-left">고객</th><th className="p-2.5 text-left">고수</th><th className="p-2.5 text-center">평점</th><th className="p-2.5 text-left">코멘트</th><th className="p-2.5 text-center">작성일</th><th className="p-2.5 text-center">관리</th></tr></thead>
                                    <tbody>{filteredReviews.map(r => (
                                        <tr key={r.review_id} className={`border-b border-gray-700/50 hover:bg-gray-700/20 ${r.is_hidden ? 'opacity-40' : ''}`}>
                                            <td className="p-2.5 text-white text-sm">{r.customerName}</td>
                                            <td className="p-2.5 text-gray-300 text-sm">{r.proName}</td>
                                            <td className="p-2.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map(s => <span key={s} className={`text-xs ${s <= r.rating ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>)}
                                                    </div>
                                                    <span className="text-white font-bold text-xs ml-1">{Number(r.rating).toFixed(1)}</span>
                                                </div>
                                            </td>
                                            <td className="p-2.5 text-gray-400 text-xs max-w-xs truncate">{r.comment || '(없음)'}</td>
                                            <td className="p-2.5 text-center text-gray-500 text-xs">{fmtDate(r.created_at)}</td>
                                            <td className="p-2.5 text-center"><div className="flex items-center justify-center gap-1">
                                                {(() => {
                                                    const isEligible = r.rating >= 4.5 && (r.comment?.length || 0) >= 50;
                                                    return (
                                                        <button
                                                            onClick={() => isEligible ? toggleReviewFeatured(r.review_id, !!r.is_featured_on_main) : alert('평점 4.5 이상, 50자 이상인 리뷰만 메인에 노출할 수 있습니다.')}
                                                            className={`text-xs px-2 py-1 rounded font-bold border transition-colors ${!isEligible ? 'border-gray-600 text-gray-500 bg-gray-800 opacity-50 cursor-not-allowed' :
                                                                r.is_featured_on_main ? 'bg-blue-600 text-white border-blue-500' : 'bg-transparent text-blue-400 hover:bg-blue-900 border-blue-500 border-opacity-50'
                                                                }`}
                                                            title={!isEligible ? "조건 미달 (4.5점 이상 & 50자 이상 필요)" : "메인 화면 노출 토글"}
                                                        >
                                                            {r.is_featured_on_main ? '★ 메인' : '☆ 일반'}
                                                        </button>
                                                    );
                                                })()}
                                                <button onClick={() => toggleReviewHidden(r.review_id, !!r.is_hidden)} className={`text-xs px-2 py-1 rounded font-bold ${r.is_hidden ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'}`}>{r.is_hidden ? '복원' : '블라인드'}</button>
                                                <button onClick={() => deleteReview(r.review_id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded font-bold">삭제</button>
                                            </div></td>
                                        </tr>
                                    ))}{filteredReviews.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-gray-500">리뷰 없음</td></tr>}</tbody></table>
                            </div>
                        </>)}

                        {/* ═══ SEARCH LOGS ═══ */}
                        {tab === 'search_logs' && (<>
                            <h1 className="text-2xl font-black mb-4">🔍 검색/유입 분석 (Zero-Search)</h1>
                            <p className="text-sm text-gray-400 mb-6">검색결과가 0건인 키워드들입니다. 유효한 키워드는 특정 카테고리에 매핑하여 다음 검색 시 결과를 반환하도록 조치할 수 있습니다.</p>

                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                        <th className="p-3 text-center w-16">순위</th>
                                        <th className="p-3 text-left">검색 실패 키워드</th>
                                        <th className="p-3 text-center w-24">실패 횟수</th>
                                        <th className="p-3 text-right">매핑 / 무시 액션</th>
                                    </tr></thead>
                                    <tbody>
                                        {searchLogsLoading ? (
                                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">데이터를 집계 중입니다...</td></tr>
                                        ) : searchLogs.length === 0 ? (
                                            <tr><td colSpan={4} className="p-12 text-center text-gray-500">조회된 이탈 검색어 로그가 없습니다. (Zero Search 청정 구역)</td></tr>
                                        ) : (
                                            searchLogs.map((log, idx) => (
                                                <tr key={log.keyword} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                                    <td className="p-3 text-center text-yellow-400 font-bold">{idx + 1}</td>
                                                    <td className="p-3 text-white font-medium">{log.keyword}</td>
                                                    <td className="p-3 text-center text-gray-300 font-mono text-xs">{fmtNum(Number(log.fail_count))}회</td>
                                                    <td className="p-3 text-right flex items-center justify-end gap-2">
                                                        <select
                                                            value={selectedCategoryMapping[log.keyword] || ''}
                                                            onChange={(e) => setSelectedCategoryMapping(prev => ({ ...prev, [log.keyword]: e.target.value }))}
                                                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        >
                                                            <option value="" disabled>카테고리 선택...</option>
                                                            {MAPPING_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                        </select>
                                                        <button
                                                            onClick={() => handleMapSearchTag(log.keyword)}
                                                            className={`text-xs px-3 py-1.5 rounded font-bold transition-colors ${selectedCategoryMapping[log.keyword] ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                                                            disabled={!selectedCategoryMapping[log.keyword]}
                                                        >
                                                            태그 추가
                                                        </button>
                                                        <button
                                                            onClick={() => handleIgnoreSearchKeyword(log.keyword)}
                                                            className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 flex items-center justify-center font-bold transition"
                                                            title="해당 키워드를 매핑하지 않고 영구 삭제(무시)합니다."
                                                        >
                                                            무시/삭제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>)}

                        {/* ═══ SETTINGS ═══ */}
                        {tab === 'settings' && (<>
                            <h1 className="text-2xl font-black mb-6">⚙️ 과금 컨트롤러</h1>
                            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-6">
                                {[
                                    { key: 'quote_cost', t: '견적 발송 비용', d: '고수가 견적 1건 발송 시 차감되는 캐시' },
                                    { key: 'max_quotes_per_request', t: '최대 견적 수신 수', d: '요청 1건당 최대 수신 견적 수' },
                                    { key: 'signup_bonus', t: '신규 가입 보너스', d: '고수 신규 가입 시 자동 지급 캐시' },
                                ].map((s, i) => (
                                    <div key={s.key} className={i > 0 ? 'border-t border-gray-700 pt-6' : ''}>
                                        <h3 className="text-base font-bold mb-1">{s.t}</h3>
                                        <p className="text-gray-400 text-sm mb-3">{s.d} (현재: <span className="text-white font-bold">{fmtNum(platformSettings[s.key] ?? 0)}</span>)</p>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                value={settingsInputs[s.key] ?? String(platformSettings[s.key] ?? 0)}
                                                onChange={e => setSettingsInputs(prev => ({ ...prev, [s.key]: e.target.value }))}
                                                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white w-36 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <button
                                                disabled={savingKey === s.key}
                                                onClick={async () => {
                                                    const val = Number(settingsInputs[s.key]);
                                                    if (isNaN(val) || val < 0) { alert('유효한 값을 입력하세요.'); return; }
                                                    setSavingKey(s.key);
                                                    const { error } = await supabase.rpc('update_platform_setting', { p_key: s.key, p_value: val });
                                                    if (error) {
                                                        alert('저장 실패: ' + error.message);
                                                    } else {
                                                        setPlatformSettings(prev => ({ ...prev, [s.key]: val }));
                                                        alert(`${s.t} 값이 ${fmtNum(val)}(으)로 저장되었습니다.`);
                                                    }
                                                    setSavingKey(null);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                                            >
                                                {savingKey === s.key ? '저장 중...' : '저장'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── [확장] 테스트 데이터 초기화 위험 구역 ── */}
                            <div className="mt-8 bg-gradient-to-br from-red-900/30 to-red-800/20 rounded-xl border-2 border-red-600/50 p-6">
                                <h2 className="text-lg font-black text-red-400 mb-2 flex items-center gap-2">
                                    <span className="text-2xl">⚠️</span> DANGER ZONE — 테스트 데이터 초기화
                                </h2>
                                <p className="text-sm text-gray-400 mb-4 leading-relaxed break-keep">
                                    모든 활동 내역(요청서, 견적서, 채팅, 리뷰, 결제, 알림, 제재 이력, 신고 내역, 문의, 템플릿)을 <strong className="text-red-400">영구 삭제</strong>하고 캐시와 통계를 0으로 리셋합니다.<br />
                                    회원 계정(users, auth.users, pro_profiles)은 100% 보존됩니다. 삭제 전 자동 백업 스냅샷이 생성됩니다.
                                </p>
                                <button
                                    onClick={() => { setShowResetModal(true); setResetConfirmText(''); }}
                                    className="bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-bold px-6 py-3 rounded-xl transition shadow-[0_0_12px_rgba(220,38,38,0.4)] hover:shadow-[0_0_20px_rgba(220,38,38,0.6)] text-sm"
                                >
                                    🗑️ 테스트 데이터 1초 초기화
                                </button>
                            </div>

                            {/* ── [확장] 2-Depth 하드락 초기화 모달 ── */}
                            {showResetModal && (
                                <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) setShowResetModal(false); }}>
                                    <div className="absolute inset-0 bg-black/70"></div>
                                    <div className="relative bg-gray-900 rounded-2xl border-2 border-red-600/60 shadow-2xl max-w-md w-full mx-4 p-6">
                                        <div className="text-center mb-5">
                                            <span className="text-5xl block mb-3">💣</span>
                                            <h3 className="text-xl font-black text-red-400">최종 확인</h3>
                                            <p className="text-sm text-gray-400 mt-2 break-keep">
                                                이 작업은 <strong className="text-white">10개 테이블의 모든 활동 데이터</strong>를 삭제하고<br />
                                                캐시와 통계를 0으로 초기화합니다.
                                            </p>
                                        </div>

                                        <div className="bg-gray-800 rounded-xl p-4 mb-4 border border-gray-700">
                                            <p className="text-xs text-gray-400 mb-2 font-bold">아래 입력란에 <span className="text-red-400">"초기화 승인"</span>이라고 정확히 입력하세요.</p>
                                            <input
                                                value={resetConfirmText}
                                                onChange={e => setResetConfirmText(e.target.value)}
                                                placeholder="초기화 승인"
                                                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-gray-600"
                                                disabled={resetting}
                                            />
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowResetModal(false)}
                                                disabled={resetting}
                                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition text-sm"
                                            >취소</button>
                                            <button
                                                disabled={resetConfirmText !== '초기화 승인' || resetting}
                                                onClick={async () => {
                                                    setResetting(true);
                                                    try {
                                                        await supabase.from('admin_action_logs').delete().gt('id', 0);
                                                        const { data, error } = await supabase.rpc('reset_test_transaction_data');
                                                        if (error) throw error;
                                                        await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                                                        await supabase.from('inquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                                                        setShowResetModal(false);
                                                        // 전역 상태 리프레시
                                                        window.dispatchEvent(new Event('wallet-updated'));
                                                        window.dispatchEvent(new Event('notifications-updated'));
                                                        showToast('모든 테스트 데이터가 초기화되었습니다 (캐시/거래/신고 내역 포함). 백업 스냅샷이 backup_*_temp 테이블에 보존됩니다.', 'success');
                                                    } catch (e: any) {
                                                        showToast('초기화 실패: ' + e.message, 'error');
                                                    } finally {
                                                        setResetting(false);
                                                    }
                                                }}
                                                className={`flex-1 font-bold py-3 rounded-xl transition text-sm ${resetConfirmText === '초기화 승인' && !resetting
                                                    ? 'bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white shadow-[0_0_12px_rgba(220,38,38,0.4)]'
                                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    }`}
                                            >{resetting ? '초기화 진행 중...' : '🗑️ 최종 초기화 실행'}</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>)}
                        {/* ═══ CMS ═══ */}
                        {tab === 'cms' && (<>
                            <h1 className="text-2xl font-black mb-6">🖼️ 홈페이지 CMS 제어</h1>

                            <div className="space-y-8">

                                {/* 배너 관리 */}

                                {/* 배너 관리 */}
                                <h2 className="text-xl font-bold mb-4">메인 배너 미디어</h2>
                                <p className="text-sm text-gray-400 mb-6">고객 퍼넬 우측의 대형 배너(이미지 또는 비디오)를 교체합니다.</p>

                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                    <div className="w-full md:w-1/2">
                                        {cmsBanners[0] ? (
                                            <div className="rounded-xl overflow-hidden border border-gray-700 aspect-video relative">
                                                {cmsBanners[0].media_type === 'VIDEO' ? (
                                                    <video src={cmsBanners[0].media_url} controls className="w-full h-full object-cover" />
                                                ) : (
                                                    <img src={cmsBanners[0].media_url} className="w-full h-full object-cover" alt="Banner" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-gray-600 aspect-video flex items-center justify-center text-gray-500">배너 없음</div>
                                        )}
                                    </div>
                                    <div className="w-full md:w-1/2 flex flex-col gap-4">
                                        <input type="file" id="cmsUpload" accept="image/*,video/*" className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-blue-900/50 file:text-blue-300 hover:file:bg-blue-900/80 cursor-pointer" />
                                        <button
                                            disabled={cmsUploading}
                                            onClick={async () => {
                                                const fileInput = document.getElementById('cmsUpload') as HTMLInputElement;
                                                const file = fileInput.files?.[0];
                                                if (!file) { alert('파일을 선택하세요.'); return; }
                                                setCmsUploading(true);
                                                try {
                                                    const mType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
                                                    const optimizedFile = mType === 'IMAGE' ? await optimizeImage(file, 1920, 1080, 0.8) : file;
                                                    const ext = optimizedFile.name.split('.').pop() || 'png';
                                                    const fileName = `home_banner_${Date.now()}.${mType === 'IMAGE' ? 'webp' : ext}`;

                                                    const { error: upErr } = await supabase.storage.from('quote_images').upload(`cms/${fileName}`, optimizedFile);
                                                    if (upErr) throw upErr;
                                                    const { data: { publicUrl } } = supabase.storage.from('quote_images').getPublicUrl(`cms/${fileName}`);

                                                    // 모두 삭제 후 새로 추가 (단일 배너 유지)
                                                    await supabase.from('cms_banners').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                                                    await supabase.from('cms_banners').insert({ media_url: publicUrl, media_type: mType, is_active: true });

                                                    fileInput.value = '';
                                                    alert('배너가 교체되었습니다.');
                                                    loadCms();
                                                } catch (err: any) {
                                                    alert('업로드 실패: ' + err.message);
                                                } finally {
                                                    setCmsUploading(false);
                                                }
                                            }}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50"
                                        >
                                            {cmsUploading ? '업로드 중...' : '새 미디어 업로드 및 교체'}
                                        </button>
                                    </div>
                                </div>
                                {/* 카테고리 관리 */}
                                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold">홈 카테고리 설정</h2>
                                            <p className="text-sm text-gray-400 mt-1">홈페이지 하단의 카테고리 버튼들을 관리합니다.</p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left text-gray-400">
                                            <thead className="text-xs uppercase bg-gray-900/50 text-gray-500">
                                                <tr><th className="px-4 py-3">아이콘</th><th className="px-4 py-3">타이틀</th><th className="px-4 py-3">설명</th><th className="px-4 py-3">연결 URL</th><th className="px-4 py-3">활성</th></tr>
                                            </thead>
                                            <tbody>
                                                {cmsCategories.map((cat, idx) => (
                                                    <tr key={cat.id} className="border-b border-gray-700">
                                                        <td className="px-4 py-3 text-2xl">{cat.icon}</td>
                                                        <td className="px-4 py-3 font-bold text-white">{cat.title}</td>
                                                        <td className="px-4 py-3">{cat.description}</td>
                                                        <td className="px-4 py-3 font-mono text-xs text-blue-400">{cat.link_url}</td>
                                                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${cat.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>{cat.is_active ? '활성' : '비활성'}</span></td>
                                                    </tr>
                                                ))}
                                                {cmsCategories.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">카테고리 데이터가 없습니다. SQL 문서를 통해 초기 셋업을 진행하세요.</td></tr>}
                                            </tbody>
                                        </table>
                                        <p className="text-xs text-gray-500 mt-4">* 카테고리의 구성(순서, 텍스트) 변경은 현재 DataGrip 등 DB 클라이언트를 통해 cms_categories 테이블에서 직접 제어하십시오. (추후 에디터 오픈 예정)</p>
                                    </div>
                                </div>
                                {/* 고객 지원 페이지 (CMS V2) 관리 */}
                                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold">고객 지원 페이지 관리 (CMS V2)</h2>
                                            <p className="text-sm text-gray-400 mt-1">플랫폼 소개, 고객 가이드 등 2-Depth 텍스트 문서를 직접 관리할 수 있습니다.</p>
                                        </div>
                                    </div>

                                    {!editingSupportPage ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-gray-400">
                                                <thead className="text-xs uppercase bg-gray-900/50 text-gray-500">
                                                    <tr>
                                                        <th className="px-4 py-3">분류 (Depth 1)</th>
                                                        <th className="px-4 py-3">Slug (URL)</th>
                                                        <th className="px-4 py-3">페이지 타이틀 (Depth 2)</th>
                                                        <th className="px-4 py-3 text-center">상태</th>
                                                        <th className="px-4 py-3 text-right">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {supportPages.map(page => {
                                                        const cat = supportCategories.find(c => c.id === page.category_id);
                                                        return (
                                                            <tr key={page.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                                                                <td className="px-4 py-3 font-bold text-gray-300">{cat ? cat.title : '미분류'}</td>
                                                                <td className="px-4 py-3 font-mono text-xs text-blue-400">/support/{cat ? cat.slug : ''}/{page.slug}</td>
                                                                <td className="px-4 py-3 font-bold text-white">{page.title}</td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${page.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                                        {page.is_active ? '공개중' : '비공개'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <button
                                                                        onClick={() => setEditingSupportPage({ ...page })}
                                                                        className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 font-bold py-1 px-4 rounded text-sm transition"
                                                                    >
                                                                        내용 수정
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                            {supportPages.length === 0 && (
                                                <div className="text-center p-8 text-gray-500">등록된 2-Depth 페이지가 없습니다.</div>
                                            )}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSaveSupportPage} className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-lg text-white">문서 수정 <span className="text-gray-500 text-sm ml-2">(/support/{supportCategories.find(c => c.id === editingSupportPage.category_id)?.slug}/{editingSupportPage.slug})</span></h3>
                                                <button type="button" onClick={() => setEditingSupportPage(null)} className="text-gray-400 hover:text-white">✕ 취소</button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex gap-4">
                                                    <div className="w-1/3">
                                                        <label className="block text-sm font-bold text-gray-300 mb-1">상위 카테고리</label>
                                                        <select
                                                            value={editingSupportPage.category_id}
                                                            onChange={e => setEditingSupportPage({ ...editingSupportPage, category_id: Number(e.target.value) })}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        >
                                                            {supportCategories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                                        </select>
                                                    </div>
                                                    <div className="w-2/3">
                                                        <label className="block text-sm font-bold text-gray-300 mb-1">문서 고유 Slug</label>
                                                        <input
                                                            type="text"
                                                            value={editingSupportPage.slug}
                                                            onChange={e => setEditingSupportPage({ ...editingSupportPage, slug: e.target.value })}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-300 mb-1">페이지 제목 (Title)</label>
                                                    <input
                                                        type="text"
                                                        value={editingSupportPage.title}
                                                        onChange={e => setEditingSupportPage({ ...editingSupportPage, title: e.target.value })}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-300 mb-1">본문 (HTML 지원)</label>
                                                    <textarea
                                                        value={editingSupportPage.content}
                                                        onChange={e => setEditingSupportPage({ ...editingSupportPage, content: e.target.value })}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded p-3 h-64 font-mono text-xs text-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        required
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="support-active"
                                                        checked={editingSupportPage.is_active}
                                                        onChange={e => setEditingSupportPage({ ...editingSupportPage, is_active: e.target.checked })}
                                                        className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-blue-600"
                                                    />
                                                    <label htmlFor="support-active" className="text-sm font-bold text-gray-300">공개하기</label>
                                                </div>
                                                <div className="pt-4 flex justify-end gap-2">
                                                    <button type="button" onClick={() => setEditingSupportPage(null)} className="px-4 py-2 border border-gray-600 text-gray-400 font-bold rounded hover:bg-gray-800 transition">취소</button>
                                                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition">저장</button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>
                                {/* ═══ End Settings Tabs ═══ */}

                                {/* 법적 고지 관리 (Legal Docs) */}
                                <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h2 className="text-xl font-bold">법적 고지 관리 (버전 이력 관리)</h2>
                                            <p className="text-sm text-gray-400 mt-1">이용약관, 개인정보처리방침 등 이력 관리가 중요한 문서를 관리합니다.</p>
                                        </div>
                                        {!editingLegalDoc && (
                                            <button
                                                onClick={() => setEditingLegalDoc({ document_type: 'TERMS', version: 'v1.1', title: '', content: '', effective_date: new Date().toISOString().split('T')[0], is_active: false })}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold text-sm transition"
                                            >
                                                + 새 문서/버전 추가
                                            </button>
                                        )}
                                    </div>

                                    {!editingLegalDoc ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left text-gray-400">
                                                <thead className="text-xs uppercase bg-gray-900/50 text-gray-500">
                                                    <tr>
                                                        <th className="px-4 py-3">문서 타입 (라우트)</th>
                                                        <th className="px-4 py-3 text-center">버전</th>
                                                        <th className="px-4 py-3">문서 제목</th>
                                                        <th className="px-4 py-3 text-center">시행일(Effective)</th>
                                                        <th className="px-4 py-3 text-center">상태</th>
                                                        <th className="px-4 py-3 text-right">관리</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {legalDocs.map(doc => (
                                                        <tr key={doc.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                                                            <td className="px-4 py-3 font-bold text-white">
                                                                {doc.document_type === 'TERMS' ? '이용약관 ' : '개인정보처리방침 '}
                                                                <span className="text-blue-400 font-mono text-xs font-normal">(/legal/{doc.document_type.toLowerCase()})</span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-mono text-blue-300">{doc.version}</td>
                                                            <td className="px-4 py-3 text-gray-300">{doc.title}</td>
                                                            <td className="px-4 py-3 text-center font-mono text-xs">{doc.effective_date}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${doc.is_active ? 'bg-purple-900/50 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                                                                    {doc.is_active ? '현재 적용중' : '이전/대기'}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    onClick={() => setEditingLegalDoc({ ...doc })}
                                                                    className="bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 font-bold py-1 px-4 rounded text-sm transition"
                                                                >
                                                                    수정
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {legalDocs.length === 0 && (
                                                <div className="text-center p-8 text-gray-500">등록된 법적 고지가 없습니다.</div>
                                            )}
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSaveLegalDoc} className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="font-bold text-lg text-white">법적 고지 {editingLegalDoc.id ? '수정' : '작성하기'} <span className="text-gray-500 text-sm ml-2">(/legal/{editingLegalDoc.document_type.toLowerCase()})</span></h3>
                                                <button type="button" onClick={() => setEditingLegalDoc(null)} className="text-gray-400 hover:text-white">✕ 취소</button>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex gap-4">
                                                    <div className="w-1/3">
                                                        <label className="block text-sm font-bold text-gray-300 mb-1">문서 타입</label>
                                                        <select
                                                            value={editingLegalDoc.document_type}
                                                            onChange={e => setEditingLegalDoc({ ...editingLegalDoc, document_type: e.target.value })}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            disabled={!!editingLegalDoc.id}
                                                        >
                                                            <option value="TERMS">이용약관 (TERMS)</option>
                                                            <option value="PRIVACY">개인정보처리방침 (PRIVACY)</option>
                                                        </select>
                                                    </div>
                                                    <div className="w-1/3">
                                                        <label className="block text-sm font-bold text-gray-300 mb-1">버전 지정</label>
                                                        <input
                                                            type="text"
                                                            value={editingLegalDoc.version}
                                                            onChange={e => setEditingLegalDoc({ ...editingLegalDoc, version: e.target.value })}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="예: v1.0, v2026.1"
                                                            required
                                                        />
                                                    </div>
                                                    <div className="w-1/3">
                                                        <label className="block text-sm font-bold text-gray-300 mb-1">시행 일자 (Effective Date)</label>
                                                        <input
                                                            type="date"
                                                            value={editingLegalDoc.effective_date}
                                                            onChange={e => setEditingLegalDoc({ ...editingLegalDoc, effective_date: e.target.value })}
                                                            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            required
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-gray-300 mb-1">문서 제목</label>
                                                    <input
                                                        type="text"
                                                        value={editingLegalDoc.title}
                                                        onChange={e => setEditingLegalDoc({ ...editingLegalDoc, title: e.target.value })}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                        placeholder="예: 히든프로 이용약관"
                                                        required
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-bold text-gray-300 mb-1">본문 (HTML 지원)</label>
                                                    <textarea
                                                        value={editingLegalDoc.content}
                                                        onChange={e => setEditingLegalDoc({ ...editingLegalDoc, content: e.target.value })}
                                                        className="w-full bg-gray-800 border border-gray-700 rounded p-3 h-64 font-mono text-xs text-blue-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                        required
                                                    />
                                                </div>

                                                <div className="flex items-center gap-2 bg-purple-900/30 p-3 rounded border border-purple-900/50">
                                                    <input
                                                        type="checkbox"
                                                        id="legal-active"
                                                        checked={editingLegalDoc.is_active}
                                                        onChange={e => setEditingLegalDoc({ ...editingLegalDoc, is_active: e.target.checked })}
                                                        className="w-4 h-4 rounded bg-gray-800 border-gray-600 text-purple-600"
                                                    />
                                                    <label htmlFor="legal-active" className="text-sm font-bold text-purple-300">이 문서를 현재 활성(적용) 버전으로 공표합니다. (기존 버전들을 대체하게 됩니다)</label>
                                                </div>

                                                <div className="pt-4 flex justify-end gap-2">
                                                    <button type="button" onClick={() => setEditingLegalDoc(null)} className="px-4 py-2 border border-gray-600 text-gray-400 font-bold rounded hover:bg-gray-800 transition">취소</button>
                                                    <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition">저장 및 반영</button>
                                                </div>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </>
                        )}                        {/* ═══ Inquiries (1:1 문의) ═══ */}
                        {tab === 'inquiries' && (<>
                            <h1 className="text-2xl font-black mb-6">🎧 1:1 문의 관리</h1>
                            <div className="flex flex-wrap gap-2 mb-6">
                                <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                                    <span className="text-gray-400 text-sm">🔍</span>
                                    <input
                                        type="text"
                                        value={inquiriesSearch}
                                        onChange={e => setInquiriesSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') loadInquiries(); }}
                                        placeholder="닉네임 또는 이메일 검색 후 Enter"
                                        className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-52"
                                    />
                                    {inquiriesSearch && (
                                        <button onClick={() => { setInquiriesSearch(''); }} className="text-gray-500 hover:text-white text-xs">✕</button>
                                    )}
                                </div>
                                <select value={inquiriesFilter} onChange={e => { setInquiriesFilter(e.target.value as any); }} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                    <option value="all">전체 상태</option>
                                    <option value="pending">접수 대기</option>
                                    <option value="in_progress">처리 중</option>
                                    <option value="resolved">답변 완료</option>
                                </select>
                                <select value={inquiriesCategory} onChange={e => { setInquiriesCategory(e.target.value); }} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                                    <option value="all">전체 카테고리</option>
                                    <option value="ACCOUNT">계정 및 로그인</option>
                                    <option value="PAYMENT">결제 및 환불</option>
                                    <option value="MATCHING">견적 및 매칭</option>
                                    <option value="REPORT">사용자 신고</option>
                                    <option value="OTHER">서비스 이용(기타)</option>
                                </select>
                            </div>

                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                {inquiriesLoading ? (
                                    <div className="p-12 text-center text-gray-500">불러오는 중...</div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                            <th className="p-3 text-left w-20">상태</th>
                                            <th className="p-3 text-left w-28">유형</th>
                                            <th className="p-3 text-left flex-1 min-w-[200px]">제목</th>
                                            <th className="p-3 text-left w-40">작성자</th>
                                            <th className="p-3 text-left w-36">작성일</th>
                                            <th className="p-3 text-right w-24">관리</th>
                                        </tr></thead>
                                        <tbody>
                                            {inquiries.map(iq => (
                                                <tr key={iq.id} className="border-b border-gray-700/50 hover:bg-gray-700/20 transition">
                                                    <td className="p-3">
                                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${iq.status === 'resolved' ? 'bg-green-900/50 text-green-300' : iq.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                                                            {iq.status === 'resolved' ? '답변완료' : iq.status === 'in_progress' ? '처리중' : '접수대기'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-gray-300 text-xs font-mono">{iq.category}</td>
                                                    <td className="p-3 text-white font-medium line-clamp-1 break-all flex-1">
                                                        {iq.title}
                                                        {Array.isArray(iq.image_urls) && iq.image_urls.length > 0 && (
                                                            <span className="ml-2 text-xs text-gray-500">📎 {iq.image_urls.length}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-gray-400 text-xs">
                                                        <span className="font-bold text-gray-300">{iq.users?.nickname || iq.users?.name || '알수없음'}</span>
                                                        <span className="text-gray-500 block text-[10px] mt-0.5">{iq.user_type}</span>
                                                    </td>
                                                    <td className="p-3 text-gray-500 text-xs">{fmtDate(iq.created_at)}</td>
                                                    <td className="p-3 text-right">
                                                        {iq.status === 'resolved' ? (
                                                            <button onClick={() => { setSelectedInquiry(iq); setReplyContent(iq.admin_reply || ''); }} className="text-green-300 bg-green-900/30 border border-green-900/60 hover:bg-green-700 hover:text-white px-3 py-1.5 rounded transition text-xs font-bold">답변보기</button>
                                                        ) : (
                                                            <button onClick={() => { setSelectedInquiry(iq); setReplyContent(iq.admin_reply || ''); }} className="text-blue-300 bg-blue-900/30 border border-blue-900/60 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded transition text-xs font-bold">답변하기</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {inquiries.length === 0 && <tr><td colSpan={6} className="p-12 text-center text-gray-500">조회된 문의 내역이 없습니다. 지정한 필터를 확인해주세요.</td></tr>}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {inquiriesTotalCount > INQUIRIES_PAGE_SIZE && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
                                    <span className="text-xs text-gray-500">
                                        총 {inquiriesTotalCount}건 · {inquiriesPage}p / {Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE)}p
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => loadInquiries(inquiriesPage - 1)} disabled={inquiriesPage <= 1 || inquiriesLoading} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded transition">← 이전</button>
                                        {Array.from({ length: Math.min(5, Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE)) }, (_, i) => {
                                            const totalPages = Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE);
                                            const startPage = Math.max(1, Math.min(inquiriesPage - 2, totalPages - 4));
                                            const p = startPage + i;
                                            if (p > totalPages) return null;
                                            return <button key={p} onClick={() => loadInquiries(p)} className={`px-3 py-1.5 text-xs rounded transition ${p === inquiriesPage ? 'bg-blue-600 text-white font-bold' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>{p}</button>;
                                        })}
                                        <button onClick={() => loadInquiries(inquiriesPage + 1)} disabled={inquiriesPage >= Math.ceil(inquiriesTotalCount / INQUIRIES_PAGE_SIZE) || inquiriesLoading} className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white rounded transition">다음 →</button>
                                    </div>
                                </div>
                            )}
                        </>)}

                        {/* ═══ PAYOUT MANAGEMENT ═══ */}
                        {tab === 'payout' && (<>
                            <h1 className="text-2xl font-black mb-4">💸 출금 관리</h1>

                            {/* 상단: 필터 탭 + 새로고침 */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1">
                                    {(['all', 'PENDING', 'HELD', 'APPROVED', 'REJECTED'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setPayoutFilter(f)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${payoutFilter === f ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            {{ all: '전체', PENDING: '검토중', HELD: '홀드', APPROVED: '승인완료', REJECTED: '거절' }[f]}
                                            {f === 'PENDING' && payoutRequests.filter(p => p.status === 'PENDING').length > 0 && (
                                                <span className="ml-1.5 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {payoutRequests.filter(p => p.status === 'PENDING').length}
                                                </span>
                                            )}
                                            {f === 'HELD' && payoutRequests.filter(p => p.status === 'HELD').length > 0 && (
                                                <span className="ml-1.5 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                                    {payoutRequests.filter(p => p.status === 'HELD').length}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={loadPayoutRequests} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">🔄 새로고침</button>
                            </div>

                            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                            <th className="p-2.5 text-left">신청일</th>
                                            <th className="p-2.5 text-left">고수</th>
                                            <th className="p-2.5 text-left">계좌 정보</th>
                                            <th className="p-2.5 text-right">금액</th>
                                            <th className="p-2.5 text-center">상태</th>
                                            <th className="p-2.5 text-center">처리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payoutLoading ? (
                                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">로딩 중...</td></tr>
                                        ) : payoutRequests.filter(p => payoutFilter === 'all' || p.status === payoutFilter).length === 0 ? (
                                            <tr><td colSpan={6} className="p-6 text-center text-gray-500">출금 신청 없음</td></tr>
                                        ) : payoutRequests
                                            .filter(p => payoutFilter === 'all' || p.status === payoutFilter)
                                            .map(p => (
                                            <tr key={p.id} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                                <td className="p-2.5 text-gray-400 text-xs">{new Date(p.requested_at).toLocaleDateString()}</td>
                                                <td className="p-2.5">
                                                    <p className="font-semibold text-white text-xs">{p.pro?.nickname || p.pro?.users?.name || '-'}</p>
                                                    <p className="text-gray-500 text-xs">{p.pro?.users?.email || '-'}</p>
                                                </td>
                                                <td className="p-2.5">
                                                    <p className="text-white text-xs font-bold">{p.bank_name}</p>
                                                    <p className="text-gray-400 text-xs font-mono">{p.account_number}</p>
                                                    <p className="text-gray-400 text-xs">{p.account_holder}</p>
                                                </td>
                                                <td className="p-2.5 text-right font-bold text-green-400">₱{p.amount.toLocaleString()}</td>
                                                <td className="p-2.5 text-center">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'APPROVED' ? 'bg-green-900/50 text-green-300' :
                                                            p.status === 'REJECTED' ? 'bg-red-900/50 text-red-300' :
                                                                p.status === 'HELD' ? 'bg-yellow-900/50 text-yellow-300' :
                                                                    'bg-blue-900/50 text-blue-300'
                                                        }`}>
                                                        {p.status === 'APPROVED' ? '승인완료' : p.status === 'REJECTED' ? '거절' : p.status === 'HELD' ? '홀드' : '검토중'}
                                                    </span>
                                                    {p.status === 'HELD' && p.hold_reason && (
                                                        <p className="text-xs text-yellow-400 mt-1 max-w-[160px] break-words">{p.hold_reason}</p>
                                                    )}
                                                    {p.admin_note && (
                                                        <p className="text-xs text-gray-500 mt-1">{p.admin_note}</p>
                                                    )}
                                                </td>
                                                <td className="p-2.5 text-center">
                                                    {/* HELD: 승인/거절 버튼 노출 금지 — 7일 홀드 정책 준수 */}
                                                    {p.status === 'HELD' ? (
                                                        <div className="text-center">
                                                            <p className="text-xs text-yellow-400 font-semibold">7일 홀드 중</p>
                                                            <p className="text-[10px] text-gray-500 mt-0.5">고수에게 재신청 안내</p>
                                                        </div>
                                                    ) : p.status === 'PENDING' ? (
                                                        <div className="flex flex-col gap-1 items-center">
                                                            {/* 승인 시 명의 확인 메모 필수 */}
                                                            <input
                                                                type="text"
                                                                placeholder="명의 확인 메모 (필수)"
                                                                value={payoutNote[p.id] || ''}
                                                                onChange={e => setPayoutNote(prev => ({ ...prev, [p.id]: e.target.value }))}
                                                                className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white w-32 focus:outline-none focus:border-blue-500"
                                                            />
                                                            <div className="flex gap-1">
                                                                <button
                                                                    disabled={payoutActionLoading === p.id}
                                                                    onClick={async () => {
                                                                        if (!payoutNote[p.id]?.trim()) { alert('승인 전 예금주 명의 확인 메모를 입력해주세요.\n예) "명의 확인 완료 - 홍길동"'); return; }
                                                                        if (!window.confirm(`예금주 [${p.account_holder}] 명의가 가입자 명의와 일치하는지 확인하셨습니까?\n\n확인 후 승인 버튼을 눌러주세요.`)) return;
                                                                        setPayoutActionLoading(p.id);
                                                                        const { data: adminData } = await supabase.auth.getUser();
                                                                        const { error } = await supabase.rpc('admin_process_payout', {
                                                                            p_admin_id: adminData.user?.id,
                                                                            p_payout_id: p.id,
                                                                            p_action: 'APPROVE',
                                                                            p_note: payoutNote[p.id] || ''
                                                                        });
                                                                        if (error) alert('처리 실패: ' + error.message);
                                                                        else {
                                                                            // ── 감사 로그 기록 ──
                                                                            const { error: logErr } = await supabase.from('admin_action_logs').insert({
                                                                                target_user_id: p.pro_id,
                                                                                admin_id: adminData.user?.id,
                                                                                action_type: 'PAYOUT_APPROVE',
                                                                                reason: `출금 승인 ₱${p.amount.toLocaleString()} — ${payoutNote[p.id] || '메모 없음'}`,
                                                                            });
                                                                            if (logErr) console.error('❌ 출금 승인 감사 로그 실패:', logErr);
                                                                            alert('승인 완료.'); loadPayoutRequests();
                                                                        }
                                                                        setPayoutActionLoading(null);
                                                                    }}
                                                                    className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded font-bold"
                                                                >승인</button>
                                                                <button
                                                                    disabled={payoutActionLoading === p.id}
                                                                    onClick={async () => {
                                                                        if (!payoutNote[p.id]?.trim()) { alert('거절 사유를 입력해주세요.'); return; }
                                                                        setPayoutActionLoading(p.id);
                                                                        const { data: adminData } = await supabase.auth.getUser();
                                                                        const { error } = await supabase.rpc('admin_process_payout', {
                                                                            p_admin_id: adminData.user?.id,
                                                                            p_payout_id: p.id,
                                                                            p_action: 'REJECT',
                                                                            p_note: payoutNote[p.id] || ''
                                                                        });
                                                                        if (error) alert('처리 실패: ' + error.message);
                                                                        else {
                                                                            // ── 감사 로그 기록 ──
                                                                            const { error: logErr } = await supabase.from('admin_action_logs').insert({
                                                                                target_user_id: p.pro_id,
                                                                                admin_id: adminData.user?.id,
                                                                                action_type: 'PAYOUT_REJECT',
                                                                                reason: `출금 거절 ₱${p.amount.toLocaleString()} — ${payoutNote[p.id] || '사유 없음'}`,
                                                                            });
                                                                            if (logErr) console.error('❌ 출금 거절 감사 로그 실패:', logErr);
                                                                            alert('거절 처리 완료.'); loadPayoutRequests();
                                                                        }
                                                                        setPayoutActionLoading(null);
                                                                    }}
                                                                    className="text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-2 py-1 rounded font-bold"
                                                                >거절</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-600">처리완료</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>)}

            {/* ═══ AUDIT LOG ═══ */}
            {tab === 'audit_log' && (<>
                <h1 className="text-2xl font-black mb-4">🔒 감사 로그</h1>
                <p className="text-gray-500 text-xs mb-4">관리자가 수행한 모든 주요 액션 기록입니다. 누가, 언제, 무슨 처리를 했는지 추적합니다.</p>

                {/* 필터 + 새로고침 */}
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex flex-wrap gap-1 bg-gray-800/60 rounded-xl p-1">
                        {([
                            ['all', '전체'],
                            ['CASH_CHARGE', '캐시 충전'],
                            ['CASH_REFUND', '캐시 환불'],
                            ['PAYOUT_APPROVE', '출금 승인'],
                            ['PAYOUT_REJECT', '출금 거절'],
                            ['SUSPEND', '계정 정지'],
                            ['UNSUSPEND', '정지 해제'],
                            ['DELETE', '계정 삭제'],
                            ['REVIEW_BLIND', '리뷰 블라인드'],
                            ['REVIEW_DELETE', '리뷰 삭제'],
                            ['ADMIN_ROLE_CHANGE', '관리자 지정/해제'],
                        ] as const).map(([k, label]) => (
                            <button key={k} onClick={() => { setAuditFilter(k); setAuditPage(1); loadAuditLogs(1, k); }}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${auditFilter === k ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <button onClick={() => loadAuditLogs(auditPage, auditFilter)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">🔄 새로고침</button>
                </div>

                {/* 총 건수 */}
                <p className="text-xs text-gray-500 mb-3">총 {auditTotal.toLocaleString()}건</p>

                {/* 테이블 */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                                <th className="p-2.5 text-left">시간</th>
                                <th className="p-2.5 text-left">처리한 관리자</th>
                                <th className="p-2.5 text-left">대상 유저</th>
                                <th className="p-2.5 text-center">액션</th>
                                <th className="p-2.5 text-left">사유/내용</th>
                            </tr>
                        </thead>
                        <tbody>
                            {auditLoading ? (
                                <tr><td colSpan={5} className="p-6 text-center text-gray-500">로딩 중...</td></tr>
                            ) : auditLogs.length === 0 ? (
                                <tr><td colSpan={5} className="p-6 text-center text-gray-500">기록 없음</td></tr>
                            ) : auditLogs.map((log, i) => (
                                <tr key={log.id || i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                    <td className="p-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(log.created_at)}</td>
                                    <td className="p-2.5">
                                        <p className="text-white text-xs font-semibold">{log.admin?.name || log.admin?.email || log.admin_id?.slice(0, 8) + '...'}</p>
                                        <p className="text-gray-500 text-[10px]">{log.admin?.email || ''}</p>
                                    </td>
                                    <td className="p-2.5">
                                        {log.target ? (
                                            <>
                                                <p className="text-white text-xs font-semibold">{log.target?.nickname || log.target?.name || '-'}</p>
                                                <p className="text-gray-500 text-[10px]">{log.target?.email || ''}</p>
                                            </>
                                        ) : (
                                            <span className="text-gray-600 text-xs">-</span>
                                        )}
                                    </td>
                                    <td className="p-2.5 text-center">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                            log.action_type === 'CASH_CHARGE' ? 'bg-blue-900/50 text-blue-300' :
                                            log.action_type === 'CASH_REFUND' ? 'bg-purple-900/50 text-purple-300' :
                                            log.action_type === 'PAYOUT_APPROVE' ? 'bg-green-900/50 text-green-300' :
                                            log.action_type === 'PAYOUT_REJECT' ? 'bg-red-900/50 text-red-300' :
                                            log.action_type === 'SUSPEND' ? 'bg-orange-900/50 text-orange-300' :
                                            log.action_type === 'UNSUSPEND' ? 'bg-teal-900/50 text-teal-300' :
                                            log.action_type === 'DELETE' ? 'bg-gray-700/50 text-gray-400' :
                                            log.action_type === 'REVIEW_BLIND' ? 'bg-yellow-900/50 text-yellow-300' :
                                            log.action_type === 'REVIEW_DELETE' ? 'bg-red-900/50 text-red-400' :
                                            'bg-gray-700/50 text-gray-400'
                                        }`}>
                                            {{
                                                CASH_CHARGE: '캐시 충전',
                                                CASH_REFUND: '캐시 환불',
                                                PAYOUT_APPROVE: '출금 승인',
                                                PAYOUT_REJECT: '출금 거절',
                                                SUSPEND: '계정 정지',
                                                UNSUSPEND: '정지 해제',
                                                DELETE: '계정 삭제',
                                                REVIEW_BLIND: '리뷰 블라인드',
                                                REVIEW_DELETE: '리뷰 삭제',
                                                REVIEW_FEATURE: '리뷰 메인노출',
                                            }[log.action_type as string] || log.action_type}
                                        </span>
                                    </td>
                                    <td className="p-2.5 text-gray-300 text-xs max-w-xs truncate">{log.reason || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 페이지네이션 */}
                {auditTotal > AUDIT_PAGE_SIZE && (
                    <div className="flex justify-center gap-2 mt-4">
                        <button disabled={auditPage === 1} onClick={() => { const p = auditPage - 1; setAuditPage(p); loadAuditLogs(p, auditFilter); }}
                            className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-40">← 이전</button>
                        <span className="px-3 py-1.5 text-xs text-gray-400">{auditPage} / {Math.ceil(auditTotal / AUDIT_PAGE_SIZE)}</span>
                        <button disabled={auditPage >= Math.ceil(auditTotal / AUDIT_PAGE_SIZE)} onClick={() => { const p = auditPage + 1; setAuditPage(p); loadAuditLogs(p, auditFilter); }}
                            className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white disabled:opacity-40">다음 →</button>
                    </div>
                )}
            </>)}
                    </>)}
                </div>
            </main>

            {/* ─── Inquiries Modal ─── */}
            {
                selectedInquiry && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInquiry(null)}>
                        <div className="bg-gray-800 rounded-2xl w-full max-w-2xl border border-gray-700 shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-gray-700 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedInquiry.status === 'resolved' ? 'bg-green-900/50 text-green-300' :
                                                selectedInquiry.status === 'in_progress' ? 'bg-blue-900/50 text-blue-300' :
                                                    'bg-yellow-900/50 text-yellow-300'
                                            }`}>
                                            {selectedInquiry.status === 'resolved' ? '답변완료' : selectedInquiry.status === 'in_progress' ? '처리중' : '접수대기'}
                                        </span>
                                        1:1 문의 상세
                                    </h3>
                                </div>
                                <button onClick={() => { setSelectedInquiry(null); setReplyImages([]); setReplyImagePreviews([]); }} className="text-gray-400 hover:text-white text-xl">✕</button>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-6">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-xl font-bold text-white leading-snug">{selectedInquiry.title}</h4>
                                    </div>
                                    <div className="flex gap-4 text-xs text-gray-400 mb-4 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                                        <p><strong>작성자:</strong> {selectedInquiry.users?.nickname || selectedInquiry.users?.name || '알수없음'} ({selectedInquiry.user_type})</p>
                                        <p><strong>유형:</strong> {selectedInquiry.category}</p>
                                        <p><strong>작성일:</strong> {fmtDate(selectedInquiry.created_at)}</p>
                                    </div>
                                    <p className="text-gray-300 text-sm whitespace-pre-wrap bg-gray-700/30 p-4 rounded-xl leading-relaxed border border-gray-700/30">{selectedInquiry.content}</p>
                                    {Array.isArray(selectedInquiry.image_urls) && selectedInquiry.image_urls.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {selectedInquiry.image_urls.map((url: string, idx: number) => (
                                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                    <img src={url} alt={`첨부 ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-600 hover:opacity-80 transition" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-gray-700 pt-6">
                                    <label className="flex items-center gap-2 text-sm font-bold text-blue-400 mb-3">
                                        <span className="text-lg">🧑‍💻</span>
                                        {selectedInquiry.status === 'resolved' ? '등록된 답변 내용 (읽기 전용)' : '관리자 답변 작성'}
                                    </label>
                                    <textarea
                                        value={replyContent}
                                        onChange={e => { if (selectedInquiry.status !== 'resolved') setReplyContent(e.target.value); }}
                                        readOnly={selectedInquiry.status === 'resolved'}
                                        placeholder={selectedInquiry.status === 'resolved' ? '등록된 답변이 없습니다.' : '고객에게 전달될 답변 내용을 작성해주세요. (HTML 태그 사용 가능)'}
                                        className={`w-full rounded-xl p-4 text-sm text-white focus:outline-none min-h-[160px] ${selectedInquiry.status === 'resolved'
                                                ? 'bg-gray-700/40 border border-gray-600/40 cursor-default text-gray-300'
                                                : 'bg-gray-900 border border-gray-700 focus:ring-2 focus:ring-blue-500'
                                            }`}
                                    />
                                    <p className="text-xs text-gray-500 mt-2 ml-1">답변 저장 시 상태가 '답변 완료'로 자동 변경되며 사용자에게 즉시 노출됩니다.</p>
                                    {/* 기존 등록된 답변 이미지 표시 */}
                                    {Array.isArray(selectedInquiry.admin_reply_images) && selectedInquiry.admin_reply_images.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-xs font-bold text-gray-400 mb-2">📎 등록된 답변 이미지</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedInquiry.admin_reply_images.map((url: string, idx: number) => (
                                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                                        <img src={url} alt={`답변첨부 ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg border border-gray-600 hover:opacity-80 transition" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 답변 이미지 첨부 */}
                                    <div className="mt-4">
                                        <p className="text-xs font-bold text-gray-400 mb-2">📎 답변 이미지 첨부 <span className="font-normal text-gray-500">(선택, 최대 5장)</span></p>
                                        {replyImagePreviews.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {replyImagePreviews.map((src, idx) => (
                                                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-600">
                                                        <img src={src} alt={`답변첨부${idx + 1}`} className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveReplyImage(idx)}
                                                            className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold hover:bg-black/80"
                                                        >✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {replyImages.length < 5 && (
                                            <>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    id="reply-image-input"
                                                    onChange={handleReplyImageSelect}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor="reply-image-input"
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-600 rounded-lg text-xs text-gray-400 font-medium hover:border-blue-500 hover:text-blue-400 cursor-pointer transition"
                                                >
                                                    🖼️ 사진 추가 ({replyImages.length}/5)
                                                </label>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-5 border-t border-gray-700 flex justify-between items-center bg-gray-800/80 rounded-b-2xl">
                                {/* 왼쪽: 상태 전환 버튼 */}
                                <div className="flex gap-2">
                                    {selectedInquiry.status !== 'pending' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'pending')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-yellow-900/40 border border-yellow-700/50 text-yellow-300 hover:bg-yellow-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >접수대기로 변경</button>
                                    )}
                                    {selectedInquiry.status !== 'in_progress' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'in_progress')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >처리중으로 변경</button>
                                    )}
                                    {selectedInquiry.status !== 'resolved' && (
                                        <button
                                            onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'resolved')}
                                            disabled={inquiryStatusUpdating}
                                            className="px-3 py-2 text-xs bg-green-900/40 border border-green-700/50 text-green-300 hover:bg-green-800/60 disabled:opacity-40 font-bold rounded-lg transition"
                                        >답변완료로 변경</button>
                                    )}
                                </div>
                                {/* 오른쪽: 닫기 + 저장 버튼 */}
                                <div className="flex gap-2">
                                    <button onClick={() => { setSelectedInquiry(null); setReplyImages([]); setReplyImagePreviews([]); }} className="px-5 py-2.5 border border-gray-600 text-gray-300 hover:bg-gray-700 font-bold rounded-lg transition text-sm">닫기</button>
                                    {selectedInquiry.status !== 'resolved' && (
                                        <button
                                            onClick={handleSaveInquiryReply}
                                            disabled={replySaving || !replyContent.trim()}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-blue-400 disabled:cursor-not-allowed text-white font-bold rounded-lg transition text-sm flex items-center gap-2"
                                        >
                                            {replySaving ? '저장 중...' : '저장 및 답변 완료 처리'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ─── Cash Modal ─── */}
            {
                cashModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
                            <div className="p-5 border-b border-gray-700">
                                <h3 className="text-lg font-bold">{cashModal.type === 'charge' ? '💎 캐시 충전' : '🔥 캐시 환불/차감'}</h3>
                                <p className="text-sm text-gray-400 mt-1">대상: <span className="text-white font-semibold">{cashModal.pro.nickname || cashModal.pro.name || cashModal.pro.pro_id.slice(0, 12)}</span></p>
                                <p className="text-sm text-gray-400">현재 잔액: <span className="text-blue-400 font-bold">₱{fmtNum(cashModal.pro.current_cash)}</span></p>
                            </div>
                            <div className="p-5 space-y-3">
                                {/* [보너스 캐시 확장] 캐시 유형 선택 라디오 */}
                                <div>
                                    <label className="text-xs text-gray-400 font-bold mb-2 block">캐시 유형 선택</label>
                                    <div className="flex gap-2">
                                        <button onClick={() => setCashType('REAL')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition border ${cashType === 'REAL' ? 'bg-blue-600/20 text-blue-400 border-blue-500' : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'}`}>
                                            💎 실제 캐시
                                        </button>
                                        <button onClick={() => setCashType('BONUS')}
                                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition border ${cashType === 'BONUS' ? 'bg-green-600/20 text-green-400 border-green-500' : 'bg-gray-700 text-gray-400 border-gray-600 hover:border-gray-500'}`}>
                                            🎁 보너스 캐시
                                        </button>
                                    </div>
                                </div>
                                <div><label className="text-xs text-gray-400 font-bold mb-1 block">{cashModal.type === 'charge' ? '충전' : '환불/차감'} 금액 (₱)</label>
                                    <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="금액 입력" className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus /></div>
                                <div><label className="text-xs text-gray-400 font-bold mb-1 block">사유 (원장 기록)</label>
                                    <input type="text" value={cashDesc} onChange={e => setCashDesc(e.target.value)} placeholder={cashType === 'BONUS' ? '예: 이벤트 보너스 지급' : '예: 고객 서비스 보상'} className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                                {cashAmount && Number(cashAmount) > 0 && (
                                    <div className="bg-gray-900 rounded-lg p-3 text-sm space-y-1">
                                        <div className="flex justify-between text-gray-400"><span>{cashType === 'BONUS' ? '보너스 잔액' : '실제 잔액'}</span><span>₱{fmtNum(cashType === 'BONUS' ? (cashModal.pro.bonus_cash || 0) : cashModal.pro.current_cash)}</span></div>
                                        <div className={`flex justify-between font-bold ${cashModal.type === 'charge' ? 'text-blue-400' : 'text-red-400'}`}><span>{cashModal.type === 'charge' ? '+' : '-'}</span><span>₱{fmtNum(Number(cashAmount))}</span></div>
                                        <div className="border-t border-gray-700 pt-1 flex justify-between text-white font-bold"><span>변경 후</span><span>₱{fmtNum((cashType === 'BONUS' ? (cashModal.pro.bonus_cash || 0) : cashModal.pro.current_cash) + (cashModal.type === 'charge' ? Number(cashAmount) : -Number(cashAmount)))}</span></div>
                                    </div>
                                )}
                            </div>
                            <div className="p-5 border-t border-gray-700 flex gap-2">
                                <button onClick={() => setCashModal(null)} className="flex-1 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-bold text-sm">취소</button>
                                <button onClick={handleCashAction} disabled={cashProcessing} className={`flex-1 py-2.5 rounded-lg font-bold text-sm disabled:opacity-50 ${cashModal.type === 'charge' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>{cashProcessing ? '처리 중...' : (cashModal.type === 'charge' ? '충전 확인' : '환불 확인')}</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* ─── Pro Drill-down Modal ─── */}
            {
                drilldown && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDrilldown(null)}>
                        <div className="bg-gray-800 rounded-2xl w-full max-w-3xl border border-gray-700 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="p-5 border-b border-gray-700 flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold">🔍 {drilldown.proName} 개별 거래 내역</h3>
                                    <p className="text-xs text-gray-400 mt-1">{drilldown.proEmail}{drilldown.proPhone ? ` · ${drilldown.proPhone}` : ''}</p>
                                </div>
                                <button onClick={() => setDrilldown(null)} className="text-gray-400 hover:text-white text-xl leading-none">✕</button>
                            </div>
                            {drilldown.loading ? <div className="p-12 text-center text-gray-500">불러오는 중...</div> : (<>
                                {/* Drill-down stats */}
                                {(() => {
                                    const txs = drilldown.txs;
                                    const sumByType = (types: string[]) => txs.filter(t => types.includes(t.tx_type)).reduce((s, t) => s + Number(t.amount), 0);
                                    const stats = [
                                        { l: '전체', v: txs.reduce((s, t) => s + Number(t.amount), 0), c: 'text-white' },
                                        { l: '견적 차감', v: sumByType(['DEDUCT_QUOTE']), c: 'text-red-400' },
                                        { l: '충전', v: sumByType(['CHARGE', 'ADMIN_CHARGE', 'BONUS']), c: 'text-blue-400' },
                                        { l: '환불', v: sumByType(['REFUND', 'ADMIN_REFUND']), c: 'text-orange-400' },
                                    ];
                                    return (
                                        <div className="grid grid-cols-4 gap-2 p-4 border-b border-gray-700">
                                            {stats.map((s, i) => (
                                                <div key={i} className="bg-gray-900/60 rounded-lg p-3 text-center">
                                                    <p className="text-gray-500 text-[10px] font-bold uppercase">{s.l}</p>
                                                    <p className={`text-lg font-black ${s.c}`}>{s.v >= 0 ? '+' : ''}₱{fmtNum(Math.abs(s.v))}</p>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                                {/* Drill-down filter tabs */}
                                <div className="flex gap-1 p-3 border-b border-gray-700/50">
                                    {([['all', '전체'], ['DEDUCT_QUOTE', '견적 차감'], ['CHARGE', '충전'], ['REFUND', '환불']] as ['all' | 'DEDUCT_QUOTE' | 'CHARGE' | 'REFUND', string][]).map(([k, label]) => (
                                        <button key={k} onClick={() => setDrilldownFilter(k)}
                                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${drilldownFilter === k ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {/* Drill-down table */}
                                <div className="overflow-auto flex-1">
                                    <table className="w-full text-sm">
                                        <thead><tr className="border-b border-gray-700 text-gray-400 text-xs uppercase sticky top-0 bg-gray-800">
                                            <th className="p-2.5 text-left">시간</th><th className="p-2.5 text-left">유형</th><th className="p-2.5 text-right">금액</th><th className="p-2.5 text-right">잔액</th><th className="p-2.5 text-left">설명</th>
                                        </tr></thead>
                                        <tbody>
                                            {drilldown.txs.filter(tx => {
                                                if (drilldownFilter === 'all') return true;
                                                if (drilldownFilter === 'CHARGE') return ['CHARGE', 'ADMIN_CHARGE', 'BONUS'].includes(tx.tx_type);
                                                if (drilldownFilter === 'REFUND') return ['REFUND', 'ADMIN_REFUND'].includes(tx.tx_type);
                                                return tx.tx_type === drilldownFilter;
                                            }).map((tx: any, i: number) => (
                                                <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                                                    <td className="p-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                                                    <td className="p-2.5"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tx.amount > 0 ? 'bg-blue-900/50 text-blue-300' : 'bg-red-900/50 text-red-300'}`}>{txLabel(tx.tx_type)}</span></td>
                                                    <td className={`p-2.5 text-right font-bold ${tx.amount > 0 ? 'text-blue-400' : 'text-red-400'}`}>{tx.amount > 0 ? '+' : ''}₱{fmtNum(Math.abs(Number(tx.amount)))}</td>
                                                    <td className="p-2.5 text-right text-gray-400 text-xs">₱{fmtNum(Number(tx.balance_snapshot))}</td>
                                                    <td className="p-2.5 text-gray-500 text-xs">{txDesc(tx.tx_type, tx.description)}</td>
                                                </tr>
                                            ))}
                                            {drilldown.txs.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500">거래 내역 없음</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </>)}
                        </div>
                    </div>
                )
            }
            {/* ─── Modals Add ─── */}
            {isChatOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">💬 양방향 채팅 로그 (ReadOnly)</h2>
                            <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 flex flex-col-reverse gap-3">
                            {chatLogs.map((msg: any) => {
                                const isCustomer = msg.sender_id === selectedRequest.customer_id;
                                return (
                                    <div key={msg.message_id} className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[10px] text-gray-500 mb-0.5 px-1">{isCustomer ? '고객' : '고수'}</span>
                                        <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm ${isCustomer ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 border border-gray-700 rounded-bl-none'}`}>
                                            {msg.content}
                                        </div>
                                        <span className="text-[9px] text-gray-600 mt-0.5 px-1">{fmtDate(msg.created_at)}</span>
                                    </div>
                                );
                            })}
                            {chatLogs.length === 0 && <p className="text-center text-gray-500 my-10">채팅 내역이 없습니다.</p>}
                        </div>
                    </div>
                </div>
            )}

            {suspendModal?.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-red-900/50 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden shadow-red-900/20">
                        <div className="bg-red-950/40 p-5 border-b border-red-900/30">
                            <h2 className="text-red-400 font-bold text-lg mb-1">계정 정지 사유 입력 (Audit Log)</h2>
                            <p className="text-xs text-red-300/70 leading-relaxed">입력된 사유는 데이터베이스 감사 로그(suspension_reason)에 영구 저장됩니다.</p>
                        </div>
                        <div className="p-5">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-400 mb-2">CS 제재 사유 (최소 5자 이상)</label>
                                <textarea
                                    value={suspendReason}
                                    onChange={e => setSuspendReason(e.target.value)}
                                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition resize-none placeholder-gray-600"
                                    placeholder="예: 허위 견적 발송 및 고객 폭언으로 인한 영구 정지"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button onClick={() => { setSuspendModal(null); setSuspendReason(''); }} className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-400 hover:text-white transition">취소</button>
                                <button onClick={handleSuspendUserWithReason} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition ${suspendReason.length >= 5 ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-red-900/50 text-red-500/50 cursor-not-allowed'}`}>강제 정지 집행</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CS 채팅 팝업 모달 ── */}
            {csChatModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '80vh' }}>
                        {/* 헤더 */}
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center flex-shrink-0">
                            <div>
                                <h2 className="text-base font-bold text-white">💬 채팅 내역</h2>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    👤 {csChatModal.customerName} &nbsp;↔&nbsp; 🔧 {csChatModal.proName}
                                </p>
                            </div>
                            <button
                                onClick={() => { setCsChatModal(null); setCsChatMessages([]); setCsChatRoomId(undefined); setCsChatOffset(0); setCsChatHasMore(false); }}
                                className="text-gray-400 hover:text-white text-xl flex-shrink-0"
                            >✕</button>
                        </div>

                        {/* 본문 */}
                        <div className="overflow-y-auto flex-1 p-4 space-y-2">
                            {csChatRoomId === undefined && csChatLoading ? (
                                <div className="text-center text-gray-500 py-10 text-xs">불러오는 중...</div>
                            ) : csChatRoomId === null ? (
                                <p className="text-center text-gray-600 py-10 text-xs bg-gray-800/50 border border-gray-800 rounded-xl border-dashed">아직 채팅방이 없습니다.</p>
                            ) : (
                                <>
                                    {/* 이전 대화 더 보기 (상단) */}
                                    {csChatHasMore && (
                                        <div className="text-center mb-2">
                                            <button
                                                onClick={loadCsChatMore}
                                                disabled={csChatLoading}
                                                className="text-xs text-blue-400 hover:text-blue-300 bg-gray-800/50 border border-gray-700 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                                            >
                                                {csChatLoading ? '불러오는 중...' : '이전 대화 더 보기'}
                                            </button>
                                        </div>
                                    )}
                                    {/* 메시지 목록 */}
                                    {csChatMessages.length === 0 && !csChatLoading ? (
                                        <p className="text-center text-gray-600 py-6 text-xs">채팅 내역이 없습니다.</p>
                                    ) : (
                                        [...csChatMessages].reverse().map((msg: any) => {
                                            const senderName = (msg.sender as any)?.nickname || (msg.sender as any)?.name || (msg.sender_id?.slice(0, 8) + '...');
                                            const isCustomer = msg.sender_id === csChatModal.customerId;
                                            return (
                                                <div key={msg.message_id} className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}>
                                                    <span className="text-[10px] text-gray-500 mb-0.5">
                                                        {isCustomer ? '👤 고객' : '🔧 고수'} · {senderName} · {fmtDate(msg.created_at)}
                                                    </span>
                                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs leading-relaxed break-words ${isCustomer ? 'bg-gray-700 text-gray-200' : 'bg-blue-800/50 text-blue-100'}`}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    {csChatLoading && csChatMessages.length > 0 && (
                                        <div className="text-center text-gray-600 text-xs py-2">불러오는 중...</div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}



            {/* ── CS 고수 상세 팝업 모달 ── */}
            {proDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        {/* 헤더 */}
                        <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white">👤 고수 상세 정보</h2>
                            <button onClick={() => { setProDetailModal(null); setProDetailData(null); }} className="text-gray-400 hover:text-white text-xl">✕</button>
                        </div>

                        {/* 탭 네비게이션 */}
                        {!proDetailLoading && proDetailData && (
                            <div className="flex gap-0 bg-gray-900 border-b border-gray-800">
                                {(['info', 'ledger', 'quotes', 'reviews'] as const).map(t => (
                                    <button key={t} onClick={() => handleProDetailTabChange(t, proDetailModal.proId)}
                                        className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition ${proDetailTab === t ? 'border-blue-400 text-white bg-gray-800/50' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
                                        {{ info: '기본정보', ledger: '캐시내역', quotes: '견적', reviews: '리뷰' }[t]}
                                    </button>
                                ))}
                            </div>
                        )}

                        {proDetailLoading ? (
                            <div className="p-10 text-center text-gray-400">불러오는 중...</div>
                        ) : proDetailData ? (
                            <div className="overflow-y-auto max-h-[65vh]">
                                {/* ── 기본정보 탭 ── */}
                                {proDetailTab === 'info' && (
                                    <div className="p-5 space-y-4">
                                        {/* 프로필 헤더 */}
                                        <div className="flex items-center gap-4 bg-gray-800 p-4 rounded-xl border border-gray-700">
                                            <div className="w-14 h-14 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                                                {proDetailData.avatar_url
                                                    ? <img src={proDetailData.avatar_url} alt="프로필" className="w-full h-full object-cover" />
                                                    : <span className="text-2xl text-gray-400">👤</span>
                                                }
                                            </div>
                                            <div>
                                                <p className="text-white font-bold text-lg">{proDetailData.nickname || proDetailData.name || '-'}</p>
                                                <p className="text-gray-400 text-xs mt-0.5">PRO · {proDetailData.status || 'ACTIVE'}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-yellow-400 text-xs">⭐ {Number(proDetailData.average_rating || 0).toFixed(1)}</span>
                                                    <span className="text-gray-500 text-xs">({proDetailData.review_count || 0}개 리뷰)</span>
                                                </div>
                                            </div>
                                            <div className="ml-auto text-right">
                                                <p className="text-blue-400 font-bold">₱{fmtNum(proDetailData.current_cash || 0)}</p>
                                                {(proDetailData.bonus_cash || 0) > 0 && <p className="text-green-400 text-xs">+🎁₱{fmtNum(proDetailData.bonus_cash)}</p>}
                                                <p className="text-gray-500 text-[10px] mt-1">캐시 잔액</p>
                                            </div>
                                        </div>

                                        {/* 연락처 정보 */}
                                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 space-y-2">
                                            <h3 className="text-xs font-bold text-gray-400 mb-3">📞 연락처</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[10px] text-gray-500">이메일</p>
                                                    <p className="text-sm text-white font-mono">{proDetailData.email || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">전화번호</p>
                                                    <p className="text-sm text-white font-mono">{proDetailData.phone || '-'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 기본 정보 */}
                                        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                            <h3 className="text-xs font-bold text-gray-400 mb-3">📋 기본 정보</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[10px] text-gray-500">이름</p>
                                                    <p className="text-sm text-white">{proDetailData.name || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">활동명</p>
                                                    <p className="text-sm text-white">{proDetailData.nickname || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">가입일</p>
                                                    <p className="text-sm text-white">{proDetailData.created_at ? fmtDate(proDetailData.created_at) : '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">인증 상태</p>
                                                    <p className={`text-sm font-bold ${proDetailData.is_phone_verified ? 'text-green-400' : 'text-gray-500'}`}>
                                                        {proDetailData.is_phone_verified ? '✅ 인증됨' : '미인증'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">활동 지역</p>
                                                    <p className="text-sm text-white">{proDetailData.region || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-gray-500">Facebook</p>
                                                    <p className="text-sm text-white truncate">{proDetailData.facebook_url || '-'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 제공 서비스 */}
                                        {proDetailData.services?.length > 0 && (
                                            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                                                <h3 className="text-xs font-bold text-gray-400 mb-3">🛠 제공 서비스</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {proDetailData.services.map((s: string, i: number) => (
                                                        <span key={i} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-800/50 px-2 py-1 rounded-lg">{s}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── 캐시내역 탭 ── */}
                                {proDetailTab === 'ledger' && (
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                                            <span className="text-xs text-gray-400">캐시 잔액</span>
                                            <span className="text-blue-400 font-bold">₱{fmtNum(proDetailData.current_cash || 0)}
                                                {(proDetailData.bonus_cash || 0) > 0 && <span className="text-green-400 text-xs ml-2">+🎁₱{fmtNum(proDetailData.bonus_cash)}</span>}
                                            </span>
                                        </div>
                                        {proDetailTabData.ledger == null ? (
                                            <div className="py-8 text-center text-gray-500 text-sm">불러오는 중...</div>
                                        ) : (proDetailTabData.ledger || []).length === 0 ? (
                                            <div className="py-8 text-center text-gray-600 text-sm">캐시 내역이 없습니다.</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {(proDetailTabData.ledger || []).map((row: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between bg-gray-800/60 px-3 py-2.5 rounded-lg border border-gray-700/50">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs text-white font-medium">{txLabel(row.tx_type)}</p>
                                                            <p className="text-[10px] text-gray-500 truncate">{txDesc(row.tx_type, row.description)}</p>
                                                            <p className="text-[10px] text-gray-600 mt-0.5">{fmtDate(row.created_at)}</p>
                                                        </div>
                                                        <div className="text-right ml-3 flex-shrink-0">
                                                            <p className={`text-sm font-bold ${row.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {row.amount >= 0 ? '+' : ''}₱{fmtNum(Math.abs(row.amount))}
                                                            </p>
                                                            {row.balance_snapshot != null && (
                                                                <p className="text-[10px] text-gray-500">잔액 ₱{fmtNum(row.balance_snapshot)}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                                {proDetailLedgerHasMore && (
                                                    <button
                                                        onClick={() => handleProDetailLedgerMore(proDetailModal!.proId)}
                                                        disabled={proDetailTabLoading}
                                                        className="w-full py-2 text-xs text-gray-400 hover:text-white bg-gray-800/40 hover:bg-gray-700/60 border border-gray-700/50 rounded-lg transition disabled:opacity-50"
                                                    >
                                                        {proDetailTabLoading ? '불러오는 중...' : '더 보기'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── 견적 탭 ── */}
                                {proDetailTab === 'quotes' && (
                                    <div className="p-5 space-y-3">
                                        {proDetailTabLoading ? (
                                            <div className="py-8 text-center text-gray-500 text-sm">불러오는 중...</div>
                                        ) : (proDetailTabData.quotes || []).length === 0 ? (
                                            <div className="py-8 text-center text-gray-600 text-sm">발송한 견적이 없습니다.</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {(proDetailTabData.quotes || []).map((q: any, i: number) => (
                                                    <div key={i} className="bg-gray-800/60 px-3 py-2.5 rounded-lg border border-gray-700/50">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(q.status)}`}>{statusLabel(q.status)}</span>
                                                            <span className="text-blue-400 font-bold text-sm">₱{fmtNum(q.price || 0)}</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 truncate">{q.description || '-'}</p>
                                                        <p className="text-[10px] text-gray-600 mt-0.5">{fmtDate(q.created_at)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ── 리뷰 탭 ── */}
                                {proDetailTab === 'reviews' && (
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-xl border border-gray-700">
                                            <span className="text-yellow-400 font-bold">⭐ {Number(proDetailData.average_rating || 0).toFixed(1)}</span>
                                            <span className="text-gray-400 text-xs">({proDetailData.review_count || 0}개 리뷰)</span>
                                        </div>
                                        {proDetailTabLoading ? (
                                            <div className="py-8 text-center text-gray-500 text-sm">불러오는 중...</div>
                                        ) : (proDetailTabData.reviews || []).length === 0 ? (
                                            <div className="py-8 text-center text-gray-600 text-sm">받은 리뷰가 없습니다.</div>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {(proDetailTabData.reviews || []).map((rv: any, i: number) => (
                                                    <div key={i} className="bg-gray-800/60 px-3 py-2.5 rounded-lg border border-gray-700/50">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-yellow-400 text-xs font-bold">{'⭐'.repeat(Math.min(rv.rating || 0, 5))} {rv.rating}/5</span>
                                                            <span className="text-[10px] text-gray-600">{fmtDate(rv.created_at)}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-300">{rv.comment || '-'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-gray-500">데이터를 불러올 수 없습니다.</div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── 커스텀 모달 (관리자 승급/회수 알림) ─── */}
            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#1e2433] rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 flex flex-col items-center gap-4">
                        {modal.type === 'success' && (
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                <span className="text-green-400 text-3xl">✓</span>
                            </div>
                        )}
                        {modal.type === 'error' && (
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                                <span className="text-red-400 text-3xl">✕</span>
                            </div>
                        )}
                        {modal.type === 'confirm' && (
                            <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <span className="text-orange-400 text-3xl">⚠</span>
                            </div>
                        )}
                        <h3 className="text-white text-xl font-bold text-center">{modal.title}</h3>
                        <p className="text-gray-400 text-sm text-center leading-relaxed whitespace-pre-line">{modal.message}</p>
                        {modal.type === 'confirm' ? (
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setModal(null)}
                                    className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={() => { modal.onConfirm?.(); setModal(null); }}
                                    className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition"
                                >
                                    확인
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setModal(null)}
                                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition mt-2"
                            >
                                확인
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── 정지 사유 입력 모달 ─── */}
            {suspendReasonModal?.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-[#1e2433] rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4 flex flex-col gap-4">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${suspendReasonModal.currentStatus === 'SUSPENDED' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                            <span className="text-3xl">{suspendReasonModal.currentStatus === 'SUSPENDED' ? '✅' : '🚫'}</span>
                        </div>
                        <h3 className="text-white text-xl font-bold text-center">
                            {suspendReasonModal.currentStatus === 'SUSPENDED' ? '정지 해제' : '계정 정지'}
                        </h3>
                        <p className="text-gray-400 text-sm text-center">
                            {suspendReasonModal.currentStatus === 'SUSPENDED'
                                ? '해제 사유를 입력하세요 (5자 이상, 감사 로그에 기록됩니다)'
                                : '정지 사유를 입력하세요 (5자 이상, 감사 로그에 기록됩니다)'}
                        </p>
                        <textarea
                            className="w-full bg-[#2a3347] text-white rounded-xl p-3 text-sm resize-none border border-gray-600 focus:border-indigo-500 focus:outline-none"
                            rows={3}
                            placeholder="예: 반복적인 노쇼, 허위 정보 등록, 사기 의심 등"
                            value={suspendReasonModal.reason}
                            onChange={e => setSuspendReasonModal(prev => prev ? { ...prev, reason: e.target.value } : null)}
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSuspendReasonModal(null)}
                                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium hover:bg-gray-600 transition"
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    if (!suspendReasonModal.reason.trim() || suspendReasonModal.reason.trim().length < 5) {
                                        setModal({ type: 'error', title: '입력 오류', message: '정지 사유를 5자 이상 입력해주세요.' });
                                        return;
                                    }
                                    setSuspendReasonModal(null);
                                    executeSuspendToggle(
                                        suspendReasonModal.userId,
                                        suspendReasonModal.currentStatus,
                                        suspendReasonModal.isPro,
                                        suspendReasonModal.reason.trim()
                                    );
                                }}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition"
                            >
                                {suspendReasonModal.currentStatus === 'SUSPENDED' ? '해제 확인' : '정지 확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── 비활성 자동 로그아웃 경고 모달 ─── */}
            {showTimeoutWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-[#1e2433] rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-yellow-500/20">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h3 className="text-white text-xl font-bold">세션 만료 임박</h3>
                        <p className="text-gray-400 text-sm">30초 후 비활성으로 인해 자동 로그아웃됩니다.</p>
                        <button
                            onClick={() => setShowTimeoutWarning(false)}
                            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-500 transition"
                        >
                            계속 사용하기
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function AdminDashboardPage() {
    return (
        <React.Suspense fallback={<div className="min-h-screen bg-[#0E121E] flex items-center justify-center text-white">로딩 중...</div>}>
            <AdminDashboardPageContent />
        </React.Suspense>
    );
}
