"use client";

import React from "react";
import { useTranslations } from "next-intl";

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

export default function QuoteDetailModal({
  quote,
  onClose,
  onStartChat,
  requestId,
  request,
  isReadOnly,
  proName,
}: QuoteDetailModalProps) {
  const t = useTranslations();
  const proProfile = Array.isArray(quote.pro_profiles)
    ? quote.pro_profiles[0]
    : quote.pro_profiles;
  const userInfo = proProfile?.users
    ? Array.isArray(proProfile.users)
      ? proProfile.users[0]
      : proProfile.users
    : null;
  const displayProName =
    proName ||
    (userInfo?.nickname && userInfo.nickname.trim() !== ""
      ? userInfo.nickname
      : userInfo?.name || "Pro");
  const avatarUrl = userInfo?.avatar_url || null;
  const avgRating = proProfile?.average_rating || 0;
  const reviewCount = proProfile?.review_count || 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div className="flex-1 flex items-center justify-center">
        <div
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">
              {t("quoteModal.title")}
            </h2>
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
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    className="w-5 h-5 text-blue-500"
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
              <div>
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="font-bold text-gray-800 text-base">
                    {displayProName}님
                  </span>
                  {proProfile?.is_phone_verified && (
                    <span className="inline-flex items-center text-[10px] bg-green-50 text-green-700 font-bold px-1.5 py-0.5 rounded-full border border-green-200 whitespace-nowrap">
                      {t("quoteModal.phoneVerified")}
                    </span>
                  )}
                  {proProfile?.facebook_url && (
                    <span className="inline-flex items-center text-[10px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded-full border border-blue-200 whitespace-nowrap">
                      {t("quoteModal.facebookLinked")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-bold text-yellow-500">
                    ⭐ {Number(avgRating).toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({reviewCount}
                    {t("quoteModal.reviewCount")})
                  </span>
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
              <span className="text-xs font-bold text-blue-500 uppercase tracking-wider block mb-1">
                {t("quoteModal.proposedPrice")}
              </span>
              {quote.price ? (
                <span className="text-3xl font-black text-gray-900">
                  {Number(quote.price).toLocaleString()}
                </span>
              ) : (
                <span className="text-lg font-bold text-gray-400">
                  {t("quoteModal.noPrice")}
                </span>
              )}
            </div>

            {/* C. 상세 설명 */}
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                {t("quoteModal.descriptionTitle")}
              </h3>
              {quote.description ? (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {quote.description}
                </p>
              ) : (
                <p className="text-sm text-gray-400">
                  {t("quoteModal.noDescription")}
                </p>
              )}
            </div>

            {/* D. 첨부 사진 */}
            {(() => {
              let imageList: string[] = [];
              if (quote.image_url) {
                if (quote.image_url.startsWith("[")) {
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
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("quoteModal.photosTitle")} ({imageList.length})
                  </h3>
                  <div className="flex flex-col gap-3">
                    {imageList.map((url, idx) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`${t("quoteModal.quoteImageAlt")}${idx + 1}`}
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
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  {t("quoteModal.requestTitle")}
                </h3>
                <ul className="space-y-3">
                  {(() => {
                    const dynamicAnswers = { ...request.dynamic_answers };
                    delete dynamicAnswers.details_mode;
                    delete dynamicAnswers.depth1;
                    delete dynamicAnswers.depth2;

                    if (
                      dynamicAnswers.region_reg &&
                      dynamicAnswers.region_city
                    ) {
                      dynamicAnswers.merged_region = `${dynamicAnswers.region_reg}, ${dynamicAnswers.region_city}`;
                      delete dynamicAnswers.region_reg;
                      delete dynamicAnswers.region_city;
                    }

                    const answerEntries = Object.entries(dynamicAnswers).filter(
                      ([k, v]) => {
                        if (v === null || v === undefined || v === "")
                          return false;
                        if (["details_mode", "depth1", "depth2"].includes(k))
                          return false;
                        return true;
                      },
                    );

                    const ORDERED_KEYS = [
                      "service_type",
                      "merged_region",
                      // 이사
                      "move_type",
                      "move_date",
                      "from_region",
                      "from_floor",
                      "from_size",
                      "from_elevator",
                      "appliances",
                      "furniture",
                      "images",
                      "to_region",
                      "to_floor",
                      "to_elevator",
                      // 가사/육아
                      "house_type",
                      "service_frequency",
                      "extra_services",
                      "cleaning_supplies",
                      "has_pets",
                      "visit_timing",
                      "care_schedule",
                      "children_info",
                      "language_pref",
                      "extra_tasks",
                      "child_health_note",
                      // 요리
                      "meal_headcount",
                      "meal_time",
                      "cuisine_style",
                      "grocery_needed",
                      "allergy_note",
                      // 딥클리닝/청소
                      "deep_clean_type",
                      "house_size",
                      "furnished_status",
                      "utilities_status",
                      "special_options",
                      "cleaning_cycle",
                      "focus_areas",
                      "pool_type",
                      "pool_condition",
                      "chemicals_supply",
                      "extra_repair",
                      "clean_items",
                      "item_size_qty",
                      "material_type",
                      "stain_issues",
                      // 에어컨 청소
                      "ac_quantity",
                      "ac_size",
                      "ac_symptoms",
                      "ac_height",
                      "ac_clean_date",
                      "visit_time",
                      "outdoor_unit_location",
                      "indoor_unit_access",
                      "work_time",
                      "ac_types",
                      "ceiling_height",
                      // 방역/해충/곰팡이
                      "visit_date",
                      "building_type",
                      "damage_status",
                      "area_size",
                      "treatment_method",
                      "children_pets",
                      "pest_types",
                      "problem_types",
                      "problem_locations",
                      "mold_severity",
                      // 폐기물
                      "pickup_date",
                      "waste_items",
                      "waste_volume",
                      "floor_access",
                      "disassembly_needed",
                      // 배관/수도
                      "leak_problems",
                      "leak_locations",
                      "main_valve_status",
                      "equipment_types",
                      "pump_symptoms",
                      "pump_hp",
                      "pump_location",
                      "clog_locations",
                      "clog_severity",
                      "prior_attempts",
                      "clog_cause",
                      // 전기/태양광
                      "service_type_wh",
                      "heater_type",
                      "heater_symptoms",
                      "electrical_ready",
                      "electrical_symptoms",
                      "outage_scope",
                      "panel_board_access",
                      "service_type_gen",
                      "fuel_type",
                      "gen_capacity",
                      "gen_symptoms",
                      "work_types",
                      "ceiling_type",
                      "materials_ready",
                      "wiring_condition",
                      "service_type_solar",
                      "system_type",
                      "system_capacity",
                      "roof_type",
                      // 가전/전자
                      "ac_hp",
                      "appliance_type",
                      "appliance_symptoms",
                      "appliance_brand",
                      "appliance_age",
                      "tv_size",
                      "install_type",
                      "bracket_ready",
                      "wall_type",
                      "service_type_cctv",
                      "camera_count",
                      "install_location",
                      "wifi_available",
                      // 기타 홈서비스
                      "screen_locations",
                      "screen_qty",
                      "screen_material",
                      "screen_frame_status",
                      "lock_service_type",
                      "door_material",
                      "lock_type_new",
                      "lock_product_supply",
                      "furniture_types",
                      "furniture_brand",
                      "furniture_qty",
                      "wall_mount_needed",
                      // LPG 가스
                      "gas_service_type",
                      "gas_brand",
                      "gas_capacity",
                      "empty_cylinder",
                      "gas_symptoms",
                      // 리모델링/인테리어
                      "remodel_scope",
                      "remodel_start",
                      "permit_status",
                      "material_supply",
                      "site_infra",
                      "remodel_budget",
                      "interior_scope",
                      "unit_condition",
                      "condo_permit_status",
                      "work_schedule",
                      "interior_supply",
                      "interior_budget",
                      "commercial_space_type",
                      "commercial_unit_condition",
                      "commercial_permit_status",
                      "admin_requirements",
                      "design_status",
                      "commercial_budget",
                      "commercial_start",
                      // 타일/페인트/목공/드라이월/지붕
                      "tile_spaces",
                      "floor_material",
                      "floor_condition",
                      "tile_material_supply",
                      "tile_permit_status",
                      "tile_site_access",
                      "tile_area_sqm",
                      "tile_work_schedule",
                      "paint_scope",
                      "paint_site_condition",
                      "wall_condition",
                      "paint_material_supply",
                      "paint_permit_status",
                      "floor_height",
                      "paint_work_schedule",
                      "carpentry_work_types",
                      "carpentry_material",
                      "design_doc",
                      "carpentry_site_condition",
                      "carpentry_permit_status",
                      "carpentry_work_schedule",
                      "drywall_purpose",
                      "insulation_needed",
                      "ceiling_height_drywall",
                      "finish_level",
                      "drywall_permit_status",
                      "drywall_material_supply",
                      "drywall_work_schedule",
                      "roofing_work_types",
                      "roof_problem_status",
                      "roof_material",
                      "roof_access",
                      "roof_permit_status",
                      "roof_work_schedule",
                      // 조경/정원
                      "landscaping_work_types",
                      "garden_condition",
                      "garden_area_sqm",
                      "garden_infra",
                      "garden_material_supply",
                      "garden_permit_status",
                      "garden_work_schedule",
                      // 간판
                      "signage_types",
                      "signage_location",
                      "signage_design_status",
                      "signage_power",
                      "signage_permit_status",
                      "signage_size",
                      "signage_work_schedule",
                      // 데크/펜스
                      "deck_fence_types",
                      "deck_material",
                      "deck_ground_condition",
                      "deck_material_supply",
                      "deck_permit_status",
                      "deck_size",
                      "deck_work_schedule",
                      // 가상 비서
                      "va_tasks",
                      "va_english_level",
                      "va_work_schedule",
                      "va_tools",
                      "va_wfh_infra",
                      "va_budget",
                      "va_start_date",
                      // CS/콜센터
                      "cs_channels",
                      "cs_languages",
                      "cs_agent_count",
                      "cs_coverage",
                      "cs_infra",
                      "cs_ticket_volume",
                      "cs_start_date",
                      // 텔레마케팅
                      "tm_campaign_goal",
                      "tm_target_country",
                      "tm_script_db",
                      "tm_payment_type",
                      "tm_dialer",
                      "tm_agent_count",
                      "tm_start_date",
                      // 법인 등록
                      "bizreg_entity_type",
                      "bizreg_foreign_ownership",
                      "bizreg_scope",
                      "bizreg_address_status",
                      "bizreg_capital",
                      "bizreg_start_date",
                      // 세무 기장
                      "tax_service_types",
                      "tax_vat_status",
                      "tax_transaction_volume",
                      "tax_bir_status",
                      "tax_accounting_system",
                      "tax_start_date",
                      // 비자/이민
                      "visa_service_types",
                      "visa_headcount",
                      "visa_stay_status",
                      "visa_sponsor_docs",
                      "visa_new_or_renewal",
                      "visa_start_date",
                      // 인허가
                      "permit_types",
                      "permit_current_status",
                      "permit_biz_docs",
                      "permit_item_count",
                      "permit_inspection_ready",
                      "permit_start_date",
                      // 타갈로그어 통번역
                      "tl_service_types",
                      "tl_field",
                      "tl_doc_volume",
                      "tl_interp_duration",
                      "tl_notarization",
                      "tl_location",
                      "tl_start_date",
                      // 비사야어 통번역
                      "vi_service_types",
                      "vi_dialect",
                      "vi_field",
                      "vi_doc_volume",
                      "vi_interp_duration",
                      "vi_location",
                      "vi_start_date",
                      // 영어 통번역
                      "en_service_types",
                      "en_field",
                      "en_target_country",
                      "en_doc_volume",
                      "en_interp_duration",
                      "en_apostille",
                      "en_start_date",
                      // 기타 다국어 통번역
                      "ml_language_pair",
                      "ml_service_types",
                      "ml_field",
                      "ml_doc_volume",
                      "ml_interp_duration",
                      "ml_location",
                      "ml_start_date",
                      // 그래픽 디자인
                      "gd_work_types",
                      "gd_reference_status",
                      "gd_usage_purpose",
                      "gd_source_files",
                      "gd_meeting_type",
                      "gd_start_date",
                      // 웹/앱 개발
                      "wd_platform_types",
                      "wd_project_stage",
                      "wd_local_integration",
                      "wd_hosting_status",
                      "wd_budget",
                      "wd_start_date",
                      // 영상 편집
                      "ve_platform_purpose",
                      "ve_footage_status",
                      "ve_video_length",
                      "ve_edit_elements",
                      "ve_work_style",
                      "ve_start_date",
                      // SNS 마케팅
                      "sns_platforms",
                      "sns_target_audience",
                      "sns_work_scope",
                      "sns_ads_budget_type",
                      "sns_page_status",
                      "sns_start_date",
                      // 데뷰
                      "debut_theme",
                      "debut_scope",
                      "debut_guest_count",
                      "debut_venue_status",
                      "debut_catering_rules",
                      "debut_budget",
                      "debut_date",
                      // 세례식
                      "ch_scope",
                      "ch_guest_count",
                      "ch_church_status",
                      "ch_reception_venue",
                      "ch_catering_style",
                      "ch_date",
                      // 생일/기념일 파티
                      "bday_party_type",
                      "bday_scope",
                      "bday_guest_count",
                      "bday_venue_status",
                      "bday_vendor_rules",
                      "bday_budget",
                      "bday_date",
                      // 웨딩
                      "wed_service_scope",
                      "wed_venue_type",
                      "wed_guest_count",
                      "wed_booked_items",
                      "wed_logistics",
                      "wed_budget",
                      "wed_date",
                      // 기업 행사
                      "corp_event_types",
                      "corp_headcount",
                      "corp_work_scope",
                      "corp_venue_status",
                      "corp_billing_req",
                      "corp_setup_timing",
                      "corp_date",
                      "details",
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
                      service_type: "Detailed Service",
                      merged_region: "Service Region",
                      move_type: "Moving Service Type",
                      move_date: "Moving Date",
                      from_region: "Departure Region",
                      from_floor: "Departure Floor",
                      from_size: "Departure Area / Occupants",
                      from_elevator: "Departure Site Condition",
                      appliances: "Appliances to Move",
                      furniture: "Furniture to Move",
                      images: "Attached Photos",
                      to_region: "Destination Region",
                      to_floor: "Destination Floor",
                      to_elevator: "Destination Site Condition",
                      house_type: "Housing Type & Size",
                      service_frequency: "Service Frequency",
                      extra_services: "Additional Services",
                      cleaning_supplies: "Cleaning Tools/Supplies",
                      has_pets: "Pets at Home",
                      visit_timing: "Preferred Visit Timing",
                      care_schedule: "Care Schedule & Type",
                      children_info: "Number & Age of Children",
                      language_pref: "Preferred Language",
                      extra_tasks: "Additional Tasks",
                      child_health_note: "Child Health Notes",
                      meal_headcount: "Number of Diners",
                      meal_time: "Meal Time/Purpose",
                      cuisine_style: "Cooking Style",
                      grocery_needed: "Grocery Shopping Assistance",
                      allergy_note: "Allergies/Ingredients to Avoid",
                      deep_clean_type: "Deep Cleaning Type",
                      house_size: "Unit Size & Type",
                      furnished_status: "Furnished Status",
                      utilities_status: "Electricity/Water Availability",
                      special_options: "Additional Special Options",
                      cleaning_cycle: "Cleaning Frequency",
                      focus_areas: "Focused Cleaning Areas",
                      pool_type: "Pool Type & Size",
                      pool_condition: "Water Condition",
                      chemicals_supply: "Chemical Supply Method",
                      extra_repair: "Additional Inspection/Repair",
                      clean_items: "Items for Deep Cleaning",
                      item_size_qty: "Item Size & Quantity",
                      material_type: "Material Type",
                      stain_issues: "Stain/Issue Type",
                      ac_quantity: "Number of AC Units",
                      ac_size: "AC Horsepower (HP)",
                      ac_symptoms: "AC Symptoms",
                      ac_height: "AC Installation Height",
                      ac_clean_date: "Preferred Cleaning Date",
                      visit_time: "Preferred Visit Time",
                      outdoor_unit_location: "Outdoor Unit Location",
                      indoor_unit_access: "Indoor Unit Clearance",
                      work_time: "Work Schedule",
                      ac_types: "AC Types",
                      ceiling_height: "Ceiling Height",
                      visit_date: "Preferred Visit Date",
                      building_type: "Building Type",
                      damage_status: "Termite Damage Status",
                      area_size: "Area Size",
                      treatment_method: "Treatment Method",
                      children_pets: "Children/Pets at Home",
                      pest_types: "Target Pests",
                      problem_types: "Problem Types",
                      problem_locations: "Problem Locations",
                      mold_severity: "Mold Severity",
                      pickup_date: "Preferred Pickup Date",
                      waste_items: "Items to Dispose",
                      waste_volume: "Waste Volume",
                      floor_access: "Floor & Elevator Access",
                      disassembly_needed: "Disassembly Required",
                      leak_problems: "Leak/Plumbing Issues",
                      leak_locations: "Problem Locations",
                      main_valve_status: "Main Water Valve Status",
                      equipment_types: "Equipment to Inspect",
                      pump_symptoms: "Water Pump Symptoms",
                      pump_hp: "Water Pump HP",
                      pump_location: "Pump/Tank Location",
                      clog_locations: "Clog Locations",
                      clog_severity: "Clog Severity",
                      prior_attempts: "Prior DIY Attempts",
                      clog_cause: "Clog Cause",
                      service_type_wh: "Water Heater Service Type",
                      heater_type: "Water Heater Type",
                      heater_symptoms: "Water Heater Symptoms",
                      electrical_ready: "Wiring/Breaker Status",
                      electrical_symptoms: "Electrical Symptoms",
                      outage_scope: "Outage Scope",
                      panel_board_access: "Main Panel Location",
                      service_type_gen: "Generator Service Type",
                      fuel_type: "Generator Fuel Type",
                      gen_capacity: "Generator Capacity (kVA)",
                      gen_symptoms: "Generator Symptoms",
                      work_types: "Work Types",
                      ceiling_type: "Ceiling Type & Height",
                      materials_ready: "Lighting/Materials Ready",
                      wiring_condition: "Wall/Ceiling Wiring Condition",
                      service_type_solar: "Solar Service Type",
                      system_type: "Solar System Type",
                      system_capacity: "Solar System Capacity",
                      roof_type: "Roof Type",
                      ac_hp: "AC Horsepower (HP)",
                      appliance_type: "Appliance to Repair",
                      appliance_symptoms: "Appliance Symptoms",
                      appliance_brand: "Appliance Brand",
                      appliance_age: "Appliance Age",
                      tv_size: "TV Size",
                      install_type: "Installation Type",
                      bracket_ready: "Bracket Available",
                      wall_type: "Wall Material",
                      service_type_cctv: "CCTV Service Type",
                      camera_count: "Number of Cameras",
                      install_location: "Installation Location",
                      wifi_available: "Internet (Wi-Fi) Available",
                      screen_locations: "Screen Installation Locations",
                      screen_qty: "Number of Screens",
                      screen_material: "Screen Material/Type",
                      screen_frame_status: "Window/Frame Condition",
                      lock_service_type: "Lock/Door Lock Service Type",
                      door_material: "Door Material",
                      lock_type_new: "Lock Type",
                      lock_product_supply: "Product Supply Method",
                      furniture_types: "Furniture Types to Assemble",
                      furniture_brand: "Furniture Brand/Purchase",
                      furniture_qty: "Furniture Quantity & Size",
                      wall_mount_needed: "Wall Mounting Required",
                      gas_service_type: "LPG Service Type",
                      gas_brand: "Gas Tank Brand",
                      gas_capacity: "Gas Tank Capacity",
                      empty_cylinder: "Empty Cylinder Available",
                      gas_symptoms: "Gas Symptoms/Issues",
                      remodel_scope: "Renovation Scope",
                      remodel_start: "Construction Start Timing",
                      permit_status: "Construction Permit Status",
                      material_supply: "Material Supply Method",
                      site_infra: "Site Infrastructure",
                      remodel_budget: "Total Construction Budget",
                      interior_scope: "Interior Scope",
                      unit_condition: "Unit Condition",
                      condo_permit_status: "Condo Construction Permit",
                      work_schedule: "Available Work Schedule",
                      interior_supply: "Interior Material Supply",
                      interior_budget: "Interior Budget",
                      commercial_space_type: "Commercial Space Type",
                      commercial_unit_condition: "Store Condition",
                      commercial_permit_status: "Construction Permit Status",
                      admin_requirements: "Admin/Safety Requirements",
                      design_status: "Design/Blueprint Available",
                      commercial_budget: "Interior Budget",
                      commercial_start: "Construction Start Timing",
                      tile_spaces: "Tiling Spaces",
                      floor_material: "Flooring Material",
                      floor_condition: "Current Floor Condition",
                      tile_material_supply: "Material Supply Method",
                      tile_permit_status: "Construction Permit Status",
                      tile_site_access: "Site Access Conditions",
                      tile_area_sqm: "Tiling Area (sqm)",
                      tile_work_schedule: "Available Work Schedule",
                      paint_scope: "Painting Scope",
                      paint_site_condition: "Site Condition",
                      wall_condition: "Wall Condition & Prep Work",
                      paint_material_supply: "Paint Material Supply",
                      paint_permit_status: "Construction Permit Status",
                      floor_height: "Floor/Ceiling Height",
                      paint_work_schedule: "Available Work Schedule",
                      carpentry_work_types: "Carpentry Work Types",
                      carpentry_material: "Material & Finish",
                      design_doc: "Blueprint Available",
                      carpentry_site_condition: "Work Site Condition",
                      carpentry_permit_status: "Construction Permit Status",
                      carpentry_work_schedule: "Available Work Schedule",
                      drywall_purpose: "Installation Purpose",
                      insulation_needed: "Soundproofing/Insulation Required",
                      ceiling_height_drywall: "Ceiling Height",
                      finish_level: "Finish Level",
                      drywall_permit_status: "Construction Permit Status",
                      drywall_material_supply: "Material Supply Method",
                      drywall_work_schedule: "Available Work Schedule",
                      roofing_work_types: "Roofing Work Types",
                      roof_problem_status: "Problem Status",
                      roof_material: "Roof/Floor Material",
                      roof_access: "Floor & Accessibility",
                      roof_permit_status: "Construction Permit Status",
                      roof_work_schedule: "Available Work Schedule",
                      landscaping_work_types: "Landscaping Work Types",
                      garden_condition: "Garden Current Condition",
                      garden_area_sqm: "Garden Area (sqm)",
                      garden_infra: "Site Infrastructure (Water/Power)",
                      garden_material_supply: "Material/Plant Supply",
                      garden_permit_status: "Construction Permit Status",
                      garden_work_schedule: "Available Work Schedule",
                      signage_types: "Signage/Work Types",
                      signage_location: "Signage Location & Height",
                      signage_design_status: "Design Draft Available",
                      signage_power: "Power Supply Available",
                      signage_permit_status: "Permit Status",
                      signage_size: "Signage Size",
                      signage_work_schedule: "Available Work Schedule",
                      deck_fence_types: "Construction Items",
                      deck_material: "Main Material",
                      deck_ground_condition: "Ground/Existing Structure",
                      deck_material_supply: "Material Supply Method",
                      deck_permit_status: "Construction Permit Status",
                      deck_size: "Construction Area & Length",
                      deck_work_schedule: "Available Work Schedule",
                      va_tasks: "Main Tasks",
                      va_english_level: "English Proficiency",
                      va_work_schedule: "Work Type & Schedule",
                      va_tools: "Required Software/Tools",
                      va_wfh_infra: "WFH Infrastructure",
                      va_budget: "Monthly Budget/Salary",
                      va_start_date: "Preferred Start Date",
                      cs_channels: "CS Support Channels",
                      cs_languages: "Support Languages",
                      cs_agent_count: "Number of Agents",
                      cs_coverage: "Service Hours",
                      cs_infra: "Infrastructure & Operations",
                      cs_ticket_volume: "Monthly Call/Ticket Volume",
                      cs_start_date: "Preferred Project Start Date",
                      tm_campaign_goal: "Campaign Goal",
                      tm_target_country: "Target Country",
                      tm_script_db: "Call List/Script Available",
                      tm_payment_type: "Compensation & Payment Method",
                      tm_dialer: "Dialer System",
                      tm_agent_count: "Number of Agents",
                      tm_start_date: "Preferred Campaign Start Date",
                      bizreg_entity_type: "Business Entity Type",
                      bizreg_foreign_ownership: "Foreign Ownership %",
                      bizreg_scope: "Service Scope",
                      bizreg_address_status: "Business Address Ready",
                      bizreg_capital: "Estimated Capital",
                      bizreg_start_date: "Preferred Start Date",
                      tax_service_types: "Tax Service Types",
                      tax_vat_status: "BIR Taxpayer Type",
                      tax_transaction_volume: "Monthly Transaction Volume",
                      tax_bir_status: "BIR Registration Status",
                      tax_accounting_system: "Accounting/POS System",
                      tax_start_date: "Preferred Service Start Date",
                      visa_service_types: "Visa/Immigration Service Types",
                      visa_headcount: "Number of Applicants",
                      visa_stay_status: "Current Stay Status",
                      visa_sponsor_docs: "Sponsor/Company Documents",
                      visa_new_or_renewal: "New Application or Renewal",
                      visa_start_date: "Preferred Start Date",
                      permit_types: "Permit/License Types",
                      permit_current_status: "Current Permit Status",
                      permit_biz_docs: "Basic Business Documents",
                      permit_item_count: "Number of Items/Sites",
                      permit_inspection_ready: "Inspection Ready",
                      permit_start_date: "Preferred Start Date",
                      tl_service_types:
                        "Translation/Interpretation Service Types",
                      tl_field: "Field/Context",
                      tl_doc_volume: "Document Volume",
                      tl_interp_duration: "Interpretation Duration",
                      tl_notarization: "Notarization Required",
                      tl_location: "Interpretation Location",
                      tl_start_date: "Preferred Date",
                      vi_service_types:
                        "Translation/Interpretation Service Types",
                      vi_dialect: "Visayan Dialect",
                      vi_field: "Field/Context",
                      vi_doc_volume: "Document Volume",
                      vi_interp_duration: "Interpretation Duration",
                      vi_location: "Interpretation Location",
                      vi_start_date: "Preferred Date",
                      en_service_types:
                        "Translation/Interpretation Service Types",
                      en_field: "Field",
                      en_target_country: "Target Country/Context",
                      en_doc_volume: "Document Volume",
                      en_interp_duration: "Interpretation Duration",
                      en_apostille: "Notarization/Apostille Required",
                      en_start_date: "Preferred Date",
                      ml_language_pair: "Language Pair",
                      ml_service_types:
                        "Translation/Interpretation Service Types",
                      ml_field: "Field/Context",
                      ml_doc_volume: "Document Volume",
                      ml_interp_duration: "Interpretation Duration",
                      ml_location: "Location/Submission",
                      ml_start_date: "Preferred Date",
                      gd_work_types: "Design Work Types",
                      gd_reference_status: "Brief/Reference Available",
                      gd_usage_purpose: "Output Usage Purpose",
                      gd_source_files: "Source Files/Copyright Transfer",
                      gd_meeting_type: "Communication Method",
                      gd_start_date: "Preferred Delivery Date",
                      wd_platform_types: "Development Platform Types",
                      wd_project_stage: "Project Preparation Stage",
                      wd_local_integration:
                        "Local Payment/Logistics Integration",
                      wd_hosting_status: "Server/Domain Ready",
                      wd_budget: "Project Budget",
                      wd_start_date: "Preferred Project Start Date",
                      ve_platform_purpose: "Video Platform/Purpose",
                      ve_footage_status: "Source Footage Status",
                      ve_video_length: "Final Video Length",
                      ve_edit_elements: "Required Editing Elements",
                      ve_work_style: "Work & Communication Style",
                      ve_start_date: "Preferred Delivery Date",
                      sns_platforms: "Target Platforms",
                      sns_target_audience: "Target Audience",
                      sns_work_scope: "Work Scope",
                      sns_ads_budget_type: "Ad Budget Handling",
                      sns_page_status: "Page Activation Status",
                      sns_start_date: "Preferred Start Date",
                      debut_theme: "Party Concept/Theme",
                      debut_scope: "Service Scope",
                      debut_guest_count: "Expected Guest Count",
                      debut_venue_status: "Venue Status",
                      debut_catering_rules: "Catering/Lechon Rules",
                      debut_budget: "Total Estimated Budget",
                      debut_date: "Event Date",
                      ch_scope: "Planning Scope",
                      ch_guest_count: "Guest Count",
                      ch_church_status: "Church/Chapel Booking Status",
                      ch_reception_venue: "Reception Venue Type",
                      ch_catering_style: "Catering Style",
                      ch_date: "Event Date",
                      bday_party_type: "Party Type",
                      bday_scope: "Planning Scope",
                      bday_guest_count: "Expected Guest Count",
                      bday_venue_status: "Venue Status",
                      bday_vendor_rules: "External Vendor Rules",
                      bday_budget: "Total Estimated Budget",
                      bday_date: "Party Date",
                      wed_service_scope: "Planning Service Scope",
                      wed_venue_type: "Wedding Type & Venue",
                      wed_guest_count: "Guest Count",
                      wed_booked_items: "Already Booked Items",
                      wed_logistics: "Weather/Transportation Plan",
                      wed_budget: "Total Estimated Budget",
                      wed_date: "Wedding Date",
                      corp_event_types: "Event Types",
                      corp_headcount: "Expected Attendees",
                      corp_work_scope: "Work Scope",
                      corp_venue_status: "Venue Status",
                      corp_billing_req: "Billing/Admin Requirements",
                      corp_setup_timing: "Setup Available Time",
                      corp_date: "Event Date",
                      details: "Additional Requests / Notes",
                      region: "Region",
                      region_reg: "Region",
                      region_city: "City",
                    };

                    if (answerEntries.length === 0) {
                      return (
                        <p className="text-sm text-gray-400">
                          {t("quoteModal.noRequestDetails")}
                        </p>
                      );
                    }

                    return answerEntries.map(([key, value]) => {
                      const label = labelMap[key] || key;
                      return (
                        <li key={key} className="flex flex-col">
                          <span className="text-xs text-gray-400 font-medium mb-1">
                            {label}
                          </span>
                          <div className="text-sm font-medium text-gray-800 bg-white p-2.5 rounded-lg border border-gray-100 whitespace-pre-wrap leading-relaxed">
                            {(() => {
                              if (key === "images" && Array.isArray(value)) {
                                return (
                                  <div className="flex flex-wrap gap-2 mt-1">
                                    {value.map((img: any, i: number) => (
                                      <a
                                        key={i}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block relative cursor-pointer hover:opacity-90 transition group overflow-hidden rounded-lg"
                                      >
                                        <img
                                          src={img.url}
                                          className="w-20 h-20 object-cover border border-gray-200"
                                          alt={`${t("quoteModal.imageAlt")}${i + 1}`}
                                        />
                                        {img.description && (
                                          <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] p-1 truncate text-center transition-all group-hover:bg-black/80">
                                            {img.description}
                                          </span>
                                        )}
                                      </a>
                                    ))}
                                  </div>
                                );
                              }
                              if (
                                value &&
                                typeof value === "object" &&
                                !Array.isArray(value)
                              ) {
                                const v = value as any;
                                if (v.reg && v.city)
                                  return `${v.reg}, ${v.city}`;
                                return JSON.stringify(value);
                              }
                              if (Array.isArray(value)) {
                                return value.join(", ");
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
              {t("quoteModal.arrivedAt")}
              {new Date(quote.created_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* 하단 고정 CTA */}
          {!isReadOnly && (
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
              <button
                onClick={() => onStartChat({ ...quote, request_id: requestId })}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base active:scale-[0.98]"
              >
                {t("quoteModal.chatBtn")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
