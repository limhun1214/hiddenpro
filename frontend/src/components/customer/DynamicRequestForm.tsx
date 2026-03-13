'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { checkCustomerPhoneVerified, mockVerifyCustomerPhone } from '@/lib/mockAuth';
import { PHILIPPINES_REGIONS } from '@/lib/constants';

// --- Schema Definitions ---
const BASE_STEPS = [
    { id: 'depth1', type: 'SINGLE_CHOICE', text: '어떤 분야의 전문가를 찾으시나요?' },
    { id: 'depth2', type: 'SINGLE_CHOICE', text: '어떤 서비스가 필요하신가요?' },
    { id: 'service_type', type: 'SINGLE_CHOICE', text: '상세 서비스를 선택해주세요.' },
    { id: 'region_reg', type: 'SINGLE_CHOICE', text: '서비스를 받으실 지역(Region)을 선택해주세요.' },
    { id: 'region_city', type: 'SINGLE_CHOICE', text: '상세 도시(City)를 선택해주세요.' }
];

const MOVING_STEPS = [
    { id: 'move_type', type: 'SINGLE_CHOICE', text: '어떤 이사 서비스를 원하시나요?', options: ['포장 (고수가 전부 포장 및 정리/귀중품 제외)', '반포장 (고수와 함께 포장/고수는 큰 짐 배치만)', '일반 (고객이 전부 포장 및 정리/고수는 짐 운반만)', '보관 (이삿짐 보관 후 입주일에 맞춰 운반)', '기타'] },
    { id: 'move_date', type: 'DATE_PICKER', text: '이사 날짜를 달력에서 선택해주세요.' },
    { id: 'from_region', type: 'REGION_N_CITY', text: '출발 지역과 도시를 선택해주세요.' },
    { id: 'from_floor', type: 'TEXT_INPUT', text: '출발지 층수를 입력해주세요. (단독주택, 5층 등)' },
    { id: 'from_size', type: 'TEXT_INPUT', text: '출발지 면적(sqm/방 개수)과 거주 인원을 적어주세요. (예: 30sqm, 2명)' },
    { id: 'from_elevator', type: 'SINGLE_CHOICE', text: '출발지 현장 상황을 선택해주세요.', options: ['엘리베이터 사용', '계단 사용', '사다리차 사용', '상담 후 결정'], skippable: true },
    { id: 'appliances', type: 'MULTI_CHOICE', text: '옮길 가전 제품을 선택해주세요.', options: ['없음', '냉장고', '김치냉장고', '에어컨', 'TV,모니터', 'PC,노트북', '전자레인지', '정수기', '비데', '기타'], skippable: true },
    { id: 'furniture', type: 'MULTI_CHOICE', text: '옮길 가구를 선택해주세요.', options: ['없음', '침대', '소파', '의자', '수납장', '책장', '진열장', '옷장', '화장대', '피아노', '기타'], skippable: true },
    { id: 'images', type: 'IMAGE_UPLOAD_MULTI', text: '이삿짐 사진을 첨부해주세요. (최대 5장)', skippable: true },
    { id: 'to_region', type: 'REGION_N_CITY', text: '도착 지역과 도시를 선택해주세요.' },
    { id: 'to_floor', type: 'TEXT_INPUT', text: '도착지 층수를 입력해주세요. (예: 2층)' },
    { id: 'to_elevator', type: 'SINGLE_CHOICE', text: '도착지 현장 상황을 선택해주세요.', options: ['엘리베이터 사용', '계단 사용', '사다리차 사용', '상담 후 결정'], skippable: true },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '추가 요청사항을 상세히 적어주세요.', skippable: true }
];

const DEFAULT_DETAILS_STEP = { id: 'details', type: 'TEXT_INPUT', text: '고수님께 전달할 특이사항을 적어주세요.', skippable: true };

import { optimizeImage } from '@/utils/imageOptimizer';

function uploadImageToStorage(originalFile: File) {
    return new Promise<string>(async (resolve, reject) => {
        try {
            const file = await optimizeImage(originalFile, 1200, 1200, 0.8);
            const fileExt = file.name.split('.').pop() || 'webp';
            const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
            const filePath = `requests/${fileName}`;
            const { error } = await supabase.storage.from('quote_images').upload(filePath, file);
            if (error) { reject(error); return; }
            const { data } = supabase.storage.from('quote_images').getPublicUrl(filePath);
            resolve(data.publicUrl);
        } catch (e) {
            reject(e);
        }
    });
}

export default function DynamicRequestForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [history, setHistory] = useState<{ stepText: string, userAnswer: any }[]>([]);
    const [serviceCategories, setServiceCategories] = useState<Record<string, Record<string, string[]>>>({});

    // Active schema steps logic
    const [activeSteps, setActiveSteps] = useState<any[]>([...BASE_STEPS, DEFAULT_DETAILS_STEP]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const isFinished = currentIndex >= activeSteps.length;
    const currentQuestion = activeSteps[currentIndex];

    // Sub-states for specific input types
    const [tempText, setTempText] = useState('');
    const [tempDate, setTempDate] = useState('');
    const [multiSelection, setMultiSelection] = useState<string[]>([]);
    const [regionReg, setRegionReg] = useState('');
    const [regionCity, setRegionCity] = useState('');
    const [otherText, setOtherText] = useState('');
    const [selectedSingle, setSelectedSingle] = useState('');

    // Image upload states
    const [uploadingImages, setUploadingImages] = useState(false);
    const [imagesState, setImagesState] = useState<{ url: string, description: string }[]>([]);

    // Phone Verification
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [phoneInput, setPhoneInput] = useState('');
    const [verifyingPhone, setVerifyingPhone] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const timer = setTimeout(() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }, 50);
            return () => clearTimeout(timer);
        }
    }, []);

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
        if (currentIndex > 0 && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, currentIndex]);

    // Update active steps when region_city is answered (End of BASE_STEPS context)
    useEffect(() => {
        if (answers.service_type && currentIndex === 5) {
            const targetKeywords = ['이사', '운송', '차량'];
            const isMovingService = targetKeywords.some(keyword => answers.service_type.includes(keyword));

            if (isMovingService) {
                setActiveSteps([...BASE_STEPS, ...MOVING_STEPS]);
            } else {
                setActiveSteps([...BASE_STEPS, DEFAULT_DETAILS_STEP]);
            }
        }
    }, [answers.service_type, currentIndex]);

    const getOptionsForCurrentStep = () => {
        if (!currentQuestion) return [];
        switch (currentQuestion.id) {
            case 'depth1': return Object.keys(serviceCategories);
            case 'depth2': return Object.keys(serviceCategories[answers.depth1] || {});
            case 'service_type': return serviceCategories[answers.depth1]?.[answers.depth2] || [];
            case 'region_reg': return Object.keys(PHILIPPINES_REGIONS);
            case 'region_city': return PHILIPPINES_REGIONS[answers.region_reg] || [];
            default: return currentQuestion.options || [];
        }
    };

    const commitAnswer = (answerValue: any, displayValue: string) => {
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: answerValue }));
        setHistory(prev => [...prev, { stepText: currentQuestion.text, userAnswer: displayValue }]);

        setCurrentIndex(prev => prev + 1);

        // Reset temp states
        setTempText(''); setTempDate(''); setMultiSelection([]); setRegionReg(''); setRegionCity(''); setImagesState([]); setOtherText(''); setSelectedSingle('');
    };

    const isAutoAdvanced = useRef(false);
    const isDepth2AutoAdvanced = useRef(false);
    const isDepth2ForServiceTypeAutoAdvanced = useRef(false);
    const isServiceTypeAutoAdvanced = useRef(false);

    // depth1 자동 진행 (기존 — 변경 없음)
    useEffect(() => {
        const categoryId = searchParams?.get('categoryId');
        if (categoryId && currentIndex === 0 && currentQuestion?.id === 'depth1' && !isAutoAdvanced.current) {
            const keys = Object.keys(serviceCategories);
            if (keys.length > 0 && keys.includes(categoryId)) {
                isAutoAdvanced.current = true;
                commitAnswer(categoryId, categoryId);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories]);

    // depth2 자동 진행: serviceId가 depth2에 매칭될 때 (추천 5개 항목용 — 변경 없음)
    useEffect(() => {
        const serviceId = searchParams?.get('serviceId');
        const categoryId = searchParams?.get('categoryId');
        if (serviceId && categoryId && currentIndex === 1 && currentQuestion?.id === 'depth2' && !isDepth2AutoAdvanced.current) {
            const depth2Keys = Object.keys(serviceCategories[categoryId] || {});
            if (depth2Keys.length > 0 && depth2Keys.includes(serviceId)) {
                isDepth2AutoAdvanced.current = true;
                commitAnswer(serviceId, serviceId);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories]);

    // depth2 자동 진행: serviceType(3뎁스)이 있을 때 depth2 파라미터로 진행 (전체 서비스용 — 신규)
    useEffect(() => {
        const depth2Param = searchParams?.get('depth2');
        const serviceType = searchParams?.get('serviceType');
        const categoryId = searchParams?.get('categoryId');
        if (depth2Param && serviceType && categoryId && currentIndex === 1 && currentQuestion?.id === 'depth2' && !isDepth2ForServiceTypeAutoAdvanced.current) {
            const depth2Keys = Object.keys(serviceCategories[categoryId] || {});
            if (depth2Keys.length > 0 && depth2Keys.includes(depth2Param)) {
                isDepth2ForServiceTypeAutoAdvanced.current = true;
                commitAnswer(depth2Param, depth2Param);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories]);

    // service_type(3뎁스) 자동 진행: depth2 완료 후 serviceType 파라미터로 진행 (전체 서비스용 — 신규)
    useEffect(() => {
        const serviceType = searchParams?.get('serviceType');
        const categoryId = searchParams?.get('categoryId');
        const depth2Param = searchParams?.get('depth2');
        if (serviceType && depth2Param && categoryId && currentIndex === 2 && currentQuestion?.id === 'service_type' && !isServiceTypeAutoAdvanced.current) {
            const serviceTypes = serviceCategories[categoryId]?.[depth2Param] || [];
            if (serviceTypes.length > 0 && serviceTypes.includes(serviceType)) {
                isServiceTypeAutoAdvanced.current = true;
                commitAnswer(serviceType, serviceType);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories]);

    const handleEdit = (index: number) => {
        setHistory(prev => prev.slice(0, index));
        setCurrentIndex(index);
    };

    const handleSkip = () => {
        if (!currentQuestion.skippable) return;
        const skipValue = currentQuestion.id === 'details' ? '상담 시 논의할게요' : '미입력 (건너뜀)';
        commitAnswer(skipValue, skipValue);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        if (imagesState.length + newFiles.length > 5) {
            alert('사진은 최대 5장까지만 업로드할 수 있습니다.');
            return;
        }

        setUploadingImages(true);
        try {
            const uploadedUrls = await Promise.all(newFiles.map(uploadImageToStorage));
            setImagesState(prev => [...prev, ...uploadedUrls.map(url => ({ url, description: '' }))]);
        } catch (error) {
            alert('이미지 업로드에 실패했습니다.');
        } finally {
            setUploadingImages(false);
            e.target.value = ''; // Reset input
        }
    };

    const removeImage = (index: number) => {
        setImagesState(prev => prev.filter((_, i) => i !== index));
    };

    const updateImageDesc = (index: number, text: string) => {
        if (text.length > 100) return;
        setImagesState(prev => {
            const next = [...prev];
            next[index].description = text;
            return next;
        });
    };

    const submitAction = async () => {
        if (isSubmitting) return; // 중복 제출 차단
        setIsSubmitting(true);

        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const sessionUser = authData?.user;

            if (authError || !sessionUser) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('pendingRequestData', JSON.stringify(answers));
                    localStorage.setItem('pending_show_login', '1');
                }
                router.replace('/');
                return;
            }

            // [role 체크] pro 계정은 견적 요청 불가
            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('user_id', sessionUser.id)
                .single();

            if (!userData || userData.role?.toUpperCase() === 'PRO') {
                showToast('고수 계정으로는 견적 요청을 할 수 없습니다.', 'error');
                setTimeout(() => { router.replace('/'); }, 1500);
                return;
            }

            const isVerified = await checkCustomerPhoneVerified(sessionUser.id);
            if (!isVerified) {
                // 첫 번째 견적 여부 확인 (match_requests에 기존 견적이 없으면 첫 번째)
                const { count } = await supabase
                    .from('match_requests')
                    .select('request_id', { count: 'exact', head: true })
                    .eq('customer_id', sessionUser.id);

                if (count === 0) {
                    // 첫 번째 견적: 인증 없이 바로 등록
                    await doActualSubmit();
                    return;
                }
                // 두 번째 이상: 전화번호 인증 모달 표시
                setShowPhoneModal(true);
                return;
            }
            await doActualSubmit();
        } catch (e: any) { alert("오류 발생: " + e.message); } finally {
            setIsSubmitting(false); // 성공/실패 무관하게 항상 해제
        }
    };

    const handlePhoneVerifyAndSubmit = async () => {
        if (!phoneInput.trim()) { alert('휴대폰 번호를 입력해주세요.'); return; }
        setVerifyingPhone(true);
        try {
            const { data: authData } = await supabase.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) throw new Error('로그인이 필요합니다.');
            await mockVerifyCustomerPhone(userId, phoneInput);
            setShowPhoneModal(false);
            setVerifyingPhone(false);
            await doActualSubmit();
        } catch (e: any) { alert('인증 실패: ' + e.message); }
        setVerifyingPhone(false);
    };

    const doActualSubmit = async () => {
        try {
            const { data: authData } = await supabase.auth.getUser();
            const customerId = authData?.user?.id;
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const finalRegion = `${answers.region_reg}, ${answers.region_city}`;

            let realCategoryId = null;
            if (answers.service_type) {
                const { data: catData } = await supabase.from('categories').select('id').eq('name', answers.service_type).single();
                if (catData) realCategoryId = catData.id;
            }

            const { data: requestData, error } = await supabase.from('match_requests').insert({
                customer_id: customerId,
                category_id: realCategoryId,
                region_id: 1,
                service_type: answers.service_type,
                region: finalRegion,
                dynamic_answers: answers,
                status: 'OPEN',
                expires_at: expiresAt
            }).select('request_id').single();

            if (error) throw error;

            // 1. 대분류 지역 추출 및 요청 서비스
            const mainRegion = finalRegion.split(',')[0].trim();
            const requestedService = answers.service_type;

            // 2. DB 페칭: 괄호 등 특수문자로 인한 Supabase 파싱 에러를 피하기 위해 프로필 안전 조회
            const { data: prosData } = await supabase
                .from('pro_profiles')
                .select('pro_id, services, region')
                .eq('is_accepting_requests', true);

            if (prosData && prosData.length > 0) {
                // 3. JS 정밀 타격 필터링: 양방향 지역(전체) 교차 검증 + 서비스 검증
                const matchedPros = prosData.filter(pro => {
                    const proServices = pro.services || [];
                    const proRegion = pro.region || '';

                    // 프로필 완성도 가드: 서비스 또는 지역 미설정 깡통 프로필 제외
                    if (proServices.length === 0 || proRegion.trim() === '') return false;

                    const isProNationwide = proRegion.includes('전체');
                    const isCustomerNationwide = mainRegion.includes('전체');

                    // 고수가 전국구이거나, 고객이 전국구를 원하거나, 지역이 일치할 경우 완벽 매칭
                    const matchesRegion = isProNationwide || isCustomerNationwide || proRegion.includes(mainRegion);
                    const matchesService = proServices.includes(requestedService);

                    return matchesRegion && matchesService;
                });

                // 4. 검증된 타겟 고수에게만 알림 발송
                if (matchedPros.length > 0) {
                    const notificationsToInsert = matchedPros.map(pro => ({
                        user_id: pro.pro_id,
                        type: 'MATCH',
                        message: `[${requestedService}] 새로운 서비스 요청이 도착했습니다. 견적을 보내보세요!`,
                        reference_id: requestData.request_id,
                        is_read: false
                    }));
                    await supabase.from('notifications').insert(notificationsToInsert);
                }
            }

            showToast('성공적으로 견적을 요청했습니다! 고수들의 견적을 기다려주세요.', 'success');
            router.push('/quotes/received');
        } catch (e: any) { alert("오류 발생: " + e.message); }
    };

    const options = getOptionsForCurrentStep();

    return (
        <div className="flex flex-col w-full min-h-screen bg-[#F4F5F7] lg:overflow-y-auto relative">

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-3 bg-white shadow-sm z-50">
                <button onClick={() => router.push('/')} className="text-gray-500 hover:text-gray-800 p-1">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <div className="flex flex-col items-center">
                    <h1 className="text-[16px] font-bold text-gray-800">새로운 견적 요청</h1>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mt-0.5">HiddenPro</span>
                </div>
                <div className="w-8"></div>
            </div>

            {/* Chat History Flow */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32 scroll-smooth">
                {history.map((h, i) => (
                    <div key={i} className="space-y-4">
                        <div className="flex justify-start">
                            <div className="flex flex-col gap-1 max-w-[85%]">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                        <span className="text-blue-600 text-xs font-bold">Q</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500">Hidden AI</span>
                                </div>
                                <div className="bg-white border border-gray-100 text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm text-sm">
                                    {h.stepText}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end flex-col items-end w-full">
                            <div className="bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[80%] text-sm break-keep break-words">
                                {h.userAnswer}
                            </div>
                            <button onClick={() => handleEdit(i)} className="text-[10px] text-gray-400 mt-1 hover:text-blue-500 underline text-right">수정하기</button>
                        </div>
                    </div>
                ))}

                {/* Active Question */}
                {!isFinished && currentQuestion && (
                    <div className="flex justify-start animate-fade-in-up">
                        <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                    <span className="text-blue-600 text-xs font-bold">Q</span>
                                </div>
                                <span className="text-xs font-bold text-gray-500">Hidden AI</span>
                            </div>
                            <div className="bg-white border border-gray-100 text-gray-800 p-4 rounded-2xl rounded-tl-none shadow-sm text-sm w-full">
                                <p className="mb-4 font-medium text-[15px]">{currentQuestion.text}</p>

                                {/* 1. SINGLE_CHOICE */}
                                {currentQuestion.type === 'SINGLE_CHOICE' && (
                                    <div className="flex flex-col gap-2">
                                        {options.map((opt: string) => (
                                            <div key={opt} className="w-full">
                                                <button
                                                    onClick={() => {
                                                        if (opt === '기타') {
                                                            setSelectedSingle('기타');
                                                        } else {
                                                            commitAnswer(opt, opt);
                                                        }
                                                    }}
                                                    className={`w-full py-3 px-4 rounded-xl border font-medium transition whitespace-normal text-left ${selectedSingle === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                                                >
                                                    {opt}
                                                </button>

                                                {opt === '기타' && selectedSingle === '기타' && (
                                                    <div className="mt-2 animate-fade-in-up flex flex-col gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                                        <textarea
                                                            value={otherText}
                                                            onChange={e => setOtherText(e.target.value)}
                                                            placeholder="원하시는 이사/운송 형태를 상세히 적어주세요."
                                                            className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]"
                                                            maxLength={255}
                                                        />
                                                        <div className="text-right text-[10px] text-gray-400">{otherText.length} / 255자</div>
                                                        <button
                                                            onClick={() => {
                                                                if (otherText.trim()) {
                                                                    commitAnswer(`기타(${otherText})`, `기타(${otherText})`);
                                                                }
                                                            }}
                                                            disabled={!otherText.trim()}
                                                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                                        >
                                                            선택 완료
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 2. DATE_PICKER */}
                                {currentQuestion.type === 'DATE_PICKER' && (() => {
                                    const todayPHT = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
                                    return (
                                        <div className="flex flex-col gap-3">
                                            <input
                                                type="date"
                                                value={tempDate}
                                                onChange={e => setTempDate(e.target.value)}
                                                min={todayPHT}
                                                className="border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 w-full"
                                            />
                                            <button
                                                onClick={() => tempDate && commitAnswer(tempDate, tempDate)}
                                                disabled={!tempDate}
                                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                            >
                                                다음
                                            </button>
                                        </div>
                                    );
                                })()}

                                {/* 3. TEXT_INPUT & TEXTAREA_INPUT */}
                                {(currentQuestion.type === 'TEXT_INPUT' || currentQuestion.type === 'TEXTAREA_INPUT') && (
                                    <div className="flex flex-col gap-3">
                                        {currentQuestion.type === 'TEXT_INPUT' ? (
                                            <input
                                                type="text"
                                                value={tempText}
                                                onChange={e => setTempText(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && tempText && commitAnswer(tempText, tempText)}
                                                className="border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 w-full"
                                                placeholder="입력해주세요"
                                            />
                                        ) : (
                                            <textarea
                                                value={tempText}
                                                onChange={e => setTempText(e.target.value)}
                                                className="border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 w-full min-h-[100px]"
                                                placeholder="상세 내용을 적어주세요..."
                                            />
                                        )}
                                        <div className="flex gap-2">
                                            {currentQuestion.skippable && (
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">상담 시 논의할게요</button>
                                            )}
                                            <button
                                                onClick={() => tempText && commitAnswer(tempText, tempText)}
                                                disabled={!tempText}
                                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                            >
                                                다음
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 4. REGION_N_CITY */}
                                {currentQuestion.type === 'REGION_N_CITY' && (
                                    <div className="flex flex-col gap-3">
                                        <select
                                            value={regionReg}
                                            onChange={e => { setRegionReg(e.target.value); setRegionCity(''); }}
                                            className="border border-gray-300 p-3 rounded-xl"
                                        >
                                            <option value="">Region 선택</option>
                                            {Object.keys(PHILIPPINES_REGIONS).map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <select
                                            value={regionCity}
                                            onChange={e => setRegionCity(e.target.value)}
                                            disabled={!regionReg}
                                            className="border border-gray-300 p-3 rounded-xl disabled:opacity-50"
                                        >
                                            <option value="">City 선택</option>
                                            {regionReg && PHILIPPINES_REGIONS[regionReg as keyof typeof PHILIPPINES_REGIONS].map((c: string) => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <button
                                            onClick={() => regionReg && regionCity && commitAnswer({ reg: regionReg, city: regionCity }, `${regionReg}, ${regionCity}`)}
                                            disabled={!regionReg || !regionCity}
                                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                        >
                                            다음
                                        </button>
                                    </div>
                                )}

                                {/* 5. MULTI_CHOICE */}
                                {currentQuestion.type === 'MULTI_CHOICE' && (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex flex-wrap gap-2">
                                            {options.map((opt: string) => {
                                                const isSel = multiSelection.includes(opt);
                                                return (
                                                    <button
                                                        key={opt}
                                                        onClick={() => {
                                                            if (opt === '없음') {
                                                                setMultiSelection(['없음']);
                                                            } else {
                                                                setMultiSelection(prev => {
                                                                    const noNone = prev.filter(p => p !== '없음');
                                                                    if (noNone.includes(opt)) return noNone.filter(p => p !== opt);
                                                                    return [...noNone, opt];
                                                                });
                                                            }
                                                        }}
                                                        className={`py-2 px-4 rounded-full border text-sm font-medium transition ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {multiSelection.includes('기타') && (
                                            <div className="mt-2 animate-fade-in-up">
                                                <textarea
                                                    value={otherText}
                                                    onChange={e => setOtherText(e.target.value)}
                                                    placeholder="어떤 짐인지 상세히 적어주세요. (예: 안마의자 1개)"
                                                    className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm min-h-[80px]"
                                                    maxLength={255}
                                                />
                                                <div className="text-right text-[10px] text-gray-400 mt-1">{otherText.length} / 255자</div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                            {currentQuestion.skippable && (
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">건너뛰기</button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (multiSelection.length > 0) {
                                                        const finalSelection = multiSelection.map(item => item === '기타' && otherText.trim() ? `기타(${otherText})` : item);
                                                        commitAnswer(finalSelection, finalSelection.join(', '));
                                                        setOtherText(''); // 초기화
                                                    }
                                                }}
                                                disabled={multiSelection.length === 0}
                                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                            >
                                                선택 완료
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 6. IMAGE_UPLOAD_MULTI */}
                                {currentQuestion.type === 'IMAGE_UPLOAD_MULTI' && (
                                    <div className="flex flex-col gap-4">
                                        {imagesState.map((img, idx) => (
                                            <div key={idx} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-3 relative">
                                                <div className="flex gap-3 items-center">
                                                    <img src={img.url} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="사진을 설명해주세요. (선택)"
                                                            value={img.description}
                                                            onChange={e => updateImageDesc(idx, e.target.value)}
                                                            className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:border-blue-500"
                                                        />
                                                        <span className="text-[10px] text-gray-400 mt-1 block px-1">{img.description.length}/100</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => removeImage(idx)} className="absolute top-2 right-2 p-1 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}

                                        {imagesState.length < 5 && (
                                            <div className="relative border-2 border-dashed border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 transition flex flex-col items-center justify-center p-6 cursor-pointer">
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept="image/*"
                                                    onChange={handleImageUpload}
                                                    disabled={uploadingImages}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                                                />
                                                {uploadingImages ? (
                                                    <div className="flex items-center gap-2 text-blue-600 font-bold">
                                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                        업로드 중...
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-blue-700">
                                                        <svg className="w-8 h-8 mx-auto mb-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        <span className="font-bold text-sm">사진 첨부하기 ({imagesState.length}/5)</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {currentQuestion.skippable && (
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">건너뛰기</button>
                                            )}
                                            <button
                                                onClick={() => commitAnswer(imagesState, imagesState.length > 0 ? `사진 ${imagesState.length}장 첨부됨` : '(건너뜀)')}
                                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
                                            >
                                                다음
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 7. DETAILS_CHOICE */}
                                {currentQuestion.type === 'DETAILS_CHOICE' && (
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => commitAnswer('지금 작성할게요', '💬 지금 작성할게요')} className="bg-blue-50 text-blue-700 py-3 px-4 rounded-xl border border-blue-200 font-medium text-left">
                                            💬 지금 작성할게요
                                        </button>
                                        <button onClick={() => commitAnswer('고수와 상담 시 논의할게요', '🤝 상담 시 논의할게요')} className="bg-gray-50 text-gray-700 py-3 px-4 rounded-xl border border-gray-200 font-medium text-left">
                                            🤝 고수와 상담 시 논의할게요
                                        </button>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                )}

                {isFinished && (
                    <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-green-100 animate-fade-in-up">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-gray-800">모든 답변이 완료되었습니다!</h2>
                            <p className="text-sm text-gray-500 mt-2">이제 최적의 고수님들과 매칭을 시작합니다.</p>
                        </div>
                        <button
                            onClick={submitAction}
                            disabled={isSubmitting}
                            className={`w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg mt-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? '요청 전송 중...' : '견적 요청 완료하기 (무료)'}
                        </button>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Phone Overlay */}
            {showPhoneModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col gap-4">
                        <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
                            <span className="text-2xl">📱</span>
                        </div>
                        <h2 className="text-xl font-bold text-center text-gray-800">본인 인증이 필요해요</h2>
                        <p className="text-sm text-gray-500 text-center leading-relaxed">
                            안전한 견적 발송을 위해<br />최초 1회 연락처 인증이 필요합니다.
                        </p>
                        <input
                            type="tel"
                            value={phoneInput}
                            onChange={e => setPhoneInput(e.target.value)}
                            placeholder="예: 09171234567"
                            className="p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition text-center text-lg font-medium tracking-wider mt-2"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowPhoneModal(false)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition text-sm"
                            >
                                나중에 하기
                            </button>
                            <button
                                onClick={handlePhoneVerifyAndSubmit}
                                disabled={verifyingPhone}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg transition text-sm disabled:opacity-50"
                            >
                                {verifyingPhone ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        인증 중...
                                    </span>
                                ) : '인증하고 견적 받기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
