'use client';

import React from 'react';

interface QuoteDetailModalProps {
    quote: {
        quote_id: string;
        pro_id: string;
        price?: number | null;
        description?: string | null;
        image_url?: string | null;
        created_at: string;
        pro_profiles?: {
            pro_id: string;
            average_rating?: number;
            review_count?: number;
            is_phone_verified?: boolean;
            facebook_url?: string;
        };
    };
    onClose: () => void;
    onStartChat: (quote: any) => void;
    requestId: string;
    request?: any;
    isReadOnly?: boolean;
    proName?: string;
}

export default function QuoteDetailModal({ quote, onClose, onStartChat, requestId, request, isReadOnly, proName }: QuoteDetailModalProps) {
    const proProfile = Array.isArray(quote.pro_profiles) ? quote.pro_profiles[0] : quote.pro_profiles;
    const userInfo = proProfile?.users
        ? (Array.isArray(proProfile.users) ? proProfile.users[0] : proProfile.users)
        : null;
    const displayProName = proName || ((userInfo?.nickname && userInfo.nickname.trim() !== '') ? userInfo.nickname : (userInfo?.name || '전문가'));
    const avatarUrl = userInfo?.avatar_url || null;
    const avgRating = proProfile?.average_rating || 0;
    const reviewCount = proProfile?.review_count || 0;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-50 p-4" onClick={onClose}>
            <div className="flex-1 flex items-center justify-center">
                <div
                    className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden relative"
                    onClick={e => e.stopPropagation()}
                >
                    {/* 헤더 */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <h2 className="text-lg font-bold text-gray-800">견적 상세</h2>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition text-gray-500"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 스크롤 가능 본문 */}
                    <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
                        {/* A. 고수 정보 + 트러스트 배지 */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-200">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center flex-wrap gap-1.5">
                                    <span className="font-bold text-gray-800 text-base">{displayProName}님</span>
                                    {proProfile?.is_phone_verified && (
                                        <span className="inline-flex items-center text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap">✅ 전화번호 인증</span>
                                    )}
                                    {proProfile?.facebook_url && (
                                        <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">🔵 Facebook 연동</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-xs font-bold text-yellow-500">⭐ {Number(avgRating).toFixed(1)}</span>
                                    <span className="text-xs text-gray-400">({reviewCount}개 리뷰)</span>
                                </div>
                            </div>
                        </div>

                        {/* 한 줄 소개 */}
                        {proProfile?.intro && (
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                "{proProfile.intro}"
                            </p>
                        )}

                        {/* B. 제안 금액 (가장 눈에 띄게) */}
                        <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 text-center">
                            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">제안 금액</span>
                            {quote.price ? (
                                <span className="text-3xl font-black text-gray-900">
                                    ₱{Number(quote.price).toLocaleString()}
                                </span>
                            ) : (
                                <span className="text-lg font-bold text-gray-400">금액 미기재</span>
                            )}
                        </div>

                        {/* C. 상세 설명 */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">상세 설명</h3>
                            {quote.description ? (
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                    {quote.description}
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400">상세 설명이 첨부되지 않았습니다.</p>
                            )}
                        </div>

                        {/* D. 첨부 사진 */}
                        {(() => {
                            let imageList: string[] = [];
                            if (quote.image_url) {
                                if (quote.image_url.startsWith('[')) {
                                    try {
                                        const parsed = JSON.parse(quote.image_url);
                                        if (Array.isArray(parsed)) {
                                            imageList = parsed;
                                        }
                                    } catch (e) {
                                        imageList = [quote.image_url];
                                    }
                                } else {
                                    imageList = [quote.image_url];
                                }
                            }

                            if (imageList.length === 0) return null;

                            return (
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">첨부 사진 ({imageList.length}장)</h3>
                                    <div className="flex flex-col gap-3">
                                        {imageList.map((url, idx) => (
                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block cursor-pointer hover:opacity-90 transition-opacity">
                                                <img
                                                    src={url}
                                                    alt={`견적서 첨부 이미지 ${idx + 1}`}
                                                    className="w-full rounded-lg object-contain border border-gray-200 shadow-sm max-h-80 bg-white"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* E. 요청 내용 (고객 원본 데이터) */}
                        {request && request.dynamic_answers && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mt-6">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">요청 내용</h3>
                                <ul className="space-y-3">
                                    {(() => {
                                        const dynamicAnswers = { ...request.dynamic_answers };
                                        delete dynamicAnswers.details_mode;
                                        delete dynamicAnswers.depth1;
                                        delete dynamicAnswers.depth2;

                                        if (dynamicAnswers.region_reg && dynamicAnswers.region_city) {
                                            dynamicAnswers.merged_region = `${dynamicAnswers.region_reg}, ${dynamicAnswers.region_city}`;
                                            delete dynamicAnswers.region_reg;
                                            delete dynamicAnswers.region_city;
                                        }

                                        const answerEntries = Object.entries(dynamicAnswers).filter(([k, v]) => {
                                            if (v === null || v === undefined || v === '') return false;
                                            if (['details_mode', 'depth1', 'depth2'].includes(k)) return false;
                                            return true;
                                        });

                                        const ORDERED_KEYS = [
                                            'service_type', 'merged_region',
                                            // 이사
                                            'move_type', 'move_date', 'from_region', 'from_floor', 'from_size', 'from_elevator',
                                            'appliances', 'furniture', 'images', 'to_region', 'to_floor', 'to_elevator',
                                            // 가사/육아
                                            'house_type', 'service_frequency', 'extra_services', 'cleaning_supplies', 'has_pets',
                                            'visit_timing', 'care_schedule', 'children_info', 'language_pref', 'extra_tasks', 'child_health_note',
                                            // 요리
                                            'meal_headcount', 'meal_time', 'cuisine_style', 'grocery_needed', 'allergy_note',
                                            // 딥클리닝/청소
                                            'deep_clean_type', 'house_size', 'furnished_status', 'utilities_status', 'special_options',
                                            'cleaning_cycle', 'focus_areas',
                                            'pool_type', 'pool_condition', 'chemicals_supply', 'extra_repair',
                                            'clean_items', 'item_size_qty', 'material_type', 'stain_issues',
                                            // 에어컨 청소
                                            'ac_quantity', 'ac_size', 'ac_symptoms', 'ac_height',
                                            'ac_clean_date', 'visit_time', 'outdoor_unit_location', 'indoor_unit_access',
                                            'work_time', 'ac_types', 'ceiling_height',
                                            // 방역/해충/곰팡이
                                            'visit_date', 'building_type', 'damage_status', 'area_size', 'treatment_method', 'children_pets',
                                            'pest_types', 'problem_types', 'problem_locations', 'mold_severity',
                                            // 폐기물
                                            'pickup_date', 'waste_items', 'waste_volume', 'floor_access', 'disassembly_needed',
                                            // 배관/수도
                                            'leak_problems', 'leak_locations', 'main_valve_status',
                                            'equipment_types', 'pump_symptoms', 'pump_hp', 'pump_location',
                                            'clog_locations', 'clog_severity', 'prior_attempts', 'clog_cause',
                                            // 전기/태양광
                                            'service_type_wh', 'heater_type', 'heater_symptoms', 'electrical_ready',
                                            'electrical_symptoms', 'outage_scope', 'panel_board_access',
                                            'service_type_gen', 'fuel_type', 'gen_capacity', 'gen_symptoms',
                                            'work_types', 'ceiling_type', 'materials_ready', 'wiring_condition',
                                            'service_type_solar', 'system_type', 'system_capacity', 'roof_type',
                                            // 가전/전자
                                            'ac_hp', 'appliance_type', 'appliance_symptoms', 'appliance_brand', 'appliance_age',
                                            'tv_size', 'install_type', 'bracket_ready', 'wall_type',
                                            'service_type_cctv', 'camera_count', 'install_location', 'wifi_available',
                                            // 기타 홈서비스
                                            'screen_locations', 'screen_qty', 'screen_material', 'screen_frame_status',
                                            'lock_service_type', 'door_material', 'lock_type_new', 'lock_product_supply',
                                            'furniture_types', 'furniture_brand', 'furniture_qty', 'wall_mount_needed',
                                            // LPG 가스
                                            'gas_service_type', 'gas_brand', 'gas_capacity', 'empty_cylinder', 'gas_symptoms',
                                            // 리모델링/인테리어
                                            'remodel_scope', 'remodel_start', 'permit_status', 'material_supply', 'site_infra', 'remodel_budget',
                                            'interior_scope', 'unit_condition', 'condo_permit_status', 'work_schedule', 'interior_supply', 'interior_budget',
                                            'commercial_space_type', 'commercial_unit_condition', 'commercial_permit_status', 'admin_requirements', 'design_status', 'commercial_budget', 'commercial_start',
                                            // 타일/페인트/목공/드라이월/지붕
                                            'tile_spaces', 'floor_material', 'floor_condition', 'tile_material_supply', 'tile_permit_status', 'tile_site_access', 'tile_area_sqm', 'tile_work_schedule',
                                            'paint_scope', 'paint_site_condition', 'wall_condition', 'paint_material_supply', 'paint_permit_status', 'floor_height', 'paint_work_schedule',
                                            'carpentry_work_types', 'carpentry_material', 'design_doc', 'carpentry_site_condition', 'carpentry_permit_status', 'carpentry_work_schedule',
                                            'drywall_purpose', 'insulation_needed', 'ceiling_height_drywall', 'finish_level', 'drywall_permit_status', 'drywall_material_supply', 'drywall_work_schedule',
                                            'roofing_work_types', 'roof_problem_status', 'roof_material', 'roof_access', 'roof_permit_status', 'roof_work_schedule',
                                            // 조경/정원
                                            'landscaping_work_types', 'garden_condition', 'garden_area_sqm', 'garden_infra', 'garden_material_supply', 'garden_permit_status', 'garden_work_schedule',
                                            // 간판
                                            'signage_types', 'signage_location', 'signage_design_status', 'signage_power', 'signage_permit_status', 'signage_size', 'signage_work_schedule',
                                            // 데크/펜스
                                            'deck_fence_types', 'deck_material', 'deck_ground_condition', 'deck_material_supply', 'deck_permit_status', 'deck_size', 'deck_work_schedule',
                                            // 가상 비서
                                            'va_tasks', 'va_english_level', 'va_work_schedule', 'va_tools', 'va_wfh_infra', 'va_budget', 'va_start_date',
                                            // CS/콜센터
                                            'cs_channels', 'cs_languages', 'cs_agent_count', 'cs_coverage', 'cs_infra', 'cs_ticket_volume', 'cs_start_date',
                                            // 텔레마케팅
                                            'tm_campaign_goal', 'tm_target_country', 'tm_script_db', 'tm_payment_type', 'tm_dialer', 'tm_agent_count', 'tm_start_date',
                                            // 법인 등록
                                            'bizreg_entity_type', 'bizreg_foreign_ownership', 'bizreg_scope', 'bizreg_address_status', 'bizreg_capital', 'bizreg_start_date',
                                            // 세무 기장
                                            'tax_service_types', 'tax_vat_status', 'tax_transaction_volume', 'tax_bir_status', 'tax_accounting_system', 'tax_start_date',
                                            // 비자/이민
                                            'visa_service_types', 'visa_headcount', 'visa_stay_status', 'visa_sponsor_docs', 'visa_new_or_renewal', 'visa_start_date',
                                            // 인허가
                                            'permit_types', 'permit_current_status', 'permit_biz_docs', 'permit_item_count', 'permit_inspection_ready', 'permit_start_date',
                                            // 타갈로그어 통번역
                                            'tl_service_types', 'tl_field', 'tl_doc_volume', 'tl_interp_duration', 'tl_notarization', 'tl_location', 'tl_start_date',
                                            // 비사야어 통번역
                                            'vi_service_types', 'vi_dialect', 'vi_field', 'vi_doc_volume', 'vi_interp_duration', 'vi_location', 'vi_start_date',
                                            // 영어 통번역
                                            'en_service_types', 'en_field', 'en_target_country', 'en_doc_volume', 'en_interp_duration', 'en_apostille', 'en_start_date',
                                            // 기타 다국어 통번역
                                            'ml_language_pair', 'ml_service_types', 'ml_field', 'ml_doc_volume', 'ml_interp_duration', 'ml_location', 'ml_start_date',
                                            // 그래픽 디자인
                                            'gd_work_types', 'gd_reference_status', 'gd_usage_purpose', 'gd_source_files', 'gd_meeting_type', 'gd_start_date',
                                            // 웹/앱 개발
                                            'wd_platform_types', 'wd_project_stage', 'wd_local_integration', 'wd_hosting_status', 'wd_budget', 'wd_start_date',
                                            // 영상 편집
                                            've_platform_purpose', 've_footage_status', 've_video_length', 've_edit_elements', 've_work_style', 've_start_date',
                                            // SNS 마케팅
                                            'sns_platforms', 'sns_target_audience', 'sns_work_scope', 'sns_ads_budget_type', 'sns_page_status', 'sns_start_date',
                                            // 데뷰
                                            'debut_theme', 'debut_scope', 'debut_guest_count', 'debut_venue_status', 'debut_catering_rules', 'debut_budget', 'debut_date',
                                            // 세례식
                                            'ch_scope', 'ch_guest_count', 'ch_church_status', 'ch_reception_venue', 'ch_catering_style', 'ch_date',
                                            // 생일/기념일 파티
                                            'bday_party_type', 'bday_scope', 'bday_guest_count', 'bday_venue_status', 'bday_vendor_rules', 'bday_budget', 'bday_date',
                                            // 웨딩
                                            'wed_service_scope', 'wed_venue_type', 'wed_guest_count', 'wed_booked_items', 'wed_logistics', 'wed_budget', 'wed_date',
                                            // 기업 행사
                                            'corp_event_types', 'corp_headcount', 'corp_work_scope', 'corp_venue_status', 'corp_billing_req', 'corp_setup_timing', 'corp_date',
                                            'details'
                                        ];

                                        answerEntries.sort((a, b) => {
                                            const indexA = ORDERED_KEYS.indexOf(a[0]);
                                            const indexB = ORDERED_KEYS.indexOf(b[0]);
                                            if (indexA === -1 && indexB === -1) return 0;
                                            if (indexA === -1) return 1;
                                            if (indexB === -1) return -1;
                                            return indexA - indexB;
                                        });

                                        const labelMap: Record<string, string> = {
                                            service_type: '상세 서비스', merged_region: '서비스를 받으실 지역',
                                            // 이사
                                            move_type: '이사 서비스 종류', move_date: '이사 날짜',
                                            from_region: '출발 지역', from_floor: '출발지 층수', from_size: '출발지 면적 / 인원', from_elevator: '출발지 현장 상황',
                                            appliances: '이전 가전', furniture: '이전 가구', images: '첨부 사진',
                                            to_region: '도착 지역', to_floor: '도착지 층수', to_elevator: '도착지 현장 상황',
                                            // 가사/육아
                                            house_type: '주거 형태 및 크기', service_frequency: '서비스 주기',
                                            extra_services: '추가 서비스', cleaning_supplies: '청소 도구/세제 준비', has_pets: '반려동물 여부',
                                            visit_timing: '희망 방문 시기', care_schedule: '돌봄 시간대 및 형태',
                                            children_info: '아이 인원 및 나이', language_pref: '선호 소통 언어',
                                            extra_tasks: '추가 업무', child_health_note: '아이 건강 특이사항',
                                            // 요리
                                            meal_headcount: '식사 인원', meal_time: '요리 시간대/목적',
                                            cuisine_style: '요리 스타일', grocery_needed: '식재료 장보기 대행', allergy_note: '알레르기/피해야 할 식재료',
                                            // 딥클리닝/청소
                                            deep_clean_type: '딥클리닝 종류', house_size: '집 규모 및 형태',
                                            furnished_status: '가구/가전 입주 상태', utilities_status: '전기/수도 사용 여부', special_options: '추가 특수 방역/청소 옵션',
                                            cleaning_cycle: '청소 서비스 주기', focus_areas: '집중 청소 구역',
                                            pool_type: '수영장 종류 및 규모', pool_condition: '수질 상태',
                                            chemicals_supply: '약품 준비 방법', extra_repair: '추가 점검/수리 설비',
                                            clean_items: '딥클리닝 대상 품목', item_size_qty: '품목 크기 및 수량',
                                            material_type: '제품 소재', stain_issues: '오염/문제 종류',
                                            // 에어컨 청소
                                            ac_quantity: '에어컨 수량', ac_size: '에어컨 마력(HP)',
                                            ac_symptoms: '에어컨 증상', ac_height: '에어컨 설치 높이',
                                            ac_clean_date: '청소/점검 희망 날짜', visit_time: '희망 방문 시간대',
                                            outdoor_unit_location: '실외기 위치', indoor_unit_access: '실내기 하단 공간',
                                            work_time: '작업 시간대', ac_types: '에어컨 종류', ceiling_height: '천장 층고',
                                            // 방역/해충/곰팡이
                                            visit_date: '방문 희망 날짜', building_type: '건물 형태',
                                            damage_status: '흰개미 피해 상황', area_size: '공간 면적',
                                            treatment_method: '흰개미 퇴치 방식', children_pets: '어린아이/반려동물 여부',
                                            pest_types: '퇴치 대상 해충',
                                            problem_types: '주요 문제 종류', problem_locations: '문제 발생 위치', mold_severity: '곰팡이 피해 심각도',
                                            // 폐기물
                                            pickup_date: '수거 희망 날짜', waste_items: '폐기 품목',
                                            waste_volume: '폐기물 양(부피)', floor_access: '층수 및 엘리베이터 여부', disassembly_needed: '분해 작업 필요 여부',
                                            // 배관/수도
                                            leak_problems: '누수/배관 문제', leak_locations: '문제 발생 위치',
                                            main_valve_status: '메인 수도 밸브 상태',
                                            equipment_types: '점검 대상 장비', pump_symptoms: '워터펌프 증상',
                                            pump_hp: '워터펌프 마력(HP)', pump_location: '워터펌프/물탱크 위치',
                                            clog_locations: '막힘 발생 위치', clog_severity: '막힘 심각도',
                                            prior_attempts: '직접 시도한 방법', clog_cause: '이물질 원인',
                                            // 전기/태양광
                                            service_type_wh: '온수기 서비스 종류', heater_type: '온수기 종류',
                                            heater_symptoms: '온수기 증상', electrical_ready: '전선/차단기 준비 상태',
                                            electrical_symptoms: '전기 증상', outage_scope: '정전 범위', panel_board_access: '메인 분전함 위치',
                                            service_type_gen: '발전기 서비스 종류', fuel_type: '발전기 연료 타입',
                                            gen_capacity: '발전기 용량(kVA)', gen_symptoms: '발전기 증상',
                                            work_types: '작업 종류', ceiling_type: '천장 형태 및 높이',
                                            materials_ready: '조명/자재 준비 여부', wiring_condition: '벽/천장 배선 상태',
                                            service_type_solar: '태양광 서비스 종류', system_type: '태양광 시스템 방식',
                                            system_capacity: '태양광 시스템 용량', roof_type: '지붕 형태',
                                            // 가전/전자
                                            ac_hp: '에어컨 마력(HP)', appliance_type: '수리 대상 가전',
                                            appliance_symptoms: '가전 증상', appliance_brand: '가전 브랜드', appliance_age: '가전 사용 기간',
                                            tv_size: 'TV 크기', install_type: '설치 방식',
                                            bracket_ready: '브라켓 보유 여부', wall_type: '벽 재질',
                                            service_type_cctv: 'CCTV 서비스 종류', camera_count: '카메라 설치 대수',
                                            install_location: '설치 장소 형태', wifi_available: '인터넷(Wi-Fi) 연결 여부',
                                            // 기타 홈서비스
                                            screen_locations: '방충망 시공 위치', screen_qty: '방충망 시공 수량',
                                            screen_material: '방충망 재질/기능', screen_frame_status: '창문/틀 상태',
                                            lock_service_type: '열쇠/도어락 서비스 종류', door_material: '문 재질',
                                            lock_type_new: '자물쇠 종류', lock_product_supply: '제품 준비 방법',
                                            furniture_types: '조립 가구 종류', furniture_brand: '가구 브랜드/구매처',
                                            furniture_qty: '가구 수량 및 규모', wall_mount_needed: '벽 고정 작업 필요 여부',
                                            // LPG 가스
                                            gas_service_type: 'LPG 서비스 종류', gas_brand: '가스통 브랜드',
                                            gas_capacity: '가스통 용량', empty_cylinder: '빈 가스통 보유 여부', gas_symptoms: '가스 증상/문제',
                                            // 리모델링/인테리어
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
                                            // 타일/바닥재
                                            tile_spaces: '시공 공간', floor_material: '바닥재 종류',
                                            floor_condition: '현재 바닥 상태', tile_material_supply: '자재 준비 방식',
                                            tile_permit_status: '공사 허가 상태', tile_site_access: '현장 반입 환경',
                                            tile_area_sqm: '시공 면적', tile_work_schedule: '작업 가능 시간대',
                                            // 페인트
                                            paint_scope: '페인트 시공 범위', paint_site_condition: '현장 상태',
                                            wall_condition: '벽면 상태 및 사전 작업', paint_material_supply: '페인트 자재 준비',
                                            paint_permit_status: '공사 허가 상태', floor_height: '층수/층고',
                                            paint_work_schedule: '작업 가능 시간대',
                                            // 목공
                                            carpentry_work_types: '목공 작업 종류', carpentry_material: '자재 및 마감 방식',
                                            design_doc: '도면 보유 여부', carpentry_site_condition: '작업 장소 상태',
                                            carpentry_permit_status: '공사 허가 상태', carpentry_work_schedule: '작업 가능 시간대',
                                            // 가벽/드라이월
                                            drywall_purpose: '시공 목적', insulation_needed: '방음/단열 필요 여부',
                                            ceiling_height_drywall: '층고', finish_level: '마감 단계',
                                            drywall_permit_status: '공사 허가 상태', drywall_material_supply: '자재 준비 방식',
                                            drywall_work_schedule: '작업 가능 시간대',
                                            // 지붕/방수
                                            roofing_work_types: '지붕 공사 종류', roof_problem_status: '문제 상황',
                                            roof_material: '지붕/바닥 재질', roof_access: '층수 및 접근성',
                                            roof_permit_status: '공사 허가 상태', roof_work_schedule: '작업 가능 시간대',
                                            // 조경/정원
                                            landscaping_work_types: '조경/정원 관리 작업 종류', garden_condition: '정원 현재 상태',
                                            garden_area_sqm: '정원 면적', garden_infra: '현장 인프라 (수도/전기)',
                                            garden_material_supply: '자재/식물 준비 방식', garden_permit_status: '공사 허가 상태',
                                            garden_work_schedule: '작업 가능 시간대',
                                            // 간판
                                            signage_types: '간판/작업 종류', signage_location: '간판 설치 위치 및 높이',
                                            signage_design_status: '디자인 시안 준비 여부', signage_power: '전기 공급 여부',
                                            signage_permit_status: '관할 허가 상태', signage_size: '간판 크기',
                                            signage_work_schedule: '작업 가능 시간대',
                                            // 데크/펜스
                                            deck_fence_types: '시공 항목', deck_material: '주요 자재',
                                            deck_ground_condition: '지면/기존 구조물 상태', deck_material_supply: '자재 준비 방식',
                                            deck_permit_status: '공사 허가 상태', deck_size: '시공 면적 및 길이',
                                            deck_work_schedule: '작업 가능 시간대',
                                            // 가상 비서
                                            va_tasks: '주요 업무', va_english_level: '영어 능통 수준',
                                            va_work_schedule: '근무 형태 및 시간대', va_tools: '필수 소프트웨어/툴',
                                            va_wfh_infra: '재택근무 인프라 요건', va_budget: '월간 예산/급여 수준',
                                            va_start_date: '업무 시작 희망 날짜',
                                            // CS/콜센터
                                            cs_channels: 'CS 지원 채널', cs_languages: '지원 언어',
                                            cs_agent_count: '상담원 규모', cs_coverage: '서비스 제공 시간대',
                                            cs_infra: '인프라 및 운영 방식', cs_ticket_volume: '월간 콜/티켓 볼륨',
                                            cs_start_date: '프로젝트 시작 희망일',
                                            // 텔레마케팅
                                            tm_campaign_goal: '캠페인 주요 목적', tm_target_country: '타겟 고객 국가',
                                            tm_script_db: '콜 리스트/스크립트 준비 여부', tm_payment_type: '보상 및 지불 방식',
                                            tm_dialer: '다이얼러 시스템 준비 방식', tm_agent_count: '투입 인원 규모',
                                            tm_start_date: '캠페인 시작 희망일',
                                            // 법인 등록
                                            bizreg_entity_type: '사업체 형태', bizreg_foreign_ownership: '외국인 지분율',
                                            bizreg_scope: '대행 업무 범위', bizreg_address_status: '사업장 주소지 확보 여부',
                                            bizreg_capital: '예상 자본금 규모', bizreg_start_date: '대행 업무 시작 희망일',
                                            // 세무 기장
                                            tax_service_types: '세무 서비스 종류', tax_vat_status: 'BIR 납세자 형태',
                                            tax_transaction_volume: '월 평균 거래 건수', tax_bir_status: 'BIR 등록 상태',
                                            tax_accounting_system: '회계/POS 시스템', tax_start_date: '서비스 시작 희망 날짜',
                                            // 비자/이민
                                            visa_service_types: '비자/이민 서류 업무 종류', visa_headcount: '수속 대상자 인원',
                                            visa_stay_status: '현재 체류 상태', visa_sponsor_docs: '스폰서 법인 서류 상태',
                                            visa_new_or_renewal: '신규/갱신 여부', visa_start_date: '서류 접수 대행 시작 희망일',
                                            // 인허가
                                            permit_types: '인허가/면허 종류', permit_current_status: '인허가 진행 상태',
                                            permit_biz_docs: '기본 사업 서류 구비 상태', permit_item_count: '대상 물품/사업장 수',
                                            permit_inspection_ready: '실사 준비 여부', permit_start_date: '대행 업무 시작 희망일',
                                            // 타갈로그어 통번역
                                            tl_service_types: '통번역 서비스 종류', tl_field: '통번역 분야/문맥',
                                            tl_doc_volume: '번역 분량', tl_interp_duration: '통역 소요 시간',
                                            tl_notarization: '공증/확인서 필요 여부', tl_location: '통역 장소 형태',
                                            tl_start_date: '희망 날짜',
                                            // 비사야어 통번역
                                            vi_service_types: '통번역 서비스 종류', vi_dialect: '비사야어 방언',
                                            vi_field: '통번역 분야/문맥', vi_doc_volume: '번역 분량',
                                            vi_interp_duration: '통역 소요 시간', vi_location: '통역 장소 형태',
                                            vi_start_date: '희망 날짜',
                                            // 영어 통번역
                                            en_service_types: '통번역 서비스 종류', en_field: '전문 분야',
                                            en_target_country: '타겟 국가/문맥', en_doc_volume: '번역 분량',
                                            en_interp_duration: '통역 소요 시간', en_apostille: '공증/아포스티유 필요 여부',
                                            en_start_date: '희망 날짜',
                                            // 기타 다국어 통번역
                                            ml_language_pair: '언어 쌍', ml_service_types: '통번역 서비스 종류',
                                            ml_field: '통번역 분야/문맥', ml_doc_volume: '번역 분량',
                                            ml_interp_duration: '통역 소요 시간', ml_location: '장소/제출처',
                                            ml_start_date: '희망 날짜',
                                            // 그래픽 디자인
                                            gd_work_types: '디자인 작업 종류', gd_reference_status: '기획/레퍼런스 보유 상태',
                                            gd_usage_purpose: '결과물 활용 목적', gd_source_files: '원본 파일/저작권 양도 여부',
                                            gd_meeting_type: '소통 방식', gd_start_date: '납품 희망 날짜',
                                            // 웹/앱 개발
                                            wd_platform_types: '개발 플랫폼 종류', wd_project_stage: '프로젝트 준비 단계',
                                            wd_local_integration: '현지 결제/물류 연동', wd_hosting_status: '서버/도메인 준비 상태',
                                            wd_budget: '프로젝트 예산', wd_start_date: '프로젝트 시작 희망일',
                                            // 영상 편집
                                            ve_platform_purpose: '영상 활용 플랫폼/목적', ve_footage_status: '원본 소스 상태',
                                            ve_video_length: '완성본 길이', ve_edit_elements: '필수 편집 요소',
                                            ve_work_style: '작업 및 소통 방식', ve_start_date: '납품 희망 날짜',
                                            // SNS 마케팅
                                            sns_platforms: '타겟 플랫폼', sns_target_audience: '타겟 고객층',
                                            sns_work_scope: '업무 범위', sns_ads_budget_type: '광고비 처리 방식',
                                            sns_page_status: '페이지 활성화 상태', sns_start_date: '대행 시작 희망일',
                                            // 데뷰
                                            debut_theme: '파티 컨셉/테마', debut_scope: '서비스 범위',
                                            debut_guest_count: '예상 하객 수', debut_venue_status: '베뉴 섭외 상태',
                                            debut_catering_rules: '케이터링/레촌 반입 규정', debut_budget: '총 예상 예산',
                                            debut_date: '행사 예정일',
                                            // 세례식
                                            ch_scope: '기획 범위', ch_guest_count: '하객 규모',
                                            ch_church_status: '성당/교회 예약 상태', ch_reception_venue: '리셉션 장소 형태',
                                            ch_catering_style: '케이터링 스타일', ch_date: '행사 예정일',
                                            // 생일/기념일 파티
                                            bday_party_type: '파티 종류', bday_scope: '기획 범위',
                                            bday_guest_count: '예상 하객 수', bday_venue_status: '베뉴 섭외 상태',
                                            bday_vendor_rules: '외부 업체 반입 규정', bday_budget: '총 예상 예산',
                                            bday_date: '파티 예정일',
                                            // 웨딩
                                            wed_service_scope: '플래닝 서비스 범위', wed_venue_type: '웨딩 형태 및 베뉴',
                                            wed_guest_count: '하객 규모', wed_booked_items: '예약 완료 항목',
                                            wed_logistics: '날씨/이동 대비', wed_budget: '총 예상 예산',
                                            wed_date: '예식 예정일',
                                            // 기업 행사
                                            corp_event_types: '행사 종류', corp_headcount: '예상 참여 인원',
                                            corp_work_scope: '업무 범위', corp_venue_status: '베뉴 준비 상태',
                                            corp_billing_req: '결제/행정 요건', corp_setup_timing: '셋업 가능 시간',
                                            corp_date: '행사 예정일',
                                            details: '추가 요청사항 / 특이사항',
                                            // 하위 호환
                                            region: '지역', region_reg: '지역 (Region)', region_city: '도시 (City)'
                                        };

                                        if (answerEntries.length === 0) {
                                            return <p className="text-sm text-gray-400">요청 상세 내용이 없습니다.</p>;
                                        }

                                        return answerEntries.map(([key, value]) => {
                                            const label = labelMap[key] || key;
                                            return (
                                                <li key={key} className="flex flex-col">
                                                    <span className="text-xs text-gray-400 font-medium mb-1">{label}</span>
                                                    <div className="text-sm font-medium text-gray-800 bg-white p-2.5 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                                                        {(() => {
                                                            if (key === 'images' && Array.isArray(value)) {
                                                                return (
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {value.map((img: any, i: number) => (
                                                                            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer" className="block relative cursor-pointer hover:opacity-90 transition group overflow-hidden rounded-lg">
                                                                                <img src={img.url} className="w-20 h-20 object-cover border border-gray-200" alt={`첨부사진 ${i + 1}`} />
                                                                                {img.description && <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate text-center transition-all group-hover:bg-black/80">{img.description}</span>}
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }
                                                            if (value && typeof value === 'object' && !Array.isArray(value)) {
                                                                const v = value as any;
                                                                if (v.reg && v.city) return `${v.reg}, ${v.city}`;
                                                                return JSON.stringify(value);
                                                            }
                                                            if (Array.isArray(value)) {
                                                                return value.join(', ');
                                                            }
                                                            return String(value);
                                                        })()}
                                                    </div>
                                                </li>
                                            );
                                        });
                                    })()}
                                </ul>
                            </div>
                        )}

                        {/* 견적 도착 시간 */}
                        <p className="text-xs text-gray-400 text-right">
                            견적 도착: {new Date(quote.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {/* 하단 고정 CTA */}
                    {!isReadOnly && (
                        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                            <button
                                onClick={() => onStartChat({ ...quote, request_id: requestId })}
                                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base active:scale-[0.98]"
                            >
                                <span className="text-lg">💬</span> 상담 / 채팅하기
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
