'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { PROFILE_IMAGE_COOLDOWN_DAYS, PROFILE_IMAGE_MAX_SIZE_BYTES, NICKNAME_COOLDOWN_DAYS } from '@/lib/constants';
import Link from 'next/link';
import { PHILIPPINES_REGIONS } from '@/lib/constants';
import { mockVerifyProPhone, mockLinkFacebook } from '@/lib/mockAuth';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────
// 메인 프로필 페이지
// ─────────────────────────────────────────────
export default function ProfilePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'CUSTOMER' | 'PRO' | null>(null);
    const { showToast } = useToast();
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawConfirmText, setWithdrawConfirmText] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);

    useEffect(() => {
        const fetchUserRole = async () => {
            let { data: authData, error: authError } = await supabase.auth.getUser();
            let user = authData?.user;

            // getUser 실패 시 세션 리프레시 후 1회 재시도
            if (authError || !user) {
                console.warn('Profile: getUser 첫 시도 실패, 세션 리프레시 후 재시도', authError?.message);
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (!refreshError) {
                    const retry = await supabase.auth.getUser();
                    authData = retry.data;
                    authError = retry.error;
                    user = authData?.user;
                }
            }

            if (authError || !user) {
                console.error('Profile: getUser 최종 실패, 메인으로 이동', authError?.message);
                router.replace('/');
                return;
            }
            setSessionUser(user);

            let role = user.user_metadata?.role?.toUpperCase();

            if (!role) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('user_id', user.id)
                    .single();

                if (userData) {
                    role = userData.role.toUpperCase();
                } else {
                    role = 'CUSTOMER'; // fallback
                }
            }

            console.log('Current Profile Role:', role);
            setUserRole(role as 'CUSTOMER' | 'PRO');
            setLoading(false);
        };
        fetchUserRole();
    }, [router]);

    // 역할 충돌 안내 토스트 (auth/complete에서 전달)
    useEffect(() => {
        try {
            const msg = sessionStorage.getItem('role_conflict_msg');
            if (msg) {
                sessionStorage.removeItem('role_conflict_msg');
                // 페이지 렌더링 완료 후 토스트 표시
                setTimeout(() => showToast(msg, 'warning', true), 500);
            }
        } catch {}
    }, [showToast]);

    // PRO 계정 견적 차단 안내 토스트 (auth/complete에서 전달)
    useEffect(() => {
        const msg = sessionStorage.getItem('pro_quote_blocked_msg');
        if (msg) {
            sessionStorage.removeItem('pro_quote_blocked_msg');
            showToast(msg, 'error');
        }
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    const handleWithdraw = async () => {
        if (withdrawConfirmText !== '탈퇴합니다' || !sessionUser) return;
        setWithdrawing(true);
        try {
            // 1. withdrawal_logs에 개인정보 보존
            const { error: logErr } = await supabase.from('withdrawal_logs').insert({
                user_id: sessionUser.id,
                real_name: sessionUser.user_metadata?.name || sessionUser.name || null,
                email: sessionUser.email || null,
                phone: sessionUser.user_metadata?.phone || null,
                role: userRole,
                reason: withdrawReason || '사유 미입력',
            });
            if (logErr) throw new Error('탈퇴 로그 저장 실패: ' + logErr.message);

            // 2. users 테이블 개인정보 마스킹 + DELETED 처리 (핵심 단계 — 실패 시 즉시 중단)
            const { error: updateErr } = await supabase.from('users').update({
                name: '탈퇴한 사용자',
                nickname: `deleted_${sessionUser.id}`,
                phone: null,
                email: `deleted_${sessionUser.id}@deleted.com`,
                status: 'DELETED',
                device_token: null,
            }).eq('user_id', sessionUser.id);
            if (updateErr) throw new Error('계정 상태 업데이트 실패: ' + updateErr.message);

            // 2-1. JWT user_metadata에도 DELETED 기록 (middleware 차단용)
            const { error: metaErr } = await supabase.auth.updateUser({
                data: { status: 'DELETED' }
            });
            if (metaErr) throw new Error('JWT 메타데이터 업데이트 실패: ' + metaErr.message);

            // 3. Supabase Auth 계정 비활성화 (관리자 API로 banned_until 영구 설정)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.auth as any).admin?.updateUserById?.(sessionUser.id, {
                ban_duration: '876000h', // 100년 = 사실상 영구 차단
            })?.catch?.(() => {
                // admin API 미지원 환경 무시 — middleware에서 DELETED 상태 체크로 2차 차단
            });

            // 4. 로그아웃 후 홈으로 (탈퇴 안내 배너 표시)
            await supabase.auth.signOut();
            window.location.href = '/?withdrawn=true';
        } catch (e: any) {
            showToast('탈퇴 처리 중 오류가 발생했습니다: ' + e.message, 'error');
            setWithdrawing(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-gray-500">로딩 중...</div>;
    if (!userRole) return <div className="p-10 text-center text-red-500">프로필 로드 에러</div>;

    // [기획 핵심] 강제 Early Return (고객일 경우 고수 DB 조회 원천 차단)
    if (userRole === 'CUSTOMER') {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col w-full lg:px-8 lg:py-8 lg:items-stretch">
                <header className="w-full bg-white p-4 border-b border-gray-100 flex justify-center lg:justify-start items-center shadow-sm lg:text-left lg:mb-8 lg:bg-transparent lg:border-none lg:p-0 lg:mt-8">
                    <h1 className="text-xl lg:text-2xl lg:font-bold">프로필 관리</h1>
                </header>
                <main className="flex-1 w-full space-y-6 mt-4">
                    <ProfileHeader user={sessionUser} role="CUSTOMER" tableName="users" idColumn="user_id" onLogout={handleLogout} />
                    <CustomerProfile user={sessionUser} />
                    <CustomerSupportSection />

                    {/* 최하단 로그아웃 + 탈퇴 버튼 */}
                    <div className="pt-8 pb-12 flex flex-col items-center gap-3">
                        <button
                            onClick={handleLogout}
                            className="text-sm text-gray-400 hover:text-gray-500 underline underline-offset-4 transition"
                        >
                            로그아웃
                        </button>
                        <button
                            onClick={() => { setShowWithdrawModal(true); setWithdrawReason(''); setWithdrawConfirmText(''); }}
                            className="text-xs text-gray-300 hover:text-red-400 transition"
                        >
                            회원 탈퇴
                        </button>
                    </div>
                </main>

            {/* ── 회원 탈퇴 모달 (CUSTOMER) ── */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
                        <div className="text-center">
                            <span className="text-4xl block mb-2">😢</span>
                            <h3 className="text-lg font-black text-gray-800">정말 탈퇴하시겠어요?</h3>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                탈퇴 시 개인정보는 즉시 삭제되며<br />거래 내역은 법적 보존 기간 동안 보관됩니다.
                            </p>
                        </div>

                        {/* 탈퇴 사유 선택 */}
                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">탈퇴 사유 (선택)</p>
                            <select
                                value={withdrawReason}
                                onChange={e => setWithdrawReason(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                            >
                                <option value="">사유를 선택해주세요</option>
                                <option value="서비스 불만족">서비스 불만족</option>
                                <option value="이용 빈도 낮음">이용 빈도 낮음</option>
                                <option value="개인정보 우려">개인정보 우려</option>
                                <option value="다른 서비스 이용">다른 서비스 이용</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>

                        {/* 확인 텍스트 입력 */}
                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">
                                아래 입력란에 <span className="text-red-500">"탈퇴합니다"</span>라고 입력하세요
                            </p>
                            <input
                                type="text"
                                value={withdrawConfirmText}
                                onChange={e => setWithdrawConfirmText(e.target.value)}
                                placeholder="탈퇴합니다"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-300"
                                disabled={withdrawing}
                            />
                        </div>

                        {/* 버튼 */}
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setShowWithdrawModal(false)}
                                disabled={withdrawing}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
                            >취소</button>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawConfirmText !== '탈퇴합니다' || withdrawing}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                                    withdrawConfirmText === '탈퇴합니다' && !withdrawing
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                }`}
                            >{withdrawing ? '처리 중...' : '탈퇴하기'}</button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col w-full lg:px-8 lg:py-8 lg:items-stretch">
            <header className="w-full bg-white p-4 border-b border-gray-100 flex justify-center lg:justify-start items-center shadow-sm lg:text-left lg:mb-8 lg:bg-transparent lg:border-none lg:p-0 lg:mt-8">
                <h1 className="text-xl lg:text-2xl lg:font-bold">프로필 관리</h1>
            </header>

            <main className="flex-1 w-full space-y-6 mt-4">
                <ProfileHeader user={sessionUser} role="PRO" tableName="pro_profiles" idColumn="pro_id" onLogout={handleLogout} reviewHref="/pro/reviews" />
                <ProProfile user={sessionUser} />
                <CustomerSupportSection />

                {/* 최하단 로그아웃 + 탈퇴 버튼 */}
                <div className="pt-8 pb-12 flex flex-col items-center gap-3">
                    <button
                        onClick={handleLogout}
                        className="text-sm text-gray-400 hover:text-gray-500 underline underline-offset-4 transition"
                    >
                        로그아웃
                    </button>
                    <button
                        onClick={() => { setShowWithdrawModal(true); setWithdrawReason(''); setWithdrawConfirmText(''); }}
                        className="text-xs text-gray-300 hover:text-red-400 transition"
                    >
                        회원 탈퇴
                    </button>
                </div>
            </main>

            {/* ── 회원 탈퇴 모달 (PRO) ── */}
            {showWithdrawModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
                        <div className="text-center">
                            <span className="text-4xl block mb-2">😢</span>
                            <h3 className="text-lg font-black text-gray-800">정말 탈퇴하시겠어요?</h3>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                탈퇴 시 개인정보는 즉시 삭제되며<br />거래 내역은 법적 보존 기간 동안 보관됩니다.
                            </p>
                        </div>

                        {/* 탈퇴 사유 선택 */}
                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">탈퇴 사유 (선택)</p>
                            <select
                                value={withdrawReason}
                                onChange={e => setWithdrawReason(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                            >
                                <option value="">사유를 선택해주세요</option>
                                <option value="서비스 불만족">서비스 불만족</option>
                                <option value="이용 빈도 낮음">이용 빈도 낮음</option>
                                <option value="개인정보 우려">개인정보 우려</option>
                                <option value="다른 서비스 이용">다른 서비스 이용</option>
                                <option value="기타">기타</option>
                            </select>
                        </div>

                        {/* 확인 텍스트 입력 */}
                        <div>
                            <p className="text-xs font-bold text-gray-600 mb-2">
                                아래 입력란에 <span className="text-red-500">"탈퇴합니다"</span>라고 입력하세요
                            </p>
                            <input
                                type="text"
                                value={withdrawConfirmText}
                                onChange={e => setWithdrawConfirmText(e.target.value)}
                                placeholder="탈퇴합니다"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 placeholder:text-gray-300"
                                disabled={withdrawing}
                            />
                        </div>

                        {/* 버튼 */}
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setShowWithdrawModal(false)}
                                disabled={withdrawing}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
                            >취소</button>
                            <button
                                onClick={handleWithdraw}
                                disabled={withdrawConfirmText !== '탈퇴합니다' || withdrawing}
                                className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${
                                    withdrawConfirmText === '탈퇴합니다' && !withdrawing
                                        ? 'bg-red-500 hover:bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                }`}
                            >{withdrawing ? '처리 중...' : '탈퇴하기'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─────────────────────────────────────────────
// 프로필 헤더 (사진 + 이름 + 역할 + 계정 설정)
// ─────────────────────────────────────────────
function ProfileHeader({ user, role, tableName, idColumn, onLogout, reviewHref }: {
    user: any;
    role: 'CUSTOMER' | 'PRO';
    tableName: string;
    idColumn: string;
    onLogout: () => void;
    reviewHref?: string;
}) {
    const { showToast } = useToast();
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [nickname, setNickname] = useState<string>('');
    const [showSettings, setShowSettings] = useState(false);
    const [reviewStats, setReviewStats] = useState<{ avg: number; count: number }>({ avg: 0, count: 0 });

    // 계정 설정 폼 상태
    const [newNickname, setNewNickname] = useState('');
    const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
    const [nicknameMsg, setNicknameMsg] = useState('');
    const [uploading, setUploading] = useState(false);
    const [imageUpdatedAt, setImageUpdatedAt] = useState<string | null>(null);
    const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
    const [nicknameUpdatedAt, setNicknameUpdatedAt] = useState<string | null>(null);
    const [nicknameCooldown, setNicknameCooldown] = useState<number>(0);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // DB에서 프로필 정보 로드
    useEffect(() => {
        const load = async () => {
            // [수술 핵심] 닉네임과 아바타는 무조건 users 테이블을 Single Source of Truth로 바라보게 강제
            const { data } = await supabase
                .from('users')
                .select('nickname, avatar_url, profile_image_updated_at, nickname_updated_at')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setNickname(data.nickname || '');
                setNewNickname(data.nickname || '');
                setAvatarUrl(data.avatar_url || null);
                setImageUpdatedAt(data.profile_image_updated_at || null);
                if (data.profile_image_updated_at) {
                    const updatedAt = new Date(data.profile_image_updated_at);
                    const now = new Date();
                    const diffDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
                    const remaining = Math.ceil(PROFILE_IMAGE_COOLDOWN_DAYS - diffDays);
                    setCooldownRemaining(remaining > 0 ? remaining : 0);
                }
                setNicknameUpdatedAt(data.nickname_updated_at || null);
                if (data.nickname_updated_at) {
                    const updatedAt = new Date(data.nickname_updated_at);
                    const now = new Date();
                    const diffDays = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
                    const remaining = Math.ceil(NICKNAME_COOLDOWN_DAYS - diffDays);
                    setNicknameCooldown(remaining > 0 ? remaining : 0);
                }
            }

            // PRO: 평점/리뷰 수 로드
            if (role === 'PRO') {
                const { data: proData } = await supabase
                    .from('pro_profiles')
                    .select('average_rating, review_count')
                    .eq('pro_id', user.id)
                    .single();
                if (proData) {
                    setReviewStats({
                        avg: Number(proData.average_rating) || 0,
                        count: proData.review_count || 0
                    });
                }
            }
        };
        load();
    }, [user.id, tableName, idColumn, role]);

    // 닉네임 중복 체크 (디바운스 300ms)
    const checkNickname = useCallback((value: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!value.trim()) {
            setNicknameStatus('idle');
            setNicknameMsg('');
            return;
        }

        if (value.trim() === nickname) {
            setNicknameStatus('available');
            setNicknameMsg('현재 사용 중인 활동명입니다.');
            return;
        }

        if (value.trim().length < 2) {
            setNicknameStatus('error');
            setNicknameMsg('활동명은 2자 이상이어야 합니다.');
            return;
        }

        if (value.trim().length > 20) {
            setNicknameStatus('error');
            setNicknameMsg('활동명은 20자 이하여야 합니다.');
            return;
        }

        setNicknameStatus('checking');
        setNicknameMsg('중복 확인 중...');

        debounceRef.current = setTimeout(async () => {
            try {
                const { data, error } = await supabase.rpc('check_nickname_duplicate', {
                    p_nickname: value.trim(),
                    p_user_id: user.id
                });

                if (error) throw error;

                if (data === true) {
                    setNicknameStatus('taken');
                    setNicknameMsg('이미 사용 중인 활동명입니다.');
                } else {
                    setNicknameStatus('available');
                    setNicknameMsg('사용 가능한 활동명입니다! ✓');
                }
            } catch {
                setNicknameStatus('error');
                setNicknameMsg('중복 확인에 실패했습니다.');
            }
        }, 300);
    }, [user.id, nickname]);

    // 프로필 사진 업로드
    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // [방어 1] 쿨다운 체크 (DB Single Source of Truth 기준)
        if (cooldownRemaining > 0) {
            showToast(`프로필 사진은 ${cooldownRemaining}일 후에 변경할 수 있습니다.`, 'error');
            return;
        }

        // [방어 2] 이미지 파일만 허용
        if (!file.type.startsWith('image/')) {
            showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
            return;
        }

        // [방어 3] 파일 크기 5MB 이하
        if (file.size > PROFILE_IMAGE_MAX_SIZE_BYTES) {
            showToast('파일 크기는 5MB 이하여야 합니다.', 'error');
            return;
        }

        setUploading(true);
        try {
            const ext = file.name.split('.').pop() || 'jpg';
            const fileName = `${user.id}/${Date.now()}.${ext}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const publicUrl = publicUrlData.publicUrl;
            const now = new Date().toISOString();

            // DB 업데이트: avatar_url + profile_image_updated_at 동시 저장
            const { error: dbError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrl, profile_image_updated_at: now })
                .eq('user_id', user.id);

            if (dbError) throw dbError;

            if (role === 'PRO') {
                await supabase
                    .from('pro_profiles')
                    .update({ avatar_url: publicUrl })
                    .eq('pro_id', user.id);
            }

            setAvatarUrl(publicUrl);
            setImageUpdatedAt(now);
            setCooldownRemaining(PROFILE_IMAGE_COOLDOWN_DAYS);
            showToast('프로필 사진이 성공적으로 변경되었습니다.', 'success');
        } catch (err: any) {
            showToast('사진 업로드 실패: ' + (err.message || '알 수 없는 오류'), 'error');
        } finally {
            setUploading(false);
        }
    };

    // 활동명 저장
    const handleSaveNickname = async () => {
        if (nicknameStatus !== 'available') {
            showToast('활동명을 다시 확인해주세요.', 'error');
            return;
        }

        // 쿨다운 체크 (DB Single Source of Truth 기준)
        if (nicknameCooldown > 0) {
            showToast(`활동명은 ${nicknameCooldown}일 후에 변경할 수 있습니다.`, 'error');
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase.rpc('update_nickname', {
                p_user_id: user.id,
                p_nickname: newNickname.trim(),
                p_is_admin: false
            });

            if (error) throw error;

            if (data.success === false) {
                if (data.error === 'cooldown') {
                    showToast(`활동명은 ${data.remaining_days}일 후에 변경할 수 있습니다.`, 'error');
                    setNicknameCooldown(data.remaining_days);
                } else if (data.error === 'duplicate') {
                    showToast('이미 사용 중인 활동명입니다.', 'error');
                    setNicknameStatus('taken');
                    setNicknameMsg('이미 사용 중인 활동명입니다.');
                }
                return;
            }

            const now = new Date().toISOString();
            setNickname(newNickname.trim());
            setNicknameUpdatedAt(now);
            setNicknameCooldown(NICKNAME_COOLDOWN_DAYS);
            showToast('활동명이 변경되었습니다.', 'success');
            setShowSettings(false);
        } catch (err: any) {
            showToast('활동명 저장 실패: ' + (err.message || '알 수 없는 오류'), 'error');
        } finally {
            setSaving(false);
        }
    };

    const roleLabel = role === 'CUSTOMER' ? '고객님' : '고수님';
    const displayName = nickname || user.email?.split('@')[0] || '사용자';

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 프로필 헤더 영역 */}
            <div className="p-6 flex items-center gap-4">
                {/* 원형 프로필 사진 */}
                <div className="relative flex-shrink-0">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-white shadow-md">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="프로필"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        )}
                    </div>
                    {uploading && (
                        <div className="absolute inset-0 w-16 h-16 rounded-full bg-black/40 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>

                {/* 이름 + 이메일 */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{displayName}</h2>
                        <span className="text-sm text-gray-500 flex-shrink-0">{roleLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-400">✉️</span>
                        <span className="text-sm text-gray-500 truncate">{user.email || '이메일 없음'}</span>
                    </div>
                </div>

                {/* 계정 설정 버튼 */}
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 ${showSettings
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                        }`}
                >
                    계정 설정
                </button>
            </div>

            {/* 평점/리뷰 링크 바 (Pro 전용) */}
            {reviewHref && (
                <div className="px-6 pb-4 flex items-center gap-2">
                    <button
                        onClick={() => window.location.href = reviewHref}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-semibold py-2.5 rounded-xl border border-yellow-200 transition text-sm"
                    >
                        <span>⭐</span>
                        <span>{reviewStats.avg.toFixed(1)}</span>
                        <span className="text-yellow-500/70 text-xs">({reviewStats.count}건)</span>
                    </button>
                </div>
            )}

            {/* 계정 설정 패널 (슬라이드 다운) */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showSettings ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-6 space-y-5 border-t border-gray-100 pt-5">
                    {/* 프로필 사진 변경 */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            📷 프로필 사진
                        </label>
                        <div className="flex items-center gap-4">
                            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-2 border-gray-100 shadow-inner">
                                {avatarUrl ? (
                                    <img
                                        src={avatarUrl}
                                        alt="프로필"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading || cooldownRemaining > 0}
                                    className="bg-white hover:bg-gray-50 text-gray-700 font-medium text-sm px-4 py-2.5 rounded-xl border border-gray-200 transition disabled:opacity-50 shadow-sm"
                                >
                                    {uploading
                                        ? '업로드 중...'
                                        : cooldownRemaining > 0
                                            ? `${cooldownRemaining}일 후 변경 가능`
                                            : avatarUrl ? '사진 변경' : '사진 등록'}
                                </button>
                                <span className="text-[11px] text-gray-400">JPG, PNG (최대 5MB)</span>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* 활동명 수정 */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                            ✏️ 히든프로 활동명
                            <span className="text-xs text-gray-400 font-normal">(2~20자, 중복 불가)</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={newNickname}
                                    onChange={(e) => {
                                        setNewNickname(e.target.value);
                                        checkNickname(e.target.value);
                                    }}
                                    placeholder="활동명을 입력하세요"
                                    maxLength={20}
                                    className={`w-full p-3 border rounded-xl focus:outline-none focus:ring-2 transition text-sm ${nicknameStatus === 'taken' || nicknameStatus === 'error'
                                        ? 'border-red-300 focus:ring-red-500 bg-red-50/50'
                                        : nicknameStatus === 'available'
                                            ? 'border-green-300 focus:ring-green-500 bg-green-50/50'
                                            : 'border-gray-200 focus:ring-blue-500'
                                        }`}
                                />
                                {nicknameStatus === 'checking' && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleSaveNickname}
                                disabled={saving || nicknameStatus !== 'available' || nicknameCooldown > 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
                            >
                                {saving
                                    ? '저장 중...'
                                    : nicknameCooldown > 0
                                        ? `${nicknameCooldown}일 후 변경 가능`
                                        : '활동명 저장'}
                            </button>
                        </div>
                        {/* 중복 체크 메시지 */}
                        {nicknameMsg && (
                            <p className={`text-xs font-medium pl-1 ${nicknameStatus === 'taken' || nicknameStatus === 'error'
                                ? 'text-red-500'
                                : nicknameStatus === 'available'
                                    ? 'text-green-600'
                                    : 'text-gray-400'
                                }`}>
                                {nicknameMsg}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────
// 고객 프로필 (기본 정보)
// ─────────────────────────────────────────────
function CustomerProfile({ user }: { user: any }) {
    const { showToast } = useToast();
    const [phoneData, setPhoneData] = useState<{ is_phone_verified: boolean; phone: string } | null>(null);
    const [joinDate, setJoinDate] = useState<string>('');
    const [reviewCount, setReviewCount] = useState<number>(0);
    const [phoneInput, setPhoneInput] = useState('');
    const [verifyingPhone, setVerifyingPhone] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 전화번호 + 가입일
                const { data } = await supabase
                    .from('users')
                    .select('is_phone_verified, phone, created_at')
                    .eq('user_id', user.id)
                    .single();
                if (data) {
                    setPhoneData(data);
                    if (data.created_at) {
                        setJoinDate(new Date(data.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric'
                        }));
                    }
                }

                // 리뷰 수
                const { count } = await supabase
                    .from('reviews')
                    .select('*', { count: 'exact', head: true })
                    .eq('customer_id', user.id)
                    .eq('is_hidden', false);
                if (count !== null) setReviewCount(count);
            } catch (e) {
                console.warn('고객 프로필 데이터 조회 실패 (무시 가능)');
            }
        };
        fetchData();
    }, [user.id]);

    const handlePhoneVerify = async () => {
        if (!phoneInput.trim()) { showToast('휴대폰 번호를 입력해주세요.', 'error'); return; }
        setVerifyingPhone(true);
        try {
            const { mockVerifyCustomerPhone } = await import('@/lib/mockAuth');
            await mockVerifyCustomerPhone(user.id, phoneInput);
            setPhoneData(prev => ({ ...prev!, is_phone_verified: true, phone: phoneInput.replace(/[\s\-]/g, '') }));
            setPhoneInput('');
            showToast('전화번호 인증이 완료되었습니다.', 'success');
        } catch (e: any) {
            showToast('인증 실패: ' + e.message, 'error');
        } finally {
            setVerifyingPhone(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">기본 정보</h2>
            <div className="space-y-3">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-500 font-medium mb-1">이메일 계정</span>
                    <span className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {user.email || '이메일 정보 없음'}
                    </span>
                </div>
                {phoneData?.is_phone_verified && phoneData?.phone ? (
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium mb-1">인증된 전화번호</span>
                        <span className="text-gray-900 font-medium bg-green-50 p-3 rounded-lg border border-green-200 flex items-center gap-2">
                            <span className="text-green-600 text-sm">✅</span>
                            {phoneData.phone}
                        </span>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium mb-1">전화번호 인증</span>
                        <div className="flex gap-2">
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={e => setPhoneInput(e.target.value)}
                                placeholder="예: 09171234567"
                                className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                disabled={verifyingPhone}
                            />
                            <button
                                onClick={handlePhoneVerify}
                                disabled={verifyingPhone || !phoneInput.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50 whitespace-nowrap"
                            >
                                {verifyingPhone ? '인증 중...' : '인증하기'}
                            </button>
                        </div>
                        <span className="text-xs text-gray-400 mt-1">2번째 견적 요청부터 전화번호 인증이 필요합니다.</span>
                    </div>
                )}
                {joinDate && (
                    <div className="flex flex-col">
                        <span className="text-xs text-gray-500 font-medium mb-1">가입일</span>
                        <span className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-center gap-2">
                            <span className="text-gray-400 text-sm">📅</span>
                            {joinDate}
                        </span>
                    </div>
                )}
                <div className="flex flex-col cursor-pointer group" onClick={() => window.location.href = '/customer/my-reviews'}>
                    <span className="text-xs text-gray-500 font-medium mb-1">작성한 리뷰</span>
                    <span className="text-gray-900 font-medium bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex items-center gap-2 group-hover:bg-yellow-100 group-hover:border-yellow-300 transition">
                        <span className="text-yellow-500 text-sm">⭐</span>
                        {reviewCount}건
                        <span className="ml-auto text-gray-400 text-xs group-hover:text-yellow-600 transition">보기 →</span>
                    </span>
                </div>
            </div>
        </div>
    );
}


// ─────────────────────────────────────────────
// 고수 프로필 (전문가 정보 관리)
// ─────────────────────────────────────────────
function ProProfile({ user }: { user: any }) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const [isAcceptingRequests, setIsAcceptingRequests] = useState(true);

    const [formData, setFormData] = useState({
        intro: '',
        detailed_intro: '',
        services: [] as string[],
        region: ''
    });

    // 인증 상태
    const [facebookUrl, setFacebookUrl] = useState('');
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [proPhone, setProPhone] = useState('');
    const [facebookInput, setFacebookInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    const [linkingFb, setLinkingFb] = useState(false);
    const [editingFb, setEditingFb] = useState(false);

    const [selectedDepth1, setSelectedDepth1] = useState<string>('');
    const [selectedDepth2, setSelectedDepth2] = useState<string>('');

    const [selectedReg, setSelectedReg] = useState<string>('');
    const [selectedCity, setSelectedCity] = useState<string>('');

    const [serviceCategories, setServiceCategories] = useState<Record<string, Record<string, string[]>>>({});

    useEffect(() => {
        const loadCategories = async () => {
            const { data } = await supabase.from('categories').select('name, depth1, depth2').eq('is_active', true).order('sort_order', { ascending: true });
            if (data) {
                const tree: Record<string, Record<string, string[]>> = {};
                data.forEach(item => {
                    if (!item.depth1 || !item.depth2) return;
                    if (!tree[item.depth1]) tree[item.depth1] = {};
                    if (!tree[item.depth1][item.depth2]) tree[item.depth1][item.depth2] = [];
                    tree[item.depth1][item.depth2].push(item.name);
                });
                setServiceCategories(tree);
            }
        };
        loadCategories();
    }, []);

    useEffect(() => {
        const fetchProData = async () => {
            try {
                const { data, error } = await supabase
                    .from('pro_profiles')
                    .select('*')
                    .eq('pro_id', user.id)
                    .single();

                if (error) {
                    console.warn('pro_profiles fetch error (무시 가능):', error.message);
                }

                if (data) {
                    let loadedRegion = data.region || '';
                    let reg = '';
                    let city = '';
                    if (loadedRegion.includes(', ')) {
                        [reg, city] = loadedRegion.split(', ');
                    }

                    setFormData({
                        intro: data.intro || '',
                        detailed_intro: data.detailed_intro || '',
                        services: Array.isArray(data.services) ? data.services.slice(0, 5) : [],
                        region: loadedRegion
                    });
                    setSelectedReg(reg);
                    setSelectedCity(city);
                    setIsAcceptingRequests(data.is_accepting_requests ?? true);

                    // 인증 상태 로드 (컬럼이 없으면 기본값 유지)
                    setFacebookUrl(data.facebook_url || '');
                    setIsPhoneVerified(data.is_phone_verified === true);
                    setProPhone(data.phone || '');
                    setFacebookInput(data.facebook_url || '');
                    setPhoneInput(data.phone || '');
                }
            } catch (e) {
                console.error('ProProfile fetch 예외:', e);
            }
            setLoading(false);
        };
        fetchProData();
    }, [user.id]);

    const handleToggleAccepting = async () => {
        const newVal = !isAcceptingRequests;
        setIsAcceptingRequests(newVal);
        const { error } = await supabase
            .from('pro_profiles')
            .update({ is_accepting_requests: newVal })
            .eq('pro_id', user.id);
        if (error) {
            showToast('상태 업데이트에 실패했습니다.', 'error');
            setIsAcceptingRequests(!newVal);
        }
    };

    const handleServiceToggle = (service: string) => {
        setFormData(prev => {
            const isSelected = prev.services.includes(service);
            if (isSelected) {
                return { ...prev, services: prev.services.filter(s => s !== service) };
            } else {
                if (prev.services.length >= 5) {
                    showToast('제공 서비스는 최대 5개까지만 선택할 수 있습니다.', 'error');
                    return prev;
                }
                return { ...prev, services: [...prev.services, service] };
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let finalRegion = '';
        if (selectedReg && selectedCity) {
            finalRegion = `${selectedReg}, ${selectedCity}`;
        } else if (selectedReg) {
            finalRegion = selectedReg;
        }

        if (formData.services.length > 5) {
            showToast('제공 서비스는 최대 5개까지만 선택할 수 있습니다.', 'error');
            return;
        }

        setSaving(true);
        const { error } = await supabase
            .from('pro_profiles')
            .upsert({
                pro_id: user.id,
                intro: formData.intro,
                detailed_intro: formData.detailed_intro,
                region: finalRegion,
                services: formData.services
            }, { onConflict: 'pro_id' });

        setSaving(false);

        if (error) {
            showToast('저장 중 오류가 발생했습니다: ' + error.message, 'error');
        } else {
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500);
            showToast('프로필이 성공적으로 저장되었습니다.', 'success');
        }
    };

    if (loading) return <div className="text-center p-4 text-gray-500">프로필 정보를 불러오는 중입니다...</div>;

    const depth1Keys = Object.keys(serviceCategories);
    const depth2Keys = selectedDepth1 ? Object.keys(serviceCategories[selectedDepth1] || {}) : [];
    const depth3Items = (selectedDepth1 && selectedDepth2) ? serviceCategories[selectedDepth1][selectedDepth2] || [] : [];

    const regionKeys = Object.keys(PHILIPPINES_REGIONS);
    const cityItems = selectedReg ? PHILIPPINES_REGIONS[selectedReg] || [] : [];

    const handleFbLink = async () => {
        if (!facebookInput.trim()) { showToast('URL을 입력해주세요.', 'error'); return; }
        setLinkingFb(true);
        try {
            await mockLinkFacebook(user.id, facebookInput);
            setFacebookUrl(facebookInput);
            // DB 업데이트 성공 시에만 여기 도달
        } catch (e: any) {
            showToast(e.message, 'error');
        }
        setLinkingFb(false);
    };

    const handlePhoneVerify = async () => {
        if (!phoneInput.trim()) { showToast('전화번호를 입력해주세요.', 'error'); return; }
        setVerifyingPhone(true);
        try {
            await mockVerifyProPhone(user.id, phoneInput);
            setIsPhoneVerified(true);
            setProPhone(phoneInput);
            // DB 업데이트 성공 시에만 여기 도달
        } catch (e: any) {
            showToast(e.message, 'error');
        }
        setVerifyingPhone(false);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-4 mb-4">전문가 프로필</h2>

            {/* 매칭 일시 정지 토글 섹션 */}
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        {isAcceptingRequests ? '🔵 새로운 견적 요청 받기 (On)' : '⚪ 새로운 견적 요청 받기 (Off)'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                        일정이 꽉 찼거나, 수면·휴식 등으로 알림을 원하지 않을 때 잠시 꺼두세요. 매칭 알림이 차단되며 요청 리스트가 일시적으로 숨겨집니다.
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isAcceptingRequests}
                        onChange={handleToggleAccepting}
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* 인증 배지 영역 */}
            <div className="flex flex-wrap gap-2 mb-4">
                {isPhoneVerified && (
                    <span className="inline-flex items-center bg-green-50 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200">
                        ✅ Phone Verified
                    </span>
                )}
                {facebookUrl && (
                    <span className="inline-flex items-center bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-200">
                        🔵 Facebook Linked
                    </span>
                )}
                {!isPhoneVerified && !facebookUrl && (
                    <span className="text-xs text-gray-400">아직 인증된 항목이 없습니다.</span>
                )}
            </div>

            {/* 전화번호 인증 섹션 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    📞 전화번호 인증
                    {isPhoneVerified && <span className="text-green-600 text-xs">(인증 완료)</span>}
                </label>
                {isPhoneVerified ? (
                    <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm font-medium border border-green-200">
                        ✅ 인증 완료: {proPhone}
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="tel"
                            value={phoneInput}
                            onChange={e => setPhoneInput(e.target.value)}
                            placeholder="예: 09171234567"
                            className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none transition text-sm"
                        />
                        <button
                            type="button"
                            onClick={handlePhoneVerify}
                            disabled={verifyingPhone}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:bg-green-300"
                        >
                            {verifyingPhone ? '처리 중...' : '인증하기'}
                        </button>
                    </div>
                )}
            </div>

            {/* Facebook 연동 섹션 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4 space-y-3">
                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    🔵 Facebook 연동
                    {facebookUrl && <span className="text-blue-600 text-xs">(연동 완료)</span>}
                </label>
                {facebookUrl && !editingFb ? (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-blue-50 text-blue-700 p-3 rounded-lg text-sm font-medium border border-blue-200 break-all truncate">
                            🔵 {facebookUrl}
                        </div>
                        <button
                            type="button"
                            onClick={() => setEditingFb(true)}
                            className="flex-shrink-0 text-xs font-bold text-blue-600 hover:text-blue-800 bg-white px-3 py-2 rounded-lg border border-blue-200 hover:bg-blue-50 transition"
                        >
                            수정
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={facebookInput}
                            onChange={e => setFacebookInput(e.target.value)}
                            placeholder="https://facebook.com/yourname"
                            className="flex-1 p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition text-sm"
                        />
                        <button
                            type="button"
                            onClick={async () => {
                                await handleFbLink();
                                setEditingFb(false);
                            }}
                            disabled={linkingFb}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-3 rounded-xl transition text-sm whitespace-nowrap disabled:bg-blue-300"
                        >
                            {linkingFb ? '처리 중...' : '연동하기'}
                        </button>
                        {facebookUrl && (
                            <button
                                type="button"
                                onClick={() => {
                                    setFacebookInput(facebookUrl);
                                    setEditingFb(false);
                                }}
                                className="text-gray-400 hover:text-gray-600 font-bold px-2 transition text-sm"
                            >
                                취소
                            </button>
                        )}
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col space-y-2">
                    <label className="text-sm font-bold text-gray-700">한 줄 소개 <span className="text-xs text-gray-400 font-normal ml-1">(50자 이내)</span></label>
                    <input
                        type="text"
                        value={formData.intro}
                        onChange={e => setFormData({ ...formData, intro: e.target.value })}
                        maxLength={50}
                        placeholder="고객을 사로잡을 한 줄 소개를 입력하세요."
                        className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        required
                    />
                    <span className="text-xs text-gray-400 text-right">{formData.intro.length}/50</span>
                </div>

                <div className="flex flex-col space-y-2">
                    <label className="text-sm font-bold text-gray-700">상세 소개 <span className="text-xs text-gray-400 font-normal ml-1">(영업시간, 서비스 상세 등)</span></label>
                    <textarea
                        value={formData.detailed_intro}
                        onChange={e => setFormData({ ...formData, detailed_intro: e.target.value })}
                        rows={5}
                        placeholder="영업시간, 제공 서비스 상세, 경력 등을 자유롭게 작성해주세요."
                        className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none text-sm"
                    />
                </div>

                <div className="flex flex-col space-y-3">
                    <label className="text-sm font-bold text-gray-700">활동 지역 (필리핀)</label>
                    <div className="grid grid-cols-2 gap-3">
                        <select
                            value={selectedReg}
                            onChange={(e) => {
                                setSelectedReg(e.target.value);
                                setSelectedCity('');
                            }}
                            className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-white"
                            required
                        >
                            <option value="" disabled>Region 선택</option>
                            {regionKeys.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition bg-white disabled:bg-gray-100 disabled:text-gray-400"
                            required
                            disabled={!selectedReg}
                        >
                            <option value="" disabled>City 선택</option>
                            {cityItems.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col space-y-3 border-t pt-4 border-gray-100">
                    <div className="flex justify-between items-end">
                        <label className="text-sm font-bold text-gray-700">제공 서비스 (최대 5개)</label>
                        <span className="text-xs font-bold text-blue-600">{formData.services.length} / 5</span>
                    </div>

                    {/* 카테고리 뎁스 브라우저 */}
                    <div className="grid grid-cols-2 gap-3 mb-2">
                        <select
                            value={selectedDepth1}
                            onChange={(e) => {
                                setSelectedDepth1(e.target.value);
                                setSelectedDepth2('');
                            }}
                            className="p-2 border border-gray-200 rounded-lg text-sm bg-gray-50"
                        >
                            <option value="">1뎁스 분류</option>
                            {depth1Keys.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                        <select
                            value={selectedDepth2}
                            onChange={(e) => setSelectedDepth2(e.target.value)}
                            className="p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 disabled:opacity-50"
                            disabled={!selectedDepth1}
                        >
                            <option value="">2뎁스 분류</option>
                            {depth2Keys.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>

                    {/* 3뎁스 선택 영역 */}
                    {depth3Items.length > 0 ? (
                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-48 overflow-y-auto flex flex-col space-y-2">
                            {depth3Items.map(service => {
                                const isSelected = formData.services.includes(service);
                                return (
                                    <label key={service} className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg cursor-pointer transition">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleServiceToggle(service)}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <span className={`text-sm ${isSelected ? 'font-bold text-blue-700' : 'text-gray-700'}`}>
                                            {service}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-400">
                            상위 카테고리를 먼저 선택해주세요.
                        </div>
                    )}

                    {/* 선택된 서비스 태그 표시 */}
                    {formData.services.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 p-3 border border-blue-100 bg-blue-50/50 rounded-xl">
                            {formData.services.map(s => (
                                <span key={s} className="inline-flex items-center bg-white border border-blue-200 text-blue-700 text-xs px-2 py-1.5 rounded-md shadow-sm">
                                    {s}
                                    <button
                                        type="button"
                                        onClick={() => handleServiceToggle(s)}
                                        className="ml-1.5 text-blue-400 hover:text-red-500 font-bold px-1"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className={`w-full font-bold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] transition mt-4 text-white ${isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
                        }`}
                >
                    {saving ? '저장 중...' : isSaved ? '✅ 저장 완료' : '저장하기'}
                </button>
            </form>
        </div>
    );
}

// ─────────────────────────────────────────────
// 고객 지원 (Customer Support)
// ─────────────────────────────────────────────
function CustomerSupportSection() {
    const [categories, setCategories] = useState<any[]>([]);
    const [pages, setPages] = useState<any[]>([]);
    const [expandedCatId, setExpandedCatId] = useState<number | null>(null);

    useEffect(() => {
        const fetchCms = async () => {
            const { data: cats } = await supabase.from('support_categories').select('*').order('sort_order', { ascending: true });
            if (cats) setCategories(cats);

            const { data: pgs } = await supabase.from('support_pages').select('*').eq('is_active', true).order('sort_order', { ascending: true });
            if (pgs) setPages(pgs);
        };
        fetchCms();
    }, []);

    const toggleCat = (id: number) => {
        setExpandedCatId(prev => prev === id ? null : id);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <h2 className="text-lg font-bold text-gray-800 p-6 pb-2 border-b border-gray-100">고객 지원</h2>
            <ul className="flex flex-col">
                <li className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition cursor-pointer">
                    <Link href="/support/inquiry" className="w-full flex justify-between items-center p-4">
                        <span className="text-sm font-bold text-blue-600 flex items-center gap-2">
                            <span className="text-lg">💬</span> 1:1 문의하기
                        </span>
                        <span className="text-blue-400 text-xs text-right">내역 확인 &rarr;</span>
                    </Link>
                </li>
                {categories.map(cat => {
                    const catPages = pages.filter(p => p.category_id === cat.id);
                    const isExpanded = expandedCatId === cat.id;
                    return (
                        <li key={cat.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                            <button
                                type="button"
                                onClick={() => toggleCat(cat.id)}
                                className="w-full flex justify-between items-center p-4 transition text-left cursor-pointer"
                            >
                                <span className="text-sm font-medium text-gray-700">{cat.title}</span>
                                <span className="text-gray-400 text-xs transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▼</span>
                            </button>
                            {isExpanded && (
                                <ul className="bg-gray-50 flex flex-col pt-1 pb-3 px-4 shadow-inner">
                                    {catPages.length === 0 ? (
                                        <li className="text-xs text-gray-400 py-2 pl-2">등록된 문서가 없습니다.</li>
                                    ) : (
                                        catPages.map(page => (
                                            <li key={page.id} className="py-1">
                                                <Link href={`/support/${cat.slug}/${page.slug}`} className="flex items-center text-sm text-gray-600 hover:text-blue-600 hover:font-bold transition pl-2 py-2 border-l-2 border-transparent hover:border-blue-600">
                                                    📄 {page.title}
                                                </Link>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
