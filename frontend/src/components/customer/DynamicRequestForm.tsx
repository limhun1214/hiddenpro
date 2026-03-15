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

const PARTTIME_HOUSEKEEPER_STEPS = [
    { id: 'house_type', type: 'SINGLE_CHOICE', text: '주거 형태 및 크기를 선택해주세요.', options: ['스튜디오', '1베드룸', '2베드룸', '3베드룸 이상', '단독주택(House & Lot)'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: '서비스 빈도를 선택해주세요.', options: ['1회성', '주 1회 정기', '월 2회 정기'] },
    { id: 'extra_services', type: 'MULTI_CHOICE', text: '집중 청소나 추가로 부탁할 서비스가 있나요? (중복 선택 가능)', options: ['없음', '손빨래 및 세탁기 돌리기(Laba)', '다림질(Plantsa)', '냉장고 내부 청소', '베란다 및 창틀 청소', '기타'] },
    { id: 'cleaning_supplies', type: 'SINGLE_CHOICE', text: '청소 도구와 세제는 어떻게 준비할까요?', options: ['고객 집 도구/세제 사용', '고수님 직접 지참 (+추가비용)'] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: '집에 반려동물이 있나요?', options: ['없음', '개나 고양이 있음', '기타 동물 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특별한 요청사항이 있나요? (선택)', skippable: true }
];

const BABYSITTER_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'care_schedule', type: 'SINGLE_CHOICE', text: '원하시는 돌봄 시간대와 형태를 선택해주세요.', options: ['파트타임 (4~5시간)', '풀타임 (8~9시간)', '야간 돌봄 (수면 시간 포함)', '입주 돌봄 (Stay-in 논의)'] },
    { id: 'children_info', type: 'TEXT_INPUT', text: '돌보아야 할 아이의 인원과 나이를 적어주세요.', placeholder: '예: 2명 (8개월, 4살)' },
    { id: 'language_pref', type: 'SINGLE_CHOICE', text: '선호하는 소통 언어를 선택해주세요.', options: ['타갈로그어 가능', '영어 가능', '한국어 가능', '상관없음'] },
    { id: 'extra_tasks', type: 'MULTI_CHOICE', text: '기본 돌봄 외에 추가 업무가 필요한가요? (중복 선택 가능)', options: ['없음 (오직 돌봄만 집중)', '아이 식사 및 간식 준비', '아이 옷 세탁 및 다림질', '젖병 소독 및 목욕 보조', '등하원 픽업 동행'] },
    { id: 'child_health_note', type: 'TEXT_INPUT', text: '아이의 건강 특이사항이나 알레르기가 있다면 적어주세요. (선택)', skippable: true },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: '집에 반려동물이 있나요?', options: ['없음', '개나 고양이 있음', '기타 동물 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 바라는 성향이나 기타 요청사항이 있나요? (선택)', skippable: true, placeholder: '예: 영어가 유창한 분을 원해요, 거실에 CCTV가 있습니다 등' }
];

const COOKING_HELPER_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'meal_headcount', type: 'SINGLE_CHOICE', text: '식사를 드실 인원이 몇 명인가요?', options: ['1~2명', '3~4명', '5~8명', '9명 이상 (대규모)'] },
    { id: 'meal_time', type: 'MULTI_CHOICE', text: '요리가 필요한 식사 시간대나 목적을 선택해주세요. (중복 선택 가능)', options: ['아침', '점심', '저녁', '하루 종일(밀프렙/다수 식사 준비)', '홈 파티 및 행사(Handaan)'] },
    { id: 'cuisine_style', type: 'MULTI_CHOICE', text: '선호하는 요리 스타일을 선택해주세요. (중복 선택 가능)', options: ['필리핀 현지식', '한국식(한식)', '서양식', '다이어트 및 건강식', '기타'] },
    { id: 'grocery_needed', type: 'SINGLE_CHOICE', text: '식재료 장보기(Palengke/Grocery) 대행이 필요한가요?', options: ['냉장고에 재료가 준비되어 있어요 (바로 요리)', '장보기 대행이 필요해요 (+추가 비용)'] },
    { id: 'allergy_note', type: 'TEXT_INPUT', text: '피해야 할 식재료나 알레르기가 있다면 적어주세요. (선택)', skippable: true },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 주방 환경이나 기타 요청사항이 있나요? (선택)', skippable: true, placeholder: '예: 오븐이 없습니다, 인덕션 2구 사용 중입니다 등' }
];

const DEEP_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'deep_clean_type', type: 'SINGLE_CHOICE', text: '어떤 종류의 딥클리닝인가요?', options: ['신축 입주 (Post-construction/분진 및 페인트 제거)', '이전 거주자가 있던 집 입주', '이사 나가기 전(Move-out) 청소'] },
    { id: 'house_size', type: 'SINGLE_CHOICE', text: '청소할 집의 규모와 형태를 선택해주세요.', options: ['스튜디오~1베드룸', '2베드룸 (화장실 1~2개)', '3베드룸 이상 (콘도)', '2층 이상 단독주택(House & Lot)'] },
    { id: 'furnished_status', type: 'SINGLE_CHOICE', text: '현재 집에 짐(가구/가전)이 있는 상태인가요?', options: ['완전한 빈집 (Bare / 가구 없음)', '일부 가구 있음 (Semi-furnished)', '짐이 모두 있는 상태 (Fully-furnished)'] },
    { id: 'utilities_status', type: 'SINGLE_CHOICE', text: '현재 현장에 전기와 수도를 사용할 수 있나요?', options: ['전기, 수도 모두 사용 가능', '수도만 가능 (전기 끊김)', '전기만 가능 (수도 끊김)', '둘 다 사용 불가 (해결 후 예약 요망)'] },
    { id: 'special_options', type: 'MULTI_CHOICE', text: '추가로 필요한 특수 방역/청소 옵션이 있나요? (중복 선택 가능)', options: ['없음', '해충 방역 (Pest Control)', '에어컨 내부 분해 청소', '매트리스 및 소파 딥클리닝', '기름때 하수구(Grease Trap) 청소'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 관리사무소(Admin) 작업 허가증(Work Permit) 처리가 필요합니다 등' }
];

const REGULAR_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'cleaning_cycle', type: 'SINGLE_CHOICE', text: '청소 서비스 주기를 선택해주세요.', options: ['1회성 일반 청소', '주 1~2회 정기 청소', '월 1~2회 정기 청소'] },
    { id: 'house_size', type: 'SINGLE_CHOICE', text: '주거 형태 및 방/화장실 규모를 선택해주세요.', options: ['스튜디오~1베드룸', '2베드룸 (화장실 1~2개)', '3베드룸 이상 (콘도)', '2층 이상 단독주택(House & Lot)'] },
    { id: 'cleaning_supplies', type: 'SINGLE_CHOICE', text: '청소 장비와 전용 세제는 어떻게 준비할까요?', options: ['고객 집의 일반 도구/세제 사용', '고수의 전문 장비 및 세제 지참 요망 (+추가 비용)'] },
    { id: 'focus_areas', type: 'MULTI_CHOICE', text: '집중적으로 청소가 필요한 구역이 있나요? (중복 선택 가능)', options: ['없음 (집안 전체 일반 청소)', '주방 기름때 및 찌든 때', '화장실 물때 및 곰팡이', '베란다(발코니) 및 창틀', '냉장고 내부'] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: '집에 반려동물이 있나요?', options: ['없음', '개나 고양이 있음', '기타 동물 있음'] }
];

const POOL_MAINTENANCE_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'pool_type', type: 'SINGLE_CHOICE', text: '관리할 수영장의 종류와 규모를 선택해주세요.', options: ['개인 주택 소형 풀 (Plunge pool)', '개인 주택 대형 풀', '콘도/빌리지 공용 풀 (상업용)', '기타 수경시설 (연못 등)'] },
    { id: 'pool_condition', type: 'SINGLE_CHOICE', text: '현재 수영장의 수질 상태는 어떤가요?', options: ['일상적인 관리 상태 (맑은 물)', '바닥에 낙엽이나 흙이 가라앉은 상태', '녹조(녹색 물/Algae)가 심하게 낀 상태', '물이 완전히 비워진 빈 수영장'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: '원하시는 청소/관리 주기를 선택해주세요.', options: ['1회성 문제 해결 (딥클리닝)', '주 1~2회 정기 방문 관리', '월간 정기 관리'] },
    { id: 'chemicals_supply', type: 'SINGLE_CHOICE', text: '수질 관리를 위한 약품은 어떻게 준비할까요?', options: ['고객이 보유한 약품 사용', '고수님이 전문가용 약품 모두 지참 요망 (+추가 비용)'] },
    { id: 'extra_repair', type: 'MULTI_CHOICE', text: '추가로 점검이나 수리가 필요한 설비가 있나요? (중복 선택 가능)', options: ['없음 (수질 관리 및 청소만)', '펌프 및 여과기(Filter) 점검', '수중 조명 고장 수리', '수영장 타일 깨짐 보수', '누수(Leak) 의심 점검'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 여과기 펌프 소음이 심합니다, 실내 수영장입니다 등' }
];

const SOFA_MATTRESS_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'clean_items', type: 'MULTI_CHOICE', text: '어떤 품목의 딥클리닝이 필요하신가요? (중복 선택 가능)', options: ['매트리스', '소파', '카페트 및 러그', '식탁 의자 및 사무용 의자', '기타'] },
    { id: 'item_size_qty', type: 'TEXT_INPUT', text: '청소할 품목의 크기와 수량을 적어주세요.', placeholder: '예: 퀸사이즈 매트리스 1개, 3인용 소파 1개' },
    { id: 'material_type', type: 'SINGLE_CHOICE', text: '제품의 주요 소재를 선택해주세요.', options: ['패브릭(천)', '천연 가죽', '인조 가죽(PU)', '소재 혼합 및 잘 모름'] },
    { id: 'stain_issues', type: 'MULTI_CHOICE', text: '특별히 해결을 원하는 오염이나 문제가 있나요? (중복 선택 가능)', options: ['없음 (일반 먼지 및 진드기 케어)', '반려동물 소변 및 심한 악취', '커피, 와인, 음식물 얼룩', '빈대(Surot) 및 해충 케어', '곰팡이 제거'] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: '집에 반려동물이 있나요?', options: ['없음', '개나 고양이 있음', '기타 동물 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 심한 얼룩 부위가 있습니다, 오전 방문을 원합니다 등' }
];

const WINDOW_AC_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: '희망 방문 시기를 선택해주세요.', options: ['오늘', '내일', '이번 주 내', '날짜 협의 가능'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: '청소할 창문형 에어컨의 총 수량을 선택해주세요.', options: ['1대', '2대', '3대', '4대 이상'] },
    { id: 'ac_size', type: 'MULTI_CHOICE', text: '에어컨의 대략적인 크기(마력/HP)를 모두 선택해주세요. (중복 선택 가능)', options: ['0.5 ~ 1.0 HP (소형)', '1.5 ~ 2.0 HP (중대형)', '2.5 HP 이상 (초대형)', '잘 모름'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 증상이나 특별한 청소 목적이 있나요? (중복 선택 가능)', options: ['없음 (일반 정기 딥클리닝)', '냉기가 약함 (안 시원함)', '물이 방 안으로 떨어짐 (누수)', '곰팡이 및 악취가 심함', '소음이 심함'] },
    { id: 'ac_height', type: 'SINGLE_CHOICE', text: '에어컨이 설치된 높이(위치)는 어떤가요?', options: ['일반적인 높이 (손이 닿거나 의자 사용 가능)', '높은 곳에 위치 (전문 사다리 필수)', '작업 공간이 매우 좁거나 위험함'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 브랜드가 콜맨(Condura)/캐리어(Carrier)입니다, 최근에 가스 충전을 했습니다 등' }
];

const SPLIT_AC_CLEANING_STEPS = [
    { id: 'ac_clean_date', type: 'DATE_PICKER', text: '청소 및 점검을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: '청소할 스플릿형 에어컨의 총 수량을 선택해주세요.', options: ['1대', '2대', '3대', '4대 이상'] },
    { id: 'ac_size', type: 'MULTI_CHOICE', text: '에어컨의 대략적인 마력(HP)을 모두 선택해주세요. (중복 선택 가능)', options: ['1.0 ~ 1.5 HP (소형 방용)', '2.0 ~ 2.5 HP (거실용 중대형)', '3.0 HP 이상 (초대형/상업용)', '잘 모름'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 증상이나 청소 목적이 있나요? (중복 선택 가능)', options: ['없음 (일반 정기 청소)', '냉기가 약함 (가스 부족 의심)', '실내기에서 물이 뚝뚝 떨어짐 (누수/배관 막힘)', '곰팡이 냄새가 심함', '소음이 심함'] },
    { id: 'outdoor_unit_location', type: 'SINGLE_CHOICE', text: '실외기(Outdoor Unit)가 설치된 위치는 어디인가요?', options: ['발코니/베란다 바닥 (접근 매우 쉬움)', '실외기 전용 난간이나 지붕 (접근 가능)', '창문 밖 외벽 공중 (위험/안전장비 필요)', '잘 모름'] },
    { id: 'indoor_unit_access', type: 'SINGLE_CHOICE', text: '실내기(에어컨 본체) 바로 아래에 이동하기 어려운 큰 가구가 있나요?', options: ['아래 공간이 비어있음', '쉽게 치울 수 있는 가구가 있음', '무거운 침대나 TV가 고정되어 있음 (보양 작업 꼼꼼히 필요)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 Admin 작업 허가증(Work Permit)이 필요합니다, 실외기가 너무 멀리 있습니다 등' }
];

const COMMERCIAL_AC_CLEANING_STEPS = [
    { id: 'ac_clean_date', type: 'DATE_PICKER', text: '청소 및 점검을 원하시는 날짜를 선택해주세요.' },
    { id: 'work_time', type: 'SINGLE_CHOICE', text: '원하시는 작업 시간대를 선택해주세요.', options: ['주간 (오전 8시~오후 5시)', '야간 (영업 종료 후)', '주말 및 휴일', '고수와 시간 협의'] },
    { id: 'ac_types', type: 'MULTI_CHOICE', text: '청소할 에어컨의 종류를 모두 선택해주세요. (중복 선택 가능)', options: ['천장형 카세트 (4Way)', '천장형 카세트 (1Way/2Way)', '대형 스탠드형', '매립 덕트형 (Ducted)', '잘 모름'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: '청소할 에어컨의 총 수량을 선택해주세요.', options: ['1~2대', '3~5대', '6~10대', '11대 이상 (대형 현장)'] },
    { id: 'ceiling_height', type: 'SINGLE_CHOICE', text: '천장형 에어컨이 설치된 층고(높이)는 대략 어느 정도인가요?', options: ['일반적인 층고 (3m 이하, 일반 사다리 가능)', '높은 층고 (3m~4m, 긴 사다리 필요)', '매우 높은 층고 (4m 이상, 비계/Scaffolding 설치 필요)', '천장형 에어컨 없음 (스탠드형만 해당)'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 증상이나 청소 목적이 있나요? (중복 선택 가능)', options: ['없음 (일반 정기 딥클리닝)', '냉기가 약함 (가스 부족 의심)', '기기에서 물이 떨어짐 (누수/펌프 고장)', '곰팡이 및 악취가 심함', '에러 코드가 뜨거나 작동이 안 됨'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 쇼핑몰/콘도 규정상 야간 작업만 가능합니다, 공식 영수증(Official Receipt) 발행이 필요합니다 등' }
];

const TERMITE_CONTROL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: '흰개미 피해가 발생한 건물의 형태를 선택해주세요.', options: ['콘도/아파트', '단독주택 (House & Lot) 및 타운하우스', '상업용 건물 및 사무실', '기타'] },
    { id: 'damage_status', type: 'MULTI_CHOICE', text: '현재 확인된 흰개미(Anay) 피해 상황은 어떤가요? (중복 선택 가능)', options: ['벽이나 나무에 흙 터널(Mud tubes)이 보임', '나무 기둥이나 목제 가구가 파먹힌 자국이 있음', '날개 달린 흰개미 군충(Swarmers)이 날아다님', '피해는 없으나 예방 차원의 방역을 원함'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: '방역이 필요한 공간의 대략적인 면적을 선택해주세요.', options: ['50sqm 이하 (소형)', '51~100sqm (중형)', '101~200sqm (대형)', '201sqm 이상 (초대형)', '잘 모름'] },
    { id: 'treatment_method', type: 'SINGLE_CHOICE', text: '선호하시는 흰개미 퇴치 방식이 있나요?', options: ['약제 살포 및 드릴링 (일반적/빠른 효과)', '베이트 시스템 (먹이통 설치/친환경적)', '토양 방충 (Soil poisoning/단독주택용)', '전문가 진단 후 가장 적합한 방식 결정'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: '집에 어린아이나 반려동물이 있나요? (약품 선택 시 중요)', options: ['없음', '어린아이 있음', '반려동물(개/고양이 등) 있음', '어린아이와 반려동물 모두 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 부엌 싱크대 쪽 나무가 많이 상했습니다, 친환경/무취 약품을 원합니다 등' }
];

const GENERAL_PEST_CONTROL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'pest_types', type: 'MULTI_CHOICE', text: '주로 퇴치하고 싶은 해충은 무엇인가요? (중복 선택 가능)', options: ['바퀴벌레 (Ipis)', '개미 (Langgam)', '모기 및 파리 (Lamok/Langaw)', '쥐 (Daga)', '빈대 및 벼룩 (Surot/Pulgas)', '기타 또는 잘 모름'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: '방역이 필요한 건물의 형태를 선택해주세요.', options: ['콘도/아파트', '단독주택 (House & Lot) 및 타운하우스', '상업용 건물 (식당/카페 등)', '사무실 및 기타'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: '방역할 공간의 대략적인 면적을 선택해주세요.', options: ['50sqm 이하 (소형/스튜디오)', '51~100sqm (중형/2BR)', '101~200sqm (대형)', '201sqm 이상 (초대형)', '잘 모름'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: '원하시는 방역 서비스 주기를 선택해주세요.', options: ['1회성 집중 방역', '1개월 단위 정기 방역', '3개월 단위 정기 방역', '전문가 진단 후 결정'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: '집에 어린아이나 반려동물이 있나요? (약품 선택 시 중요)', options: ['없음', '어린아이 있음', '반려동물(개/고양이 등) 있음', '어린아이와 반려동물 모두 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 주방 싱크대 주변에 바퀴벌레가 많습니다, 무취/친환경 약품을 원합니다, 식당 영업 종료 후 야간에 와주세요 등' }
];

const MOLD_ODOR_REMOVAL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'problem_types', type: 'MULTI_CHOICE', text: '주로 해결하고 싶은 문제는 무엇인가요? (중복 선택 가능)', options: ['벽/천장 곰팡이 (Amag)', '화장실 찌든 곰팡이', '하수구 악취', '반려동물 배설물 냄새', '에어컨 및 집안의 꿉꿉한 냄새 (Amoy kulob)', '기타 악취'] },
    { id: 'problem_locations', type: 'MULTI_CHOICE', text: '문제가 발생한 주요 위치는 어디인가요? (중복 선택 가능)', options: ['방 (침실)', '화장실', '거실 및 주방', '가구 및 매트리스 내부', '집 전체'] },
    { id: 'mold_severity', type: 'SINGLE_CHOICE', text: '곰팡이의 상태나 피해 심각도는 어느 정도인가요?', options: ['표면에만 살짝 있음 (간단한 제거 가능)', '페인트나 벽지가 벗겨질 정도로 심함 (복구 작업 필요)', '집안 넓은 면적에 퍼져 있음', '눈에 보이는 곰팡이는 없고 악취만 심함'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: '작업이 필요한 공간의 대략적인 규모를 선택해주세요.', options: ['특정 부분만 (10sqm 이하)', '방 1개 규모', '방 2~3개 규모', '집 전체 (대대적인 작업)'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: '집에 어린아이나 반려동물이 있나요? (살균/탈취 약품 선택 시 중요)', options: ['없음', '어린아이 있음', '반려동물(개/고양이 등) 있음', '어린아이와 반려동물 모두 있음'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 비가 오면 벽에서 물이 샙니다(누수 의심), 창문이 없어 환기가 불가능한 방입니다 등' }
];

const BULK_WASTE_DISPOSAL_STEPS = [
    { id: 'pickup_date', type: 'DATE_PICKER', text: '수거 및 반출을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'waste_items', type: 'MULTI_CHOICE', text: '폐기할 주요 품목은 무엇인가요? (중복 선택 가능)', options: ['대형 가구 (침대/소파/장롱 등)', '대형 가전 (냉장고/세탁기 등)', '인테리어 및 건축 폐기물 (Debris)', '이사 후 남은 대량의 잡동사니', '식당 및 상가 폐기물'] },
    { id: 'waste_volume', type: 'SINGLE_CHOICE', text: '전체 폐기물의 대략적인 양(부피)은 어느 정도인가요? (배차 기준)', options: ['멀티캡(Multicab) 1대 분량 (소량)', 'L300 밴 또는 픽업트럭 1대 분량 (중량)', '엘프(Elf) 트럭 1대 분량 (대량)', '6륜 이상 대형 트럭 분량', '잘 모름 (사진 첨부 및 상담)'] },
    { id: 'floor_access', type: 'SINGLE_CHOICE', text: '폐기물을 반출할 현장의 층수와 엘리베이터 유무를 선택해주세요.', options: ['1층 또는 엘리베이터 사용 가능 (화물용 포함)', '계단만 사용 (2층~3층)', '계단만 사용 (4층 이상)', '사다리차 등 특수 장비 필요'] },
    { id: 'disassembly_needed', type: 'SINGLE_CHOICE', text: '반출 전 가구나 가전의 분해(해체) 작업이 필요한가요?', options: ['아니요 (있는 그대로 문 통과 가능)', '네 (크기가 커서 분해 후 반출해야 함)', '잘 모름 (전문가 판단 요망)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 Admin의 반출 허가증(Gate Pass)을 받아두었습니다, 트럭 진입이 어려운 좁은 골목입니다 등' }
];

const PLUMBING_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['최대한 빨리 (긴급 출동)', '오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'leak_problems', type: 'MULTI_CHOICE', text: '현재 겪고 있는 누수/배관 문제는 무엇인가요? (중복 선택 가능)', options: ['수도관 파열 및 물 쏟아짐', '천장이나 벽에서 물이 샘 (윗집 누수 의심)', '수도꼭지 및 샤워기 누수', '이유 없는 수도 요금(Water bill) 폭탄', '녹물이나 이물질 발생'] },
    { id: 'leak_locations', type: 'MULTI_CHOICE', text: '문제가 발생한 주요 위치는 어디인가요? (중복 선택 가능)', options: ['화장실 및 욕실', '주방 싱크대', '천장 및 벽면', '세탁실', '마당 및 실외 계량기 주변'] },
    { id: 'main_valve_status', type: 'SINGLE_CHOICE', text: '현재 집의 메인 수도 밸브(Main Valve)를 잠글 수 있는 상태인가요?', options: ['네, 잠가두었습니다', '아니요, 밸브 위치를 모릅니다', '밸브가 고장 나서 잠기지 않습니다', '누수가 미미하여 잠그지 않았습니다'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: '건물의 형태를 선택해주세요. (누수 탐지 장비 및 배관 구조 파악용)', options: ['콘도/아파트', '단독주택 (House & Lot) 및 타운하우스', '상업용 건물 및 사무실'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 Admin에 누수 신고를 해두었습니다, 타일이나 벽을 깨야 할 수도 있습니다 등' }
];

const WATER_PUMP_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'equipment_types', type: 'MULTI_CHOICE', text: '점검이 필요한 주요 장비는 무엇인가요? (중복 선택 가능)', options: ['워터펌프 (Motor)', '압력탱크 (Pressure Tank/Bladder Tank)', '옥상 물탱크 (Overhead Tank)', '지하 저수조 (Cistern)'] },
    { id: 'pump_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 증상은 무엇인가요? (중복 선택 가능)', options: ['집 전체에 물이 나오지 않음 (수압 0)', '수압이 너무 약함', '펌프 모터가 멈추지 않고 계속 돌아감', '펌프에서 큰 소음이나 타는 냄새가 남', '탱크나 배관에서 물이 샘'] },
    { id: 'pump_hp', type: 'SINGLE_CHOICE', text: '사용 중인 워터펌프의 마력(HP)을 알고 계신가요?', options: ['0.5 HP 이하 (소형)', '1.0 HP (중형)', '1.5 HP 이상 (대형/상업용)', '잘 모름'] },
    { id: 'pump_location', type: 'SINGLE_CHOICE', text: '워터펌프와 물탱크가 설치된 위치는 어디인가요?', options: ['1층 마당 및 다용도실', '옥상 (지붕 위)', '지하 (저수조 옆)', '기타'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 브랜드가 Goulds(또는 Pedrollo) 입니다, 수리 불가능 시 새 제품 교체 견적도 같이 내주세요 등' }
];

const DRAIN_UNCLOG_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['최대한 빨리 (긴급 출동)', '오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'clog_locations', type: 'MULTI_CHOICE', text: '막힘이 발생한 곳은 어디인가요? (중복 선택 가능)', options: ['변기 (Toilet bowl)', '화장실 바닥 하수구', '주방 싱크대', '세면대', '야외 메인 하수관 (정화조/Poso Negro 관련)'] },
    { id: 'clog_severity', type: 'SINGLE_CHOICE', text: '막힘의 심각도는 어느 정도인가요?', options: ['물이 아주 천천히 내려감', '완전히 막혀서 물이 고여 있음', '물이나 오물이 역류하여 넘침 (가장 심각함)'] },
    { id: 'prior_attempts', type: 'SINGLE_CHOICE', text: '고수님이 오시기 전, 직접 시도해 보신 방법이 있나요? (약품 사용 여부 중요)', options: ['아무것도 하지 않음 (그대로 둠)', '뚫어뻥(Plunger) 사용', '화학 약품(Liquid Sosa 등) 부어둠 (작업자 안전을 위해 필수 고지)', '옷걸이나 도구 사용'] },
    { id: 'clog_cause', type: 'SINGLE_CHOICE', text: '이물질이 들어간 원인을 알고 계신가요?', options: ['단순 휴지 및 대변 (변기)', '머리카락 및 기름때 (하수구/싱크대)', '딱딱한 물건(장난감, 플라스틱 등)이 빠짐', '전혀 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 화장실이 1개라 긴급합니다, 하수구에서 악취가 심하게 올라옵니다 등' }
];

const WATER_HEATER_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'service_type_wh', type: 'SINGLE_CHOICE', text: '필요하신 서비스 종류를 선택해주세요.', options: ['신규 설치 (고객이 제품 보유함)', '신규 설치 (고수님이 제품 구매 및 지참 요망)', '기존 온수기 수리 및 점검', '기존 온수기 철거 및 이전 설치'] },
    { id: 'heater_type', type: 'SINGLE_CHOICE', text: '대상 온수기의 종류는 무엇인가요?', options: ['싱글포인트 (샤워기 1개 연결용)', '멀티포인트 (샤워기 및 세면대 동시 연결용)', '대형 저장식 온수기 (Storage Tank)', '잘 모름'] },
    { id: 'heater_symptoms', type: 'MULTI_CHOICE', text: '[수리 고객만] 현재 겪고 있는 증상은 무엇인가요? (설치 고객은 \'해당 없음\' 선택)', options: ['해당 없음 (신규/이전 설치)', '물이 전혀 따뜻해지지 않음', '온도가 조절되지 않음 (너무 뜨거움)', '기기 본체에서 물이 샘', '온수기를 켜면 차단기(Breaker)가 떨어짐'] },
    { id: 'electrical_ready', type: 'SINGLE_CHOICE', text: '[설치 고객만] 설치할 위치에 전선과 차단기(Breaker)가 준비되어 있나요?', options: ['해당 없음 (수리 고객)', '네, 온수기용 전선과 차단기가 이미 벽에 나와 있습니다', '아니요, 메인 차단기에서 전선을 새로 끌어와야 합니다', '잘 모름 (현장 점검 필요)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 제품 브랜드는 Panasonic(또는 Joven) 입니다, 수압이 약해서 온수기 펌프가 필요할 것 같습니다 등' }
];

const ELECTRICAL_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['최대한 빨리 (긴급 출동)', '오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'electrical_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 주요 증상은 무엇인가요? (중복 선택 가능)', options: ['메인 차단기(Main Breaker)가 자꾸 떨어짐', '특정 방이나 콘센트에 전기가 안 들어옴', '콘센트나 스위치에서 스파크나 타는 냄새가 남', '전등이 심하게 깜빡거림', '감전 위험(찌릿함)이 느껴짐'] },
    { id: 'outage_scope', type: 'SINGLE_CHOICE', text: '전기가 들어오지 않는 범위가 어떻게 되나요?', options: ['집/건물 전체가 정전됨', '특정 층이나 구역만 안 들어옴', '특정 콘센트나 조명 1~2개만 안 됨', '외부 정전(Meralco 등 전력회사 문제)인지 내부 문제인지 모름'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: '건물의 형태를 선택해주세요. (배선 구조 및 작업 난이도 파악용)', options: ['콘도/아파트', '단독주택 (House & Lot) 및 타운하우스', '상업용 건물 및 사무실', '기타'] },
    { id: 'panel_board_access', type: 'SINGLE_CHOICE', text: '메인 분전함(Panel Board/Breaker Box)의 위치를 알고 계신가요?', options: ['네, 집 안에 있으며 접근 가능합니다', '네, 집 외부에 있습니다', '관리사무소(Admin)가 관리하여 열쇠가 필요합니다', '위치를 잘 모릅니다'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 에어컨을 켜면 차단기가 떨어집니다, 비가 온 뒤부터 벽에서 전기가 통합니다 등' }
];

const LANDSCAPING_STEPS = [
    { id: 'landscaping_work_types', type: 'MULTI_CHOICE', text: '필요하신 조경 및 정원 관리 작업을 선택해주세요. (다중 선택 가능)', options: ['잔디 깎기 및 잡초 제거 (Lawn mowing & Weeding)', '나무 및 관목 전지/가지치기 (Trimming/Pruning)', '신규 식물 식재 및 정원 디자인 (New landscaping)', '병해충 방제 및 비료 주기', '인조 잔디 시공', '정원 폐기물(Green waste) 수거 및 처리'] },
    { id: 'garden_condition', type: 'SINGLE_CHOICE', text: '현재 정원(또는 작업 대상지)의 상태는 어떤가요?', options: ['정기적인 관리가 필요한 일반적인 상태', '오랫동안 방치되어 잡초와 나무가 무성한 상태 (정글 상태)', '식물이 없는 빈 땅 (신규 조성 필요)', '기존 조경을 모두 철거해야 하는 상태'] },
    { id: 'garden_area_sqm', type: 'SINGLE_CHOICE', text: '예상되는 대략적인 작업 면적(sqm)을 선택해주세요.', options: ['50sqm 미만 (소규모 마당)', '50 ~ 150sqm', '150 ~ 300sqm', '300sqm 이상', '정확한 면적을 모름 (현장 실사 필요)'] },
    { id: 'garden_infra', type: 'MULTI_CHOICE', text: '작업 현장의 수도 및 전기 인프라 상태를 체크해주세요. (다중 선택 가능)', options: ['외부 수도(Maynilad 등) 및 호스 연결 가능', '외부 전기(Meralco) 콘센트 사용 가능 (전동 공구용)', '수도 및 전기 사용 불가 (고수가 장비 자체 준비 필요)'] },
    { id: 'garden_material_supply', type: 'SINGLE_CHOICE', text: '조경 자재(식물, 흙, 비료 등) 준비 방식을 선택해주세요.', options: ['고객이 식물 및 자재 직접 준비 (Labor only)', '고수가 디자인 제안부터 자재 구매, 시공까지 턴키(Turn-key) 진행', '단순 제초 및 가지치기 작업임 (자재 불필요)'] },
    { id: 'garden_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 관리소(Admin/HOA) 작업 허가 상태를 알려주세요.', options: ['서브디비전/빌리지 (HOA 승인 완료)', '콘도미니엄 발코니/공용부 (Admin 승인 완료)', '일반 독립 주택 (허가 불필요)', '아직 허가받지 않음 (고수 안내 필요)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '작업 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'garden_work_schedule', type: 'SINGLE_CHOICE', text: '빌리지 규정상 소음 작업(예탁기, 전동톱 등)이 가능한 시간대를 선택해주세요.', options: ['평일 주간 (오전 8시~오후 5시) 상시 가능', '주말 포함 주간 상시 가능', '특정 시간대만 가능 (오후 1시~5시 등)', '아직 규정을 확인하지 못함'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 잘라낸 큰 나뭇가지들을 모두 폐기물 처리장으로 버려주셔야 합니다, 특정 열대 식물(망고나무 등) 가지치기입니다 등' }
];

const SIGNAGE_STEPS = [
    { id: 'signage_types', type: 'MULTI_CHOICE', text: '원하시는 간판 및 작업 종류를 선택해주세요. (다중 선택 가능)', options: ['조명용 파나플렉스(Panaflex) 간판', '아크릴 또는 금속 입체 글자(Build-up letters)', 'LED 네온 사인', '타포린(Tarpaulin) 현수막 및 배너', '윈도우 시트지(Sticker/Decal) 시공', '기존 간판 천갈이(Reprint) 및 형광등/LED 교체', '기존 간판 철거'] },
    { id: 'signage_location', type: 'SINGLE_CHOICE', text: '간판이 설치될 위치와 높이를 알려주세요.', options: ['1층 높이 (사다리로 작업 가능)', '2층 이상 건물 외벽 (비계/Scaffolding 또는 스카이차 필수)', '쇼핑몰(SM, Ayala 등) 내부 매장 입구', '실내 벽면'] },
    { id: 'signage_design_status', type: 'SINGLE_CHOICE', text: '간판 디자인 및 로고 파일 보유 상태를 선택해주세요.', options: ['인쇄/제작이 바로 가능한 고해상도 디자인 파일(AI, PDF 등) 보유', '로고 스케치나 사진만 보유 (고수가 디자인 시안 작업 필요)', '아무것도 없으며 로고 디자인부터 필요함'] },
    { id: 'signage_power', type: 'SINGLE_CHOICE', text: '현장의 간판용 전원(전기) 연결 상태는 어떤가요?', options: ['설치 위치에 전원선이 이미 나와 있음 (바로 연결 가능)', '설치 위치까지 전기 배선(Wiring) 추가 공사 필요', '비조명 간판이라 전기 연결 불필요'] },
    { id: 'signage_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 쇼핑몰 관리소(Admin) 또는 시청(LGU) 간판 설치 허가 상태를 알려주세요.', options: ['쇼핑몰/상가 Admin 도면 승인 및 Work Permit 완료', '시청(City Hall) 간판 퍼밋 발급 완료', '일반 사유지 내 설치 (퍼밋 불필요)', '아직 퍼밋 규정을 확인하지 못함 (고수 대행 필요)'] },
    { id: 'signage_size', type: 'SINGLE_CHOICE', text: '예상하시는 간판의 대략적인 크기를 선택해주세요.', options: ['소형 (1sqm 미만)', '중형 (1 ~ 3sqm)', '대형 (3sqm 이상 / 건물 전면 간판)', '아직 미정 (현장 실측 후 결정)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '설치(또는 현장 실측)를 희망하시는 날짜를 선택해주세요.' },
    { id: 'signage_work_schedule', type: 'SINGLE_CHOICE', text: '작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 가능', '주말 포함 주간 상시 가능', '쇼핑몰/상가 영업 종료 후 야간(Night shift)만 가능', '고수와 시간 협의'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 태풍에 기존 간판이 파손되어 긴급 철거가 먼저 필요합니다, SM Mall 규정상 아크릴 입체 간판만 허용됩니다 등' }
];

const DECK_FENCE_STEPS = [
    { id: 'deck_fence_types', type: 'MULTI_CHOICE', text: '필요하신 시공 항목을 선택해주세요. (다중 선택 가능)', options: ['야외 데크(Deck) 신규 시공', '기존 데크 수리 및 오일 스테인 유지보수', '경계용 펜스(Fence/울타리) 신규 설치', '기존 펜스 수리 및 도색', '프라이버시 스크린(가림막) 설치', '대문(Gate) 제작 및 설치'] },
    { id: 'deck_material', type: 'SINGLE_CHOICE', text: '시공을 원하시는 주요 자재를 선택해주세요.', options: ['천연 방부목 (Treated wood)', '합성 목재 (WPC Composite - 유지보수 용이)', '금속 철제/단조 (Steel/Wrought iron)', '콘크리트 및 블록 (CHB)', '미정 (고수와 상담 후 결정)'] },
    { id: 'deck_ground_condition', type: 'SINGLE_CHOICE', text: '현재 시공 현장의 바닥(지반) 상태는 어떤가요?', options: ['평탄한 콘크리트 바닥 (바로 프레임 설치 가능)', '흙바닥 (평탄화 및 콘크리트 기초 타설/파운데이션 필수)', '기존 데크나 펜스가 있어 철거가 먼저 필요한 상태', '상태를 정확히 모름 (실사 필요)'] },
    { id: 'deck_material_supply', type: 'SINGLE_CHOICE', text: '자재 준비 방식을 선택해주세요.', options: ['고객이 데크/펜스 자재 직접 구매 (Labor only)', '고수가 프레임 및 마감 자재 일체 준비 (Turn-key)', '상담 후 결정'] },
    { id: 'deck_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 서브디비전(HOA) 또는 바랑가이 경계선/건축선(Setback) 허가 상태를 알려주세요.', options: ['HOA/빌리지 공사 승인 및 경계선 확인 완료', '내 소유의 완전한 사유지 (이웃 분쟁 소지 없음)', '아직 경계선 규정 및 허가를 확인하지 못함 (고수 안내 필요)'] },
    { id: 'deck_size', type: 'SINGLE_CHOICE', text: '예상되는 대략적인 데크 면적 또는 펜스 길이를 선택해주세요.', options: ['소규모 (데크 10sqm 미만 / 펜스 10m 미만)', '중규모 (데크 10~30sqm / 펜스 10~30m)', '대규모 (데크 30sqm 이상 / 펜스 30m 이상)', '정확히 모름 (현장 실사 필요)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사 시작(또는 현장 실측)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'deck_work_schedule', type: 'SINGLE_CHOICE', text: '빌리지 규정상 작업(용접, 절단 등)이 가능한 시간대를 선택해주세요.', options: ['평일 주간 상시 가능', '평일 및 토요일 주간 가능', '아직 규정을 확인하지 못함'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 용접기 사용을 위한 220V 전원 연결이 가능합니다, 옆집과의 경계 문제로 펜스 높이는 1.5m 이내로 제한됩니다 등' }
];

const VIRTUAL_ASSISTANT_STEPS = [
    { id: 'va_tasks', type: 'MULTI_CHOICE', text: '가상 비서(VA)에게 맡기실 주요 업무를 선택해주세요. (다중 선택 가능)', options: ['이메일/일정 관리 및 일반 사무 (Admin/Data Entry)', '소셜 미디어 관리 및 콘텐츠 업로드', '고객 지원 (CS/Chat/Email)', '회계 및 영수증 처리 (Bookkeeping)', '리서치 및 리드 제너레이션 (Lead Gen)', '그래픽 디자인 또는 영상 편집'] },
    { id: 'va_english_level', type: 'SINGLE_CHOICE', text: '요구되는 영어 능통 수준을 선택해주세요.', options: ['기본적인 읽기/쓰기 가능 수준 (비대면 텍스트 위주)', '유창한 회화 가능 (내부 화상 회의 가능)', '원어민 수준 (미국/해외 고객 대상 직접 통화/CS 가능)'] },
    { id: 'va_work_schedule', type: 'SINGLE_CHOICE', text: '근무 형태 및 시간대를 선택해주세요.', options: ['풀타임 (하루 8시간)', '파트타임 (하루 4시간 이하)', '단기 프로젝트 단위', '필리핀 주간 시간대 (PH/KR Shift)', '미국 야간 시간대 (Graveyard/US Shift)', '호주 시간대 (AU Shift)'] },
    { id: 'va_tools', type: 'MULTI_CHOICE', text: '필수적으로 다뤄야 하는 소프트웨어/툴이 있나요? (다중 선택 가능)', options: ['MS Office', 'Google Workspace', '디자인 툴 (Canva, Photoshop 등)', 'CRM 툴 (Salesforce, Hubspot 등)', '회계 툴 (Xero, QuickBooks 등)', '협업 툴 (Slack, Trello, Asana 등)', '기타 (특이사항에 기재)'] },
    { id: 'va_wfh_infra', type: 'SINGLE_CHOICE', text: '[중요] 재택근무(WFH) 인프라에 대한 필수 요건을 선택해주세요.', options: ['안정적인 광랜(Fiber) 및 정전 대비 백업 전력(UPS/Generator) 필수', '일반적인 인터넷 환경이면 무관함', '장비(노트북 등)를 클라이언트가 지원할 예정임', '에이전시 오피스 출근 필수'] },
    { id: 'va_budget', type: 'SINGLE_CHOICE', text: '예상하시는 월간 예산(PHP) 또는 급여 수준을 선택해주세요.', options: ['15,000 ~ 25,000 PHP (기본 사무)', '25,000 ~ 40,000 PHP (중급/전문 스킬)', '40,000 PHP 이상 (고급 인력)', '시간당 페이로 지급 희망 (Hourly rate)', '상담 후 결정'] },
    { id: 'va_start_date', type: 'DATE_PICKER', text: '업무 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 쇼피파이(Shopify) 백엔드 관리 경험이 필수입니다, 일일 업무 보고(Daily Stand-up) 미팅이 줌(Zoom)으로 진행됩니다 등' }
];

const CS_CALLCENTER_STEPS = [
    { id: 'cs_channels', type: 'MULTI_CHOICE', text: '아웃소싱이 필요한 고객 지원(CS) 채널을 선택해주세요. (다중 선택 가능)', options: ['인바운드 전화 (Inbound Voice)', '이메일 지원 (Email Support)', '실시간 채팅 (Live Chat)', '소셜 미디어 DM 및 댓글 관리', '티켓팅 시스템 관리 (Zendesk 등)'] },
    { id: 'cs_languages', type: 'MULTI_CHOICE', text: '상담원(Agent)이 지원해야 할 주요 언어를 선택해주세요. (다중 선택 가능)', options: ['영어 (원어민/유창한 수준)', '타갈로그(Tagalog) 등 필리핀 로컬 언어', '한국어', '기타 다국어 지원 필요'] },
    { id: 'cs_agent_count', type: 'SINGLE_CHOICE', text: '필요한 상담원(Seats/Agents) 규모를 선택해주세요.', options: ['1~3명 (초기 소규모 세팅)', '4~10명', '11~50명', '50명 이상 (대형 콜센터)', '아직 트래픽을 몰라 상담 후 결정'] },
    { id: 'cs_coverage', type: 'SINGLE_CHOICE', text: '서비스 제공 시간대(Coverage)를 선택해주세요.', options: ['24/7 연중무휴 (교대 근무)', '미국 비즈니스 시간대 (필리핀 야간/Graveyard)', '필리핀/한국 비즈니스 시간대 (주간)', '특정 요일/주말 전담'] },
    { id: 'cs_infra', type: 'SINGLE_CHOICE', text: '[중요] 인프라 및 운영 방식에 대한 요구사항을 선택해주세요.', options: ['에이전시(BPO) 오피스 내 자체 시설 및 보안 네트워크 사용 필수', '재택근무(WFH) 형태 허용', '클라이언트 시스템(VPN, 회사 전화망 등) 원격 접속 필수'] },
    { id: 'cs_ticket_volume', type: 'SINGLE_CHOICE', text: '예상되는 월간 인바운드 콜 또는 티켓 볼륨(건수)을 선택해주세요.', options: ['월 1,000건 미만', '1,000 ~ 5,000건', '5,000건 이상', '초기 단계라 예측 불가'] },
    { id: 'cs_start_date', type: 'DATE_PICKER', text: '아웃소싱 프로젝트 시작 희망일을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 기존에 작성된 CS 매뉴얼(SOP)을 제공해 드립니다, 의료/법률 등 전문 용어 숙지가 필요한 캠페인입니다 등' }
];

const TELEMARKETING_STEPS = [
    { id: 'tm_campaign_goal', type: 'MULTI_CHOICE', text: '텔레마케팅/캠페인의 주요 목적을 선택해주세요. (다중 선택 가능)', options: ['B2B 잠재 고객 발굴 (Lead Generation)', 'B2C 아웃바운드 세일즈 (직접 판매)', '미팅 약속 잡기 (Appointment Setting)', '기존 고객 해피콜 및 설문조사', '데이터 클렌징(DB 업데이트)'] },
    { id: 'tm_target_country', type: 'SINGLE_CHOICE', text: '타겟 고객층(Target Audience)의 주요 국가를 선택해주세요.', options: ['미국', '캐나다', '호주 및 뉴질랜드', '필리핀 로컬 (현지 대상)', '한국', '기타'] },
    { id: 'tm_script_db', type: 'SINGLE_CHOICE', text: '콜 리스트(Lead DB) 및 영업 스크립트 제공 여부를 선택해주세요.', options: ['고객 DB와 스크립트 모두 클라이언트가 제공함', '스크립트만 제공 (에이전시가 자체 DB 발굴 필요)', '에이전시에서 스크립트 작성부터 DB 확보까지 모두 턴키 대행 희망'] },
    { id: 'tm_payment_type', type: 'SINGLE_CHOICE', text: '보상 및 지불 방식(Payment Term)은 어떻게 계획하고 계신가요?', options: ['고정 인건비 지급 (Fixed Hourly/Monthly)', '기본급 + 성과급 (Base + Commission)', '100% 성과 기반 지급 (Pay per Lead/Sale)', '고수와 상담 후 결정'] },
    { id: 'tm_dialer', type: 'SINGLE_CHOICE', text: '[중요] 통신료 및 다이얼러(Dialer) 시스템 준비 방식을 선택해주세요.', options: ['클라이언트가 VoIP 번호 및 다이얼러 시스템(RingCentral 등) 제공함', '에이전시가 보유한 다이얼러 시스템 사용 희망 (견적에 통신비 포함)', '모바일 폰을 이용한 로컬 콜(필리핀 내)만 진행'] },
    { id: 'tm_agent_count', type: 'SINGLE_CHOICE', text: '캠페인에 투입될 인원(Seats) 규모를 선택해주세요.', options: ['1~2명 (테스트 캠페인)', '3~5명', '5명 이상 대규모 팀'] },
    { id: 'tm_start_date', type: 'DATE_PICKER', text: '캠페인 시작 희망일을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 부동산 콜드 콜링(Cold Calling) 경력자가 필요합니다, 최소 주 단위로 실적 리포트가 필요합니다 등' }
];

const BIZREG_STEPS = [
    { id: 'bizreg_entity_type', type: 'SINGLE_CHOICE', text: '설립하시려는 사업체의 형태를 선택해주세요.', options: ['개인 사업자 (DTI - Sole Proprietorship)', '1인 법인 (SEC - OPC)', '주식회사 (SEC - Corporation)', '파트너십 (SEC - Partnership)', '아직 미정 (상담 후 결정)'] },
    { id: 'bizreg_foreign_ownership', type: 'SINGLE_CHOICE', text: '예상되는 외국인 지분율(Foreign Ownership)을 선택해주세요.', options: ['100% 필리핀인 지분 (외국인 없음)', '60% 필리핀인, 40% 외국인 지분', '외국인 지분 40% 초과 또는 100% 외국인 법인'] },
    { id: 'bizreg_scope', type: 'MULTI_CHOICE', text: '원하시는 대행 업무의 범위를 선택해주세요. (다중 선택 가능)', options: ['SEC/DTI 기본 등록만', '바랑가이 클리어런스(Barangay Clearance) 대행', '시청 영업허가증(Mayor\'s Permit / Business Permit) 대행', 'BIR(세무서) 등록 및 영수증(ATP) 발급까지 전체 턴키(Turn-key)', '은행 법인 계좌 개설 지원'] },
    { id: 'bizreg_address_status', type: 'SINGLE_CHOICE', text: '사업장 주소지(Office/Commercial Space)가 확보되어 있나요?', options: ['임대차 계약서(Lease Contract) 보유 완료', '현재 상가/오피스 계약 진행 중', '주소지가 없어 가상 오피스(Virtual Office) 연계 필요', '거주 중인 주택 주소 사용 예정'] },
    { id: 'bizreg_capital', type: 'SINGLE_CHOICE', text: '법인(SEC) 설립의 경우, 예상 자본금(Paid-up Capital) 규모를 선택해주세요.', options: ['1,000,000 PHP 미만', '1,000,000 ~ 5,000,000 PHP', '5,000,000 PHP 이상', '개인사업자(DTI) 진행 예정'] },
    { id: 'bizreg_start_date', type: 'DATE_PICKER', text: '대행 업무 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 식당업(F&B)이라 FDA 퍼밋 진행도 추후 필요합니다, 소매업(Retail)으로 100% 외국인 법인 설립 요건이 궁금합니다 등' }
];

const BIR_TAX_STEPS = [
    { id: 'tax_service_types', type: 'MULTI_CHOICE', text: '필요하신 세무 서비스의 종류를 선택해주세요. (다중 선택 가능)', options: ['매월 정기 세무 기장 (Retainer Bookkeeping & Tax filing)', '연말 정산 및 ITR(Annual Income Tax Return) 신고', '시청 영업허가증(Mayor\'s Permit) 연례 갱신 대행', 'BIR 감사(Audit) 대응 및 페널티 해결(Open cases)', '직원 급여 대장(Payroll) 및 SSS/PhilHealth/Pag-IBIG 관리'] },
    { id: 'tax_vat_status', type: 'SINGLE_CHOICE', text: '사업체의 BIR 납세자 형태를 선택해주세요.', options: ['VAT(부가세) 등록 법인 또는 개인', 'Non-VAT(면세/Percentage Tax) 등록 법인 또는 개인', '아직 BIR 등록 전', '상태를 정확히 모름'] },
    { id: 'tax_transaction_volume', type: 'SINGLE_CHOICE', text: '사업체의 월 평균 거래(매출/매입 영수증) 건수는 대략 어느 정도인가요?', options: ['월 50건 미만 (초기/소규모)', '50 ~ 200건', '200건 이상 (거래량 많음)', '거래가 거의 없는 휴면 상태(Zero filing 필요)'] },
    { id: 'tax_bir_status', type: 'SINGLE_CHOICE', text: '현재 BIR 등록 상태 및 영수증(O.R./Invoice) 보유 현황을 알려주세요.', options: ['BIR COR(2303) 및 공식 영수증(ATP) 모두 정상 보유 중', '신규 사업자로 이제 막 영수증을 인쇄해야 함', '장기간 신고를 누락하여 페널티(Open cases)가 예상됨', '이전 회계사로부터 서류 인수가 필요한 상태'] },
    { id: 'tax_accounting_system', type: 'SINGLE_CHOICE', text: '현재 사용 중인 회계/POS 시스템이 있나요?', options: ['퀵북(QuickBooks), 제로(Xero) 등 클라우드 회계 프로그램 사용', '자체 POS 시스템 데이터 다운로드 가능', '시스템 없이 엑셀/수기 영수증(Manual)으로만 관리'] },
    { id: 'tax_start_date', type: 'DATE_PICKER', text: '서비스 시작을 희망하시는 날짜(월)를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: PEZA/BOI 면세 혜택을 받고 있는 법인입니다, 2년 동안 세금 신고를 누락해서 페널티 합의(Compromise)가 시급합니다 등' }
];

const VISA_STEPS = [
    { id: 'visa_service_types', type: 'MULTI_CHOICE', text: '필요하신 비자 또는 이민국 서류 업무를 선택해주세요. (다중 선택 가능)', options: ['9G 워킹비자 및 AEP(노동허가증) 신규/갱신', 'SRRV (은퇴비자) 신규 발급', '13A (결혼비자) 및 가족 동반 비자', '관광비자 연장 및 ACR I-Card 발급', 'ECC (출국 허가증) 발급 대행', '블랙리스트(Blacklist) 해제 및 오버스테이 해결', '비자 다운그레이딩(Downgrading)'] },
    { id: 'visa_headcount', type: 'SINGLE_CHOICE', text: '비자 및 서류 수속 대상자의 총 인원을 선택해주세요.', options: ['본인 1명', '본인 및 가족 포함 2~4명', '기업 주재원 등 단체(5명 이상)'] },
    { id: 'visa_stay_status', type: 'SINGLE_CHOICE', text: '수속 대상자의 현재 필리핀 체류 상태를 알려주세요.', options: ['현재 합법적인 비자로 필리핀 내 체류 중', '오버스테이(Overstay) 상태로 페널티 부과 대상', '아직 필리핀 입국 전 (해외 체류 중)', '이미 출국하여 해외에서 처리 필요'] },
    { id: 'visa_sponsor_docs', type: 'SINGLE_CHOICE', text: '워킹비자(9G) 진행의 경우, 스폰서 법인(고용주)의 서류 준비 상태는 어떤가요?', options: ['SEC, GIS, Mayor\'s Permit, BIR 등 법인 서류 완비 (바로 신청 가능)', '법인 서류 일부 누락 또는 갱신 안 됨 (확인 필요)', '스폰서 법인이 없음 (에이전시 더미/스폰서 필요 여부 상담)', '워킹비자 진행 아님 (해당 없음)'] },
    { id: 'visa_new_or_renewal', type: 'SINGLE_CHOICE', text: '신규 발급인가요, 기존 비자 갱신인가요?', options: ['처음 신청하는 신규 발급', '만료 전 연장/갱신', '만료일이 이미 지난 후 갱신(페널티 예상)', '비자 취소(다운그레이딩)'] },
    { id: 'visa_start_date', type: 'DATE_PICKER', text: '서류 접수 대행 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 3주 뒤에 출국해야 해서 워킹비자 진행 중 출국 관련 수속(SRC 등)이 필요합니다, 관광비자가 6개월 이상 오버스테이 상태입니다 등' }
];

const PERMIT_STEPS = [
    { id: 'permit_types', type: 'MULTI_CHOICE', text: '대행이 필요하신 특수 인허가/면허의 종류를 선택해주세요. (다중 선택 가능)', options: ['FDA 인허가 (식품, 화장품, 의약품 수입/유통 LTO 및 CPR)', 'PCAB (필리핀 건설업 면허) 신규 및 갱신', 'DOLE (노동청) 안전 허가 및 등록', '환경부(DENR/LLDA) 관련 환경 인허가', '소방 필증 (FSIC) 및 바랑가이 클리어런스', '관세청(BOC) 수입업자 등록(AMO)'] },
    { id: 'permit_current_status', type: 'SINGLE_CHOICE', text: '진행하시려는 인허가의 상태를 알려주세요.', options: ['완전 신규 신청', '기존 인허가의 정기 갱신(Renewal)', '갱신 기간이 지나 페널티가 발생한 상태', '기존 대행사로부터 업무 이관 및 서류 보완 필요'] },
    { id: 'permit_biz_docs', type: 'SINGLE_CHOICE', text: '대상 사업체(법인/개인)의 기본 서류 구비 상태를 알려주세요.', options: ['SEC/DTI, Mayor\'s Permit, BIR 등 기본 사업 서류 완비', '기본 사업 서류부터 먼저 세팅해야 하는 상태', '외국인 지분 등 특정 요건 충족 여부 사전 컨설팅 필요'] },
    { id: 'permit_item_count', type: 'SINGLE_CHOICE', text: '인허가가 필요한 대상 물품 또는 사업장 수를 알려주세요.', options: ['단일 품목 또는 단일 사업장 1곳', '복수 품목(FDA 등) 2~5개', '복수 품목 5개 이상', '해당 사항 없음 (건설면허 등 기업 단위)'] },
    { id: 'permit_inspection_ready', type: 'SINGLE_CHOICE', text: '해당 기관의 사전 실사(Inspection) 준비가 되어 있나요?', options: ['사업장 및 시설 요건을 모두 갖추어 실사 대비 완료', '아직 시설 완비가 안 되어 컨설팅 필요', '실사가 필요 없는 서류 작업임', '정확히 모름'] },
    { id: 'permit_start_date', type: 'DATE_PICKER', text: '대행 업무 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 한국에서 화장품을 수입하기 위해 FDA CPR이 3개 품목 필요합니다, PCAB 건설 면허 승급(Upgrading) 서류 대행입니다 등' }
];

const TAGALOG_TRANS_STEPS = [
    { id: 'tl_service_types', type: 'MULTI_CHOICE', text: '필요하신 통번역 서비스의 종류를 선택해주세요. (다중 선택 가능)', options: ['문서 번역 (텍스트, 이메일, 계약서 등)', '대면 통역 (현장 동행, 회의 등)', '비대면 화상/전화 통역 (Zoom, 일반 통화 등)', '영상 자막 번역 및 더빙'] },
    { id: 'tl_field', type: 'SINGLE_CHOICE', text: '통번역이 필요한 주요 분야(문맥)를 선택해주세요.', options: ['일상 회화 및 관광 가이드', '관공서(시청, 이민국 등) 및 행정 서류', '법률 계약서 및 경찰/법원 출석', '비즈니스 미팅 및 무역', '의료 및 전문 기술 분야'] },
    { id: 'tl_doc_volume', type: 'SINGLE_CHOICE', text: '(번역의 경우) 대략적인 번역 분량을 선택해주세요.', options: ['A4 1~2장 내외 (간단한 이메일/증명서)', 'A4 3~10장', 'A4 10장 이상 (매뉴얼, 제안서 등)', '번역 아님 (통역만 필요)'] },
    { id: 'tl_interp_duration', type: 'SINGLE_CHOICE', text: '(통역의 경우) 예상되는 통역 소요 시간 또는 일정을 선택해주세요.', options: ['2시간 이내 (단건 미팅)', '반나절 (4시간 내외)', '종일 (8시간)', '며칠간 지속되는 일정', '통역 아님 (번역만 필요)'] },
    { id: 'tl_notarization', type: 'SINGLE_CHOICE', text: '[중요] 공식 기관 제출용 공증(Notarization) 또는 번역 확인 증명서가 필요한가요?', options: ['네, 필리핀 변호사 공증(Notary Public)까지 대행이 필요합니다', '네, 번역가의 서명이 들어간 확인서가 필요합니다', '아니요, 단순 참고 및 소통용입니다', '아직 모름 (상담 필요)'] },
    { id: 'tl_location', type: 'SINGLE_CHOICE', text: '(통역의 경우) 통역이 진행될 장소 형태를 알려주세요.', options: ['마닐라/메트로마닐라 내 고객 지정 장소 대면', '고객 지정 장소 대면이나 외곽/지방 출장 필요', '100% 온라인 비대면 진행', '해당 없음 (번역만)'] },
    { id: 'tl_start_date', type: 'DATE_PICKER', text: '통번역 작업(또는 미팅)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 필리핀 현지 직원들과의 노사 갈등 관련 미팅이라 분위기가 무거울 수 있습니다, 따갈로그어 외에 영어 통역도 섞어서 진행해야 합니다 등' }
];

const VISAYAN_TRANS_STEPS = [
    { id: 'vi_service_types', type: 'MULTI_CHOICE', text: '필요하신 통번역 서비스의 종류를 선택해주세요. (다중 선택 가능)', options: ['문서 번역', '대면 통역 (현장 동행, 회의 등)', '비대면 화상/전화 통역', '영상 자막 번역'] },
    { id: 'vi_dialect', type: 'SINGLE_CHOICE', text: '타겟 지역 또는 구체적인 비사야어 방언(Dialect)을 선택해주세요.', options: ['세부아노(Cebuano - 세부, 보홀 등)', '다바오에뇨(Davaoeño - 다바오 및 민다나오 지역)', '일롱고/힐리가이논(Ilonggo/Hiligaynon - 일로일로, 바콜로드 등)', '와라이(Waray - 사마르, 레이테 등)', '정확히 모름 (타겟 지역을 특이사항에 기재)'] },
    { id: 'vi_field', type: 'SINGLE_CHOICE', text: '통번역이 필요한 주요 분야(문맥)를 선택해주세요.', options: ['일상 회화 및 현지 관광', '건설/공장 등 현장 근로자 소통 (Safety/Toolbox meeting 등)', '비즈니스 및 관공서 업무', '법률 및 분쟁 해결', '기타 전문 분야'] },
    { id: 'vi_doc_volume', type: 'SINGLE_CHOICE', text: '(번역의 경우) 대략적인 번역 분량을 선택해주세요.', options: ['A4 1~2장 내외', 'A4 3~10장', 'A4 10장 이상', '번역 아님 (통역만 필요)'] },
    { id: 'vi_interp_duration', type: 'SINGLE_CHOICE', text: '(통역의 경우) 예상되는 통역 소요 시간 또는 일정을 선택해주세요.', options: ['2시간 이내', '반나절 (4시간 내외)', '종일 (8시간)', '며칠간 지속되는 일정 (지방 출장 포함)', '통역 아님 (번역만 필요)'] },
    { id: 'vi_location', type: 'SINGLE_CHOICE', text: '(통역의 경우) 통역이 진행될 장소 형태를 알려주세요.', options: ['비사야/민다나오 주요 도시 내 대면 진행 (세부, 다바오 등)', '오지 또는 외곽 지역 출장 필수 (차량 지원 가능)', '100% 온라인 비대면 진행', '해당 없음 (번역만)'] },
    { id: 'vi_start_date', type: 'DATE_PICKER', text: '통번역 작업(또는 미팅)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 민다나오 현지 농장 시찰 통역입니다, 영어나 따갈로그어를 전혀 못하는 현지인 대상입니다 등' }
];

const ENGLISH_TRANS_STEPS = [
    { id: 'en_service_types', type: 'MULTI_CHOICE', text: '필요하신 통번역 서비스의 종류를 선택해주세요. (다중 선택 가능)', options: ['문서 번역', '대면 통역', '비대면 화상/전화 통역', '영상 자막 번역 및 감수(Proofreading)'] },
    { id: 'en_field', type: 'SINGLE_CHOICE', text: '통번역이 필요한 주요 전문 분야를 선택해주세요.', options: ['일반 비즈니스 (이메일, 제안서, 일반 미팅)', 'IT 및 기술 (소프트웨어, 엔지니어링 등)', '법률 및 계약 (MOA, NDA, 고용계약서 등)', '의료 및 제약', '금융 및 회계', '학술 논문 및 유학 서류'] },
    { id: 'en_target_country', type: 'SINGLE_CHOICE', text: '대상 영어의 주요 타겟 국가나 문맥이 있나요?', options: ['필리핀 로컬 비즈니스 (Taglish 뉘앙스 및 현지 문화 이해 필요)', '미국/캐나다 타겟 (북미 표준 영어)', '글로벌 스탠다드 (일반적인 비즈니스 영어)', '무관함'] },
    { id: 'en_doc_volume', type: 'SINGLE_CHOICE', text: '(번역의 경우) 대략적인 번역 분량을 선택해주세요.', options: ['A4 1~2장 내외 (단어수 500자 미만)', 'A4 3~10장', 'A4 10장 이상 대량 문서', '번역 아님 (통역만 필요)'] },
    { id: 'en_interp_duration', type: 'SINGLE_CHOICE', text: '(통역의 경우) 예상되는 통역 소요 시간 또는 일정을 선택해주세요.', options: ['2시간 이내', '반나절 (4시간 내외)', '종일 (8시간)', '다일간의 컨퍼런스 및 전시회', '통역 아님 (번역만 필요)'] },
    { id: 'en_apostille', type: 'SINGLE_CHOICE', text: '[중요] 문서의 경우 공증/아포스티유(Apostille) 대행이 필요한가요?', options: ['필리핀 DFA 아포스티유 발급 대행까지 필요', '단순 필리핀 변호사 공증(Notarization)만 필요', '번역만 필요 (공증 불필요)', '번역 아님'] },
    { id: 'en_start_date', type: 'DATE_PICKER', text: '통번역 작업(또는 미팅)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 전문적인 IT 용어(블록체인 등)가 많이 포함된 피칭(Pitching) 행사 순차 통역입니다, SEC 제출용 정관 번역입니다 등' }
];

const MULTILANG_TRANS_STEPS = [
    { id: 'ml_language_pair', type: 'SINGLE_CHOICE', text: '통번역이 필요한 언어 쌍(Language Pair)을 선택해주세요.', options: ['중국어 ↔ 한국어/영어/타갈로그어', '일본어 ↔ 한국어/영어/타갈로그어', '스페인어 ↔ 한국어/영어/타갈로그어', '베트남어 등 기타 동남아어', '기타 유럽/중동어 (특이사항에 기재)'] },
    { id: 'ml_service_types', type: 'MULTI_CHOICE', text: '필요하신 통번역 서비스의 종류를 선택해주세요. (다중 선택 가능)', options: ['문서 번역', '대면 통역', '비대면 화상/전화 통역', '영상 자막 번역'] },
    { id: 'ml_field', type: 'SINGLE_CHOICE', text: '통번역이 필요한 주요 분야(문맥)를 선택해주세요.', options: ['일상 회화 및 관광 가이드', '비즈니스 미팅 및 기업 탐방', '관공서 및 법률 행정', 'IT 및 전문 기술', '의료 및 뷰티(성형/피부과 등)'] },
    { id: 'ml_doc_volume', type: 'SINGLE_CHOICE', text: '(번역의 경우) 대략적인 번역 분량을 선택해주세요.', options: ['A4 1~2장 내외', 'A4 3~10장', 'A4 10장 이상', '번역 아님 (통역만 필요)'] },
    { id: 'ml_interp_duration', type: 'SINGLE_CHOICE', text: '(통역의 경우) 예상되는 통역 소요 시간 또는 일정을 선택해주세요.', options: ['2시간 이내', '반나절 (4시간 내외)', '종일 (8시간)', '다일간 일정', '통역 아님 (번역만 필요)'] },
    { id: 'ml_location', type: 'SINGLE_CHOICE', text: '[중요] 통역이 진행될 장소 또는 번역 문서 제출처를 알려주세요.', options: ['필리핀 내 대면 진행 (수도권)', '필리핀 내 대면 진행 (지방/외곽)', '100% 비대면 온라인 진행', '대사관 등 공식 기관 제출용 (공증 필요)', '개인 보관 및 내부 소통용'] },
    { id: 'ml_start_date', type: 'DATE_PICKER', text: '통번역 작업(또는 미팅)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 구체적인 언어 및 특이사항을 적어주세요. (필수 기재)', placeholder: '예: [태국어 → 한국어] 번역입니다, 마닐라에 방문하는 스페인 바이어 대상 공장 투어 통역입니다 등' }
];

const GRAPHIC_DESIGN_STEPS = [
    { id: 'gd_work_types', type: 'MULTI_CHOICE', text: '필요하신 디자인 작업의 종류를 선택해주세요. (다중 선택 가능)', options: ['기업/브랜드 로고 (CI/BI)', '명함 및 봉투 등 서식류', '브로셔/카탈로그/전단지 (인쇄용)', '상품 패키지 및 라벨 디자인', '웹/SNS 콘텐츠용 이미지', '기타 (특이사항 기재)'] },
    { id: 'gd_reference_status', type: 'SINGLE_CHOICE', text: '현재 기획 및 참고 자료(레퍼런스) 보유 상태를 알려주세요.', options: ['뚜렷한 컨셉 스케치 및 벤치마킹 이미지 보유 중', '텍스트로 된 기획안만 보유', '아이디어 단계이며 디자이너의 창의적인 제안 필요', '기존 디자인의 리뉴얼(수정) 작업'] },
    { id: 'gd_usage_purpose', type: 'SINGLE_CHOICE', text: '디자인 결과물의 주된 활용 목적을 선택해주세요.', options: ['상업적 인쇄물 제작 (CMYK, 고해상도 필수)', '온라인/디지털 전용 (웹사이트, SNS 등)', '인쇄 및 온라인 겸용', '간판 등 대형 옥외광고용'] },
    { id: 'gd_source_files', type: 'SINGLE_CHOICE', text: '[중요] 원본 파일(AI, PSD 등) 및 저작권 양도가 필요하신가요?', options: ['원본 파일 제공 및 완전한 상업적 저작권 양도 필수 (추가 비용 발생 동의)', '원본 없이 고해상도 이미지 파일(JPG, PNG, PDF)만 필요', '고수와 상담 후 결정'] },
    { id: 'gd_meeting_type', type: 'SINGLE_CHOICE', text: '선호하시는 미팅 및 소통 방식을 선택해주세요.', options: ['100% 온라인/비대면 진행 (이메일, 메신저, 화상 등)', '마닐라/수도권 내 1~2회 대면 미팅 희망', '인하우스(사무실 출근) 파트타임 근무 희망'] },
    { id: 'gd_start_date', type: 'DATE_PICKER', text: '최종 디자인 납품(또는 초안 수령)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 필리핀 로컬 타겟팅이라 현지인들이 선호하는 색감과 폰트를 추천받고 싶습니다, 로고와 명함 디자인을 패키지로 진행하고 싶습니다 등' }
];

const WEB_DEV_STEPS = [
    { id: 'wd_platform_types', type: 'MULTI_CHOICE', text: '개발하고자 하는 플랫폼의 종류를 선택해주세요. (다중 선택 가능)', options: ['소개용 웹사이트 (랜딩페이지, 회사소개서 등)', '쇼핑몰/이커머스 웹사이트', '플랫폼 및 웹 서비스 (예약, 매칭 등)', '안드로이드(Android) 앱', '아이오에스(iOS) 앱', '모바일 하이브리드/크로스플랫폼 앱'] },
    { id: 'wd_project_stage', type: 'SINGLE_CHOICE', text: '현재 프로젝트의 준비 단계는 어디까지 진행되었나요?', options: ['아이디어만 있는 상태 (상세 기획부터 필요)', '화면 설계서(Wireframe) 및 스토리보드 보유', '디자인(Figma, XD 등)까지 완료되어 개발만 필요', '기존 운영 중인 서비스의 유지보수 및 기능 추가'] },
    { id: 'wd_local_integration', type: 'MULTI_CHOICE', text: '[중요] 필리핀 현지 특화 결제/물류 연동이 필요하신가요? (다중 선택 가능)', options: ['로컬 결제 게이트웨이(GCash, Maya, PayMongo 등) 연동 필수', '현지 배송 API (Lalamove, Grab, J&T 등) 연동 필수', '필리핀 로컬 SMS(OTP) 발송 연동 필수', '글로벌 서비스라 현지 연동 불필요', '아직 미정'] },
    { id: 'wd_hosting_status', type: 'SINGLE_CHOICE', text: '서버(Hosting) 및 도메인 준비 상태를 알려주세요.', options: ['고객(사) 명의로 도메인 및 서버(AWS, Cafe24 등) 확보 완료', '개발사(고수)에서 초기 세팅 및 대행 구매 요망', '기존 서버에서 이전(Migration) 작업 필요'] },
    { id: 'wd_budget', type: 'SINGLE_CHOICE', text: '예상하시는 총 프로젝트 예산(PHP)을 선택해주세요.', options: ['50,000 PHP 미만 (단순 템플릿 기반)', '50,000 ~ 150,000 PHP', '150,000 ~ 500,000 PHP', '500,000 PHP 이상 (맞춤형 플랫폼)', '상세 기획 후 견적 산출 희망'] },
    { id: 'wd_start_date', type: 'DATE_PICKER', text: '프로젝트 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 필리핀 현지 인터넷 환경(느린 속도)을 고려해 매우 가벼운 로딩 속도가 핵심입니다, 다국어(영어, 한국어, 타갈로그어) 지원이 필요합니다 등' }
];

const VIDEO_EDIT_STEPS = [
    { id: 've_platform_purpose', type: 'MULTI_CHOICE', text: '영상이 주로 활용될 플랫폼/목적을 선택해주세요. (다중 선택 가능)', options: ['유튜브(YouTube) 롱폼 콘텐츠', '숏폼 콘텐츠 (TikTok, Reels, Shorts)', '기업/제품 홍보 영상 (TVC, 랜딩페이지용)', '행사/웨딩/기념일 영상', '교육용 및 인강 영상'] },
    { id: 've_footage_status', type: 'SINGLE_CHOICE', text: '편집할 원본 영상(Footage) 소스의 상태를 알려주세요.', options: ['촬영된 원본 소스를 모두 제공함 (편집만 요망)', '촬영부터 편집까지 모두 의뢰함 (별도 촬영팀 필요)', '보유한 소스가 부족하여 스톡 영상(Stock Footage) 활용 편집 필요'] },
    { id: 've_video_length', type: 'SINGLE_CHOICE', text: '예상되는 최종 완성본의 길이를 선택해주세요.', options: ['1분 미만 (숏폼, 짧은 광고)', '1분 ~ 5분', '5분 ~ 15분', '15분 이상 (다큐, 행사 풀영상 등)', '여러 편을 제작해야 함 (특이사항 기재)'] },
    { id: 've_edit_elements', type: 'MULTI_CHOICE', text: '편집 시 필수적으로 포함되어야 하는 요소를 체크해주세요. (다중 선택 가능)', options: ['컷 편집 및 매끄러운 트랜지션', '기본 자막 (대수 타이핑 등)', '다국어 자막 번역 (영어, 타갈로그어 등 추가)', '모션 그래픽 및 특수 효과(VFX)', '색보정(Color Grading)', '배경음악(BGM) 및 효과음(SFX)'] },
    { id: 've_work_style', type: 'SINGLE_CHOICE', text: '선호하시는 작업 및 소통 방식을 선택해주세요.', options: ['100% 온라인 비대면 (클라우드로 대용량 파일 송수신)', '편집자가 사무실에 방문하여 인하우스 장비로 작업 희망', '첫 미팅만 오프라인으로 진행 후 온라인 작업'] },
    { id: 've_start_date', type: 'DATE_PICKER', text: '최종 영상 납품을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 필리핀 Z세대가 선호하는 빠른 템포와 밈(Meme)을 적극 활용해 주세요, 유튜브 채널 썸네일(Thumbnail) 디자인도 함께 요청합니다 등' }
];

const SNS_MARKETING_STEPS = [
    { id: 'sns_platforms', type: 'MULTI_CHOICE', text: '마케팅 및 관리가 필요한 타겟 플랫폼을 선택해주세요. (다중 선택 가능)', options: ['페이스북 (Facebook - 필리핀 1위 플랫폼)', '인스타그램 (Instagram)', '틱톡 (TikTok)', '링크드인 (LinkedIn)', '유튜브 (YouTube)', '기타 (특이사항 기재)'] },
    { id: 'sns_target_audience', type: 'SINGLE_CHOICE', text: '주요 타겟 고객층(Target Audience)은 누구인가요?', options: ['필리핀 로컬 현지인 (Taglish 등 로컬화된 콘텐츠 필요)', '필리핀 내 한국인 교민', '한국 내 소비자', '글로벌 및 영어권 소비자'] },
    { id: 'sns_work_scope', type: 'MULTI_CHOICE', text: '고수(에이전시)에게 맡기고 싶은 주요 업무 범위를 선택해주세요. (다중 선택 가능)', options: ['계정/페이지 초기 세팅 및 최적화', '정기적인 콘텐츠 기획 및 디자인 제작 (주 N회 포스팅)', '페이스북/인스타 유료 스폰서드 광고 집행 (Ads Management)', '고객 댓글 및 메시지(DM/PM) 응대 대행', '인플루언서(KOL) 섭외 및 관리'] },
    { id: 'sns_ads_budget_type', type: 'SINGLE_CHOICE', text: '[중요] 유료 광고(Paid Ads) 진행 시 예산 처리 방식을 선택해주세요.', options: ['대행 수수료(Management fee)만 지급하고, 광고비는 고객 카드로 직접 결제함', '대행 수수료와 실제 광고 소진 비용을 모두 합쳐서 견적(Turn-key) 요청', '유료 광고는 진행하지 않고 오가닉(Organic) 페이지만 관리함'] },
    { id: 'sns_page_status', type: 'SINGLE_CHOICE', text: '현재 페이지의 활성화 상태는 어떤가요?', options: ['이제 막 사업을 시작하여 페이지 신규 생성부터 필요함', '페이지는 있으나 방치되어 있어 리브랜딩이 필요함', '현재 활발히 운영 중이나 전문적인 광고/콘텐츠 스케일업이 필요함'] },
    { id: 'sns_start_date', type: 'DATE_PICKER', text: '마케팅 대행 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 페이스북 페이지 샵(Shop) 기능 세팅이 필수입니다, 일회성 이벤트 홍보가 아닌 월 단위 장기 계약을 희망합니다 등' }
];

const DEBUT_STEPS = [
    { id: 'debut_theme', type: 'SINGLE_CHOICE', text: '데뷰 파티의 주요 컨셉이나 테마를 선택해주세요.', options: ['모던/심플한 스타일', '화려한 동화/프린세스 컨셉', '빈티지/보헤미안', 'K-Pop 및 현대적인 파티', '아직 미정 (고수와 상담 후 결정)'] },
    { id: 'debut_scope', type: 'MULTI_CHOICE', text: '기획 및 준비가 필요한 서비스 범위를 선택해주세요. (다중 선택 가능)', options: ['전체 기획 및 준비 턴키 (Full Planning)', '행사 당일 현장 진행만 (On-the-day Coordination)', '베뉴 및 케이터링 섭외', '드레스 대여 및 헤어/메이크업(HMUA)', '사진 및 영상 촬영 (P&V)', '코틸리온(Cotillion), 18 Roses 등 프로그램 기획'] },
    { id: 'debut_guest_count', type: 'SINGLE_CHOICE', text: '예상되는 총 하객(Guest) 수를 선택해주세요.', options: ['50명 미만 (소규모)', '50 ~ 100명', '100 ~ 150명', '150명 이상'] },
    { id: 'debut_venue_status', type: 'SINGLE_CHOICE', text: '행사 베뉴(Venue) 섭외 상태를 알려주세요.', options: ['호텔 볼룸/연회장 예약 완료', '프라이빗 이벤트 홀/레스토랑 예약 완료', '야외/가든 베뉴 예약 완료', '베뉴부터 섭외 필요 (고수 추천 요망)'] },
    { id: 'debut_catering_rules', type: 'SINGLE_CHOICE', text: '[중요] 케이터링(식음료) 및 통돼지 바비큐(Lechon) 반입 규정을 확인하셨나요?', options: ['베뉴 자체 케이터링 이용 (외부 음식 반입 불가)', '외부 케이터링 및 레촌 반입 예정 (코르키지/Corkage 비용 확인 완료)', '아직 베뉴의 외부 반입 규정을 확인하지 못함', '케이터링 섭외부터 필요함'] },
    { id: 'debut_budget', type: 'SINGLE_CHOICE', text: '데뷰 파티의 총 예상 예산(PHP)을 선택해주세요.', options: ['100,000 PHP 미만', '100,000 ~ 250,000 PHP', '250,000 ~ 500,000 PHP', '500,000 PHP 이상'] },
    { id: 'debut_date', type: 'DATE_PICKER', text: '행사(데뷰) 예정일을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 코틸리온(Cotillion) 댄스 안무 지도가 가능한 팀을 원합니다, 주인공 드레스 2벌과 들러리 드레스 대여 패키지가 필요합니다 등' }
];

const CHRISTENING_STEPS = [
    { id: 'ch_scope', type: 'MULTI_CHOICE', text: '필요하신 세례식(Christening/Baptism) 기획 범위를 선택해주세요. (다중 선택 가능)', options: ['전체 기획 및 진행 (성당 수속 + 피로연)', '성당 예약 및 행정 지원만', '리셉션(파티) 베뉴 및 케이터링 섭외', '기념품(Souvenirs) 및 데코레이션 세팅', '사진 및 영상 촬영'] },
    { id: 'ch_guest_count', type: 'SINGLE_CHOICE', text: '대부모(Ninong & Ninang) 및 하객의 대략적인 규모를 선택해주세요.', options: ['직계 가족 및 소수의 대부모만 (30명 미만)', '중간 규모 파티 (30 ~ 70명)', '대규모 파티 (70명 이상)'] },
    { id: 'ch_church_status', type: 'SINGLE_CHOICE', text: '세례식이 진행될 성당/교회 예약 상태를 알려주세요.', options: ['성당 예약 및 일정 확정 완료', '희망하는 성당은 있으나 아직 예약 전', '성당 추천 및 예약 대행부터 필요'] },
    { id: 'ch_reception_venue', type: 'SINGLE_CHOICE', text: '세례식 후 이어질 리셉션(파티) 장소의 선호 형태를 선택해주세요.', options: ['레스토랑 프라이빗 룸', '성당 부속 연회장 (Parish Hall)', '호텔 또는 전문 이벤트 홀', '자택 또는 콘도/빌리지 클럽하우스', '미정 (상담 필요)'] },
    { id: 'ch_catering_style', type: 'SINGLE_CHOICE', text: '[중요] 피로연 파티의 스타일과 케이터링 선호 방식을 선택해주세요.', options: ['필리핀 전통식 (레촌 포함, 로컬 뷔페 스타일)', '모던하고 심플한 서양식 코스 또는 뷔페', '아이를 위한 특정 캐릭터/테마 파티 스타일', '고수와 상담 후 결정'] },
    { id: 'ch_date', type: 'DATE_PICKER', text: '세례식(또는 파티) 예정일을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 대부모님(Ninong/Ninang)들을 위한 특별한 답례품(Giveaways) 제작이 필요합니다, 성당 규정상 지정된 포토그래퍼만 촬영 가능 여부 확인이 필요합니다 등' }
];

const BIRTHDAY_PARTY_STEPS = [
    { id: 'bday_party_type', type: 'SINGLE_CHOICE', text: '기획하실 파티의 종류를 선택해주세요.', options: ['아이 첫돌/1세 생일 파티', '7세 생일 파티 (필리핀 주요 행사)', '일반 성인 생일 파티', '환갑/칠순 등 부모님 특별 생신 (Senior/Jubilee)', '결혼 기념일 등 기타 기념일'] },
    { id: 'bday_scope', type: 'MULTI_CHOICE', text: '필요하신 파티 기획 범위를 선택해주세요. (다중 선택 가능)', options: ['전체 기획 및 현장 진행 (Full Planning)', '파티 베뉴 섭외 및 케이터링', '파티 스타일링 (풍선, 백드롭, 포토존 등)', '엔터테인먼트 (마술사, 페이스페인팅, MC 등)', '사진 및 영상 촬영'] },
    { id: 'bday_guest_count', type: 'SINGLE_CHOICE', text: '예상되는 총 하객 수를 선택해주세요.', options: ['30명 미만 (프라이빗 소규모)', '30 ~ 70명', '70 ~ 150명', '150명 이상'] },
    { id: 'bday_venue_status', type: 'SINGLE_CHOICE', text: '파티 장소(Venue) 섭외 상태를 알려주세요.', options: ['호텔/레스토랑 예약 완료', '거주 중인 콘도/빌리지 클럽하우스(Function Room) 대관 완료', '장소 섭외부터 필요 (고수 추천 요망)'] },
    { id: 'bday_vendor_rules', type: 'SINGLE_CHOICE', text: '[중요] 외부 업체(데코, 엔터테이너, 케이터링) 반입에 대한 베뉴 규정을 확인하셨나요?', options: ['외부 반입 전면 허용 (보증금/Work Permit 등 납부 완료 또는 불필요)', '코르키지(Corkage) 및 벤더 반입 수수료 발생 (사전 확인 완료)', '아직 규정을 확인하지 못함 (고수 안내 필요)', '베뉴 미정'] },
    { id: 'bday_budget', type: 'SINGLE_CHOICE', text: '파티의 총 예상 예산(PHP)을 선택해주세요.', options: ['50,000 PHP 미만', '50,000 ~ 100,000 PHP', '100,000 ~ 200,000 PHP', '200,000 PHP 이상'] },
    { id: 'bday_date', type: 'DATE_PICKER', text: '파티 예정일을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: Jollibee나 McDonald\'s 파티 패키지 예약 대행을 원합니다, 야외 수영장 풀파티라 우천 시 대비책(Tent)이 필요합니다 등' }
];

const WEDDING_STEPS = [
    { id: 'wed_service_scope', type: 'SINGLE_CHOICE', text: '필요하신 웨딩 플래닝 서비스 범위를 선택해주세요.', options: ['전체 풀 플래닝 (예산부터 식장, 스드메까지 턴키)', '반 플래닝 (일부 벤더 예약 완료, 나머지 섭외 및 조율 지원)', '예식 당일 진행 디렉팅 (On-the-day Coordination)'] },
    { id: 'wed_venue_type', type: 'SINGLE_CHOICE', text: '선호하시는 웨딩의 형태 및 베뉴를 선택해주세요.', options: ['전통적인 성당/교회 예식 후 호텔 리셉션', '해변/비치 데스티네이션 웨딩 (보라카이, 세부 등)', '가든/야외 하우스 웨딩', '실내 전문 웨딩홀 및 레스토랑'] },
    { id: 'wed_guest_count', type: 'SINGLE_CHOICE', text: '예상되는 하객(Guest) 규모를 선택해주세요.', options: ['50명 미만 (스몰/마이크로 웨딩)', '50 ~ 100명', '100 ~ 200명', '200명 이상 (대규모)'] },
    { id: 'wed_booked_items', type: 'MULTI_CHOICE', text: '웨딩 준비 단계에서 현재 예약이 완료된 항목을 체크해주세요. (다중 선택 가능)', options: ['예식장 (성당/교회/채플)', '피로연장 (리셉션 베뉴)', '케이터링 업체', '스드메 (드레스, 헤어메이크업, 스튜디오)', '아직 아무것도 예약하지 않음 (초기 단계)'] },
    { id: 'wed_logistics', type: 'SINGLE_CHOICE', text: '[중요] 필리핀 현지 날씨 변수 및 장거리 이동(Logistics) 대비가 필요한가요?', options: ['야외/가든 예식이라 우천 대비(Tent 또는 실내 백업 베뉴) 필수', '타 지역 하객이 많아 버스 대절 및 호텔 숙박 어레인지 필수', '실내 예식이라 날씨 영향 없음', '상담 후 조율 필요'] },
    { id: 'wed_budget', type: 'SINGLE_CHOICE', text: '웨딩 전체 예상 예산(PHP)을 선택해주세요.', options: ['300,000 PHP 미만', '300,000 ~ 800,000 PHP', '800,000 ~ 1,500,000 PHP', '1,500,000 PHP 이상'] },
    { id: 'wed_date', type: 'DATE_PICKER', text: '예식 예정일(또는 희망월)을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 외국인-필리핀인 국제 결혼이라 혼인 신고서(CENOMAR 등) 행정 절차 안내도 필요합니다, 신부 들러리(Entourage) 드레스 맞춤 제작도 포함하고 싶습니다 등' }
];

const CORPORATE_EVENT_STEPS = [
    { id: 'corp_event_types', type: 'MULTI_CHOICE', text: '기획하실 기업 행사의 종류를 선택해주세요. (다중 선택 가능)', options: ['연말 크리스마스 파티 (Year-end Party)', '팀 빌딩 및 회사 워크샵', '제품 런칭쇼 및 VIP 초청 행사', '컨퍼런스, 세미나 및 학술 대회', '시상식 및 갈라 디너 (Gala/Awards)'] },
    { id: 'corp_headcount', type: 'SINGLE_CHOICE', text: '행사에 참여하는 예상 인원을 선택해주세요.', options: ['50명 미만', '50 ~ 150명', '150 ~ 300명', '300 ~ 500명', '500명 이상 대규모'] },
    { id: 'corp_work_scope', type: 'MULTI_CHOICE', text: '기획 및 대행이 필요한 업무 범위를 선택해주세요. (다중 선택 가능)', options: ['행사 전체 기획 및 디렉팅 (Total Directing)', '행사장 베뉴, 숙박, 케이터링 섭외', '무대 설치, 음향/조명/LED 시스템 (Technical)', 'MC, 초대가수, 공연팀 섭외', '행사 당일 현장 스태프 및 등록 데스크 운영'] },
    { id: 'corp_venue_status', type: 'SINGLE_CHOICE', text: '행사 장소(Venue) 준비 상태를 알려주세요.', options: ['자사 오피스/공장 내 진행 (무대 및 시스템 세팅만 필요)', '외부 호텔 및 컨벤션 센터 대관 완료', '리조트/야외 공간 대관 완료', '베뉴 섭외부터 필요 (고수 제안 요망)'] },
    { id: 'corp_billing_req', type: 'MULTI_CHOICE', text: '[중요] 법인 비용 처리를 위한 결제 및 행정 요건을 체크해주세요. (다중 선택 가능)', options: ['BIR 공식 영수증(Official Receipt) 발행 필수', '벤더 등록(Vendor Accreditation) 절차 진행 필수', '50% 선금, 50% 후불(Terms) 등 기업 결제 방식 선호', '공공기관 행사라 입찰(Bidding) 및 견적 비교 서류 필요', '해당 없음 (단순 결제)'] },
    { id: 'corp_setup_timing', type: 'SINGLE_CHOICE', text: '장비 셋업(Ingress) 및 철수(Egress)와 관련하여 베뉴 규정을 확인하셨나요?', options: ['행사 전날 야간부터 셋업(Ingress) 가능', '행사 당일 새벽/오전만 셋업 가능 (시간 촉박)', '베뉴 미정 및 아직 확인 전 (고수와 조율 필요)'] },
    { id: 'corp_date', type: 'DATE_PICKER', text: '행사 예정일(또는 시작일)을 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 팀빌딩 프로그램 중 필리핀 현지 직원들의 호응도가 높은 게임 위주로 구성해 주세요, 대형 경품 추첨(Raffle) 세션용 프로그램이 필요합니다 등' }
];

const LECHON_STEPS = [
    { id: 'lechon_type', type: 'SINGLE_CHOICE', text: '원하시는 레촌(Lechon)의 종류와 조리 방식을 선택해주세요.', options: ['오리지널 통돼지구이 (Whole Lechon)', '매콤한 맛 (Spicy Lechon)', '세부 스타일 레촌 (Cebu Style - 레몬그라스/허브 속재료)', '레촌 벨리/롤 (Lechon Belly - 뼈 없는 삼겹살 롤)', '기타 특수 구이 (송아지 Baka 등)'] },
    { id: 'lechon_serving_size', type: 'SINGLE_CHOICE', text: '드실 예상 인원(Pax) 및 사이즈를 선택해주세요.', options: ['15~20명 (De Leche / 초소형)', '30~40명 (Small / 소형)', '50~70명 (Medium / 중형)', '80~100명 (Large / 대형)', '100명 이상 (Jumbo 또는 여러 마리)'] },
    { id: 'lechon_service_scope', type: 'MULTI_CHOICE', text: '필요하신 서비스 제공 범위를 선택해주세요. (다중 선택 가능)', options: ['행사 장소로 단순 배달만 요망 (Drop-off)', '현장에서 직접 썰어주는 서비스 (Chopping/Carving Station) 포함', '밥(Rice) 및 기본 소스(Sarsa/Vinegar) 포함 패키지', '다른 뷔페 음식과 함께 풀 케이터링'] },
    { id: 'lechon_venue_rules', type: 'SINGLE_CHOICE', text: '[중요] 배달 및 행사 장소(Venue)의 외부 음식 반입 규정을 알려주세요.', options: ['자택 및 야외 (제한 없음)', '콘도/빌리지 (게이트 통과를 위한 Admin 사전 신고 완료)', '호텔/레스토랑 (코르키지/Corkage 비용 부과됨 - 고객 부담)', '아직 규정 확인 전'] },
    { id: 'lechon_accessibility', type: 'SINGLE_CHOICE', text: '행사가 열리는 층수 및 접근성을 알려주세요.', options: ['1층 또는 엘리베이터가 있는 건물 (운반 용이)', '계단으로 직접 운반해야 하는 2층 이상의 장소', '차량 진입이 어려운 좁은 골목 안쪽'] },
    { id: 'lechon_date', type: 'DATE_PICKER', text: '배달(또는 행사)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'lechon_delivery_time', type: 'SINGLE_CHOICE', text: '정확한 배달 도착(또는 식사 시작) 희망 시간을 선택해주세요.', options: ['오전 (10시~12시 사이)', '점심 시간 정각 (12시)', '오후 (2시~5시 사이)', '저녁 식사 (6시~8시 사이)', '야간 배달'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 껍질(Skin)이 매우 바삭하게 도착할 수 있도록 특별히 신경 써주세요, 썰지 말고 통째로 디스플레이할 예정입니다 등' }
];

const PARTY_CATERING_STEPS = [
    { id: 'pcatering_event_type', type: 'SINGLE_CHOICE', text: '케이터링이 필요한 행사의 종류를 선택해주세요.', options: ['결혼식 (Wedding Reception)', '데뷰 (18세 생일 파티)', '기업 행사 및 워크샵 (Corporate)', '아이 생일 및 세례식 (Kids/Christening)', '가족 및 친목 모임 (Private Party)'] },
    { id: 'pcatering_service_type', type: 'SINGLE_CHOICE', text: '케이터링 서비스의 형태를 선택해주세요.', options: ['풀 셋업 케이터링 (음식, 테이블, 의자, 식기, 웨이터 포함)', '단순 음식 배달 및 세팅 (Food Trays / Drop-off 뷔페)', '도시락/팩밀 배달 (Packed Meals/Bento)', '라이브 쿠킹 스테이션 (현장 조리)'] },
    { id: 'pcatering_menu_theme', type: 'MULTI_CHOICE', text: '선호하시는 음식 메뉴/테마를 선택해주세요. (다중 선택 가능)', options: ['필리핀 전통 음식 (로컬 퓨전 포함)', '서양식 (Continental/Italian 등)', '아시아/오리엔탈 (중식, 일식 등)', '한식 (Korean Buffet)', '채식(Vegetarian) 또는 할랄(Halal) 메뉴 포함 필수'] },
    { id: 'pcatering_pax', type: 'SINGLE_CHOICE', text: '예상되는 총 하객(Pax) 수를 선택해주세요.', options: ['30명 미만', '30 ~ 50명', '50 ~ 100명', '100 ~ 200명', '200명 이상'] },
    { id: 'pcatering_venue_rules', type: 'SINGLE_CHOICE', text: '[중요] 행사장(Venue) 예약 상태 및 케이터링 반입(Ingress) 규정을 체크해주세요.', options: ['외부 케이터링 반입이 100% 허용된 베뉴 (예약 완료)', '외부 반입 시 코르키지(Corkage) 비용이 발생함 (고객 부담)', '베뉴 측에서 제공하는 주방(Prep area) 사용 가능', '아직 베뉴 규정을 확인하지 못함', '베뉴 섭외부터 필요함'] },
    { id: 'pcatering_date', type: 'DATE_PICKER', text: '행사 예정일을 선택해주세요.' },
    { id: 'pcatering_setup_time', type: 'SINGLE_CHOICE', text: '행사장 셋업(Ingress) 가능 시간을 알려주세요.', options: ['행사 시작 3~4시간 전부터 여유롭게 셋업 가능', '행사 시작 1~2시간 전에만 짧게 셋업 가능 (시간 촉박)', '행사 전날 미리 셋업 가능', '아직 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: VIP용 별도 테이블(Plated service) 서빙이 필요합니다, 티파니 체어(Tiffany Chairs) 및 플로럴 센터피스 세팅이 포함된 패키지를 원합니다 등' }
];

const FOOD_CART_STEPS = [
    { id: 'fc_cart_types', type: 'MULTI_CHOICE', text: '원하시는 푸드 카트(간식)의 종류를 선택해주세요. (다중 선택 가능)', options: ['아이스크림 (Sorbetes/Dirty Ice Cream)', '팝콘 및 솜사탕 (Popcorn & Cotton Candy)', '감자튀김 및 핫도그', '타호 및 피시볼 (Taho, Fishball 등 로컬 스트릿푸드)', '밀크티 및 커피 음료', '추로스 및 와플'] },
    { id: 'fc_cart_count', type: 'SINGLE_CHOICE', text: '대여하실 푸드 카트의 총 개수(종류 수)를 선택해주세요.', options: ['1개 (단일 카트)', '2~3개 패키지', '4개 이상 (푸드 페스티벌 수준)', '고수 추천 패키지 상담 요망'] },
    { id: 'fc_servings', type: 'SINGLE_CHOICE', text: '카트당 제공해야 할 예상 인분(Servings/Pax)을 선택해주세요.', options: ['50 인분 (소규모 파티)', '100 인분 (일반 규모)', '150 ~ 200 인분', '200 인분 이상 무제한(Unlimited) 서비스 희망'] },
    { id: 'fc_electricity', type: 'SINGLE_CHOICE', text: '[중요] 행사장의 카트 설치 위치 및 전기 인프라 상태를 체크해주세요.', options: ['실내 홀 (안정적인 220V 콘센트 사용 가능)', '야외 공간이나 전기 연장선(Extension) 연결 가능', '완전 야외 (전기 없음, 자체 발전기/Generator 또는 가스 장비 필수)', '전기 불필요 (얼음/보온통 베이스)'] },
    { id: 'fc_service_hours', type: 'SINGLE_CHOICE', text: '카트 운영을 희망하시는 총 서비스 시간을 선택해주세요.', options: ['2~3시간 (기본 파티 시간)', '4~5시간', '종일 행사 (8시간 이상)', '시간 제한 없이 정해진 수량 소진 시까지'] },
    { id: 'fc_date', type: 'DATE_PICKER', text: '행사 예정일을 선택해주세요.' },
    { id: 'fc_ingress', type: 'SINGLE_CHOICE', text: '카트 반입(Ingress)을 위한 베뉴 접근성을 알려주세요.', options: ['1층 또는 대형 화물 엘리베이터 사용 가능', '계단으로만 카트를 들고 이동해야 함 (소형 분리형 카트 필수)', '야외 잔디밭/모래밭 이동 필요'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 아이 첫돌 파티라 카트 전면에 아이 사진이 들어간 커스텀 배너/타포린 부착이 가능할까요? 등' }
];

const CUSTOM_CAKE_STEPS = [
    { id: 'cake_event_type', type: 'SINGLE_CHOICE', text: '케이크가 사용될 행사의 종류를 선택해주세요.', options: ['생일/키즈 파티', '데뷰 (18세)', '웨딩 (결혼식)', '기업/브랜드 행사', '결혼기념일 등 특별한 축하', '브라이덜 샤워 및 파티'] },
    { id: 'cake_tier', type: 'SINGLE_CHOICE', text: '원하시는 케이크의 층수(Tier) 및 구성을 선택해주세요.', options: ['1단 (단층 케이크)', '2단 케이크', '3단 이상 대형 케이크', '컵케이크 타워 (상단 소형 케이크 + 컵케이크 세트)', '미니/도시락 케이크 (Bento cake) 수량 제작'] },
    { id: 'cake_design_style', type: 'SINGLE_CHOICE', text: '케이크의 메인 디자인 및 커버링 방식을 선택해주세요.', options: ['폰단트 (Fondant - 정교한 3D 캐릭터 및 조형물 디자인)', '버터크림 또는 프로스팅 (Buttercream/Icing - 심플/플라워 디자인)', '식용 사진 인쇄 (Edible Image/Photo cake)', '네이키드/러블리 스타일 (생화 장식 등)', '고수와 상담 후 결정'] },
    { id: 'cake_flavor', type: 'MULTI_CHOICE', text: '원하시는 케이크 시트(Base)의 맛을 선택해주세요. (다중 선택 가능)', options: ['촉촉한 초콜릿 (Moist Chocolate)', '바닐라 또는 버터 (Vanilla/Butter)', '레드벨벳 (Red Velvet)', '모카 또는 커피 (Mocha)', '필리핀 로컬 맛 (Ube, Pandan 등)'] },
    { id: 'cake_delivery_type', type: 'SINGLE_CHOICE', text: '[중요] 케이크 수령(배송) 방식을 어떻게 원하시나요?', options: ['파티 베뉴로 파티시에(제작자)가 직접 안전 배송 및 세팅 (Direct Delivery)', '고객이 샵으로 직접 방문 픽업 (Pick-up)', '그랩/랄라무브(Lalamove) 자동차(Car) 호출을 통한 배송 대행', '다단 케이크라 무조건 전문가 현장 조립(Assembly) 필수'] },
    { id: 'cake_date', type: 'DATE_PICKER', text: '케이크 수령(또는 행사) 예정일을 선택해주세요.' },
    { id: 'cake_reference_status', type: 'SINGLE_CHOICE', text: '디자인 참고용 사진(레퍼런스)을 보유하고 계신가요?', options: ['네, 정확히 똑같이 만들고 싶은 사진이 있습니다', '네, 대략적인 컨셉과 색감(Theme color) 사진이 있습니다', '아직 없으며 제안이 필요합니다'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 하단 1단만 진짜 케이크고, 위 2단은 스티로폼(Dummy)으로 제작해 예산과 무게를 줄이고 싶습니다, 아이가 견과류 알러지가 있습니다 등' }
];

const VIDEOKE_STEPS = [
    { id: 'vk_equipment_types', type: 'MULTI_CHOICE', text: '대여를 원하시는 장비의 종류를 선택해주세요. (다중 선택 가능)', options: ['비디오케 머신 (Videoke Machine - 최신곡 업데이트 포함)', '기본 PA 사운드 시스템 (스피커, 믹서, 마이크)', '밴드 또는 공연용 고급 음향 장비', '파티용 조명 (Party Lights/Lasers)', '프로젝터 및 스크린'] },
    { id: 'vk_headcount', type: 'SINGLE_CHOICE', text: '행사 규모와 예상 인원을 선택해주세요.', options: ['30명 미만 (소형 비디오케/스피커 1조)', '30 ~ 100명 (중형 행사용 시스템)', '100 ~ 200명 이상 (대형 연회장/야외 시스템)', '정확한 규모 모름'] },
    { id: 'vk_venue_noise', type: 'SINGLE_CHOICE', text: '[중요] 행사 장소(Venue)의 소음 규정 및 Admin 허가 상태를 알려주세요.', options: ['빌리지/바랑가이 (오후 10시 이후 소음 금지 커퓨/Curfew 있음)', '콘도미니엄 (Admin 승인 완료, 볼륨 제한 있음)', '방음이 완비된 실내 홀 또는 호텔 (제한 없음)', '야외/개인 사유지 (규정 없음)', '아직 확인 전'] },
    { id: 'vk_power_status', type: 'SINGLE_CHOICE', text: '장비 설치 장소의 전력(전기) 공급 상태를 체크해주세요.', options: ['안정적인 220V 콘센트 사용 가능 (실내)', '야외지만 전기 연장선(Extension wire)으로 연결 가능', '전기가 없는 완전 야외 (고수가 발전기/Generator 대여 필요)', '확인 전'] },
    { id: 'vk_rental_duration', type: 'SINGLE_CHOICE', text: '희망하시는 총 대여 시간을 선택해주세요.', options: ['반나절 (4~6시간 이내)', '종일 행사 (8시간 이상)', '1박 2일 (Overnight - 다음 날 회수)', '다일간 렌탈'] },
    { id: 'vk_accessibility', type: 'SINGLE_CHOICE', text: '무거운 장비 반입을 위한 현장 접근성을 알려주세요.', options: ['1층 또는 엘리베이터 사용 가능 (대차/트롤리 이동 가능)', '계단으로 직접 들고 운반해야 함 (추가 인건비 발생 가능)', '차량이 행사장 앞까지 직진입 가능'] },
    { id: 'vk_date', type: 'DATE_PICKER', text: '대여(또는 행사)를 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 무선 마이크(Wireless Mic)가 최소 4대 필요합니다, 유튜브 연결이 가능한 스마트 비디오케를 원합니다 등' }
];

const TENT_RENTAL_STEPS = [
    { id: 'tent_items', type: 'MULTI_CHOICE', text: '대여가 필요한 품목을 선택해주세요. (다중 선택 가능)', options: ['야외용 텐트 (Canopy / Monotent / 마키 텐트)', '기본 플라스틱 의자 (Monobloc chairs)', '고급 파티용 의자 (Tiffany / Ghost / Crossback chairs)', '원형 또는 사각 테이블', '테이블보 및 의자 커버 (Linens)', '야외용 대형 선풍기 (Industrial Fans) 및 쿨러'] },
    { id: 'tent_headcount', type: 'SINGLE_CHOICE', text: '사용 예상 인원(또는 대여 수량)을 선택해주세요.', options: ['30명 미만 (소규모 세트)', '30 ~ 50명', '50 ~ 100명', '100명 이상 (대형 행사)', '정확한 수량은 상담 후 결정'] },
    { id: 'tent_surface', type: 'SINGLE_CHOICE', text: '[중요] 텐트 및 장비가 설치될 바닥(Surface)의 형태를 알려주세요.', options: ['콘크리트/아스팔트 바닥 (팩 다운 불가, 무거운 물통/모래주머니 Weights 필수)', '흙바닥 또는 잔디밭 (팩/Peg 설치 가능)', '실내 홀 세팅 (텐트 불필요, 가구만 대여)', '잘 모름'] },
    { id: 'tent_access', type: 'SINGLE_CHOICE', text: '행사장의 자재 반입 규정 및 접근성을 알려주세요.', options: ['빌리지/콘도 (Admin 승인 완료 및 트럭 게이트 패스 발급 완료)', '대형 트럭(트럭반) 진입이 원활한 개인 사유지', '진입로가 좁아 작은 차로 여러 번 이동해야 함', '아직 규정을 확인하지 못함'] },
    { id: 'tent_weather', type: 'SINGLE_CHOICE', text: '기상 변수에 대비한 준비 상태를 선택해주세요.', options: ['우기(Rainy season) 대비 완전 방수 텐트 및 측면 가림막(Sidewalls) 필수', '건기/햇빛 차단용(Shade) 기본 텐트로 충분함', '실내 사용임', '고수의 날씨 상황에 맞춘 추천 요망'] },
    { id: 'tent_date', type: 'DATE_PICKER', text: '장비 대여(또는 행사)를 희망하시는 날짜를 선택해주세요.' },
    { id: 'tent_setup_time', type: 'SINGLE_CHOICE', text: '장비 셋업(Ingress) 및 철수(Egress) 가능 시간을 알려주세요.', options: ['행사 전날 미리 설치 및 행사 다음 날 철수 가능 (여유로움)', '행사 당일 몇 시간 전 설치 및 행사 직후 즉시 철수 필수 (시간 촉박)', '아직 베뉴와 조율 전'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 테이블보 및 의자 리본 색상을 파티 테마인 \'네이비 블루\'에 맞춰주세요, 텐트 내부에 조명(String lights) 설치도 필요합니다 등' }
];

const PHOTOBOOTH_STEPS = [
    { id: 'pb_service_types', type: 'MULTI_CHOICE', text: '대여를 원하시는 서비스를 선택해주세요. (다중 선택 가능)', options: ['일반 사진 인화 포토부스 (Photobooth)', '360도 비디오 부스 (360 Video Booth)', '매직 미러 부스 (Magic Mirror Booth)', '네온사인 및 커스텀 백드롭(Backdrop) 대여', '재미있는 촬영 소품(Props) 추가'] },
    { id: 'pb_duration', type: 'SINGLE_CHOICE', text: '포토부스 운영(대여)을 희망하시는 시간을 선택해주세요.', options: ['2시간 (기본 패키지)', '3시간', '4시간', '행사 내내 무제한 운영', '포토부스 아님 (소품/백드롭 단순 대여)'] },
    { id: 'pb_output_type', type: 'SINGLE_CHOICE', text: '(포토부스의 경우) 선호하시는 인화 및 결과물 제공 방식을 선택해주세요.', options: ['무제한 일반 인화지 출력 (Unlimited 4R prints)', '냉장고 자석형 인화 (Magnetic prints - 필리핀 인기)', '종이 인화 없이 이메일/QR코드 다운로드만 (Soft copy)', '360 비디오 파일만', '포토부스 아님'] },
    { id: 'pb_space_power', type: 'SINGLE_CHOICE', text: '[중요] 포토부스 설치 공간 및 전기 인프라 상태를 체크해주세요.', options: ['최소 2x2m 이상 평탄한 공간 및 전용 220V 콘센트 제공 가능', '공간은 충분하나 전기 연결선(Extension)이 길게 필요함', '야외 흙바닥/잔디밭 (평탄화용 합판/플로어링 필요)', '공간 사이즈 확인 전'] },
    { id: 'pb_template_design', type: 'SINGLE_CHOICE', text: '사진 템플릿(레이아웃) 또는 백드롭 디자인 방식을 선택해주세요.', options: ['주인공 이름/기업 로고가 들어간 완전 맞춤형(Custom) 디자인 희망', '업체가 보유한 기존 템플릿(Standard) 중 선택', '디자인 파일(AI/PSD)을 고객이 직접 제공함'] },
    { id: 'pb_venue_access', type: 'SINGLE_CHOICE', text: '행사장 형태 및 Admin 반입 규정을 알려주세요.', options: ['호텔/전문 베뉴 (반입 수수료 없음)', '콘도/빌리지 (Admin 반입 허가 및 게이트 패스 완료)', '아직 규정 확인 전', '반입 제한 없는 자택'] },
    { id: 'pb_date', type: 'DATE_PICKER', text: '대여(또는 행사)를 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 결혼식 하객용이라 식전 1시간, 식후 1시간으로 나누어(Split time) 운영 가능할까요?, 사진 템플릿에 스폰서 로고 3개를 넣어야 합니다 등' }
];

const SNAP_PHOTO_STEPS = [
    { id: 'sp_event_types', type: 'MULTI_CHOICE', text: '촬영이 필요한 행사 또는 목적을 선택해주세요. (다중 선택 가능)', options: ['웨딩 (본식 및 피로연)', '프리웨딩(Prenup) 및 커플 스냅', '데뷰(18세) 및 생일, 세례식', '기업 행사 및 세미나', '제품/상업 공간 촬영', '가족 사진 및 개인 프로필'] },
    { id: 'sp_service_scope', type: 'MULTI_CHOICE', text: '필요하신 서비스 범위를 선택해주세요. (다중 선택 가능)', options: ['사진 촬영만 (Photography)', '영상 촬영만 (Videography)', '사진 및 영상 패키지 (P&V)', '드론(Drone) 항공 촬영 추가', '행사 당일 편집 영상(SDE - Same Day Edit) 상영'] },
    { id: 'sp_duration', type: 'SINGLE_CHOICE', text: '예상되는 촬영 소요 시간을 선택해주세요.', options: ['2~4시간 (반나절 / 간단한 행사)', '5~8시간 (종일 / 웨딩 등 풀타임)', '8시간 이상 (추가 초과 수당 발생 동의)', '시간 제한 없이 행사 종료 시까지'] },
    { id: 'sp_venue_type', type: 'SINGLE_CHOICE', text: '[중요] 촬영 장소 형태 및 출장/이동(OOTF) 요건을 알려주세요.', options: ['메트로 마닐라 내 단일 장소 진행', '다중 장소 이동 (예: 호텔 준비 → 성당 → 피로연장)', '메트로 마닐라 외곽 및 지방 출장 (Out-of-town fee 및 숙박/교통 제공 필요)', '실내 스튜디오 대관 렌탈 필요'] },
    { id: 'sp_vendor_rules', type: 'SINGLE_CHOICE', text: '행사장(Venue)의 외부 포토그래퍼 반입 규정을 확인하셨나요?', options: ['외부 촬영팀 반입 100% 허용 (퍼밋 불필요 또는 납부 완료)', '코르키지(Corkage) 및 반입 수수료 발생함 (고객 부담)', '성당/교회 규정상 제단(Altar) 진입 제한 등 제약 있음', '아직 규정 확인 전'] },
    { id: 'sp_delivery_type', type: 'SINGLE_CHOICE', text: '원본 및 보정본 수령 방식을 선택해주세요.', options: ['모든 파일을 구글 드라이브/USB로만 수령 (Soft copy)', '사진 인화, 고급 앨범, 액자 제작 포함 (Hard copy 패키지)', '고수와 포트폴리오 상담 후 결정'] },
    { id: 'sp_date', type: 'DATE_PICKER', text: '촬영 희망 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 촬영 크루(Crew) 식사는 저희가 행사장 뷔페로 별도 제공합니다, 피로연 중간에 틀어야 할 SDE 영상 편집이 가장 중요합니다 등' }
];

const EVENT_MC_STEPS = [
    { id: 'mc_event_type', type: 'SINGLE_CHOICE', text: '진행자(MC)가 필요한 행사의 종류를 선택해주세요.', options: ['웨딩 리셉션', '데뷰 (18세 생일 파티)', '아이 생일파티 (Kiddie Party)', '기업 연말 파티 (Year-end) 및 팀빌딩', '컨퍼런스, 갈라 및 공식 행사'] },
    { id: 'mc_language_style', type: 'SINGLE_CHOICE', text: '원하시는 진행 언어 및 MC 스타일을 선택해주세요.', options: ['100% 영어 진행 (격식 있고 차분한 공식 행사)', '영어+타갈로그어 혼용 (Taglish - 로컬 하객 타겟의 활발한 파티)', '한국어+영어 혼용 (필리핀/한국 하객 믹스)', '유머러스하고 코믹한 스탠드업 코미디 스타일', '아직 미정'] },
    { id: 'mc_service_scope', type: 'MULTI_CHOICE', text: '필요하신 진행 서비스의 범위를 선택해주세요. (다중 선택 가능)', options: ['단독 MC 1명 진행', '코-호스트(Co-host) 포함 2명 이상 진행', '파티 게임 및 레크리에이션 기획/진행 포함', '행사 식순(Program flow) 기획 보조', '마술/노래 등 개인기(Talent) 포함'] },
    { id: 'mc_pa_status', type: 'SINGLE_CHOICE', text: '[중요] 행사장의 마이크 및 음향(PA) 시스템 상태를 알려주세요.', options: ['전문 음향팀 및 무선 마이크(Wireless mic) 완비됨', '기본 스피커만 있어 MC가 직접 오디오 잭/블루투스 연결 확인 필요', '음향 장비가 아예 없음 (MC 측에서 스피커 대여까지 턴키 요망)', '확인 전'] },
    { id: 'mc_headcount_duration', type: 'SINGLE_CHOICE', text: '예상되는 하객(Guest) 수와 행사 시간을 선택해주세요.', options: ['50명 미만 / 2~3시간 소요', '50 ~ 150명 / 4~5시간 소요', '150명 이상 대규모 / 8시간 종일 행사'] },
    { id: 'mc_venue_type', type: 'SINGLE_CHOICE', text: '행사장 형태 및 이동 요건을 알려주세요.', options: ['메트로 마닐라 내 호텔/전문 베뉴', '메트로 마닐라 내 야외/일반 레스토랑', '지방 출장(Out-of-town)으로 교통비 별도 지급 필요', '온라인 비대면(Zoom) 행사'] },
    { id: 'mc_date', type: 'DATE_PICKER', text: '행사 진행(섭외) 희망 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: K-pop을 좋아하는 데뷰 파티라 랜덤 플레이 댄스 게임을 능숙하게 이끌어 주실 분이 필요합니다, 대본(Script)은 주최 측에서 미리 작성해 제공합니다 등' }
];

const LIVE_BAND_STEPS = [
    { id: 'lb_entertainer_types', type: 'MULTI_CHOICE', text: '섭외를 원하시는 엔터테이너 종류를 선택해주세요. (다중 선택 가능)', options: ['어쿠스틱 듀오/트리오 (보컬+기타/건반)', '풀 밴드 (Full Band - 드럼, 베이스 포함)', '파티 및 클럽 DJ', '솔로 가수 (웨딩 축가 등)', '현악 3/4중주 (String Quartet - 클래식)'] },
    { id: 'lb_music_genre', type: 'SINGLE_CHOICE', text: '행사의 성격 및 주로 원하는 음악 장르를 선택해주세요.', options: ['웨딩/로맨틱 (발라드, 어쿠스틱 팝)', '데뷰 및 파티 (팝, 댄스, EDM)', '기업 행사/갈라 디너 (재즈, 보사노바, 라운지)', '로컬/OPM (Original Pilipino Music) 위주', '종교 행사 (CCM)'] },
    { id: 'lb_venue_pa', type: 'SINGLE_CHOICE', text: '[중요] 행사장(Venue)의 악기/음향(PA) 세팅 및 소음 규정을 체크해주세요.', options: ['풀 밴드용 악기 및 음향 시스템 완비됨', '음향 장비가 없어 밴드/DJ 측에서 악기와 스피커 일체 대여 요망 (견적 포함)', '빌리지 내라 밤 10시 이후 큰 소음(커퓨) 발생 불가', '아직 규정 및 장비 확인 전'] },
    { id: 'lb_performance_duration', type: 'SINGLE_CHOICE', text: '연주/공연 예상 소요 시간(세트)을 선택해주세요.', options: ['축가 및 특수 순서용 1~2곡만 (이벤트성)', '1~2세트 (1시간~1시간 반 내외)', '3세트 (피로연 및 식사 시간 전체 - 3시간 내외)', '종일 행사 또는 DJ 올나잇 파티'] },
    { id: 'lb_song_request', type: 'SINGLE_CHOICE', text: '희망하시는 곡 신청(Song Request) 방식을 선택해주세요.', options: ['고객이 사전에 전달한 플레이리스트 100% 연주 희망', '밴드/DJ의 추천 레퍼토리에 일임', '현장 하객들의 즉석 신청곡(Live request) 유연하게 허용'] },
    { id: 'lb_green_room', type: 'SINGLE_CHOICE', text: '엔터테이너 대기실(Green room) 및 식사 제공 여부를 알려주세요.', options: ['별도 대기실 및 행사 뷔페(Crew meal) 제공 가능', '식사 제공 불가 (견적에 식대 포함 요망)', '조율 필요'] },
    { id: 'lb_date', type: 'DATE_PICKER', text: '공연(행사) 희망 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 신부 입장 시 특정 팝송을 어쿠스틱 버전으로 직접 편곡해 라이브로 불러주세요, DJ 장비(Pioneer CDJ) 대여도 패키지에 포함해 주세요 등' }
];

const HMUA_STEPS = [
    { id: 'hmua_event_type', type: 'SINGLE_CHOICE', text: '메이크업을 받으실 분의 주요 행사/목적을 선택해주세요.', options: ['웨딩 (신부 본식)', '프리웨딩(Prenup) 사진/영상 촬영', '데뷰 (18세 파티 주인공)', '졸업식(Graduation) 및 프롬', '일반 파티 하객 참석용', '프로필 및 상업 광고 촬영'] },
    { id: 'hmua_pax', type: 'MULTI_CHOICE', text: '메이크업을 진행할 인원 및 대상을 모두 선택해주세요. (다중 선택 가능)', options: ['주인공 1명 (신부/데뷰탄트 등)', '혼주 및 직계 가족', '신부/파티 들러리 (Entourage)', '남성(신랑 등) 헤어 및 그루밍'] },
    { id: 'hmua_style', type: 'SINGLE_CHOICE', text: '원하시는 메이크업 스타일을 선택해주세요.', options: ['내추럴/투명한 한국식(K-Beauty) 스타일', '진한 윤곽과 인조 속눈썹 강조형 서양식(Glam) 스타일', '사진/영상 촬영에 적합한 조명용(HD/매트) 스타일', '고수와 포트폴리오 상담 후 결정'] },
    { id: 'hmua_location', type: 'SINGLE_CHOICE', text: '[중요] 메이크업 진행 장소 및 출장 요건을 선택해주세요.', options: ['지정한 호텔/자택으로 출장 방문(Home service/On-location) 희망', '고수의 메이크업 샵/스튜디오로 직접 방문 예정', '지방 출장(Out-of-town) 필수 (교통/숙박비 지원 요망)'] },
    { id: 'hmua_retouch', type: 'SINGLE_CHOICE', text: '촬영/행사 중 수정 메이크업(Retouching) 서비스가 필요한가요?', options: ['행사 내내 동행하며 드레스 변경 시 수정 메이크업(Second look) 변경 필수', '초기 헤어/메이크업 세팅 완료 후 철수 (리터치 불필요)', '상담 후 결정'] },
    { id: 'hmua_date', type: 'DATE_PICKER', text: '메이크업(행사) 희망 날짜를 선택해주세요.' },
    { id: 'hmua_call_time', type: 'SINGLE_CHOICE', text: '메이크업 아티스트가 도착해야 하는 시간(Call time)을 선택해주세요.', options: ['새벽 시간대 (오전 6시 이전 - Early call charge 발생 동의)', '오전 시간대 (오전 6시 ~ 12시)', '오후 시간대', '야간 파티 대비 저녁 시간'] },
    { id: 'hmua_special_tools', type: 'MULTI_CHOICE', text: '특수 장비/기법이 필요한가요? (다중 선택 가능)', options: ['땀과 물에 강한 에어브러시(Airbrush) 메이크업 기법', '헤어 볼륨을 위한 붙임머리/가발(Hair extension) 추가', '바디 메이크업 (어깨/등 커버)', '해당 없음 (일반 브러시 메이크업)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 들러리가 5명이라 아티스트 보조(Assistant) 동행이 필수입니다, 피부가 예민하여 제가 쓰는 화장품으로 진행해 주셨으면 합니다 등' }
];

const ENG_CONVERSATION_STEPS = [
    { id: 'ec_purpose', type: 'MULTI_CHOICE', text: '영어를 배우려는 주된 목적을 선택해주세요. (다중 선택 가능)', options: ['필리핀 일상 생활 및 생존 영어 (마트, 식당, 콘도 Admin 소통 등)', '현지 친구 사귀기 및 친목', '자녀의 학교(국제학교 등) 학부모 상담 대비', '여행 및 취미', '왕초보 탈출 및 기초 문법 확립'] },
    { id: 'ec_level', type: 'SINGLE_CHOICE', text: '현재 수강생의 대략적인 영어 실력은 어느 정도인가요?', options: ['알파벳과 아주 기초적인 단어만 아는 왕초보 수준', '간단한 문장으로 더듬더듬 의사소통이 가능한 초급', '일상 대화는 가능하지만 문법과 어휘가 부족한 중급', '유창하게 말하고 싶어 연습 상대가 필요한 고급'] },
    { id: 'ec_tutor_style', type: 'SINGLE_CHOICE', text: '선호하시는 튜터의 악센트(발음) 및 티칭 스타일을 선택해주세요.', options: ['미국식(Neutral) 악센트를 구사하는 튜터 (BPO/콜센터 경력자 등)', '발음보다는 친절하고 천천히 말해주는 필리핀 로컬 친화적 튜터', '문법과 교재 위주로 꼼꼼하게 가르치는 튜터', '자유로운 프리토킹(Free talking) 위주의 튜터'] },
    { id: 'ec_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 레슨 진행 방식 및 장소를 선택해주세요.', options: ['교통체증(Traffic) 걱정 없는 100% 온라인 화상 레슨 (Zoom, Skype 등)', '수강생의 자택(콘도/빌리지)으로 튜터가 직접 방문', '주변 조용한 카페나 스터디룸에서 대면 진행', '튜터가 지정한 장소(어학원/자택)로 수강생이 방문'] },
    { id: 'ec_access_rules', type: 'SINGLE_CHOICE', text: '[중요] (방문 레슨 시) 콘도/빌리지 출입 규정 및 요구사항을 알려주세요.', options: ['로비/게이트에 신분증(ID)만 맡기면 출입 가능', '사전에 Admin에 튜터 등록(Work/Visitor permit) 필수', '대면 방문이 아니므로 해당 없음'] },
    { id: 'ec_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['주 2~3회 평일 주간 (오전/오후)', '주 2~3회 평일 저녁 퇴근 후', '주말(토/일) 집중 레슨', '매일 조금씩 (주 5회 이상)', '고수와 스케줄 유동적 조율'] },
    { id: 'ec_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 영어를 전혀 못해서 한국어를 조금이라도 할 줄 아는 필리핀 튜터였으면 좋겠습니다, 초등학생 자녀 2명이 함께 그룹 과외를 받으려고 합니다 등' }
];

const LOCAL_LANG_STEPS = [
    { id: 'll_language', type: 'SINGLE_CHOICE', text: '배우고자 하는 정확한 로컬 언어를 선택해주세요.', options: ['표준 타갈로그어 (Tagalog - 마닐라 및 루손 지역)', '비사야어/세부아노 (Bisaya/Cebuano - 세부, 다바오 등 민다나오 지역)', '일롱고 (Ilonggo/Hiligaynon)', '일로카노 (Ilocano)', '기타 방언 (특이사항 기재)'] },
    { id: 'll_purpose', type: 'MULTI_CHOICE', text: '해당 로컬 언어를 배우려는 주된 목적이 무엇인가요? (다중 선택 가능)', options: ['필리핀 로컬 직원(현장직, 운전기사 등) 업무 지시 및 관리', '가사도우미(Ate/Yaya)와의 명확한 소통', '현지인 파트너 및 친구, 가족과의 친밀한 대화', '관공서, 재래시장 등 완전한 현지화 생존', '단순한 언어적 호기심'] },
    { id: 'll_level', type: 'SINGLE_CHOICE', text: '현재 수강생의 해당 로컬 언어 구사 수준은 어느 정도인가요?', options: ['\'살라맛(Salamat)\', \'뽀(Po)\' 등 기본 인사말만 아는 완전 기초', '자주 쓰는 생활 단어와 짧은 문장 구사 가능', '어느 정도 듣고 이해하지만 말하기가 안 되는 상태'] },
    { id: 'll_instruction_lang', type: 'SINGLE_CHOICE', text: '[중요] 레슨을 진행할 매개 언어(Instruction language)를 선택해주세요.', options: ['튜터가 \'영어\'로 타갈로그어/비사야어의 문법과 뜻을 설명 희망', '튜터가 \'한국어\'로 설명 가능해야 함 (희귀 인력으로 단가 상승 가능)', '영어를 쓰지 않고 해당 로컬 언어로만 직접 부딪히며 진행'] },
    { id: 'll_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 레슨 진행 방식 및 장소를 선택해주세요.', options: ['100% 온라인 화상 레슨', '수강생 자택(콘도) 및 사무실로 튜터 방문', '조용한 외부 카페 미팅', '튜터 지정 장소 방문'] },
    { id: 'll_access_rules', type: 'SINGLE_CHOICE', text: '(방문 레슨 시) 콘도/사무실 출입 규정을 체크해주세요.', options: ['단순 신분증(ID) 제출로 게이트/로비 통과 가능', 'Admin에 튜터 출입 사전 등록 필요', '온라인 진행이라 출입 규정 불필요'] },
    { id: 'll_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['주 2~3회 평일 주간', '주 2~3회 평일 저녁', '주말 전용', '고수와 유동적 스케줄 조율'] },
    { id: 'll_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 세부(Cebu) 현장 발령 예정이라 순수 마닐라 타갈로그어가 아닌 세부아노(Cebuano) 기초가 반드시 필요합니다, 현지 건설 현장 용어 위주로 배우고 싶습니다 등' }
];

const BUSINESS_ENG_STEPS = [
    { id: 'be_situation', type: 'MULTI_CHOICE', text: '비즈니스 영어가 가장 시급하게 필요한 구체적인 상황을 선택해주세요. (다중 선택 가능)', options: ['격식 있는 비즈니스 이메일 작성 및 슬랙(Slack) 등 업무 메신저 소통', '영어 프레젠테이션(PT) 및 프로젝트 피칭 준비', '해외 바이어 및 클라이언트와의 화상 회의(Zoom/Teams) 주도', '다국적 기업 취업 및 이직을 위한 영어 면접(Job Interview) 준비', '콜드 콜링(Cold Calling) 및 세일즈 영업 멘트 훈련'] },
    { id: 'be_industry', type: 'SINGLE_CHOICE', text: '튜터가 특히 숙지하거나 배경지식이 있었으면 하는 산업 분야가 있나요?', options: ['IT, 소프트웨어 및 엔지니어링', '무역, 수출입 및 물류', '금융, 회계 및 은행업', '의료, 제약 및 간호', '특정 분야 없음 (일반적인 비즈니스 범용 영어)'] },
    { id: 'be_level', type: 'SINGLE_CHOICE', text: '현재 수강생의 비즈니스 영어 구사 수준은 어느 정도인가요?', options: ['일상 회화는 가능하나 프로페셔널한 비즈니스 어휘와 포맷을 전혀 모름', '중급 수준으로 이메일 등은 쓰지만 보다 세련되고 고급스러운 어휘 확장이 필요함', '원어민과의 업무 소통은 무리 없으나 발음 교정 및 미세한 뉘앙스 차이(Politeness)를 다듬고 싶음'] },
    { id: 'be_tutor_req', type: 'SINGLE_CHOICE', text: '튜터에게 바라는 가장 중요한 자격 요건은 무엇인가요?', options: ['다국적 기업(MNC)이나 대형 BPO(콜센터) 매니저급 이상 실무 근무 경력자 보유', '미국/영국 원어민 수준의 완벽하고 중립적인 악센트', '비즈니스 영어 전문 티칭 자격증(TESOL, TEFL 등) 보유자', '상관없음 (실력 위주 테스트 후 결정)'] },
    { id: 'be_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 레슨 진행 방식 및 장소를 선택해주세요.', options: ['시간 절약을 위한 100% 온라인 비대면 레슨', '고객의 회사(오피스/회의실)로 튜터 출장 방문', '고객의 자택(콘도) 방문', '조용한 카페 및 비즈니스 라운지 미팅'] },
    { id: 'be_access_rules', type: 'SINGLE_CHOICE', text: '[중요] (회사/오피스 방문 시) 출입 인가 및 보안 규정을 알려주세요.', options: ['로비에서 방문자 등록만으로 회의실 출입 가능', '빌딩 관리소(Admin) 및 회사 HR에 외부인 사전 등록 필수', '온라인 진행이므로 해당 없음'] },
    { id: 'be_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['출근 전 이른 아침 시간대', '점심 시간 활용 (1시간 내외)', '퇴근 후 저녁 시간대', '주말 집중반', '튜터와 유동적으로 스케줄 조율'] },
    { id: 'be_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 다음 달 미국 본사 경영진 앞에서의 사업 성과 프레젠테이션 대본 첨삭과 모의 발표(Mock presentation) 피드백이 집중적으로 필요합니다 등' }
];

const BPO_PREP_STEPS = [
    { id: 'bpo_account_types', type: 'MULTI_CHOICE', text: '목표로 하는 BPO/콜센터의 주요 어카운트(Account) 및 직무를 선택해주세요. (다중 선택 가능)', options: ['인바운드 고객 지원 (Customer Service)', '아웃바운드 세일즈 및 텔레마케팅', '기술 지원 (Tech Support/IT)', '헬스케어 및 의료 코딩 (Healthcare/Medical Billing)', '금융 및 은행 (Financial/Banking)', '비음성 업무 (Non-Voice/Chat/Email Support)'] },
    { id: 'bpo_english_level', type: 'SINGLE_CHOICE', text: '현재 본인의 영어 구사 능력 및 발음 수준을 어떻게 평가하시나요?', options: ['기초적인 의사소통만 가능한 수준', '일상 대화는 가능하나 억양(Accent) 및 문법 교정이 필요한 중급', 'BPO 프리미엄 어카운트(미국/영국) 합격을 목표로 하는 고급(Near-native)', '아직 모름 (레벨 테스트 희망)'] },
    { id: 'bpo_weak_areas', type: 'MULTI_CHOICE', text: 'BPO 채용 과정 중 가장 취약하거나 집중 훈련이 필요한 부분을 선택해주세요. (다중 선택 가능)', options: ['초기 전화 면접 (Initial Phone Screening)', '어휘/발음 테스트 (Versant, Berlitz, SVAR 등)', '타이핑 속도 및 컴퓨터 내비게이션 시험', '최종 심층 면접 (Final Interview / 상황 대처 질문)', '모의 콜 테스트 (Mock Call Simulation)'] },
    { id: 'bpo_work_shift', type: 'SINGLE_CHOICE', text: '취업 시 희망하는 근무 형태와 시간대를 선택해주세요.', options: ['미국/야간 교대 근무(Graveyard shift) 지원 예정', '주간 근무(AU/UK/Local)만 희망', '재택근무(WFH) 포지션 우선 지원', '오피스 출근(On-site) 선호'] },
    { id: 'bpo_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 레슨 진행 방식을 선택해주세요.', options: ['100% 온라인 화상 레슨 (Zoom, Skype 등)', '수강생의 자택/콘도로 튜터 출장 방문', '튜터가 지정한 장소(어학원 등)로 방문', '조용한 카페 미팅'] },
    { id: 'bpo_start_date', type: 'DATE_PICKER', text: '레슨(훈련) 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'bpo_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간 (오전/오후)', '평일 저녁', '주말(토/일) 전용', '튜터와 자유롭게 스케줄 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콜센터 경력은 없지만 영문학과를 졸업했습니다, BPO 면접에서 3번 떨어져서 최종 면접 팁(STAR 기법)이 절실합니다 등' }
];

const VA_TRAINING_STEPS = [
    { id: 'va_train_fields', type: 'MULTI_CHOICE', text: '집중적으로 배우고 싶은 가상 비서(VA) 전문 분야를 선택해주세요. (다중 선택 가능)', options: ['일반 사무 보조 및 데이터 입력 (General Admin/Data Entry)', '소셜 미디어 관리 (SMM / 페이스북, 인스타, 틱톡)', '이커머스 관리 (Shopify, Amazon, Lazada 등)', '부동산 VA (Real Estate / Cold Calling)', '회계 및 장부 정리 (Bookkeeping / Xero, QuickBooks)', '그래픽 디자인 및 영상 편집 기초'] },
    { id: 'va_train_background', type: 'SINGLE_CHOICE', text: '현재 본인의 관련 경력 및 배경을 선택해주세요.', options: ['BPO나 프리랜서 경험이 전혀 없는 완전 초보', 'BPO(콜센터) 경력은 있으나 VA 프리랜서 업무는 처음', '기존 VA 경험이 있으며 특정 고급 기술(Niche skill) 업스킬링 희망', '일반 회사원 출신'] },
    { id: 'va_train_tools', type: 'MULTI_CHOICE', text: '실무 교육 시 꼭 다루었으면 하는 소프트웨어/툴을 체크해주세요. (다중 선택 가능)', options: ['Google Workspace (Docs, Sheets 등) 및 MS Office', 'Canva 및 기초 디자인 툴', '프로젝트 관리 툴 (Trello, Asana, Notion 등)', 'CRM 툴 (HubSpot, Salesforce 등)', '화상 회의 및 커뮤니케이션 툴 (Slack, Zoom)', '프리랜서 플랫폼 사용법 (Upwork, OnlineJobs.ph 프로필 세팅)'] },
    { id: 'va_train_infra', type: 'SINGLE_CHOICE', text: '[중요] 실제 VA 업무 및 온라인 레슨을 위한 재택(WFH) 인프라 상태를 알려주세요.', options: ['개인 노트북/PC 및 안정적인 광랜(Fiber internet) 보유 완료', '노트북/PC는 있으나 인터넷이 불안정함(모바일 데이터 사용 등)', '아직 개인용 PC/노트북이 없어 구매 전임'] },
    { id: 'va_train_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 레슨 진행 방식을 선택해주세요.', options: ['화면 공유(Screen share)가 필수적인 100% 온라인 비대면 레슨', '수강생이 개인 노트북을 지참하여 대면(Face-to-Face) 레슨', '오프라인과 온라인을 섞은 하이브리드 방식'] },
    { id: 'va_train_start_date', type: 'DATE_PICKER', text: '교육 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'va_train_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간', '평일 저녁', '주말 전용', '고수와 유동적 스케줄 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 영어가 완벽하지 않아 클라이언트와 이메일 템플릿으로 소통하는 방법을 중점적으로 배우고 싶습니다, 페이팔(PayPal)/와이즈(Wise) 등 대금 수령 세팅 방법도 알려주세요 등' }
];

const CODING_LESSON_STEPS = [
    { id: 'cl_fields', type: 'MULTI_CHOICE', text: '배우고자 하는 프로그래밍 분야/목표를 선택해주세요. (다중 선택 가능)', options: ['웹 프론트엔드 (HTML, CSS, JavaScript, React, Vue 등)', '웹 백엔드 (Node.js, Python, PHP, Java 등)', '모바일 앱 개발 (Flutter, React Native, Swift 등)', '데이터 사이언스 및 AI (Python, SQL 등)', '게임 개발 (Unity, C# 등)', '알고리즘 및 코딩 테스트(면접) 준비'] },
    { id: 'cl_level', type: 'SINGLE_CHOICE', text: '현재 수강생의 코딩 지식 수준은 어느 정도인가요?', options: ['코딩을 한 번도 해본 적 없는 완전 기초 (비전공자)', '기초 문법(변수, 조건문 등) 정도만 아는 초급', '간단한 토이 프로젝트는 만들어본 중급 (아키텍처/실무 팁 필요)', '특정 프레임워크의 심화 과정이나 코드 리뷰(멘토링)가 필요한 고급'] },
    { id: 'cl_goal', type: 'SINGLE_CHOICE', text: '코딩을 배우려는 가장 주된 목적을 선택해주세요.', options: ['IT 기업 취업 및 커리어 전환 (Developer 포지션)', '프리랜서 활동 (외주 프로젝트 수주)', '학교/대학 전공 과목 보충 및 시험 대비', '개인적인 취미 및 사이드 프로젝트 개발'] },
    { id: 'cl_lesson_type', type: 'SINGLE_CHOICE', text: '레슨 진행 방식 및 실습 환경을 선택해주세요.', options: ['100% 온라인 레슨 (화면 공유 및 Live Share 사용)', '수강생이 본인 노트북을 지참하여 대면(오프라인) 레슨', '수강생에게 PC가 없어 튜터의 장비/컴퓨터실 사용 필수 (튜터 방문)'] },
    { id: 'cl_instruction_lang', type: 'SINGLE_CHOICE', text: '레슨을 진행할 선호 언어(Instruction Language)를 선택해주세요.', options: ['영어 (글로벌 IT 환경 적응을 위해 영어 위주 설명 희망)', '타갈로그어/비사야어 (쉬운 로컬 언어로 기초부터 확실한 이해 희망)', '한국어 (튜터가 한국인일 경우)', '상관없음'] },
    { id: 'cl_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'cl_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간', '평일 저녁', '주말 전용반', '유동적 스케줄 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: Next.js와 Supabase를 활용한 사스(SaaS) 만들기 실전 프로젝트 위주로 수업을 진행하고 싶습니다, 맥북(MacBook) 환경에서 실습 예정입니다 등' }
];

const IELTS_STEPS = [
    { id: 'ielts_exam_type', type: 'SINGLE_CHOICE', text: '준비하고자 하는 공식 영어 시험의 종류를 선택해주세요.', options: ['IELTS Academic (유학 및 전문직 취업용)', 'IELTS General Training (이민 및 일반 취업용)', 'OET (의료/간호 전문직용)', 'TOEFL iBT', '아직 어떤 시험을 볼지 결정하지 못함 (상담 필요)'] },
    { id: 'ielts_target_score', type: 'SINGLE_CHOICE', text: '목표로 하는 점수(Target Score/Band)를 선택해주세요.', options: ['IELTS 5.5 ~ 6.0 (기본 요건)', 'IELTS 6.5 ~ 7.0 (주요 대학 및 일반 취업)', 'IELTS 7.5 이상 (고득점)', 'OET B 등급 이상 (UK/AU 간호사 등)', 'TOEFL 80~100점 이상', '목표 점수 미정'] },
    { id: 'ielts_current_level', type: 'SINGLE_CHOICE', text: '현재 본인의 대략적인 영어 실력이나 해당 시험 경험을 알려주세요.', options: ['해당 시험을 처음 준비하며, 기초 영어 실력부터 다져야 함 (초보)', '기본 영어 회화는 가능하나 시험 유형 파악이 필요함 (중급)', '이미 시험 응시 경험이 있으나 목표 점수 달성에 실패함 (재도전)', '특정 파트만 집중 공략하면 되는 고득점자'] },
    { id: 'ielts_weak_parts', type: 'MULTI_CHOICE', text: '가장 취약하거나 집중 튜터링이 필요한 파트를 선택해주세요. (다중 선택 가능)', options: ['스피킹 (Speaking - 원어민/전문 튜터와의 모의고사 훈련 필요)', '라이팅 (Writing - 에세이 구조 및 문법 첨삭 필수)', '리딩 (Reading - 시간 단축 및 독해 스킬)', '리스닝 (Listening)', '전 영역 고른 대비 (Full package)'] },
    { id: 'ielts_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 튜터링(레슨) 진행 방식을 선택해주세요.', options: ['100% 온라인 화상 레슨 (비대면 모의고사 진행 포함)', '수강생의 자택/콘도로 튜터 출장 방문', '조용한 카페 및 스터디룸 대면 미팅', '튜터 지정 장소(어학원 등) 방문'] },
    { id: 'ielts_exam_timeline', type: 'SINGLE_CHOICE', text: '실제 공식 시험(Official Exam) 응시 예정 시기를 알려주세요.', options: ['1~2개월 이내 (매우 급함, 스파르타식 단기 집중 요망)', '3~6개월 이내', '6개월 이후 등 시간적 여유 있음', '아직 시험 접수 전임'] },
    { id: 'ielts_start_date', type: 'DATE_PICKER', text: '튜터링 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'ielts_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간 집중', '평일 저녁 퇴근 후', '주말 전용', '고수와 자유롭게 스케줄 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 영국 간호사 취업을 위해 OET B 등급이 반드시 필요합니다, 라이팅(Writing) Task 2 에세이 첨삭 위주로 수업을 원합니다 등' }
];

const PRC_EXAM_STEPS = [
    { id: 'prc_exam_field', type: 'SINGLE_CHOICE', text: '준비하시는 PRC(Professional Regulation Commission) 보드 시험의 전공/직군을 선택해주세요.', options: ['간호사 (PNLE - Philippine Nurses Licensure Exam)', '공인회계사 (CPALE - CPA Licensure Exam)', '교사 (LET - Licensure Examination for Teachers)', '엔지니어링 (CE, ME, EE 등)', '건축가 (ALE)', '범죄학 (CLE)', '기타 PRC 보드 시험 (특이사항 기재)'] },
    { id: 'prc_taker_status', type: 'SINGLE_CHOICE', text: '현재 시험 응시 상태를 알려주세요.', options: ['대학 졸업(예정) 후 처음 응시하는 초시생 (First-time taker)', '이전 시험에 낙방하여 다시 준비하는 재수생 (Retaker / Refresher)', '해외 면허 변환 등을 위해 준비하는 외국인 응시자'] },
    { id: 'prc_review_type', type: 'SINGLE_CHOICE', text: '원하시는 시험 준비(리뷰) 방식을 선택해주세요.', options: ['취약 과목 보완을 위한 1:1 개인 튜터링', '뜻이 맞는 친구들과 2~4인 소그룹 튜터링 (비용 절감)', '대형 리뷰 센터(Review Center) 종합반 등록 상담 및 연계 희망'] },
    { id: 'prc_focus_areas', type: 'MULTI_CHOICE', text: '집중적으로 튜터링을 받고 싶은 특정 과목이나 파트가 있나요? (다중 선택 가능)', options: ['기초 개념 및 이론 완벽 정리', '과거 기출문제(Past Board Exams) 풀이 및 분석', '계산/수학 기반 문제 집중 훈련', '실전 모의고사(Mock Exam) 및 시간 관리 훈련', '전 과목 종합 리뷰'] },
    { id: 'prc_lesson_type', type: 'SINGLE_CHOICE', text: '선호하시는 튜터링 진행 방식 및 장소를 선택해주세요.', options: ['100% 온라인 비대면 레슨', '수강생 자택 방문 대면 레슨', '스터디 카페 등 조용한 외부 장소 대면 레슨'] },
    { id: 'prc_exam_timeline', type: 'SINGLE_CHOICE', text: '목표로 하는 PRC 보드 시험 응시 예정일을 알려주세요.', options: ['가장 가까운 다가오는 시험 (1~3개월 내)', '다음 회차 시험 (6개월 정도 여유)', '내년 시험 대비 (장기전)'] },
    { id: 'prc_start_date', type: 'DATE_PICKER', text: '튜터링 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'prc_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간 (풀타임 리뷰생)', '평일 저녁 (직장 병행)', '주말 집중반', '튜터와 스케줄 유동적 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 간호사 보드 시험 중 정신간호학(Psychiatric Nursing) 파트가 가장 취약합니다, 5년 전 졸업 후 다시 공부하는 거라 기초부터 짚어줄 튜터가 필요합니다 등' }
];

const SWIMMING_STEPS = [
    { id: 'sw_age_group', type: 'SINGLE_CHOICE', text: '수영 레슨을 받을 수강생의 연령대를 선택해주세요.', options: ['영유아 및 어린이 (Kids / Toddlers)', '청소년 (Teens)', '성인 (Adults)', '시니어 (Seniors)'] },
    { id: 'sw_level', type: 'SINGLE_CHOICE', text: '현재 수강생의 대략적인 수영 실력을 선택해주세요.', options: ['물이 무섭고 뜨는 법도 모르는 완전 초보', '물에 뜨고 앞으로 갈 수는 있으나 자세 교정이 필요한 초/중급', '4개 영법(자유형, 평영, 배영, 접영) 마스터 희망', '철인 3종 및 라이프가드 자격 준비 (고급)'] },
    { id: 'sw_group_type', type: 'SINGLE_CHOICE', text: '레슨을 진행할 형태(인원)를 선택해주세요.', options: ['1:1 개인 레슨', '2~3인 소그룹 레슨 (가족, 친구 등 자체 구성)', '기존 그룹 레슨에 합류 희망'] },
    { id: 'sw_pool_location', type: 'SINGLE_CHOICE', text: '[중요] 레슨을 진행할 수영장 장소를 선택해주세요.', options: ['거주 중인 콘도미니엄/빌리지 수영장 (강사 출입 가능)', '외부 퍼블릭/사설 수영장', '강사가 보유/지정한 수영장으로 직접 방문', '수영장이 없어 섭외부터 필요함'] },
    { id: 'sw_access_rules', type: 'SINGLE_CHOICE', text: '(콘도/빌리지 진행 시) 외부 강사 및 게스트 출입 규정을 확인하셨나요?', options: ['게스트 요금(Guest fee) 없이 무료 출입 및 강습 가능', 'Admin에 게스트/코치 등록 필수 및 요금 발생 (고객이 부담)', '상업적 강습(Coaching) 자체를 엄격히 금지함 (외부 장소 섭외 필요)', '아직 규정 확인 전'] },
    { id: 'sw_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'sw_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['평일 주간 (오전/오후)', '평일 저녁', '주말 전용 (토, 일)', '강사와 스케줄 유동적 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 허리 디스크가 있어 무리가 가지 않는 영법 위주로 배우고 싶습니다, 여자 강사님을 선호합니다 등' }
];

const DANCE_STEPS = [
    { id: 'dance_genres', type: 'MULTI_CHOICE', text: '배우고자 하는 댄스 장르를 선택해주세요. (다중 선택 가능)', options: ['줌바(Zumba) 및 에어로빅', 'K-Pop 방송 댄스', '힙합 및 스트릿 댄스', '라틴 및 볼룸 댄스 (사교 댄스)', '발레(Ballet)', '웨딩 댄스(First Dance) 및 코틸리온(Cotillion) 안무'] },
    { id: 'dance_purpose', type: 'SINGLE_CHOICE', text: '레슨의 주된 목적을 선택해주세요.', options: ['다이어트, 피트니스 및 취미', '학교 및 사내 행사 장기자랑 퍼포먼스 준비', '데뷰(Debut) 파티 코틸리온 및 웨딩 안무 연습', '전문적인 댄스 오디션 준비'] },
    { id: 'dance_group_type', type: 'SINGLE_CHOICE', text: '레슨을 진행할 형태(인원)를 선택해주세요.', options: ['1:1 개인 안무 레슨', '2~5인 소그룹 레슨', '6인 이상 대그룹 및 기업/학교 출강', '기존 댄스 클래스에 1인 합류 희망'] },
    { id: 'dance_venue', type: 'SINGLE_CHOICE', text: '레슨을 진행할 장소를 선택해주세요.', options: ['거주 중인 콘도/빌리지 내 짐(Gym) 또는 펑션룸(Function room)', '강사가 보유/소속된 댄스 스튜디오로 방문', '시간당 대여 가능한 외부 댄스 스튜디오(고객이 대관료 부담)', '100% 온라인 화상 레슨'] },
    { id: 'dance_noise_rules', type: 'SINGLE_CHOICE', text: '[중요] (콘도 진행 시) 소음 및 스피커 사용 규정을 확인하셨나요?', options: ['대형 블루투스 스피커 사용 및 음악 재생 가능', '소음 제한이 있어 이어폰 또는 아주 작은 볼륨으로만 가능', '상업적 외부 강사 출입 및 레슨 금지', '아직 관리소(Admin) 규정 확인 전'] },
    { id: 'dance_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'dance_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['주 2~3회 평일 주간', '주 2~3회 평일 저녁', '주말 집중반', '행사를 앞두고 매일 단기 속성반'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 다음 달 데뷰 파티를 위한 18 Roses 입장 댄스 안무를 짜주실 분이 필요합니다, 몸치라 기초 리듬 타는 법부터 알려주세요 등' }
];

const COOKING_LESSON_STEPS = [
    { id: 'ck_fields', type: 'MULTI_CHOICE', text: '배우고자 하는 요리 및 베이킹 분야를 선택해주세요. (다중 선택 가능)', options: ['필리핀 로컬 요리 (Adobo, Sinigang 등)', '한식 전반', '서양식 (파스타, 스테이크 등)', '제과제빵 (빵, 페이스트리, 쿠키)', '케이크 장식 및 데코레이션 (Fondant 등)', '건강식, 비건, 키토 다이어트 식단'] },
    { id: 'ck_purpose', type: 'SINGLE_CHOICE', text: '레슨 대상자 및 수강 목적을 선택해주세요.', options: ['본인 취미 및 가정식 요리 실력 향상', '가사도우미(Ate/Yaya) 대상 위생 및 한식/가정식 조리 교육', '카페, 식당 창업 및 비즈니스 메뉴 개발', '아이들(Kids) 체험형 쿠킹 클래스'] },
    { id: 'ck_venue', type: 'SINGLE_CHOICE', text: '레슨을 진행할 장소를 선택해주세요.', options: ['수강생의 자택(콘도/빌리지) 주방으로 강사 방문', '강사가 보유/소속된 쿠킹 스튜디오로 방문', '100% 온라인 비대면 레슨'] },
    { id: 'ck_kitchen_infra', type: 'SINGLE_CHOICE', text: '[중요] (자택 방문 시) 주방 인프라 및 도구 보유 상태를 알려주세요.', options: ['오븐, 가스/인덕션, 조리 도구가 모두 완비됨', '오븐은 없으나 기본 불 조리(Stove) 및 도구는 있음', '베이킹용 믹서, 오븐 등 특수 도구 전혀 없음 (강사 장비 지참 또는 방문 레슨 불가)', '강사 스튜디오로 방문할 예정임'] },
    { id: 'ck_ingredients', type: 'SINGLE_CHOICE', text: '식재료 준비 방식에 대한 선호도를 선택해주세요.', options: ['강사가 모든 식재료를 장봐서 준비 (레슨비에 재료비 포함 턴키)', '강사가 제공한 레시피 리스트를 보고 고객이 직접 마트에서 구매', '상담 후 결정'] },
    { id: 'ck_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'ck_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 형태 및 주기를 선택해주세요.', options: ['1회성 원데이 클래스 (One-day class)', '주 1~2회 정기 레슨 (취미/심화반)', '평일 주간 집중', '주말 전용'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 새로 온 아떼(가사도우미)에게 김치찌개, 불고기 등 기본적인 한식 5가지를 이틀 동안 집중적으로 가르쳐주고 싶습니다, 특정 해산물 알레르기가 있습니다 등' }
];

const MUSIC_LESSON_STEPS = [
    { id: 'ml_instruments', type: 'MULTI_CHOICE', text: '배우고자 하는 악기 및 분야를 선택해주세요. (다중 선택 가능)', options: ['피아노 및 키보드', '통기타(Acoustic) 및 일렉 기타', '보컬 및 발성 (노래)', '바이올린, 첼로 등 현악기', '우쿨렐레', '베이스 또는 드럼'] },
    { id: 'ml_age_level', type: 'SINGLE_CHOICE', text: '수강생의 연령대 및 현재 실력을 선택해주세요.', options: ['유아 및 어린이 (악보를 못 보는 기초)', '성인 완전 초보', '성인 중급 (어느 정도 연주/노래 가능하나 교정 필요)', '고급 (공연, 콩쿠르, 입시 준비 등)'] },
    { id: 'ml_goal', type: 'SINGLE_CHOICE', text: '레슨의 주된 목표를 선택해주세요.', options: ['1곡 마스터 (축가, 프로포즈, 장기자랑 등 단기 목표)', '꾸준한 취미 및 스트레스 해소', 'ABRSM 등 급수 시험 및 자격증 준비', '교회 반주(Accompaniment) 및 찬양팀 훈련', '음악 이론 및 화성학 기초 확립'] },
    { id: 'ml_venue', type: 'SINGLE_CHOICE', text: '레슨을 진행할 장소를 선택해주세요.', options: ['수강생의 자택(콘도/빌리지)으로 강사 출장 방문', '강사의 개인 스튜디오 및 연습실로 수강생이 방문', '100% 온라인 비대면 레슨 (Zoom 등)', '외부 연습실 대여 (대관료 고객 부담)'] },
    { id: 'ml_instrument_status', type: 'SINGLE_CHOICE', text: '[중요] (방문/온라인 레슨 시) 악기 보유 상태를 알려주세요.', options: ['어쿠스틱 피아노(Upright/Grand) 보유', '전자 키보드(디지털 피아노) 보유', '본인 소유의 기타/현악기 보유', '악기 전혀 없음 (대여 필요 또는 구매 전 상담 희망)', '보컬 레슨이라 악기 불필요'] },
    { id: 'ml_noise_rules', type: 'SINGLE_CHOICE', text: '(방문 레슨 시) 콘도/빌리지의 소음 규정을 확인하셨나요?', options: ['악기 연주 및 노래에 대한 소음 제한 없음', '낮 시간대(예: 오전 10시~오후 5시)에만 연주 허용', '층간 소음 민원으로 어쿠스틱 악기 연주 절대 불가 (헤드셋 가능한 디지털 악기만 가능)', '스튜디오 방문 예정임'] },
    { id: 'ml_start_date', type: 'DATE_PICKER', text: '레슨 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'ml_schedule', type: 'SINGLE_CHOICE', text: '희망하시는 레슨 주기 및 시간대를 선택해주세요.', options: ['주 1~2회 평일 주간', '주 1~2회 평일 저녁', '주말(토,일) 레슨', '강사와 유동적 스케줄 조율'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 아이가 집중력이 짧아 30분씩 짧게 주 3회 진행하고 싶습니다, 3달 뒤에 있을 사내 행사 밴드 공연을 위해 일렉 기타 속성 레슨이 필요합니다 등' }
];

const TILE_FLOORING_STEPS = [
    { id: 'tile_spaces', type: 'MULTI_CHOICE', text: '시공을 원하시는 공간을 선택해주세요. (다중 선택 가능)', options: ['거실 및 복도', '방 (침실 등)', '주방', '화장실 및 욕실', '베란다/발코니', '야외 공간 (주차장, 정원 등)'] },
    { id: 'floor_material', type: 'SINGLE_CHOICE', text: '원하시는 바닥재 종류를 선택해주세요.', options: ['세라믹/도기질 타일', '포셀린 타일 (대형 타일 포함)', '비닐/데코타일 (Vinyl/PVC)', '나무 마루 (Wood flooring)', '에폭시 코팅', '아직 미정 (고수와 상담 후 결정)'] },
    { id: 'floor_condition', type: 'SINGLE_CHOICE', text: '현재 바닥의 상태는 어떤가요?', options: ['기존 바닥재 철거 및 바닥 평탄화(Leveling) 필수', '아무것도 없는 콘크리트 바닥 (Bare/Turn-over 상태)', '기존 바닥재 위에 그대로 덧방 시공 희망', '상태를 정확히 모름 (실사 필요)'] },
    { id: 'tile_material_supply', type: 'SINGLE_CHOICE', text: '자재(타일, 시멘트, 접착제 등) 준비 방식은 어떻게 원하시나요?', options: ['고객이 타일 등 주요 자재 직접 구매 (Labor only)', '고수가 자재 구매부터 시공까지 모두 포함 (Turn-key)', '상담 후 결정'] },
    { id: 'tile_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 관리소(Admin/HOA) 공사 허가(Work Permit) 상태를 알려주세요.', options: ['콘도/상가 (Admin 승인 및 예치금 완료)', '서브디비전/빌리지 (HOA 승인 완료)', '일반 독립 주택 (허가 불필요 또는 자체 해결)', '아직 허가받지 않음 (고수 안내/대행 필요)'] },
    { id: 'tile_site_access', type: 'MULTI_CHOICE', text: '타일 및 시멘트 반입을 위한 현장 환경을 체크해주세요. (다중 선택 가능)', options: ['화물용 엘리베이터(Service Elevator) 사용 가능', '1층 주택이거나 대형 트럭 진입/주차 가능', '계단으로만 무거운 자재 운반 필요', '현재 전기 및 수도 정상 사용 가능'] },
    { id: 'tile_area_sqm', type: 'SINGLE_CHOICE', text: '예상되는 대략적인 총 시공 면적(sqm)을 선택해주세요.', options: ['20sqm 미만 (화장실 등 소규모)', '20 ~ 50sqm', '50 ~ 100sqm', '100sqm 이상', '정확한 면적을 모름 (현장 실사 필요)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'tile_work_schedule', type: 'SINGLE_CHOICE', text: '콘도/빌리지 규정상 작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 (오전 8시~오후 5시)', '평일 및 토요일 주간 가능', '야간 작업만 가능', '규정 확인 전이며 고수와 시간 협의'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 화장실 바닥 방수 작업(Waterproofing)도 같이 필요합니다, 대형 타일(60x120 등) 시공입니다 등' }
];

const PAINTING_STEPS = [
    { id: 'paint_scope', type: 'MULTI_CHOICE', text: '페인트 시공 범위를 선택해주세요. (다중 선택 가능)', options: ['실내 전체', '실내 일부 (방, 거실 등)', '건물 외벽 전체', '천장', '문, 창틀, 몰딩, 캐비닛 등', '지붕 페인트'] },
    { id: 'paint_site_condition', type: 'SINGLE_CHOICE', text: '현재 시공 현장의 상태는 어떤가요?', options: ['현재 거주/영업 중 (가구 및 바닥 보양(Covering) 작업 필수)', '비어 있는 공실 또는 신축 상태', '거주 전 빈집이지만 기존 가구 일부 있음'] },
    { id: 'wall_condition', type: 'MULTI_CHOICE', text: '기존 벽면 상태 및 필요한 사전 작업을 체크해주세요. (다중 선택 가능)', options: ['벽지 제거 필요', '기존 페인트 벗겨짐 및 곰팡이 심함 (제거 및 약품 처리 필요)', '크랙(실금) 보수 및 퍼티(Putty) 작업 필요', '비교적 깨끗하여 바로 덧칠 가능', '외벽 텍스처(고압 세척 필요)'] },
    { id: 'paint_material_supply', type: 'SINGLE_CHOICE', text: '페인트 자재 준비 방식을 선택해주세요.', options: ['고객이 브랜드(Boysen, Davies 등) 및 색상 지정 후 직접 구매 (Labor only)', '고수가 자재 포함 전체 준비 (Turn-key)', '고수와 색상 상담 후 고수가 구매 대행'] },
    { id: 'paint_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 공사 허가(Work Permit) 상태를 알려주세요.', options: ['콘도/상가 (Admin 승인 완료)', '서브디비전/빌리지 (HOA 승인 완료)', '일반 독립 주택 (허가 불필요)', '아직 허가받지 않음 (고수 안내 필요)'] },
    { id: 'floor_height', type: 'SINGLE_CHOICE', text: '시공할 곳의 층수 또는 층고를 알려주세요.', options: ['일반적인 단층 층고 (사다리로 작업 가능)', '2층 이상 주택 또는 높은 층고 (비계/Scaffolding 설치 필수)', '콘도 유닛'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'paint_work_schedule', type: 'SINGLE_CHOICE', text: '콘도/빌리지 규정상 작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 (오전 8시~오후 5시)', '평일 및 토요일 주간 가능', '야간/주말 작업 가능', '규정 확인 전이며 고수와 시간 협의'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 유성(Enamel) 페인트 특유의 냄새 때문에 수성(Odorless) 페인트 사용을 원합니다, 특정 브랜드(Boysen) 지정 색상 코드가 있습니다 등' }
];

const CARPENTRY_STEPS = [
    { id: 'carpentry_work_types', type: 'MULTI_CHOICE', text: '필요하신 목공 및 가구 제작 작업을 선택해주세요. (다중 선택 가능)', options: ['맞춤형 붙박이장 및 옷장', '주방 싱크대 및 상하부장(Cabinets)', '문, 문틀 교체 및 수리', '침대 프레임, 책상 등 일반 가구', '몰딩 및 걸레받이(Baseboard)', '상가/매장용 카운터 및 진열장'] },
    { id: 'carpentry_material', type: 'SINGLE_CHOICE', text: '원하시는 주요 자재 및 마감 방식을 선택해주세요.', options: ['합판(Plywood)/MDF + 필름(Laminates/Formica) 마감', '합판/MDF + 페인트 마감', '원목(Solid wood) 사용', '고수와 상담 후 결정'] },
    { id: 'design_doc', type: 'SINGLE_CHOICE', text: '디자인 및 치수가 포함된 도면을 보유하고 계신가요?', options: ['정확한 치수가 포함된 도면 보유 (바로 제작 가능)', '참고용 사진이나 간단한 스케치 보유', '아무것도 없으며 고수의 현장 실측 및 디자인 제안 필요'] },
    { id: 'carpentry_site_condition', type: 'SINGLE_CHOICE', text: '목공 작업 장소의 상태는 어떤가요?', options: ['현재 거주/영업 중 (톱밥 날림 방지 및 보양 작업 철저 요망)', '비어 있는 공실/신축 상태', '고수의 작업장(Shop)에서 제작 후 현장 조립(설치)만 희망'] },
    { id: 'carpentry_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 관리소(Admin/HOA) 허가 상태를 알려주세요.', options: ['콘도/상가 (Admin 승인 및 예치금 완료)', '서브디비전/빌리지 (HOA 승인 완료)', '일반 독립 주택 (허가 불필요)', '아직 허가받지 않음 (고수 안내 필요)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '작업 시작(또는 실측)을 희망하시는 날짜를 선택해주세요.' },
    { id: 'carpentry_work_schedule', type: 'SINGLE_CHOICE', text: '콘도/빌리지 규정상 소음 작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 상시 가능', '평일 특정 시간만 가능 (예: 오후 1시~5시)', '주말 및 야간 작업 가능', '아직 규정을 확인하지 못함'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 화물용 엘리베이터를 통해서만 대형 합판 반입이 가능합니다, 기존 가구 철거 및 폐기도 필요합니다 등' }
];

const DRYWALL_STEPS = [
    { id: 'drywall_purpose', type: 'MULTI_CHOICE', text: '가벽 및 석고보드(Drywall) 시공의 주요 목적을 선택해주세요. (다중 선택 가능)', options: ['넓은 공간 분리 (방 만들기, 파티션 등)', '천장 시공 (Drop ceiling, 평천장 등)', '울퉁불퉁한 벽면 평탄화', '상업 공간 인테리어 뼈대 작업', '단열 및 방음 목적'] },
    { id: 'insulation_needed', type: 'SINGLE_CHOICE', text: '방음 및 단열 작업이 추가로 필요하신가요?', options: ['일반적인 가벽/천장 시공만 필요 (뼈대 + 보드)', '벽체 내부에 방음/단열재(Glasswool 등) 삽입 필수', '현장 상황에 맞춰 고수와 상담 후 결정'] },
    { id: 'ceiling_height_drywall', type: 'SINGLE_CHOICE', text: '시공할 공간의 층고(천장 높이)를 알려주세요.', options: ['일반적인 층고 (3m 미만, 사다리로 가능)', '높은 층고 (3m 이상, 비계/Scaffolding 설치 필수)', '정확한 높이를 모름'] },
    { id: 'finish_level', type: 'SINGLE_CHOICE', text: '희망하시는 최종 마감 단계를 선택해주세요.', options: ['가벽 뼈대 세우고 보드 취부까지만 (Labor & Material)', '조인트 테이프 및 퍼티(Putty) 마감까지', '페인트 또는 벽지 최종 마감까지 모두 포함 (Turn-key)'] },
    { id: 'drywall_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 자재 반입 환경 및 관리소(Admin/HOA) 허가 상태를 체크해주세요.', options: ['콘도/상가 (Admin 승인 완료, 화물 엘리베이터 사용 가능)', '서브디비전/빌리지 (HOA 승인 완료)', '일반 독립 주택 (대형 트럭 진입 가능)', '계단으로만 자재 운반 필요', '아직 규정 확인 및 허가받지 않음'] },
    { id: 'drywall_material_supply', type: 'SINGLE_CHOICE', text: '자재 준비 방식을 선택해주세요.', options: ['고객이 자재(보드, 스터드 등) 직접 구매 (Labor only)', '고수가 자재 포함 전체 준비 (Turn-key)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사 시작을 희망하시는 날짜를 선택해주세요.' },
    { id: 'drywall_work_schedule', type: 'SINGLE_CHOICE', text: '콘도/빌리지 규정상 작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 (오전 8시~오후 5시)', '평일 및 토요일 주간 가능', '야간 영업 종료 후만 가능', '규정 확인 전이며 고수와 시간 협의'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 습기가 많은 화장실 근처라 방수 석고보드(Moisture Resistant)를 사용해야 합니다, 가벽 안에 전기 콘센트 신설 작업도 필요합니다 등' }
];

const ROOFING_STEPS = [
    { id: 'roofing_work_types', type: 'MULTI_CHOICE', text: '필요하신 공사의 종류를 선택해주세요. (다중 선택 가능)', options: ['지붕 누수 수리 및 부분 교체', '지붕재 전체 교체(새 지붕)', '지붕 방수 코팅 및 페인트', '옥상(Roof deck) 바닥 방수 공사', '발코니, 화장실 내부 누수 수리', '외벽 방수 및 크랙 보수'] },
    { id: 'roof_problem_status', type: 'SINGLE_CHOICE', text: '현재 발생 중인 문제 상황을 가장 잘 설명한 것을 선택해주세요.', options: ['비가 올 때 실제로 물이 떨어지거나 새는 누수 발생 중', '천장이나 벽면에 심한 물자국, 곰팡이 발생', '타일 들뜸, 바닥에 물이 고이는 현상', '누수는 없으나 예방 차원의 정기 방수 공사 희망'] },
    { id: 'roof_material', type: 'SINGLE_CHOICE', text: '시공 대상 지붕 또는 바닥의 재질을 알려주세요.', options: ['일반 금속 강판 (GI Sheet / Yero / 컬러강판)', '기와 (Concrete/Clay tiles)', '옥상 콘크리트 슬래브', '아스팔트 슁글', '실내 화장실/발코니 타일 바닥', '정확히 모름'] },
    { id: 'roof_access', type: 'SINGLE_CHOICE', text: '작업이 필요한 층수와 외부 접근성을 알려주세요.', options: ['단층(1층)으로 사다리로 쉽게 접근 가능', '2층 주택 및 건물', '3층 이상으로 비계(Scaffolding) 또는 크레인 필수', '지붕 경사도가 매우 가파르고 위험함', '실내 작업임'] },
    { id: 'roof_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 관리소(Admin/HOA) 허가 상태를 알려주세요.', options: ['서브디비전/빌리지 (HOA 승인 및 공사 허가 완료)', '일반 독립 주택 (허가 불필요)', '상가 및 빌딩 (관리소 승인 완료)', '콘도 (내부 화장실/발코니 누수 건)', '아직 허가받지 않음 (고수 안내 필요)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사(또는 긴급 점검)를 희망하시는 날짜를 선택해주세요.' },
    { id: 'roof_work_schedule', type: 'SINGLE_CHOICE', text: '작업이 가능한 시간대를 선택해주세요.', options: ['평일 주간 (오전 8시~오후 5시)', '주말 포함 주간 상시 가능', '상가 영업 종료 후 야간만 가능', '고수와 시간 협의'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 우기(Rainy season)라 오후에는 항상 비가 와서 오전 작업만 가능합니다, 당장 물이 새서 임시 비닐/천막 조치라도 시급합니다 등' }
];

const CONDO_INTERIOR_STEPS = [
    { id: 'interior_scope', type: 'MULTI_CHOICE', text: '인테리어를 진행할 범위를 선택해주세요. (다중 선택 가능)', options: ['전체 인테리어', '거실 및 방 부분 인테리어', '주방 인테리어 (캐비닛 등)', '화장실 인테리어', '베란다/발코니 공사'] },
    { id: 'unit_condition', type: 'SINGLE_CHOICE', text: '현재 해당 콘도 유닛(Unit)의 상태는 어떤가요?', options: ['개발사에서 방금 인도받은 상태 (Turn-over / Bare)', '기존 인테리어가 있어 철거가 필요한 상태', '현재 거주 중이며 부분 시공이 필요한 상태'] },
    { id: 'condo_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 콘도 관리사무소(Admin) 공사 허가(Work Permit) 및 예치금(Construction Bond) 진행 상태를 알려주세요.', options: ['Admin 승인 및 예치금 납부 완료', '도면 제출 후 승인 대기 중', '규정 확인 전이며 고수의 안내/대행 필요'] },
    { id: 'work_schedule', type: 'SINGLE_CHOICE', text: '콘도 관리 규정상 작업 가능한 시간대 및 요일을 알려주세요.', options: ['평일 주간만 가능 (주말 불가)', '평일 및 토요일 주간 가능', '야간 작업 가능', '아직 Admin 규정을 확인하지 못함'] },
    { id: 'interior_supply', type: 'SINGLE_CHOICE', text: '인테리어 자재 수급 및 디자인 방식은 어떻게 원하시나요?', options: ['디자인부터 자재 구매, 시공까지 모두 포함 (Turn-key)', '고객이 자재 직접 구매 후 시공만 의뢰 (Labor only)', '고수와 현장 실사 후 결정'] },
    { id: 'interior_budget', type: 'SINGLE_CHOICE', text: '예상하시는 총 인테리어 예산(PHP)을 선택해주세요.', options: ['100,000 PHP 미만', '100,000 ~ 300,000 PHP', '300,000 ~ 600,000 PHP', '600,000 PHP 이상', '현장 실사 후 결정'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 화물용 엘리베이터(Service Elevator) 사용이 제한적입니다, 현재 Meralco(전기) 및 Maynilad(수도) 연결이 안 되어 있습니다 등' }
];

const COMMERCIAL_INTERIOR_STEPS = [
    { id: 'commercial_space_type', type: 'SINGLE_CHOICE', text: '인테리어를 진행할 상업 공간의 종류를 선택해주세요.', options: ['식당/카페 (F&B)', '오피스/사무실', '미용실/뷰티/스파', '쇼핑몰 내 입점 매장 (Kiosk 포함)', '로드샵(상가)', '기타'] },
    { id: 'commercial_unit_condition', type: 'SINGLE_CHOICE', text: '현재 상가/매장의 상태는 어떤가요?', options: ['신축/빈 상가 (Bare unit)', '기존 인테리어 철거가 필요한 상태', '현재 영업 중이며 영업 외 시간 부분 수리 필요'] },
    { id: 'commercial_permit_status', type: 'SINGLE_CHOICE', text: '[중요] 상가/쇼핑몰 관리소(Admin/Mall Management) 공사 허가 및 작업 규정 상태를 알려주세요.', options: ['도면 승인 및 Work Permit 발급 완료', '도면 제출 후 승인 대기 중', '야간 작업(Night shift)만 허용되는 공간', '아직 규정을 확인하지 못함 (고수 대행 필요)'] },
    { id: 'admin_requirements', type: 'MULTI_CHOICE', text: '시공 시 반드시 필요한 행정 및 안전 요건을 체크해주세요. (다중 선택 가능)', options: ['공식 영수증(BIR O.R.) 발행 필수 기업', '소방 필증(Fire Safety Permit) 대행 필요', '상하수도 및 그리스 트랩(Grease Trap) 신규 공사 필요', '전기 승압(Meralco 3-Phase 등) 공사 필요', '해당 없음'] },
    { id: 'design_status', type: 'SINGLE_CHOICE', text: '인테리어 디자인 도면(3D/2D)을 보유하고 계신가요?', options: ['설계 도면 보유 중 (시공만 필요)', '디자인 컨셉만 있고 도면 제작부터 필요', '디자인부터 시공까지 턴키(Turn-key) 방식 희망'] },
    { id: 'commercial_budget', type: 'SINGLE_CHOICE', text: '예상하시는 총 인테리어 예산(PHP)을 선택해주세요.', options: ['300,000 PHP 미만', '300,000 ~ 800,000 PHP', '800,000 ~ 1,500,000 PHP', '1,500,000 PHP 이상', '현장 실사 및 도면 확인 후 결정'] },
    { id: 'commercial_start', type: 'SINGLE_CHOICE', text: '예상하시는 공사 시작 시기는 언제인가요?', options: ['최대한 빨리 (1~2주 이내 시작)', '1달 이내', '2~3달 이내', '미정 (상담 후 결정)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: SM Mall 규정상 밤 10시 이후부터 새벽 5시까지만 공사 및 자재 반입이 가능합니다, 렌트 프리(Rent-free) 기간이 2주 남았습니다 등' }
];

const REMODELING_STEPS = [
    { id: 'remodel_scope', type: 'MULTI_CHOICE', text: '리모델링 또는 증축을 진행할 범위를 선택해주세요. (다중 선택 가능)', options: ['주택 전체 리모델링', '부분 리모델링 (방, 거실 등)', '주방 리모델링', '화장실 리모델링', '공간 증축 (방 추가, 발코니 등)', '지붕 및 외관 공사'] },
    { id: 'remodel_start', type: 'SINGLE_CHOICE', text: '예상하시는 공사 시작 시기는 언제인가요?', options: ['최대한 빨리 (1주 이내)', '1달 이내', '2~3달 이내', '아직 미정 (견적 및 상담 후 결정)'] },
    { id: 'permit_status', type: 'SINGLE_CHOICE', text: '[중요] 현장 형태 및 관리사무소(Admin/HOA) 공사 허가(Work Permit) 상태를 알려주세요.', options: ['서브디비전/빌리지 (HOA 승인 완료)', '콘도미니엄 (Admin 승인 완료)', '일반 독립 주택 (바랑가이 퍼밋 자체 해결)', '아직 허가받지 않음 (고수의 안내/대행 필요)'] },
    { id: 'material_supply', type: 'SINGLE_CHOICE', text: '공사에 필요한 자재 수급 방식을 선택해주세요.', options: ['인건비 및 전체 자재 포함 (Turn-key 방식)', '고객이 자재 직접 구매 (Labor only)', '고수와 현장 실사 후 결정'] },
    { id: 'site_infra', type: 'MULTI_CHOICE', text: '현장의 작업 인프라 및 진입로 상황을 체크해주세요. (다중 선택 가능)', options: ['현재 전기(Meralco 등) 정상 사용 가능', '현재 수도(Maynilad 등) 정상 사용 가능', '자재 배송용 대형 트럭 진입 가능', '화물용 엘리베이터(Service Elevator) 사용 가능'] },
    { id: 'remodel_budget', type: 'SINGLE_CHOICE', text: '예상하시는 대략적인 총 공사 예산(PHP)을 선택해주세요.', options: ['100,000 PHP 미만', '100,000 ~ 500,000 PHP', '500,000 ~ 1,000,000 PHP', '1,000,000 PHP 이상', '현장 실사 후 결정'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 우기(Rainy season)를 대비해 지붕 방수가 시급합니다, 서브디비전 규정상 주말 소음 공사가 절대 불가능합니다, 시공 도면(Floor plan)을 보유하고 있습니다 등' }
];

const LPG_GAS_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 배달을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['최대한 빨리 (가스 소진/누출 의심 등 긴급)', '오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'gas_service_type', type: 'SINGLE_CHOICE', text: '필요하신 서비스 종류를 선택해주세요.', options: ['단순 LPG 가스 배달 및 통 교체 (Refill/Swap)', '가스 배달 + 연결 라인(호스/레귤레이터) 안전 점검', '가스 누출 점검 및 라인 수리 (배달 불필요)', '신규 가스통 구매 및 초기 설치'] },
    { id: 'gas_brand', type: 'SINGLE_CHOICE', text: '사용 중이거나 필요한 가스통의 브랜드를 선택해주세요. (밸브 타입 확인용)', options: ['Petron Gasul', 'Shine Gas (Pol 밸브/나사형)', 'Solane (Snap-on 밸브/원터치형)', 'Fiesta Gas', '기타 브랜드 또는 잘 모름'] },
    { id: 'gas_capacity', type: 'SINGLE_CHOICE', text: '가스통의 용량(사이즈)은 어떻게 되나요?', options: ['11kg (일반 가정용 표준 사이즈)', '2.7kg ~ 7kg (소형/캠핑용)', '22kg ~ 50kg (식당 및 상업용 대형)', '잘 모름'] },
    { id: 'empty_cylinder', type: 'SINGLE_CHOICE', text: '[배달 고객용] 교환할 빈 가스통(Empty cylinder)을 보유하고 계신가요?', options: ['네, 같은 브랜드의 빈 통이 있습니다 (가스 충전 비용만 발생)', '네, 하지만 다른 브랜드의 빈 통입니다 (호환/교환 가능 확인 필요)', '아니요, 빈 통이 없어서 가스통(Cylinder)을 새로 사야 합니다', '해당 없음 (수리 및 점검 고객)'] },
    { id: 'gas_symptoms', type: 'MULTI_CHOICE', text: '[점검/수리 고객용] 현재 겪고 있는 문제나 의심 증상이 있나요? (중복 선택 가능)', options: ['해당 없음 (단순 배달)', '가스 냄새가 심하게 남 (누출 의심, 긴급)', '가스불이 켜지지 않거나 화력이 너무 약함', '레귤레이터(조절기)나 고무 호스가 낡거나 찢어짐', '밸브에서 쉭쉭 소리가 남'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 관리사무소(Admin)에 LPG 반입 허가를 받았습니다, 엘리베이터가 없는 3층입니다, 상업용 주방입니다 등' }
];

const WINDOW_SCREEN_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 실측/시공을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'screen_locations', type: 'MULTI_CHOICE', text: '방충망 시공이 필요한 문이나 창문의 종류를 선택해주세요. (중복 선택 가능)', options: ['일반 슬라이딩 창문', '베란다(발코니) 대형 유리문', '현관문 (Screen door)', '기타'] },
    { id: 'screen_qty', type: 'SINGLE_CHOICE', text: '시공할 방충망의 총 수량은 대략 몇 개인가요?', options: ['1~2개 (부분 시공)', '3~5개', '6개 이상 (집 전체)', '잘 모름 (현장 실측 요망)'] },
    { id: 'screen_material', type: 'SINGLE_CHOICE', text: '원하시는 방충망의 재질이나 기능이 있나요?', options: ['일반 알루미늄/파이버글라스 망 (기본형)', '촘촘망 (미세먼지 및 아주 작은 벌레 차단)', '고양이/반려동물용 방충망 (Pet screen/찢어짐 방지)', '상담 후 결정'] },
    { id: 'screen_frame_status', type: 'SINGLE_CHOICE', text: '현재 창문의 상태는 어떤가요?', options: ['기존 방충망 틀이 있어서 망만 교체(Rewiring)하면 됨', '틀이 없거나 망가져서 틀까지 새로 제작해야 함 (신규)', '잘 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 뎅기열 때문에 모기 차단이 시급합니다, 고양이가 기존 망을 자꾸 찢습니다 등' }
];

const LOCKSMITH_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['최대한 빨리 (긴급 출동/Lockout)', '오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'lock_service_type', type: 'SINGLE_CHOICE', text: '현재 겪고 있는 문제나 원하시는 서비스는 무엇인가요?', options: ['문이 잠겨서 열어야 함 (열쇠 분실/도어락 방전)', '기존 열쇠/도어락 고장 수리', '새로운 도어락/열쇠로 전면 교체 및 신규 설치'] },
    { id: 'door_material', type: 'SINGLE_CHOICE', text: '문(Door)의 재질은 무엇인가요? (타공 장비 선택 시 중요)', options: ['일반 목재문 (Wooden door)', '금속/철문 (Metal/Steel door)', '유리문 (Glass door)', '방화문', '잘 모름'] },
    { id: 'lock_type_new', type: 'SINGLE_CHOICE', text: '[신규/교체 시] 어떤 종류의 자물쇠를 원하시나요? (수리/개방 고객은 \'해당 없음\' 선택)', options: ['해당 없음 (수리 및 잠금 해제만)', '일반 열쇠 (Knob/Deadbolt)', '디지털 도어락 (비밀번호/카드)', '스마트/지문 인식 도어락'] },
    { id: 'lock_product_supply', type: 'SINGLE_CHOICE', text: '[신규/교체 시] 설치할 제품은 어떻게 준비할까요?', options: ['해당 없음 (수리 및 잠금 해제만)', '고객이 도어락을 이미 구매해 두었습니다', '고수님이 제품 구매 후 지참해주셔야 합니다', '상담 후 결정'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 콘도 관리사무소(Admin) 규정상 문 타공(Drilling) 시 허가가 필요합니다, 마스터키를 분실했습니다 등' }
];

const FURNITURE_ASSEMBLY_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 작업을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'furniture_types', type: 'MULTI_CHOICE', text: '조립 및 배치가 필요한 가구는 무엇인가요? (중복 선택 가능)', options: ['침대 프레임', '옷장(Wardrobe) 및 대형 서랍장', '식탁 및 의자', '책상 및 사무용 가구', 'TV 거실장 및 수납장', '기타'] },
    { id: 'furniture_brand', type: 'SINGLE_CHOICE', text: '해당 가구의 브랜드나 구매처를 알려주세요.', options: ['IKEA (이케아) 제품', '온라인 쇼핑몰 (Shopee/Lazada 등) 조립식 가구', '주문 제작(Custom) 가구', '기존 가구 분해 후 재조립'] },
    { id: 'furniture_qty', type: 'SINGLE_CHOICE', text: '조립할 가구의 대략적인 수량과 규모는 어느 정도인가요?', options: ['가구 1~2개 (간단한 작업)', '가구 3~5개 (방 1개 분량)', '대량 조립 (이사 및 입주 수준, 2인 이상 필요)'] },
    { id: 'wall_mount_needed', type: 'SINGLE_CHOICE', text: '벽에 구멍을 뚫어 단단히 고정(Wall mounting)해야 하는 가구가 있나요?', options: ['아니요, 바닥에 놓기만 하면 됩니다', '네, 무거워서 벽에 앵커를 박아 고정해야 합니다', '잘 모름 (전문가 판단 요망)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 이케아 PAX 옷장이라 부품이 매우 많습니다, 가구가 너무 무거워 성인 남성 2명이 필요할 것 같습니다 등' }
];

const AC_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 점검을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'ac_types', type: 'MULTI_CHOICE', text: '수리할 에어컨의 종류를 선택해주세요. (중복 선택 가능)', options: ['창문형 (Window-type)', '스플릿/벽걸이형 (Split-type)', '스탠드형 (Floor-standing)', '천장형 (Cassette/Ducted)', '잘 모름'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: '현재 겪고 있는 주요 증상은 무엇인가요? (중복 선택 가능)', options: ['전혀 시원하지 않음 (프리온 가스 누출 의심)', '전원이 아예 켜지지 않음', '실내기에서 물이 심하게 떨어짐 (누수)', '소음 및 진동이 너무 심함', '에러 코드가 깜빡거림'] },
    { id: 'ac_hp', type: 'SINGLE_CHOICE', text: '에어컨의 대략적인 마력(HP)을 알고 계신가요?', options: ['1.0 HP 이하 (소형)', '1.5 ~ 2.0 HP (중대형)', '2.5 HP 이상 (초대형/상업용)', '잘 모름'] },
    { id: 'outdoor_unit_location', type: 'SINGLE_CHOICE', text: '실외기(Outdoor Unit)가 설치된 위치는 어디인가요?', options: ['발코니 바닥 등 접근하기 쉬운 곳', '외벽 난간 및 지붕 (위험/사다리 필요)', '창문형이라 실외기 일체형임', '잘 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 리모컨이 작동하지 않습니다, 차단기가 자꾸 떨어집니다 등' }
];

const APPLIANCE_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 점검을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'appliance_type', type: 'SINGLE_CHOICE', text: '수리가 필요한 가전은 무엇인가요?', options: ['냉장고', '냉동고', '일반 세탁기 (Top load)', '드럼 세탁기 (Front load)', '의류 건조기', '기타 대형 가전'] },
    { id: 'appliance_symptoms', type: 'MULTI_CHOICE', text: '주요 고장 증상을 선택해주세요. (중복 선택 가능)', options: ['전원이 안 켜짐', '냉장/냉동이 약하거나 안 됨 (냉장고)', '탈수/배수/급수가 안 됨 (세탁기)', '소음 및 진동이 심함', '기기에서 물이 샘 또는 에러 코드가 뜸'] },
    { id: 'appliance_brand', type: 'SINGLE_CHOICE', text: '가전의 브랜드를 선택해주세요.', options: ['Samsung (삼성)', 'LG (엘지)', 'Panasonic 또는 Condura', '기타 브랜드 및 잘 모름'] },
    { id: 'appliance_age', type: 'SINGLE_CHOICE', text: '제품의 대략적인 구매 시기(사용 기간)를 알고 계신가요?', options: ['1~2년 이내 (보증기간 내일 수 있음)', '3~5년', '5년 이상 (노후화)', '잘 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 세탁기 문이 열리지 않습니다, 냉장고에서 타는 냄새가 났습니다 등' }
];

const TV_INSTALLATION_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '설치를 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'tv_size', type: 'SINGLE_CHOICE', text: '설치할 TV의 크기를 선택해주세요.', options: ['40인치 이하', '41~55인치', '56~70인치', '71인치 이상 (대형)'] },
    { id: 'install_type', type: 'SINGLE_CHOICE', text: '원하시는 설치 방식을 선택해주세요.', options: ['새 브라켓으로 벽걸이 신규 설치', '기존 벽걸이 이전 및 재설치', '일반 스탠드형 조립 및 세팅', '천장형 설치'] },
    { id: 'bracket_ready', type: 'SINGLE_CHOICE', text: '벽걸이 브라켓(Bracket)을 보유하고 계신가요?', options: ['네, 고객이 이미 보유하고 있습니다', '아니요, 고수님이 구매 후 지참해주셔야 합니다', '스탠드형이라 브라켓이 필요 없습니다'] },
    { id: 'wall_type', type: 'SINGLE_CHOICE', text: 'TV를 설치할 벽의 재질은 무엇인가요?', options: ['일반 콘크리트 벽', '석고보드 (합판/가벽)', '대리석 및 타일 (특수 타공 필요)', '잘 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 셋톱박스와 공유기를 TV 뒤로 숨겨주세요(선 매립), 사운드바도 같이 설치해야 합니다 등' }
];

const CCTV_INSTALLATION_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 설치/점검을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'service_type_cctv', type: 'SINGLE_CHOICE', text: '필요하신 서비스 종류를 선택해주세요.', options: ['신규 CCTV 카메라 설치', '기존 CCTV 고장 수리 및 점검', '디지털 도어락 및 출입 통제기 설치', '화재 및 침입 경보기 설치'] },
    { id: 'camera_count', type: 'SINGLE_CHOICE', text: '[신규 설치 시] 카메라 설치 희망 대수는 몇 대인가요?', options: ['1~2대 (소규모)', '3~4대 (일반 주택/매장)', '5~8대 (중대형 건물)', '9대 이상 (상업용)', '해당 없음(수리 고객)'] },
    { id: 'install_location', type: 'SINGLE_CHOICE', text: '설치 장소의 형태는 어떤가요?', options: ['콘도/아파트 실내', '단독주택 (실내 및 실외 마당)', '식당, 카페 등 상업용 매장', '사무실 및 창고 공장'] },
    { id: 'wifi_available', type: 'SINGLE_CHOICE', text: '스마트폰 연동을 위한 인터넷(Wi-Fi)이 연결되어 있나요?', options: ['네, 인터넷이 연결되어 있습니다', '아니요, 아직 인터넷이 없습니다', '잘 모름'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 야간에도 잘 보이는 적외선 카메라가 필요합니다, 기존 카메라 선이 끊어졌습니다 등' }
];

const SOLAR_PANEL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 상담을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'service_type_solar', type: 'SINGLE_CHOICE', text: '필요하신 서비스 종류를 선택해주세요.', options: ['신규 시스템 설계 및 설치', '기존 패널 고장 수리 및 인버터 교체', '정기 세척(Cleaning) 및 점검', '시스템 확장 (패널이나 배터리 추가)'] },
    { id: 'system_type', type: 'SINGLE_CHOICE', text: '고려 중이거나 사용 중인 시스템 방식은 무엇인가요?', options: ['계통연계형 (Grid-Tied / 배터리 없이 Meralco 등에 연계)', '독립형 (Off-Grid / 배터리 필수)', '하이브리드형 (Hybrid / 전력망 연계 + 배터리)', '아직 결정하지 못함 (상담 필요)'] },
    { id: 'system_capacity', type: 'SINGLE_CHOICE', text: '시스템의 대략적인 규모(용량)를 선택해주세요.', options: ['3kWp 이하 (소형 주택용)', '3kWp ~ 5kWp (일반 주택용)', '5kWp ~ 10kWp (대형 주택 및 소규모 상업용)', '10kWp 이상', '잘 모름 (전기 요금 고지서 바탕으로 상담)'] },
    { id: 'roof_type', type: 'SINGLE_CHOICE', text: '패널이 설치될(또는 설치된) 지붕의 형태는 어떤가요?', options: ['일반 양철 지붕 (GI Sheet / Yero)', '평평한 콘크리트 슬래브 (지붕 위)', '기와 지붕 (Tiles)', '지붕이 아닌 마당이나 빈 공터 (Ground mount)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 인버터에 에러 코드가 뜹니다, 넷 미터링(Net Metering) 서류 작업도 같이 해주는 업체를 찾습니다 등' }
];

const LIGHTING_WIRING_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '공사 및 방문을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'work_types', type: 'MULTI_CHOICE', text: '어떤 종류의 작업이 필요하신가요? (중복 선택 가능)', options: ['일반 전등/LED 교체 및 수리', '샹들리에(Chandelier) 등 대형 조명 설치', '새로운 콘센트(Outlet) 및 스위치 추가', '메인 배선망(Wiring) 전면 교체 및 공사', '서브 미터기(Sub-meter) 설치'] },
    { id: 'ceiling_type', type: 'SINGLE_CHOICE', text: '조명을 설치할 천장의 형태와 높이는 어떤가요? (조명/배선 공사 필수)', options: ['일반 높이 (사다리로 작업 가능)', '높은 층고 (3m 이상, 긴 사다리나 비계/Scaffolding 필요)', '콘크리트 천장 (타공 힘듦)', '석고보드(Gypsum) 등 가짜 천장'] },
    { id: 'materials_ready', type: 'SINGLE_CHOICE', text: '설치할 조명 기구나 자재는 준비되어 있나요?', options: ['네, 고객이 이미 조명/자재를 구매해 두었습니다', '아니요, 고수님이 자재를 모두 구매 후 지참해주셔야 합니다 (+비용 추가)', '상담을 통해 결정하고 싶습니다'] },
    { id: 'wiring_condition', type: 'SINGLE_CHOICE', text: '배선 작업을 위한 현재 벽/천장 상태는 어떤가요?', options: ['기존 선을 그대로 사용하면 됩니다', '기존 선이 짧거나 없어서 천장/벽 안으로 새로 빼야 합니다 (매립)', '벽 밖으로 선이 노출되어도 괜찮습니다 (몰딩 마감)', '전문가의 점검이 필요합니다'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 설치할 다운라이트(Downlight)가 20개입니다, 샹들리에 무게가 꽤 무겁습니다 등' }
];

const GENERATOR_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: '방문 및 진단을 원하시는 날짜를 선택해주세요.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: '원하시는 방문 시간대를 선택해주세요.', options: ['오전 (8시~12시)', '오후 (1시~5시)', '고수와 시간 협의'] },
    { id: 'service_type_gen', type: 'SINGLE_CHOICE', text: '필요하신 서비스 종류를 선택해주세요.', options: ['신규 발전기(Genset) 설치 및 배선 연결', '기존 발전기 고장 수리', '정기 유지보수 (오일, 필터 교체 등)', 'ATS(자동 절체 스위치) 설치 및 수리'] },
    { id: 'fuel_type', type: 'SINGLE_CHOICE', text: '발전기의 연료 타입 및 종류는 무엇인가요?', options: ['가솔린 (이동식 소형)', '디젤 (스탠드형 중대형)', '인버터 발전기', '잘 모름 (전문가 확인 필요)'] },
    { id: 'gen_capacity', type: 'SINGLE_CHOICE', text: '발전기의 대략적인 용량(Capacity)을 알고 계신가요?', options: ['5kVA 이하 (가정용 비상전력)', '5kVA ~ 10kVA', '10kVA 이상 (상업용/대형 주택용)', '잘 모름'] },
    { id: 'gen_symptoms', type: 'MULTI_CHOICE', text: '[수리/보수 고객만] 현재 겪고 있는 문제는 무엇인가요? (신규 설치는 \'해당 없음\' 선택)', options: ['해당 없음 (신규 설치)', '시동이 걸리지 않음', '시동은 걸리나 전기가 안 들어옴', '엔진 소음이나 매연이 너무 심함', '엔진 오일이나 연료가 샘', '정전 시 자동 전환(ATS)이 안 됨'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: '고수님께 전달할 현장 특이사항이 있나요? (선택)', skippable: true, placeholder: '예: 브랜드는 Honda(또는 Cummins)입니다, 마당에 설치할 예정입니다 등' }
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
        if (typeof window !== 'undefined') {
            const msg = sessionStorage.getItem('pending_phone_verify_msg');
            if (msg) {
                sessionStorage.removeItem('pending_phone_verify_msg');
                showToast(msg, 'error');
            }
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
            const isParttimeHousekeeper = answers.service_type === '파트타임 가사도우미';
            const isCookingHelper = answers.service_type === '요리 도우미';
            const isBabysitter = answers.service_type === '육아/베이비시터';
            const isRegularCleaning = answers.service_type === '거주/정기 청소';
            const isDeepCleaning = answers.service_type === '이사/입주 딥클리닝';
            const isPoolMaintenance = answers.service_type === '콘도/수영장 유지보수 청소';
            const isSofaMattressCleaning = answers.service_type === '소파/매트리스 딥클리닝';
            const isWindowAcCleaning = answers.service_type === '창문형 에어컨 딥클리닝';
            const isSplitAcCleaning = answers.service_type === '스플릿/벽걸이형 에어컨 딥클리닝';
            const isCommercialAcCleaning = answers.service_type === '상업용/시스템 에어컨 청소';
            const isTermiteControl = answers.service_type === '흰개미 퇴치';
            const isGeneralPestControl = answers.service_type === '일반 해충 방역';
            const isMoldOdorRemoval = answers.service_type === '곰팡이/악취 제거';
            const isBulkWasteDisposal = answers.service_type === '대형 폐기물 수거 및 처리';
            const isPlumbingRepair = answers.service_type === '(긴급) 누수 및 수도관 수리';
            const isWaterPumpRepair = answers.service_type === '워터펌프 및 압력탱크 수리';
            const isDrainUnclog = answers.service_type === '변기/하수구 막힘 뚫기';
            const isWaterHeater = answers.service_type === '온수기 설치 및 수리';
            const isElectricalRepair = answers.service_type === '(긴급) 전기 누전/단락 수리';
            const isGeneratorRepair = answers.service_type === '발전기 설치 및 수리';
            const isLightingWiring = answers.service_type === '전등/조명/배선 공사';
            const isSolarPanel = answers.service_type === '태양광 패널 설치 및 유지보수';
            const isAcRepair = answers.service_type === '에어컨 고장 수리 및 프리온 충전';
            const isApplianceRepair = answers.service_type === '냉장고/세탁기 수리';
            const isTvInstallation = answers.service_type === 'TV 설치 (벽걸이 등)';
            const isCctvInstallation = answers.service_type === 'CCTV 및 보안기기 설치';
            const isWindowScreen = answers.service_type === '방충망 맞춤 제작 및 시공';
            const isLocksmith = answers.service_type === '열쇠/도어락 수리 및 교체';
            const isFurnitureAssembly = answers.service_type === '가구 조립 및 배치';
            const isLpgGas = answers.service_type === 'LPG 가스 배달 및 라인 점검';
            const isRemodeling = answers.service_type === '주택 리모델링 및 증축';
            const isCondoInterior = answers.service_type === '콘도/아파트 인테리어';
            const isCommercialInterior = answers.service_type === '상업공간/매장 인테리어';
            const isTileFlooring = answers.service_type === '타일 및 바닥재 시공';
            const isPainting = answers.service_type === '페인트 시공 (실내/외벽)';
            const isCarpentry = answers.service_type === '목공 및 맞춤 가구 제작';
            const isDrywall = answers.service_type === '가벽/석고보드 시공';
            const isRoofing = answers.service_type === '지붕 공사 및 방수 시공';
            const isLandscaping = answers.service_type === '조경 및 정원 관리';
            const isSignage = answers.service_type === '간판 제작 및 설치';
            const isDeckFence = answers.service_type === '데크 및 펜스 시공';
            const isVirtualAssistant = answers.service_type === '가상 비서';
            const isCsCallcenter = answers.service_type === 'CS/콜센터 아웃소싱';
            const isTelemarketing = answers.service_type === '텔레마케팅/영업 대행';
            const isBizReg = answers.service_type === 'SEC/DTI 법인 및 사업자 등록 대행';
            const isBirTax = answers.service_type === 'BIR 세무 기장 및 세금 신고';
            const isVisa = answers.service_type === '비자/이민 서류 처리 대행';
            const isPermit = answers.service_type === '각종 인허가 대행';
            const isTagalogTrans = answers.service_type === '타갈로그어 통번역';
            const isVisayanTrans = answers.service_type === '비사야어 통번역';
            const isEnglishTrans = answers.service_type === '영어 통번역';
            const isMultilangTrans = answers.service_type === '기타 다국어 통번역';
            const isGraphicDesign = answers.service_type === '로고/그래픽 디자인';
            const isWebDev = answers.service_type === '웹/앱 기획 및 개발';
            const isVideoEdit = answers.service_type === '영상 편집';
            const isSnsMarketing = answers.service_type === 'SNS 마케팅 및 페이지 관리';
            const isDebut = answers.service_type === '데뷰 기획 및 스타일링';
            const isChristening = answers.service_type === '세례식 기획';
            const isBirthdayParty = answers.service_type === '생일/기념일 파티 기획';
            const isWedding = answers.service_type === '웨딩 플래닝';
            const isCorporateEvent = answers.service_type === '기업 행사/코퍼레이트 파티';
            const isLechon = answers.service_type === '통돼지구이 배달 및 케이터링';
            const isPartyCatering = answers.service_type === '파티 뷔페/음식 케이터링';
            const isFoodCart = answers.service_type === '푸드 카트 렌탈';
            const isCustomCake = answers.service_type === '맞춤 디자인 케이크 제작';
            const isVideoke = answers.service_type === '비디오케 및 사운드 시스템 대여';
            const isTentRental = answers.service_type === '텐트/테이블/의자 대여';
            const isPhotobooth = answers.service_type === '파티 소품/포토부스 대여';
            const isSnapPhoto = answers.service_type === '스냅 사진 및 영상 촬영';
            const isEventMC = answers.service_type === '행사 진행자 섭외';
            const isLiveBand = answers.service_type === '라이브 밴드/DJ/가수 섭외';
            const isHmua = answers.service_type === '헤어 및 메이크업';
            const isEngConversation = answers.service_type === '외국인 대상 영어 회화';
            const isLocalLang = answers.service_type === '기초 타갈로그어/비사야어 레슨';
            const isBusinessEng = answers.service_type === '비즈니스 영어 튜터링';
            const isBpoPrep = answers.service_type === 'BPO/콜센터 취업 준비';
            const isVaTraining = answers.service_type === '가상 비서 실무 교육';
            const isCodingLesson = answers.service_type === '프로그래밍/코딩 레슨';
            const isIelts = answers.service_type === 'IELTS / OET / TOEFL 준비';
            const isPrcExam = answers.service_type === 'PRC 보드 시험 준비';
            const isSwimming = answers.service_type === '수영 레슨';
            const isDance = answers.service_type === '댄스/줌바 레슨';
            const isCookingLesson = answers.service_type === '요리/베이킹 레슨';
            const isMusicLesson = answers.service_type === '피아노/기타/보컬 레슨';

            if (isDeepCleaning) {
                setActiveSteps([...BASE_STEPS, ...DEEP_CLEANING_STEPS]);
            } else if (isMovingService) {
                setActiveSteps([...BASE_STEPS, ...MOVING_STEPS]);
            } else if (isParttimeHousekeeper) {
                setActiveSteps([...BASE_STEPS, ...PARTTIME_HOUSEKEEPER_STEPS]);
            } else if (isCookingHelper) {
                setActiveSteps([...BASE_STEPS, ...COOKING_HELPER_STEPS]);
            } else if (isBabysitter) {
                setActiveSteps([...BASE_STEPS, ...BABYSITTER_STEPS]);
            } else if (isRegularCleaning) {
                setActiveSteps([...BASE_STEPS, ...REGULAR_CLEANING_STEPS, DEFAULT_DETAILS_STEP]);
            } else if (isPoolMaintenance) {
                setActiveSteps([...BASE_STEPS, ...POOL_MAINTENANCE_STEPS]);
            } else if (isSofaMattressCleaning) {
                setActiveSteps([...BASE_STEPS, ...SOFA_MATTRESS_CLEANING_STEPS]);
            } else if (isWindowAcCleaning) {
                setActiveSteps([...BASE_STEPS, ...WINDOW_AC_CLEANING_STEPS]);
            } else if (isSplitAcCleaning) {
                setActiveSteps([...BASE_STEPS, ...SPLIT_AC_CLEANING_STEPS]);
            } else if (isCommercialAcCleaning) {
                setActiveSteps([...BASE_STEPS, ...COMMERCIAL_AC_CLEANING_STEPS]);
            } else if (isTermiteControl) {
                setActiveSteps([...BASE_STEPS, ...TERMITE_CONTROL_STEPS]);
            } else if (isGeneralPestControl) {
                setActiveSteps([...BASE_STEPS, ...GENERAL_PEST_CONTROL_STEPS]);
            } else if (isMoldOdorRemoval) {
                setActiveSteps([...BASE_STEPS, ...MOLD_ODOR_REMOVAL_STEPS]);
            } else if (isBulkWasteDisposal) {
                setActiveSteps([...BASE_STEPS, ...BULK_WASTE_DISPOSAL_STEPS]);
            } else if (isPlumbingRepair) {
                setActiveSteps([...BASE_STEPS, ...PLUMBING_REPAIR_STEPS]);
            } else if (isWaterPumpRepair) {
                setActiveSteps([...BASE_STEPS, ...WATER_PUMP_REPAIR_STEPS]);
            } else if (isDrainUnclog) {
                setActiveSteps([...BASE_STEPS, ...DRAIN_UNCLOG_STEPS]);
            } else if (isWaterHeater) {
                setActiveSteps([...BASE_STEPS, ...WATER_HEATER_STEPS]);
            } else if (isElectricalRepair) {
                setActiveSteps([...BASE_STEPS, ...ELECTRICAL_REPAIR_STEPS]);
            } else if (isGeneratorRepair) {
                setActiveSteps([...BASE_STEPS, ...GENERATOR_REPAIR_STEPS]);
            } else if (isLightingWiring) {
                setActiveSteps([...BASE_STEPS, ...LIGHTING_WIRING_STEPS]);
            } else if (isSolarPanel) {
                setActiveSteps([...BASE_STEPS, ...SOLAR_PANEL_STEPS]);
            } else if (isAcRepair) {
                setActiveSteps([...BASE_STEPS, ...AC_REPAIR_STEPS]);
            } else if (isApplianceRepair) {
                setActiveSteps([...BASE_STEPS, ...APPLIANCE_REPAIR_STEPS]);
            } else if (isTvInstallation) {
                setActiveSteps([...BASE_STEPS, ...TV_INSTALLATION_STEPS]);
            } else if (isCctvInstallation) {
                setActiveSteps([...BASE_STEPS, ...CCTV_INSTALLATION_STEPS]);
            } else if (isWindowScreen) {
                setActiveSteps([...BASE_STEPS, ...WINDOW_SCREEN_STEPS]);
            } else if (isLocksmith) {
                setActiveSteps([...BASE_STEPS, ...LOCKSMITH_STEPS]);
            } else if (isFurnitureAssembly) {
                setActiveSteps([...BASE_STEPS, ...FURNITURE_ASSEMBLY_STEPS]);
            } else if (isLpgGas) {
                setActiveSteps([...BASE_STEPS, ...LPG_GAS_STEPS]);
            } else if (isRemodeling) {
                setActiveSteps([...BASE_STEPS, ...REMODELING_STEPS]);
            } else if (isCondoInterior) {
                setActiveSteps([...BASE_STEPS, ...CONDO_INTERIOR_STEPS]);
            } else if (isCommercialInterior) {
                setActiveSteps([...BASE_STEPS, ...COMMERCIAL_INTERIOR_STEPS]);
            } else if (isTileFlooring) {
                setActiveSteps([...BASE_STEPS, ...TILE_FLOORING_STEPS]);
            } else if (isPainting) {
                setActiveSteps([...BASE_STEPS, ...PAINTING_STEPS]);
            } else if (isCarpentry) {
                setActiveSteps([...BASE_STEPS, ...CARPENTRY_STEPS]);
            } else if (isDrywall) {
                setActiveSteps([...BASE_STEPS, ...DRYWALL_STEPS]);
            } else if (isRoofing) {
                setActiveSteps([...BASE_STEPS, ...ROOFING_STEPS]);
            } else if (isLandscaping) {
                setActiveSteps([...BASE_STEPS, ...LANDSCAPING_STEPS]);
            } else if (isSignage) {
                setActiveSteps([...BASE_STEPS, ...SIGNAGE_STEPS]);
            } else if (isDeckFence) {
                setActiveSteps([...BASE_STEPS, ...DECK_FENCE_STEPS]);
            } else if (isVirtualAssistant) {
                setActiveSteps([...BASE_STEPS, ...VIRTUAL_ASSISTANT_STEPS]);
            } else if (isCsCallcenter) {
                setActiveSteps([...BASE_STEPS, ...CS_CALLCENTER_STEPS]);
            } else if (isTelemarketing) {
                setActiveSteps([...BASE_STEPS, ...TELEMARKETING_STEPS]);
            } else if (isBizReg) {
                setActiveSteps([...BASE_STEPS, ...BIZREG_STEPS]);
            } else if (isBirTax) {
                setActiveSteps([...BASE_STEPS, ...BIR_TAX_STEPS]);
            } else if (isVisa) {
                setActiveSteps([...BASE_STEPS, ...VISA_STEPS]);
            } else if (isPermit) {
                setActiveSteps([...BASE_STEPS, ...PERMIT_STEPS]);
            } else if (isTagalogTrans) {
                setActiveSteps([...BASE_STEPS, ...TAGALOG_TRANS_STEPS]);
            } else if (isVisayanTrans) {
                setActiveSteps([...BASE_STEPS, ...VISAYAN_TRANS_STEPS]);
            } else if (isEnglishTrans) {
                setActiveSteps([...BASE_STEPS, ...ENGLISH_TRANS_STEPS]);
            } else if (isMultilangTrans) {
                setActiveSteps([...BASE_STEPS, ...MULTILANG_TRANS_STEPS]);
            } else if (isGraphicDesign) {
                setActiveSteps([...BASE_STEPS, ...GRAPHIC_DESIGN_STEPS]);
            } else if (isWebDev) {
                setActiveSteps([...BASE_STEPS, ...WEB_DEV_STEPS]);
            } else if (isVideoEdit) {
                setActiveSteps([...BASE_STEPS, ...VIDEO_EDIT_STEPS]);
            } else if (isSnsMarketing) {
                setActiveSteps([...BASE_STEPS, ...SNS_MARKETING_STEPS]);
            } else if (isDebut) {
                setActiveSteps([...BASE_STEPS, ...DEBUT_STEPS]);
            } else if (isChristening) {
                setActiveSteps([...BASE_STEPS, ...CHRISTENING_STEPS]);
            } else if (isBirthdayParty) {
                setActiveSteps([...BASE_STEPS, ...BIRTHDAY_PARTY_STEPS]);
            } else if (isWedding) {
                setActiveSteps([...BASE_STEPS, ...WEDDING_STEPS]);
            } else if (isCorporateEvent) {
                setActiveSteps([...BASE_STEPS, ...CORPORATE_EVENT_STEPS]);
            } else if (isLechon) {
                setActiveSteps([...BASE_STEPS, ...LECHON_STEPS]);
            } else if (isPartyCatering) {
                setActiveSteps([...BASE_STEPS, ...PARTY_CATERING_STEPS]);
            } else if (isFoodCart) {
                setActiveSteps([...BASE_STEPS, ...FOOD_CART_STEPS]);
            } else if (isCustomCake) {
                setActiveSteps([...BASE_STEPS, ...CUSTOM_CAKE_STEPS]);
            } else if (isVideoke) {
                setActiveSteps([...BASE_STEPS, ...VIDEOKE_STEPS]);
            } else if (isTentRental) {
                setActiveSteps([...BASE_STEPS, ...TENT_RENTAL_STEPS]);
            } else if (isPhotobooth) {
                setActiveSteps([...BASE_STEPS, ...PHOTOBOOTH_STEPS]);
            } else if (isSnapPhoto) {
                setActiveSteps([...BASE_STEPS, ...SNAP_PHOTO_STEPS]);
            } else if (isEventMC) {
                setActiveSteps([...BASE_STEPS, ...EVENT_MC_STEPS]);
            } else if (isLiveBand) {
                setActiveSteps([...BASE_STEPS, ...LIVE_BAND_STEPS]);
            } else if (isHmua) {
                setActiveSteps([...BASE_STEPS, ...HMUA_STEPS]);
            } else if (isEngConversation) {
                setActiveSteps([...BASE_STEPS, ...ENG_CONVERSATION_STEPS]);
            } else if (isLocalLang) {
                setActiveSteps([...BASE_STEPS, ...LOCAL_LANG_STEPS]);
            } else if (isBusinessEng) {
                setActiveSteps([...BASE_STEPS, ...BUSINESS_ENG_STEPS]);
            } else if (isBpoPrep) {
                setActiveSteps([...BASE_STEPS, ...BPO_PREP_STEPS]);
            } else if (isVaTraining) {
                setActiveSteps([...BASE_STEPS, ...VA_TRAINING_STEPS]);
            } else if (isCodingLesson) {
                setActiveSteps([...BASE_STEPS, ...CODING_LESSON_STEPS]);
            } else if (isIelts) {
                setActiveSteps([...BASE_STEPS, ...IELTS_STEPS]);
            } else if (isPrcExam) {
                setActiveSteps([...BASE_STEPS, ...PRC_EXAM_STEPS]);
            } else if (isSwimming) {
                setActiveSteps([...BASE_STEPS, ...SWIMMING_STEPS]);
            } else if (isDance) {
                setActiveSteps([...BASE_STEPS, ...DANCE_STEPS]);
            } else if (isCookingLesson) {
                setActiveSteps([...BASE_STEPS, ...COOKING_LESSON_STEPS]);
            } else if (isMusicLesson) {
                setActiveSteps([...BASE_STEPS, ...MUSIC_LESSON_STEPS]);
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
