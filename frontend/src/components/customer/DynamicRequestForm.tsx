'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { useTranslations } from 'next-intl';
import { checkCustomerPhoneVerified, mockVerifyCustomerPhone } from '@/lib/mockAuth';
import { PHILIPPINES_REGIONS } from '@/lib/constants';

const DEPTH1_EN: Record<string, string> = {
    '이사/청소': 'Moving & Cleaning',
    '설치/수리': 'Installation & Repair',
    '인테리어/시공': 'Interior & Construction',
    '비즈니스/외주': 'Business & Outsourcing',
    '이벤트/파티': 'Events & Parties',
    '레슨/튜터링': 'Lessons & Tutoring',
};

const DEPTH2_EN: Record<string, string> = {
    '가사/메이드': 'Housekeeping & Maid',
    '에어컨 청소': 'AC Cleaning',
    '이사 및 운송': 'Moving & Transport',
    '집 청소': 'House Cleaning',
    '특수 청소 및 방역': 'Special Cleaning & Pest Control',
    '폐기물 처리': 'Waste Disposal',
    '가전/기기 수리': 'Appliance & Device Repair',
    '기타 수리': 'Other Repairs',
    '문/창문 및 조립': 'Doors, Windows & Assembly',
    '수도/배관': 'Plumbing',
    '전기': 'Electrical',
    '부분 시공': 'Partial Construction',
    '야외 시공': 'Outdoor Construction',
    '종합 시공': 'General Construction',
    '가상 비서 및 BPO': 'Virtual Assistant & BPO',
    '디자인/개발': 'Design & Development',
    '번역/통역': 'Translation & Interpretation',
    '행정/세무 대행': 'Administrative & Tax Services',
    '대여/렌탈': 'Rental',
    '음식 및 케이터링': 'Food & Catering',
    '촬영 및 섭외': 'Photography & Talent Booking',
    '행사 기획': 'Event Planning',
    '시험 준비': 'Exam Preparation',
    '어학 레슨': 'Language Lessons',
    '예체능/취미': 'Arts, Sports & Hobbies',
    '취업/직무 준비': 'Career & Job Preparation',
};

// --- Schema Definitions ---
const BASE_STEPS = [
    { id: 'depth1', type: 'SINGLE_CHOICE', text: 'What type of professional are you looking for?' },
    { id: 'depth2', type: 'SINGLE_CHOICE', text: 'What service do you need?' },
    { id: 'service_type', type: 'SINGLE_CHOICE', text: 'Please select the detailed service.' },
    { id: 'region_reg', type: 'SINGLE_CHOICE', text: 'Please select the region where you need the service.' },
    { id: 'region_city', type: 'SINGLE_CHOICE', text: 'Please select the city.' }
];

const MOVING_STEPS = [
    { id: 'move_type', type: 'SINGLE_CHOICE', text: 'What type of moving service do you need?', options: ['Full packing (pro packs everything, excludes valuables)', 'Semi-packing (pack together with pro, pro handles large items)', 'Standard (customer packs everything, pro transports only)', 'Storage (store items and deliver on move-in date)', 'Other'] },
    { id: 'move_date', type: 'DATE_PICKER', text: 'Please select your moving date.' },
    { id: 'from_region', type: 'REGION_N_CITY', text: 'Please select the departure region and city.' },
    { id: 'from_floor', type: 'TEXT_INPUT', text: 'Please enter the floor of the departure location. (e.g. Single house, 5th floor)' },
    { id: 'from_size', type: 'TEXT_INPUT', text: 'Please enter the area (sqm/number of rooms) and number of residents. (e.g. 30sqm, 2 people)' },
    { id: 'from_elevator', type: 'SINGLE_CHOICE', text: 'Please select the situation at the departure location.', options: ['Use elevator', 'Use stairs', 'Use ladder truck', 'Decide after consultation'], skippable: true },
    { id: 'appliances', type: 'MULTI_CHOICE', text: 'Please select the appliances to be moved.', options: ['None', 'Refrigerator', 'Kimchi refrigerator', 'Air conditioner', 'TV/Monitor', 'PC/Laptop', 'Microwave', 'Water purifier', 'Bidet', 'Other'], skippable: true },
    { id: 'furniture', type: 'MULTI_CHOICE', text: 'Please select the furniture to be moved.', options: ['None', 'Bed', 'Sofa', 'Chair', 'Storage cabinet', 'Bookshelf', 'Display cabinet', 'Wardrobe', 'Dresser', 'Piano', 'Other'], skippable: true },
    { id: 'images', type: 'IMAGE_UPLOAD_MULTI', text: 'Please attach photos of your belongings. (Up to 5 photos)', skippable: true },
    { id: 'to_region', type: 'REGION_N_CITY', text: 'Please select the destination region and city.' },
    { id: 'to_floor', type: 'TEXT_INPUT', text: 'Please enter the floor of the destination. (e.g. 2nd floor)' },
    { id: 'to_elevator', type: 'SINGLE_CHOICE', text: 'Please select the situation at the destination.', options: ['Use elevator', 'Use stairs', 'Use ladder truck', 'Decide after consultation'], skippable: true },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Please provide any additional requests in detail.', skippable: true, placeholder: 'e.g. Please handle fragile items with extra care, I need to complete the move by 5PM' }
];

const PARTTIME_HOUSEKEEPER_STEPS = [
    { id: 'house_type', type: 'SINGLE_CHOICE', text: 'Please select your housing type and size.', options: ['Studio', '1 Bedroom', '2 Bedrooms', '3+ Bedrooms', 'House & Lot'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: 'Please select the service frequency.', options: ['One-time', 'Weekly (once a week)', 'Twice a month'] },
    { id: 'extra_services', type: 'MULTI_CHOICE', text: 'Are there any additional focused cleaning tasks? (Multiple selection)', options: ['None', 'Hand wash & laundry (Laba)', 'Ironing (Plantsa)', 'Refrigerator interior cleaning', 'Balcony & window frame cleaning', 'Other'] },
    { id: 'cleaning_supplies', type: 'SINGLE_CHOICE', text: 'How should cleaning tools and supplies be prepared?', options: ["Use customer's tools/supplies", "Pro brings own supplies (+additional cost)"] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: 'Do you have pets at home?', options: ['None', 'Dog or cat', 'Other animals'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special requests for the pro? (Optional)', skippable: true }
];

const BABYSITTER_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'care_schedule', type: 'SINGLE_CHOICE', text: 'Please select the preferred care schedule and type.', options: ['Part-time (4~5 hours)', 'Full-time (8~9 hours)', 'Overnight care (includes sleep time)', 'Live-in care (Stay-in, to be discussed)'] },
    { id: 'children_info', type: 'TEXT_INPUT', text: 'Please enter the number and ages of children to be cared for.', placeholder: 'e.g. 2 children (8 months, 4 years old)' },
    { id: 'language_pref', type: 'SINGLE_CHOICE', text: 'Please select your preferred language for communication.', options: ['Tagalog', 'English', 'Korean', 'No preference'] },
    { id: 'extra_tasks', type: 'MULTI_CHOICE', text: 'Are there additional tasks beyond basic childcare? (Multiple selection)', options: ['None (childcare only)', 'Meal and snack preparation', "Child's laundry and ironing", 'Bottle sterilization and bath assistance', 'School pick-up/drop-off'] },
    { id: 'child_health_note', type: 'TEXT_INPUT', text: 'Please note any health conditions or allergies of the child. (Optional)', skippable: true },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: 'Do you have pets at home?', options: ['None', 'Dog or cat', 'Other animals'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any preferences or other requests for the pro? (Optional)', skippable: true, placeholder: 'e.g. Prefer someone fluent in English, there is a CCTV in the living room, etc.' }
];

const COOKING_HELPER_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'meal_headcount', type: 'SINGLE_CHOICE', text: 'How many people will be eating?', options: ['1~2 people', '3~4 people', '5~8 people', '9+ people (large group)'] },
    { id: 'meal_time', type: 'MULTI_CHOICE', text: 'Please select the meal time or purpose. (Multiple selection)', options: ['Breakfast', 'Lunch', 'Dinner', 'All day (meal prep/multiple meals)', 'Home party & events (Handaan)'] },
    { id: 'cuisine_style', type: 'MULTI_CHOICE', text: 'Please select preferred cooking style. (Multiple selection)', options: ['Filipino local cuisine', 'Korean food', 'Western cuisine', 'Diet & healthy food', 'Other'] },
    { id: 'grocery_needed', type: 'SINGLE_CHOICE', text: 'Do you need grocery shopping assistance (Palengke/Grocery)?', options: ['Ingredients are ready in the fridge (cook immediately)', 'Need grocery shopping assistance (+additional cost)'] },
    { id: 'allergy_note', type: 'TEXT_INPUT', text: 'Please note any ingredients to avoid or allergies. (Optional)', skippable: true },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any kitchen environment or other requests for the pro? (Optional)', skippable: true, placeholder: 'e.g. No oven available, using 2-burner induction cooktop, etc.' }
];

const DEEP_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'deep_clean_type', type: 'SINGLE_CHOICE', text: 'What type of deep cleaning do you need?', options: ['New unit move-in (Post-construction / dust and paint removal)', 'Move-in to previously occupied unit', 'Move-out cleaning'] },
    { id: 'house_size', type: 'SINGLE_CHOICE', text: 'Please select the size and type of the unit to be cleaned.', options: ['Studio~1 Bedroom', '2 Bedrooms (1~2 bathrooms)', '3+ Bedrooms (condo)', '2-story+ House & Lot'] },
    { id: 'furnished_status', type: 'SINGLE_CHOICE', text: 'Is the unit currently furnished?', options: ['Completely empty (Bare / no furniture)', 'Some furniture (Semi-furnished)', 'All items present (Fully-furnished)'] },
    { id: 'utilities_status', type: 'SINGLE_CHOICE', text: 'Are electricity and water available at the location?', options: ['Both electricity and water available', 'Water only (no electricity)', 'Electricity only (no water)', 'Neither available (please resolve before booking)'] },
    { id: 'special_options', type: 'MULTI_CHOICE', text: 'Are there additional special cleaning options needed? (Multiple selection)', options: ['None', 'Pest control', 'AC internal disassembly cleaning', 'Mattress & sofa deep cleaning', 'Grease trap cleaning'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Condo admin work permit processing required, etc.' }
];

const REGULAR_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'cleaning_cycle', type: 'SINGLE_CHOICE', text: 'Please select the cleaning service frequency.', options: ['One-time general cleaning', 'Weekly cleaning (1~2 times/week)', 'Monthly cleaning (1~2 times/month)'] },
    { id: 'house_size', type: 'SINGLE_CHOICE', text: 'Please select the housing type and room/bathroom size.', options: ['Studio~1 Bedroom', '2 Bedrooms (1~2 bathrooms)', '3+ Bedrooms (condo)', '2-story+ House & Lot'] },
    { id: 'cleaning_supplies', type: 'SINGLE_CHOICE', text: 'How should cleaning equipment and supplies be prepared?', options: ["Use customer's general tools/supplies", "Pro brings professional equipment and supplies (+additional cost)"] },
    { id: 'focus_areas', type: 'MULTI_CHOICE', text: 'Are there areas that need focused cleaning? (Multiple selection)', options: ['None (general whole-unit cleaning)', 'Kitchen grease and stains', 'Bathroom water stains and mold', 'Balcony and window frames', 'Refrigerator interior'] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: 'Do you have pets at home?', options: ['None', 'Dog or cat', 'Other animals'] }
];

const POOL_MAINTENANCE_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'pool_type', type: 'SINGLE_CHOICE', text: 'Please select the type and size of the pool to be maintained.', options: ['Private residential small pool (Plunge pool)', 'Private residential large pool', 'Condo/Village shared pool (commercial)', 'Other water features (pond, etc.)'] },
    { id: 'pool_condition', type: 'SINGLE_CHOICE', text: 'What is the current water condition of the pool?', options: ['Normal maintenance condition (clear water)', 'Leaves or dirt settled at the bottom', 'Severe algae bloom (green water)', 'Pool is completely empty'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: 'Please select the desired cleaning/maintenance frequency.', options: ['One-time problem solving (deep cleaning)', 'Regular visit 1~2 times/week', 'Monthly regular maintenance'] },
    { id: 'chemicals_supply', type: 'SINGLE_CHOICE', text: 'How should water treatment chemicals be prepared?', options: ["Use customer's existing chemicals", "Pro brings all professional chemicals (+additional cost)"] },
    { id: 'extra_repair', type: 'MULTI_CHOICE', text: 'Are there any equipment that need inspection or repair? (Multiple selection)', options: ['None (water treatment and cleaning only)', 'Pump and filter inspection', 'Underwater lighting repair', 'Pool tile repair', 'Leak inspection'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Filter pump is very noisy, indoor pool, etc.' }
];

const SOFA_MATTRESS_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'clean_items', type: 'MULTI_CHOICE', text: 'What items need deep cleaning? (Multiple selection)', options: ['Mattress', 'Sofa', 'Carpet & rug', 'Dining/office chairs', 'Other'] },
    { id: 'item_size_qty', type: 'TEXT_INPUT', text: 'Please enter the size and quantity of items to be cleaned.', placeholder: 'e.g. 1 queen size mattress, 1 three-seater sofa' },
    { id: 'material_type', type: 'SINGLE_CHOICE', text: 'Please select the main material of the item.', options: ['Fabric', 'Genuine leather', 'Faux leather (PU)', 'Mixed material / Not sure'] },
    { id: 'stain_issues', type: 'MULTI_CHOICE', text: 'Are there any specific stains or issues to be resolved? (Multiple selection)', options: ['None (general dust and mite care)', 'Pet urine and severe odor', 'Coffee, wine, food stains', 'Bed bugs (Surot) and pest care', 'Mold removal'] },
    { id: 'has_pets', type: 'SINGLE_CHOICE', text: 'Do you have pets at home?', options: ['None', 'Dog or cat', 'Other animals'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special requests for the pro? (Optional)', skippable: true, placeholder: 'e.g. There is a severe stain area, prefer morning visit, etc.' }
];

const WINDOW_AC_CLEANING_STEPS = [
    { id: 'visit_timing', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit timing.', options: ['Today', 'Tomorrow', 'Within this week', 'Flexible date'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: 'Please select the total number of window-type AC units to be cleaned.', options: ['1 unit', '2 units', '3 units', '4+ units'] },
    { id: 'ac_size', type: 'MULTI_CHOICE', text: 'Please select all applicable AC sizes (HP). (Multiple selection)', options: ['0.5 ~ 1.0 HP (small)', '1.5 ~ 2.0 HP (medium-large)', '2.5 HP+ (extra-large)', 'Not sure'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: 'Are there any current symptoms or special cleaning purposes? (Multiple selection)', options: ['None (regular deep cleaning)', 'Weak cooling (not cold enough)', 'Water dripping inside the room (leak)', 'Severe mold and odor', 'Loud noise'] },
    { id: 'ac_height', type: 'SINGLE_CHOICE', text: 'How high is the AC unit installed?', options: ['Normal height (can reach by hand or chair)', 'High position (professional ladder required)', 'Very narrow or dangerous workspace'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Brand is Condura/Carrier, recently had gas refill, etc.' }
];

const SPLIT_AC_CLEANING_STEPS = [
    { id: 'ac_clean_date', type: 'DATE_PICKER', text: 'Please select your preferred cleaning and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8AM~12PM)', 'Afternoon (1PM~5PM)', 'Flexible with pro'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: 'Please select the total number of split-type AC units to be cleaned.', options: ['1 unit', '2 units', '3 units', '4+ units'] },
    { id: 'ac_size', type: 'MULTI_CHOICE', text: 'Please select all applicable AC sizes (HP). (Multiple selection)', options: ['1.0 ~ 1.5 HP (small room)', '2.0 ~ 2.5 HP (living room/medium-large)', '3.0 HP+ (extra-large/commercial)', 'Not sure'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: 'Are there any current symptoms or cleaning purposes? (Multiple selection)', options: ['None (regular periodic cleaning)', 'Weak cooling (suspected gas shortage)', 'Water dripping from indoor unit (leak/blocked drain)', 'Severe mold odor', 'Loud noise'] },
    { id: 'outdoor_unit_location', type: 'SINGLE_CHOICE', text: 'Where is the outdoor unit installed?', options: ['Balcony/terrace floor (very easy access)', 'Dedicated outdoor unit rack or rooftop (accessible)', 'Exterior wall mid-air (dangerous/safety equipment required)', 'Not sure'] },
    { id: 'indoor_unit_access', type: 'SINGLE_CHOICE', text: 'Is there large furniture directly below the indoor unit that is hard to move?', options: ['Space below is clear', 'Furniture that can be easily moved', 'Heavy bed or fixed TV (careful protection work required)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Condo Admin work permit required, outdoor unit is far away, etc.' }
];

const COMMERCIAL_AC_CLEANING_STEPS = [
    { id: 'ac_clean_date', type: 'DATE_PICKER', text: 'Please select your preferred cleaning and inspection date.' },
    { id: 'work_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred work schedule.', options: ['Daytime (8AM~5PM)', 'Nighttime (after business hours)', 'Weekends and holidays', 'Flexible with pro'] },
    { id: 'ac_types', type: 'MULTI_CHOICE', text: 'Please select all types of AC units to be cleaned. (Multiple selection)', options: ['Ceiling cassette (4-way)', 'Ceiling cassette (1-way/2-way)', 'Large floor-standing type', 'Concealed ducted type', 'Not sure'] },
    { id: 'ac_quantity', type: 'SINGLE_CHOICE', text: 'Please select the total number of AC units to be cleaned.', options: ['1~2 units', '3~5 units', '6~10 units', '11+ units (large site)'] },
    { id: 'ceiling_height', type: 'SINGLE_CHOICE', text: 'What is the approximate ceiling height of the installed ceiling-type AC?', options: ['Standard ceiling height (under 3m, regular ladder possible)', 'High ceiling (3m~4m, tall ladder required)', 'Very high ceiling (4m+, scaffolding required)', 'No ceiling-type AC (floor-standing only)'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: 'Are there any current symptoms or cleaning purposes? (Multiple selection)', options: ['None (regular deep cleaning)', 'Weak cooling (suspected gas shortage)', 'Water dripping from unit (leak/pump failure)', 'Severe mold and odor', 'Error code or unit not working'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Mall/condo regulations require nighttime work only, Official Receipt issuance required, etc.' }
];

const TERMITE_CONTROL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8AM~12PM)', 'Afternoon (1PM~5PM)', 'Flexible with pro'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: 'Please select the type of building with termite damage.', options: ['Condo/Apartment', 'House & Lot or Townhouse', 'Commercial building or office', 'Other'] },
    { id: 'damage_status', type: 'MULTI_CHOICE', text: 'What is the current confirmed termite (Anay) damage situation? (Multiple selection)', options: ['Mud tubes visible on walls or wood', 'Wooden pillars or furniture showing eaten marks', 'Winged termite swarmers flying around', 'No damage yet, requesting preventive treatment'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: 'Please select the approximate area requiring treatment.', options: ['Under 50sqm (small)', '51~100sqm (medium)', '101~200sqm (large)', '201sqm+ (extra-large)', 'Not sure'] },
    { id: 'treatment_method', type: 'SINGLE_CHOICE', text: 'Do you have a preferred termite treatment method?', options: ['Chemical spraying and drilling (common/fast results)', 'Bait system (bait station installation/eco-friendly)', 'Soil poisoning (for standalone houses)', 'Let expert diagnose and decide the best method'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: 'Are there young children or pets at home? (Important for chemical selection)', options: ['None', 'Young children present', 'Pets (dogs/cats, etc.) present', 'Both young children and pets present'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Kitchen cabinet woodwork is heavily damaged, prefer eco-friendly/odorless chemicals, etc.' }
];

const GENERAL_PEST_CONTROL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8AM~12PM)', 'Afternoon (1PM~5PM)', 'Flexible with pro'] },
    { id: 'pest_types', type: 'MULTI_CHOICE', text: 'What pests do you mainly want to eliminate? (Multiple selection)', options: ['Cockroaches (Ipis)', 'Ants (Langgam)', 'Mosquitoes and flies (Lamok/Langaw)', 'Rats (Daga)', 'Bed bugs and fleas (Surot/Pulgas)', 'Other or not sure'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: 'Please select the type of building that needs pest control.', options: ['Condo/Apartment', 'House & Lot or Townhouse', 'Commercial building (restaurant/cafe, etc.)', 'Office or other'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: 'Please select the approximate area to be treated.', options: ['Under 50sqm (small/studio)', '51~100sqm (medium/2BR)', '101~200sqm (large)', '201sqm+ (extra-large)', 'Not sure'] },
    { id: 'service_frequency', type: 'SINGLE_CHOICE', text: 'Please select the desired pest control service frequency.', options: ['One-time intensive treatment', 'Monthly regular treatment', 'Quarterly regular treatment', 'Decide after expert diagnosis'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: 'Are there young children or pets at home? (Important for chemical selection)', options: ['None', 'Young children present', 'Pets (dogs/cats, etc.) present', 'Both young children and pets present'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Many cockroaches around kitchen sink, prefer odorless/eco-friendly chemicals, restaurant closes at night so please come after closing, etc.' }
];

const MOLD_ODOR_REMOVAL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8AM~12PM)', 'Afternoon (1PM~5PM)', 'Flexible with pro'] },
    { id: 'problem_types', type: 'MULTI_CHOICE', text: 'What problems do you mainly want to resolve? (Multiple selection)', options: ['Wall/ceiling mold (Amag)', 'Stubborn bathroom mold', 'Drain odor', 'Pet waste odor', 'Musty AC and room smell (Amoy kulob)', 'Other odors'] },
    { id: 'problem_locations', type: 'MULTI_CHOICE', text: 'What are the main locations where the problem occurred? (Multiple selection)', options: ['Bedroom', 'Bathroom', 'Living room & kitchen', 'Furniture and mattress interior', 'Whole house'] },
    { id: 'mold_severity', type: 'SINGLE_CHOICE', text: 'How severe is the mold or damage?', options: ['Only on the surface (simple removal possible)', 'Severe enough to peel paint/wallpaper (restoration needed)', 'Spread over a large area of the house', 'No visible mold but severe odor'] },
    { id: 'area_size', type: 'SINGLE_CHOICE', text: 'Please select the approximate scale of the area that needs treatment.', options: ['Specific part only (under 10sqm)', 'One room', '2~3 rooms', 'Whole house (major work)'] },
    { id: 'children_pets', type: 'SINGLE_CHOICE', text: 'Are there young children or pets at home? (Important for sanitizer/deodorizer selection)', options: ['None', 'Young children present', 'Pets (dogs/cats, etc.) present', 'Both young children and pets present'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Water seeps through the wall when it rains (suspected leak), there is no window for ventilation in the room, etc.' }
];

const BULK_WASTE_DISPOSAL_STEPS = [
    { id: 'pickup_date', type: 'DATE_PICKER', text: 'Please select your preferred pickup and removal date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8AM~12PM)', 'Afternoon (1PM~5PM)', 'Flexible with pro'] },
    { id: 'waste_items', type: 'MULTI_CHOICE', text: 'What are the main items to be disposed of? (Multiple selection)', options: ['Large furniture (bed/sofa/wardrobe, etc.)', 'Large appliances (refrigerator/washing machine, etc.)', 'Interior and construction debris', 'Large amount of miscellaneous items after moving', 'Restaurant and commercial waste'] },
    { id: 'waste_volume', type: 'SINGLE_CHOICE', text: 'What is the approximate total volume of waste? (for vehicle dispatch)', options: ['Multicab 1 load (small amount)', 'L300 van or pickup truck 1 load (medium)', 'Elf truck 1 load (large amount)', '6-wheel+ large truck load', 'Not sure (please attach photos for consultation)'] },
    { id: 'floor_access', type: 'SINGLE_CHOICE', text: 'Please select the floor and elevator availability at the pickup location.', options: ['Ground floor or elevator available (including service elevator)', 'Stairs only (2nd~3rd floor)', 'Stairs only (4th floor+)', 'Special equipment required (ladder truck, etc.)'] },
    { id: 'disassembly_needed', type: 'SINGLE_CHOICE', text: 'Is disassembly needed before removal?', options: ['No (can pass through the door as is)', 'Yes (must be disassembled due to large size)', 'Not sure (expert judgment needed)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes about the location for the pro? (Optional)', skippable: true, placeholder: 'e.g. Condo Admin gate pass for removal has been obtained, narrow alley difficult for truck entry, etc.' }
];

const PLUMBING_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like a visit and assessment.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['ASAP (Emergency dispatch)', 'Morning (8am–12pm)', 'Afternoon (1pm–5pm)', 'Discuss timing with the pro'] },
    { id: 'leak_problems', type: 'MULTI_CHOICE', text: 'What plumbing or leak issues are you currently experiencing? (Multiple choice)', options: ['Burst pipe with heavy water flow', 'Water leaking from ceiling or walls (suspected upper floor leak)', 'Faucet or showerhead leaking', 'Unexplained spike in water bill', 'Rusty or contaminated water'] },
    { id: 'leak_locations', type: 'MULTI_CHOICE', text: 'Where is the main location of the problem? (Multiple choice)', options: ['Bathroom or toilet area', 'Kitchen sink', 'Ceiling or walls', 'Laundry area', 'Yard or outdoor meter area'] },
    { id: 'main_valve_status', type: 'SINGLE_CHOICE', text: 'Can you shut off the main water valve at home?', options: ['Yes, it is already shut off', 'No, I don\'t know the valve location', 'The valve is broken and cannot be closed', 'The leak is minor and I haven\'t shut it off'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: 'Please select the type of building. (For leak detection and pipe structure assessment)', options: ['Condo / Apartment', 'House & Lot / Townhouse', 'Commercial building or office'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., I have already reported the leak to the condo admin, tiles or walls may need to be broken, etc.' }
];

const WATER_PUMP_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like a visit and assessment.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8am–12pm)', 'Afternoon (1pm–5pm)', 'Discuss timing with the pro'] },
    { id: 'equipment_types', type: 'MULTI_CHOICE', text: 'What equipment needs to be inspected? (Multiple choice)', options: ['Water Pump (Motor)', 'Pressure Tank / Bladder Tank', 'Overhead Water Tank', 'Underground Cistern'] },
    { id: 'pump_symptoms', type: 'MULTI_CHOICE', text: 'What symptoms are you currently experiencing? (Multiple choice)', options: ['No water throughout the house (zero pressure)', 'Water pressure is too weak', 'Pump motor keeps running without stopping', 'Loud noise or burning smell from the pump', 'Water leaking from tank or pipes'] },
    { id: 'pump_hp', type: 'SINGLE_CHOICE', text: 'Do you know the horsepower (HP) of your water pump?', options: ['0.5 HP or less (small)', '1.0 HP (medium)', '1.5 HP or more (large/commercial)', 'Not sure'] },
    { id: 'pump_location', type: 'SINGLE_CHOICE', text: 'Where is the water pump and water tank installed?', options: ['Ground floor yard or utility area', 'Rooftop', 'Underground (next to cistern)', 'Other'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., The brand is Goulds (or Pedrollo), please also quote for replacement if repair is not possible, etc.' }
];

const DRAIN_UNCLOG_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like a visit.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['ASAP (Emergency dispatch)', 'Morning (8am–12pm)', 'Afternoon (1pm–5pm)', 'Discuss timing with the pro'] },
    { id: 'clog_locations', type: 'MULTI_CHOICE', text: 'Where is the blockage? (Multiple choice)', options: ['Toilet bowl', 'Bathroom floor drain', 'Kitchen sink', 'Washbasin / Lavatory', 'Outdoor main sewer / Poso Negro'] },
    { id: 'clog_severity', type: 'SINGLE_CHOICE', text: 'How severe is the blockage?', options: ['Water drains very slowly', 'Completely blocked with standing water', 'Water or waste is backing up and overflowing (most severe)'] },
    { id: 'prior_attempts', type: 'SINGLE_CHOICE', text: 'Have you tried anything before calling the pro? (Chemical use is important to disclose)', options: ['Nothing (left as is)', 'Used a plunger', 'Poured chemical drain cleaner (e.g., Liquid Sosa) — must inform the pro for safety', 'Used a hanger or other tool'] },
    { id: 'clog_cause', type: 'SINGLE_CHOICE', text: 'Do you know what caused the blockage?', options: ['Toilet paper and waste (toilet)', 'Hair and grease buildup (drain/sink)', 'Hard object fell in (toy, plastic, etc.)', 'Unknown'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., We only have one bathroom so it\'s urgent, there is a strong foul smell coming from the drain, etc.' }
];

const WATER_HEATER_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like a visit.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['Morning (8am–12pm)', 'Afternoon (1pm–5pm)', 'Discuss timing with the pro'] },
    { id: 'service_type_wh', type: 'SINGLE_CHOICE', text: 'Please select the type of service you need.', options: ['New installation (customer has the unit)', 'New installation (pro to purchase and bring the unit)', 'Repair and inspection of existing water heater', 'Remove and relocate existing water heater'] },
    { id: 'heater_type', type: 'SINGLE_CHOICE', text: 'What type of water heater is it?', options: ['Single-point (for one shower)', 'Multi-point (for shower and lavatory simultaneously)', 'Large storage tank water heater', 'Not sure'] },
    { id: 'heater_symptoms', type: 'MULTI_CHOICE', text: '[Repair only] What symptoms are you experiencing? (Select \'N/A\' for installation)', options: ['N/A (new installation or relocation)', 'Water is not heating at all', 'Temperature cannot be controlled (too hot)', 'Water is leaking from the unit', 'Breaker trips when water heater is turned on'] },
    { id: 'electrical_ready', type: 'SINGLE_CHOICE', text: '[Installation only] Is the wiring and breaker in place at the installation location?', options: ['N/A (repair customer)', 'Yes, the dedicated wiring and breaker are already on the wall', 'No, new wiring needs to be run from the main breaker', 'Not sure (site inspection needed)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., The brand is Panasonic (or Joven), I think a pump may be needed due to low water pressure, etc.' }
];

const ELECTRICAL_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like a visit and assessment.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time.', options: ['ASAP (Emergency dispatch)', 'Morning (8am–12pm)', 'Afternoon (1pm–5pm)', 'Discuss timing with the pro'] },
    { id: 'electrical_symptoms', type: 'MULTI_CHOICE', text: 'What are the main symptoms you are experiencing? (Multiple choice)', options: ['Main breaker keeps tripping', 'No power in a specific room or outlet', 'Sparks or burning smell from outlet or switch', 'Lights flickering severely', 'Risk of electric shock (tingling sensation)'] },
    { id: 'outage_scope', type: 'SINGLE_CHOICE', text: 'What is the scope of the power outage?', options: ['Entire house / building has no power', 'Only a specific floor or area has no power', 'Only 1–2 outlets or lights are not working', 'Unsure if it\'s an external (Meralco) or internal issue'] },
    { id: 'building_type', type: 'SINGLE_CHOICE', text: 'Please select the type of building. (For wiring structure and work difficulty assessment)', options: ['Condo / Apartment', 'House & Lot / Townhouse', 'Commercial building or office', 'Other'] },
    { id: 'panel_board_access', type: 'SINGLE_CHOICE', text: 'Do you know the location of the main panel board / breaker box?', options: ['Yes, it is inside the unit and accessible', 'Yes, it is outside the unit', 'The admin office manages it and a key is needed', 'I don\'t know the location'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., The breaker trips whenever the AC is turned on, the wall became electrified after rain, etc.' }
];

const LANDSCAPING_STEPS = [
    { id: 'landscaping_work_types', type: 'MULTI_CHOICE', text: 'Please select the landscaping or garden maintenance work you need. (Multiple choice)', options: ['Lawn mowing & weeding', 'Tree and shrub trimming/pruning', 'New plant installation & garden design', 'Pest control & fertilizing', 'Artificial turf installation', 'Green waste collection and disposal'] },
    { id: 'garden_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the garden or work area?', options: ['Normal condition requiring regular maintenance', 'Overgrown with weeds and trees (jungle-like)', 'Empty land with no plants (new landscaping needed)', 'Existing landscaping that needs to be fully removed'] },
    { id: 'garden_area_sqm', type: 'SINGLE_CHOICE', text: 'Please select the approximate work area (sqm).', options: ['Less than 50 sqm (small yard)', '50–150 sqm', '150–300 sqm', '300 sqm or more', 'Not sure of the exact area (site inspection needed)'] },
    { id: 'garden_infra', type: 'MULTI_CHOICE', text: 'Check the water and electricity infrastructure at the site. (Multiple choice)', options: ['Outdoor water connection (e.g., Maynilad) and hose available', 'Outdoor electrical outlet available (for power tools)', 'No water or electricity on site (pro must bring own equipment)'] },
    { id: 'garden_material_supply', type: 'SINGLE_CHOICE', text: 'How will landscaping materials (plants, soil, fertilizer, etc.) be provided?', options: ['Customer provides plants and materials (labor only)', 'Pro handles everything from design to materials and installation (turn-key)', 'Simple weeding and pruning — no materials needed'] },
    { id: 'garden_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the site type and admin/HOA work permit status.', options: ['Subdivision/Village (HOA approval obtained)', 'Condominium balcony/common area (Admin approval obtained)', 'Independent private house (no permit required)', 'Not yet permitted (pro guidance needed)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date you would like work to begin.' },
    { id: 'garden_work_schedule', type: 'SINGLE_CHOICE', text: 'Per village rules, what time can noise-generating work (e.g., power tools, chainsaw) be done?', options: ['Weekdays daytime (8am–5pm) only', 'Weekdays and weekends daytime', 'Specific hours only (e.g., 1pm–5pm)', 'Have not yet checked the rules'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., All cut branches must be taken to the disposal site, this is for a specific tropical plant (mango tree) pruning, etc.' }
];

const SIGNAGE_STEPS = [
    { id: 'signage_types', type: 'MULTI_CHOICE', text: 'Please select the type of signage and work you need. (Multiple choice)', options: ['Panaflex illuminated signage', 'Acrylic or metal build-up letters', 'LED neon sign', 'Tarpaulin banner and streamer', 'Window sticker / decal installation', 'Existing signage reprinting & fluorescent/LED replacement', 'Existing signage removal/dismantling'] },
    { id: 'signage_location', type: 'SINGLE_CHOICE', text: 'Where will the signage be installed and at what height?', options: ['Ground floor level (can be done with a ladder)', '2nd floor or higher exterior wall (scaffolding or sky lift required)', 'Inside a shopping mall (SM, Ayala, etc.) storefront', 'Indoor wall surface'] },
    { id: 'signage_design_status', type: 'SINGLE_CHOICE', text: 'What is the status of your design and logo files?', options: ['Print-ready high-resolution design file (AI, PDF, etc.) available', 'Only have a logo sketch or photo (pro needs to create the design)', 'Nothing available — logo design needed from scratch'] },
    { id: 'signage_power', type: 'SINGLE_CHOICE', text: 'What is the electrical connection status at the signage location?', options: ['Power cable is already at the installation point (ready to connect)', 'Additional electrical wiring needed to the installation point', 'Non-illuminated sign — no electrical connection needed'] },
    { id: 'signage_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please indicate the mall admin or city hall (LGU) signage permit status.', options: ['Mall/commercial admin drawing approval and work permit completed', 'City Hall signage permit obtained', 'Installation on private property (no permit required)', 'Not yet checked permit requirements (pro to assist)'] },
    { id: 'signage_size', type: 'SINGLE_CHOICE', text: 'Please select the approximate size of the signage.', options: ['Small (less than 1 sqm)', 'Medium (1–3 sqm)', 'Large (3 sqm or more / building façade sign)', 'Not yet decided (to be confirmed after site measurement)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date for installation (or site measurement).' },
    { id: 'signage_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the available working hours.', options: ['Weekdays daytime', 'Weekdays and weekends daytime', 'Night shift only (after mall/commercial hours)', 'Discuss timing with the pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., The old sign was damaged by a typhoon and needs urgent removal first, SM Mall only allows acrylic build-up signs, etc.' }
];

const DECK_FENCE_STEPS = [
    { id: 'deck_fence_types', type: 'MULTI_CHOICE', text: 'Please select the construction items you need. (Multiple choice)', options: ['New outdoor deck installation', 'Existing deck repair & oil stain maintenance', 'New boundary fence installation', 'Existing fence repair & painting', 'Privacy screen installation', 'Gate fabrication and installation'] },
    { id: 'deck_material', type: 'SINGLE_CHOICE', text: 'Please select the main material you want.', options: ['Treated wood', 'WPC Composite (low maintenance)', 'Steel / Wrought iron', 'Concrete and CHB block', 'Undecided (to discuss with the pro)'] },
    { id: 'deck_ground_condition', type: 'SINGLE_CHOICE', text: 'What is the current ground condition at the site?', options: ['Flat concrete floor (frame can be installed directly)', 'Dirt floor (leveling and concrete foundation required)', 'Existing deck or fence needs to be removed first', 'Condition unknown (site inspection needed)'] },
    { id: 'deck_material_supply', type: 'SINGLE_CHOICE', text: 'How will materials be provided?', options: ['Customer purchases deck/fence materials directly (labor only)', 'Pro provides all frame and finishing materials (turn-key)', 'To be decided after consultation'] },
    { id: 'deck_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the HOA/subdivision or barangay setback permit status.', options: ['HOA/Village construction approval and setback confirmed', 'Fully owned private property (no neighbor dispute risk)', 'Not yet checked setback rules and permits (pro guidance needed)'] },
    { id: 'deck_size', type: 'SINGLE_CHOICE', text: 'Please select the approximate deck area or fence length.', options: ['Small (deck less than 10 sqm / fence less than 10 m)', 'Medium (deck 10–30 sqm / fence 10–30 m)', 'Large (deck 30 sqm or more / fence 30 m or more)', 'Not sure (site inspection needed)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select the date to start construction (or site measurement).' },
    { id: 'deck_work_schedule', type: 'SINGLE_CHOICE', text: 'Per village rules, when can noisy work (welding, cutting, etc.) be done?', options: ['Weekdays daytime anytime', 'Weekdays and Saturdays daytime', 'Have not yet checked the rules'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., A 220V power connection is available for the welding machine, fence height is limited to 1.5 m due to a boundary issue with the neighbor, etc.' }
];

const VIRTUAL_ASSISTANT_STEPS = [
    { id: 'va_tasks', type: 'MULTI_CHOICE', text: 'Please select the main tasks for the virtual assistant (VA). (Multiple choice)', options: ['Email/calendar management & general admin (Data Entry)', 'Social media management & content posting', 'Customer support (CS/Chat/Email)', 'Bookkeeping & receipt processing', 'Research & lead generation', 'Graphic design or video editing'] },
    { id: 'va_english_level', type: 'SINGLE_CHOICE', text: 'Please select the required English proficiency level.', options: ['Basic reading/writing (text-based tasks only)', 'Fluent conversational (internal video calls possible)', 'Native-level (direct calls/CS with US/international clients)'] },
    { id: 'va_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the work arrangement and time zone.', options: ['Full-time (8 hours/day)', 'Part-time (4 hours/day or less)', 'Short-term project basis', 'PH/KR daytime shift', 'US Graveyard/Night shift', 'AU shift'] },
    { id: 'va_tools', type: 'MULTI_CHOICE', text: 'Are there specific software/tools the VA must know? (Multiple choice)', options: ['MS Office', 'Google Workspace', 'Design tools (Canva, Photoshop, etc.)', 'CRM tools (Salesforce, HubSpot, etc.)', 'Accounting tools (Xero, QuickBooks, etc.)', 'Collaboration tools (Slack, Trello, Asana, etc.)', 'Other (specify in notes)'] },
    { id: 'va_wfh_infra', type: 'SINGLE_CHOICE', text: '[Important] Please select the required WFH infrastructure.', options: ['Stable fiber internet and backup power (UPS/Generator) required', 'Any normal internet environment is fine', 'Client will provide equipment (laptop, etc.)', 'Must work in-office at an agency'] },
    { id: 'va_budget', type: 'SINGLE_CHOICE', text: 'Please select the expected monthly budget (PHP) or salary range.', options: ['15,000–25,000 PHP (basic admin)', '25,000–40,000 PHP (mid-level/specialist skills)', '40,000 PHP or more (senior talent)', 'Hourly rate preferred', 'To be decided after consultation'] },
    { id: 'va_start_date', type: 'DATE_PICKER', text: 'Please select the date you would like work to start.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Shopify backend management experience is required, a daily stand-up meeting will be held via Zoom, etc.' }
];

const CS_CALLCENTER_STEPS = [
    { id: 'cs_channels', type: 'MULTI_CHOICE', text: 'Please select the customer support (CS) channels to outsource. (Multiple choice)', options: ['Inbound voice calls', 'Email support', 'Live chat', 'Social media DM & comment management', 'Ticketing system management (Zendesk, etc.)'] },
    { id: 'cs_languages', type: 'MULTI_CHOICE', text: 'Please select the languages agents must support. (Multiple choice)', options: ['English (native/fluent level)', 'Tagalog and other Philippine local languages', 'Korean', 'Other multilingual support needed'] },
    { id: 'cs_agent_count', type: 'SINGLE_CHOICE', text: 'Please select the number of agents (seats) needed.', options: ['1–3 agents (small initial setup)', '4–10 agents', '11–50 agents', '50 or more (large call center)', 'Traffic unknown — to be decided after consultation'] },
    { id: 'cs_coverage', type: 'SINGLE_CHOICE', text: 'Please select the service coverage hours.', options: ['24/7 (shift work)', 'US business hours (PH graveyard/night shift)', 'PH/KR business hours (daytime)', 'Specific days/weekends only'] },
    { id: 'cs_infra', type: 'SINGLE_CHOICE', text: '[Important] Please select infrastructure and operational requirements.', options: ['Must use BPO agency office with secure on-site network', 'WFH arrangement allowed', 'Remote access to client systems (VPN, company phone system, etc.) required'] },
    { id: 'cs_ticket_volume', type: 'SINGLE_CHOICE', text: 'Please select the expected monthly inbound call or ticket volume.', options: ['Less than 1,000/month', '1,000–5,000/month', '5,000 or more/month', 'Early stage — unpredictable'] },
    { id: 'cs_start_date', type: 'DATE_PICKER', text: 'Please select the desired outsourcing project start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., We will provide an existing CS manual (SOP), this is a campaign requiring knowledge of medical/legal terminology, etc.' }
];

const TELEMARKETING_STEPS = [
    { id: 'tm_campaign_goal', type: 'MULTI_CHOICE', text: 'Please select the main goals of the telemarketing campaign. (Multiple choice)', options: ['B2B lead generation', 'B2C outbound sales (direct selling)', 'Appointment setting', 'Customer satisfaction calls & surveys', 'Data cleansing (DB update)'] },
    { id: 'tm_target_country', type: 'SINGLE_CHOICE', text: 'Please select the primary target country.', options: ['United States', 'Canada', 'Australia & New Zealand', 'Philippines (local)', 'Korea', 'Other'] },
    { id: 'tm_script_db', type: 'SINGLE_CHOICE', text: 'Please select the call list (lead DB) and script provision status.', options: ['Client provides both the DB and script', 'Client provides script only (agency to build its own DB)', 'Agency to handle everything turn-key (script writing, DB building, and calling)'] },
    { id: 'tm_payment_type', type: 'SINGLE_CHOICE', text: 'How do you plan to compensate the agents (payment terms)?', options: ['Fixed pay (hourly/monthly)', 'Base pay + commission', '100% performance-based (pay per lead/sale)', 'To be decided after consultation'] },
    { id: 'tm_dialer', type: 'SINGLE_CHOICE', text: '[Important] Please select how the dialer system and call costs will be handled.', options: ['Client provides VoIP number and dialer system (e.g., RingCentral)', 'Agency\'s own dialer system preferred (call costs included in quote)', 'Local calls only via mobile phone (within the Philippines)'] },
    { id: 'tm_agent_count', type: 'SINGLE_CHOICE', text: 'Please select the number of agents (seats) for the campaign.', options: ['1–2 agents (test campaign)', '3–5 agents', '5 or more (large team)'] },
    { id: 'tm_start_date', type: 'DATE_PICKER', text: 'Please select the desired campaign start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Real estate cold calling experience required, weekly performance reports are needed, etc.' }
];

const BIZREG_STEPS = [
    { id: 'bizreg_entity_type', type: 'SINGLE_CHOICE', text: 'Please select the type of business entity you want to register.', options: ['Sole Proprietorship (DTI)', 'One-Person Corporation (SEC - OPC)', 'Corporation (SEC)', 'Partnership (SEC)', 'Undecided (to be discussed)'] },
    { id: 'bizreg_foreign_ownership', type: 'SINGLE_CHOICE', text: 'Please select the expected foreign ownership percentage.', options: ['100% Filipino-owned (no foreign equity)', '60% Filipino / 40% Foreign', 'Foreign equity over 40% or 100% foreign-owned corporation'] },
    { id: 'bizreg_scope', type: 'MULTI_CHOICE', text: 'Please select the scope of services you need. (Multiple choice)', options: ['SEC/DTI basic registration only', 'Barangay Clearance processing', 'Mayor\'s Permit / Business Permit processing', 'BIR registration + official receipt (ATP) — full turn-key', 'Corporate bank account opening assistance'] },
    { id: 'bizreg_address_status', type: 'SINGLE_CHOICE', text: 'Do you have a registered business address secured?', options: ['Lease contract ready', 'Currently in the process of signing a commercial lease', 'No address — virtual office connection needed', 'Planning to use home address'] },
    { id: 'bizreg_capital', type: 'SINGLE_CHOICE', text: 'For SEC corporation registration, please select the expected paid-up capital.', options: ['Less than 1,000,000 PHP', '1,000,000–5,000,000 PHP', '5,000,000 PHP or more', 'Going with DTI sole proprietorship (not applicable)'] },
    { id: 'bizreg_start_date', type: 'DATE_PICKER', text: 'Please select the date you would like the service to start.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is a food & beverage business so FDA permit will be needed later, I need to know the requirements for 100% foreign-owned retail corporation, etc.' }
];

const BIR_TAX_STEPS = [
    { id: 'tax_service_types', type: 'MULTI_CHOICE', text: 'Please select the type of tax services you need. (Multiple choice)', options: ['Monthly retainer bookkeeping & tax filing', 'Year-end ITR (Annual Income Tax Return) filing', 'Annual Mayor\'s Permit renewal processing', 'BIR audit response & penalty resolution (open cases)', 'Payroll management & SSS/PhilHealth/Pag-IBIG compliance'] },
    { id: 'tax_vat_status', type: 'SINGLE_CHOICE', text: 'Please select the BIR taxpayer type of your business.', options: ['VAT-registered (corporation or individual)', 'Non-VAT / Percentage Tax registered', 'Not yet registered with BIR', 'Not sure of the current status'] },
    { id: 'tax_transaction_volume', type: 'SINGLE_CHOICE', text: 'Approximately how many monthly transactions (sales/purchase receipts) does your business have?', options: ['Less than 50/month (early stage/small)', '50–200/month', '200 or more/month (high volume)', 'Almost no transactions (zero filing needed)'] },
    { id: 'tax_bir_status', type: 'SINGLE_CHOICE', text: 'Please describe your current BIR registration status and official receipt status.', options: ['BIR COR (2303) and official receipt (ATP) all in order', 'New business — official receipts need to be printed now', 'Long-term filing lapses — penalties (open cases) expected', 'Need to take over records from a previous accountant'] },
    { id: 'tax_accounting_system', type: 'SINGLE_CHOICE', text: 'Do you currently use any accounting or POS system?', options: ['Cloud accounting software (QuickBooks, Xero, etc.)', 'Own POS system with downloadable data', 'No system — managed manually with Excel or handwritten receipts'] },
    { id: 'tax_start_date', type: 'DATE_PICKER', text: 'Please select the date (month) you would like the service to start.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is a PEZA/BOI-registered corporation with tax incentives, I have missed 2 years of tax filings and need urgent penalty compromise, etc.' }
];

const VISA_STEPS = [
    { id: 'visa_service_types', type: 'MULTI_CHOICE', text: 'Please select the visa or immigration services you need. (Multiple choice)', options: ['9G Working Visa & AEP (new/renewal)', 'SRRV (Retirement Visa)', '13A (Marriage Visa) & dependent visa', 'Tourist visa extension & ACR I-Card', 'ECC (Exit Clearance Certificate)', 'Blacklist removal & overstay resolution', 'Visa downgrading'] },
    { id: 'visa_headcount', type: 'SINGLE_CHOICE', text: 'Please select the total number of applicants.', options: ['Just myself (1 person)', '2–4 people (including family)', 'Corporate group (5 or more)'] },
    { id: 'visa_stay_status', type: 'SINGLE_CHOICE', text: 'Please describe the current Philippine stay status of the applicant(s).', options: ['Currently in the Philippines on a valid visa', 'Overstaying — subject to penalties', 'Not yet in the Philippines (currently abroad)', 'Already departed — needs to be processed from overseas'] },
    { id: 'visa_sponsor_docs', type: 'SINGLE_CHOICE', text: 'For 9G Working Visa, what is the status of the sponsor company\'s documents?', options: ['All corporate documents ready (SEC, GIS, Mayor\'s Permit, BIR, etc.) — ready to file', 'Some corporate documents missing or not renewed (review needed)', 'No sponsor company (need to discuss agency/dummy sponsor options)', 'Not applying for a working visa (not applicable)'] },
    { id: 'visa_new_or_renewal', type: 'SINGLE_CHOICE', text: 'Is this a new application or a renewal?', options: ['New application (first time)', 'Renewal/extension before expiry', 'Renewal after expiry (penalty expected)', 'Visa cancellation (downgrading)'] },
    { id: 'visa_start_date', type: 'DATE_PICKER', text: 'Please select the date you would like the service to start.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., I need to depart in 3 weeks so SRC/departure clearance during the working visa process is needed, tourist visa has been overstayed for more than 6 months, etc.' }
];

const PERMIT_STEPS = [
    { id: 'permit_types', type: 'MULTI_CHOICE', text: 'Please select the type of special permits or licenses you need. (Multiple choice)', options: ['FDA license (food, cosmetics, pharmaceutical import/distribution — LTO & CPR)', 'PCAB (contractor\'s license) new application or renewal', 'DOLE safety permit & registration', 'DENR/LLDA environmental permit', 'Fire Safety Inspection Certificate (FSIC) & Barangay Clearance', 'BOC importer registration (AMO)'] },
    { id: 'permit_current_status', type: 'SINGLE_CHOICE', text: 'Please describe the current status of the permit/license.', options: ['Brand new application', 'Regular renewal of existing permit', 'Past renewal deadline — penalties incurred', 'Need to take over from a previous agency and complete documents'] },
    { id: 'permit_biz_docs', type: 'SINGLE_CHOICE', text: 'Please describe the basic business document readiness.', options: ['SEC/DTI, Mayor\'s Permit, BIR, and other core documents are complete', 'Basic business documents need to be set up first', 'Pre-consultation needed on foreign equity requirements'] },
    { id: 'permit_item_count', type: 'SINGLE_CHOICE', text: 'How many items or business locations need the permit?', options: ['Single item or single business location', '2–5 items (e.g., multiple FDA products)', '5 or more items', 'Not applicable (company-level license e.g., PCAB)'] },
    { id: 'permit_inspection_ready', type: 'SINGLE_CHOICE', text: 'Is the business ready for the agency\'s pre-inspection?', options: ['All facility and requirements are in order and ready for inspection', 'Facilities not yet complete — consultation needed first', 'Document-only work — no inspection required', 'Not sure'] },
    { id: 'permit_start_date', type: 'DATE_PICKER', text: 'Please select the date you would like the service to start.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Need FDA CPR for 3 cosmetic products imported from Korea, this is for PCAB license upgrading, etc.' }
];

const TAGALOG_TRANS_STEPS = [
    { id: 'tl_service_types', type: 'MULTI_CHOICE', text: 'Please select the type of translation/interpretation service you need. (Multiple choice)', options: ['Document translation (text, email, contracts, etc.)', 'On-site interpretation (field visits, meetings, etc.)', 'Remote interpretation (Zoom, phone call, etc.)', 'Video subtitle translation & dubbing'] },
    { id: 'tl_field', type: 'SINGLE_CHOICE', text: 'Please select the main field/context for translation or interpretation.', options: ['Everyday conversation & tourist guide', 'Government offices (city hall, immigration, etc.) & administrative documents', 'Legal contracts & police/court attendance', 'Business meetings & trade', 'Medical & technical/specialized fields'] },
    { id: 'tl_doc_volume', type: 'SINGLE_CHOICE', text: '(For translation) Please select the approximate volume.', options: ['1–2 A4 pages (short email/certificate)', '3–10 A4 pages', '10 or more A4 pages (manual, proposal, etc.)', 'Not translation (interpretation only)'] },
    { id: 'tl_interp_duration', type: 'SINGLE_CHOICE', text: '(For interpretation) Please select the estimated duration.', options: ['Under 2 hours (single meeting)', 'Half-day (around 4 hours)', 'Full day (8 hours)', 'Multi-day assignment', 'Not interpretation (translation only)'] },
    { id: 'tl_notarization', type: 'SINGLE_CHOICE', text: '[Important] Do you need notarization or a certified translation for official submission?', options: ['Yes, notarization by a Philippine Notary Public required', 'Yes, a translator\'s signed certification is needed', 'No, for reference or communication only', 'Not sure (consultation needed)'] },
    { id: 'tl_location', type: 'SINGLE_CHOICE', text: '(For interpretation) Please describe where the interpretation will take place.', options: ['In-person at a client-designated location in Metro Manila', 'In-person but outside Metro Manila / provincial trip needed', '100% online/remote', 'Not applicable (translation only)'] },
    { id: 'tl_start_date', type: 'DATE_PICKER', text: 'Please select the date for the translation/interpretation work (or meeting).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is a labor-management conflict meeting so the atmosphere may be tense, English interpretation will also be mixed in alongside Tagalog, etc.' }
];

const VISAYAN_TRANS_STEPS = [
    { id: 'vi_service_types', type: 'MULTI_CHOICE', text: 'Please select the type of translation/interpretation service you need. (Multiple choice)', options: ['Document translation', 'On-site interpretation (field visits, meetings, etc.)', 'Remote interpretation (video/phone)', 'Video subtitle translation'] },
    { id: 'vi_dialect', type: 'SINGLE_CHOICE', text: 'Please select the target region or specific Visayan dialect.', options: ['Cebuano (Cebu, Bohol, etc.)', 'Davaoeño (Davao and Mindanao)', 'Ilonggo / Hiligaynon (Iloilo, Bacolod, etc.)', 'Waray (Samar, Leyte, etc.)', 'Not sure (please specify target region in notes)'] },
    { id: 'vi_field', type: 'SINGLE_CHOICE', text: 'Please select the main field/context for translation or interpretation.', options: ['Everyday conversation & local tourism', 'Construction/factory site worker communication (Safety/Toolbox meetings, etc.)', 'Business & government/administrative work', 'Legal & dispute resolution', 'Other specialized fields'] },
    { id: 'vi_doc_volume', type: 'SINGLE_CHOICE', text: '(For translation) Please select the approximate volume.', options: ['1–2 A4 pages', '3–10 A4 pages', '10 or more A4 pages', 'Not translation (interpretation only)'] },
    { id: 'vi_interp_duration', type: 'SINGLE_CHOICE', text: '(For interpretation) Please select the estimated duration.', options: ['Under 2 hours', 'Half-day (around 4 hours)', 'Full day (8 hours)', 'Multi-day assignment (including provincial trips)', 'Not interpretation (translation only)'] },
    { id: 'vi_location', type: 'SINGLE_CHOICE', text: '(For interpretation) Please describe where the interpretation will take place.', options: ['In-person in major Visayas/Mindanao city (Cebu, Davao, etc.)', 'Remote area or out-of-town trip required (vehicle support available)', '100% online/remote', 'Not applicable (translation only)'] },
    { id: 'vi_start_date', type: 'DATE_PICKER', text: 'Please select the date for the translation/interpretation work (or meeting).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is for a Mindanao farm inspection trip, the local workers do not speak English or Tagalog at all, etc.' }
];

const ENGLISH_TRANS_STEPS = [
    { id: 'en_service_types', type: 'MULTI_CHOICE', text: 'Please select the type of translation/interpretation service you need. (Multiple choice)', options: ['Document translation', 'On-site interpretation', 'Remote interpretation (video/phone)', 'Video subtitle translation & proofreading'] },
    { id: 'en_field', type: 'SINGLE_CHOICE', text: 'Please select the main specialized field for translation or interpretation.', options: ['General business (email, proposals, general meetings)', 'IT & technology (software, engineering, etc.)', 'Legal & contracts (MOA, NDA, employment contracts, etc.)', 'Medical & pharmaceutical', 'Finance & accounting', 'Academic papers & study abroad documents'] },
    { id: 'en_target_country', type: 'SINGLE_CHOICE', text: 'Is there a specific target country or context for the English?', options: ['Philippine local business (Taglish nuance & local culture required)', 'US/Canada target (North American standard English)', 'Global standard business English', 'No specific preference'] },
    { id: 'en_doc_volume', type: 'SINGLE_CHOICE', text: '(For translation) Please select the approximate volume.', options: ['1–2 A4 pages (under 500 words)', '3–10 A4 pages', '10 or more A4 pages (bulk document)', 'Not translation (interpretation only)'] },
    { id: 'en_interp_duration', type: 'SINGLE_CHOICE', text: '(For interpretation) Please select the estimated duration.', options: ['Under 2 hours', 'Half-day (around 4 hours)', 'Full day (8 hours)', 'Multi-day conference or trade show', 'Not interpretation (translation only)'] },
    { id: 'en_apostille', type: 'SINGLE_CHOICE', text: '[Important] Do you need notarization or Apostille processing for the document?', options: ['Philippine DFA Apostille processing required', 'Philippine Notary Public notarization only', 'Translation only (no notarization needed)', 'Not a translation request'] },
    { id: 'en_start_date', type: 'DATE_PICKER', text: 'Please select the date for the translation/interpretation work (or meeting).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is consecutive interpretation for a pitching event with heavy IT terminology (blockchain, etc.), this is an SEC articles of incorporation translation, etc.' }
];

const MULTILANG_TRANS_STEPS = [
    { id: 'ml_language_pair', type: 'SINGLE_CHOICE', text: 'Please select the language pair you need.', options: ['Chinese ↔ Korean/English/Tagalog', 'Japanese ↔ Korean/English/Tagalog', 'Spanish ↔ Korean/English/Tagalog', 'Vietnamese or other Southeast Asian language', 'Other European/Middle Eastern language (specify in notes)'] },
    { id: 'ml_service_types', type: 'MULTI_CHOICE', text: 'Please select the type of translation/interpretation service you need. (Multiple choice)', options: ['Document translation', 'On-site interpretation', 'Remote interpretation (video/phone)', 'Video subtitle translation'] },
    { id: 'ml_field', type: 'SINGLE_CHOICE', text: 'Please select the main field/context for translation or interpretation.', options: ['Everyday conversation & tourist guide', 'Business meetings & company visits', 'Government offices & legal/administrative work', 'IT & specialized technology', 'Medical & beauty (cosmetic surgery, dermatology, etc.)'] },
    { id: 'ml_doc_volume', type: 'SINGLE_CHOICE', text: '(For translation) Please select the approximate volume.', options: ['1–2 A4 pages', '3–10 A4 pages', '10 or more A4 pages', 'Not translation (interpretation only)'] },
    { id: 'ml_interp_duration', type: 'SINGLE_CHOICE', text: '(For interpretation) Please select the estimated duration.', options: ['Under 2 hours', 'Half-day (around 4 hours)', 'Full day (8 hours)', 'Multi-day assignment', 'Not interpretation (translation only)'] },
    { id: 'ml_location', type: 'SINGLE_CHOICE', text: '[Important] Please describe where the interpretation will take place or where the translated document will be submitted.', options: ['In-person in the Philippines (Metro Manila)', 'In-person in the Philippines (provincial/out-of-town)', '100% online/remote', 'For official institution submission (e.g., embassy) — notarization required', 'For personal/internal use'] },
    { id: 'ml_start_date', type: 'DATE_PICKER', text: 'Please select the date for the translation/interpretation work (or meeting).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Please specify the exact language and any special notes. (Required)', placeholder: 'e.g., [Thai → Korean] translation, interpretation for a Spanish buyer on a factory tour in Manila, etc.' }
];

const GRAPHIC_DESIGN_STEPS = [
    { id: 'gd_work_types', type: 'MULTI_CHOICE', text: 'Please select the type of design work you need. (Multiple choice)', options: ['Corporate/brand logo (CI/BI)', 'Business cards, envelopes & stationery', 'Brochure / catalog / flyer (print)', 'Product packaging & label design', 'Web/social media content images', 'Other (specify in notes)'] },
    { id: 'gd_reference_status', type: 'SINGLE_CHOICE', text: 'Please describe your current brief and reference material status.', options: ['Clear concept sketch and benchmark images available', 'Only a text-based brief available', 'Still at idea stage — need creative proposals from the designer', 'Redesign/update of an existing design'] },
    { id: 'gd_usage_purpose', type: 'SINGLE_CHOICE', text: 'Please select the primary intended use of the design.', options: ['Commercial print materials (CMYK, high resolution required)', 'Online/digital only (website, social media, etc.)', 'Both print and online use', 'Large format outdoor advertising (signage, etc.)'] },
    { id: 'gd_source_files', type: 'SINGLE_CHOICE', text: '[Important] Do you need the source files (AI, PSD, etc.) and full copyright transfer?', options: ['Source files and full commercial copyright transfer required (additional cost agreed)', 'High-resolution image files only (JPG, PNG, PDF) — no source files needed', 'To be decided after consultation'] },
    { id: 'gd_meeting_type', type: 'SINGLE_CHOICE', text: 'Please select the preferred meeting and communication style.', options: ['100% online/remote (email, messaging, video call)', '1–2 in-person meetings in Manila/Metro Manila preferred', 'In-house part-time work at the office preferred'] },
    { id: 'gd_start_date', type: 'DATE_PICKER', text: 'Please select the desired deadline for final delivery (or first draft).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Targeting Philippine locals so I\'d like recommendations for colors and fonts preferred by locals, I want to do logo and business card design as a package, etc.' }
];

const WEB_DEV_STEPS = [
    { id: 'wd_platform_types', type: 'MULTI_CHOICE', text: 'Please select the type of platform you want to develop. (Multiple choice)', options: ['Company/landing page website', 'E-commerce/online shopping website', 'Platform & web service (booking, matching, etc.)', 'Android app', 'iOS app', 'Mobile hybrid/cross-platform app'] },
    { id: 'wd_project_stage', type: 'SINGLE_CHOICE', text: 'How far along is the project in terms of preparation?', options: ['Idea stage only (detailed planning needed)', 'Wireframe/storyboard available', 'Design (Figma, XD, etc.) complete — development only needed', 'Maintenance & feature addition for an existing live service'] },
    { id: 'wd_local_integration', type: 'MULTI_CHOICE', text: '[Important] Do you need Philippine-specific payment/logistics integration? (Multiple choice)', options: ['Local payment gateway (GCash, Maya, PayMongo, etc.) integration required', 'Local delivery API (Lalamove, Grab, J&T, etc.) integration required', 'Philippine local SMS (OTP) integration required', 'Global service — no local integration needed', 'Not yet decided'] },
    { id: 'wd_hosting_status', type: 'SINGLE_CHOICE', text: 'Please describe the hosting and domain preparation status.', options: ['Domain and server (AWS, Cafe24, etc.) already secured under client\'s name', 'Pro to handle initial setup and purchase on client\'s behalf', 'Migration from an existing server needed'] },
    { id: 'wd_budget', type: 'SINGLE_CHOICE', text: 'Please select the expected total project budget (PHP).', options: ['Less than 50,000 PHP (simple template-based)', '50,000–150,000 PHP', '150,000–500,000 PHP', '500,000 PHP or more (custom platform)', 'Quote to be determined after detailed planning'] },
    { id: 'wd_start_date', type: 'DATE_PICKER', text: 'Please select the desired project start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Fast loading speed is critical given Philippine local internet conditions (slow speeds), multilingual support (English, Korean, Tagalog) is needed, etc.' }
];

const VIDEO_EDIT_STEPS = [
    { id: 've_platform_purpose', type: 'MULTI_CHOICE', text: 'Please select the main platform/purpose of the video. (Multiple choice)', options: ['YouTube long-form content', 'Short-form content (TikTok, Reels, Shorts)', 'Corporate/product promotional video (TVC, landing page)', 'Event/wedding/anniversary video', 'Educational & online course video'] },
    { id: 've_footage_status', type: 'SINGLE_CHOICE', text: 'Please describe the status of the raw footage to be edited.', options: ['All raw footage provided — editing only', 'Shooting & editing both requested (separate filming crew needed)', 'Footage is insufficient — stock footage to be used in editing'] },
    { id: 've_video_length', type: 'SINGLE_CHOICE', text: 'Please select the expected final video length.', options: ['Under 1 minute (short-form, short ad)', '1–5 minutes', '5–15 minutes', '15 minutes or more (documentary, full event video, etc.)', 'Multiple videos to be produced (specify in notes)'] },
    { id: 've_edit_elements', type: 'MULTI_CHOICE', text: 'Please check the elements that must be included in the edit. (Multiple choice)', options: ['Cut editing & smooth transitions', 'Basic subtitles (lower thirds, etc.)', 'Multilingual subtitle translation (English, Tagalog, etc.)', 'Motion graphics & VFX', 'Color grading', 'Background music (BGM) & sound effects (SFX)'] },
    { id: 've_work_style', type: 'SINGLE_CHOICE', text: 'Please select the preferred work and communication style.', options: ['100% online/remote (large files via cloud)', 'Editor to work in-house at the office', 'First meeting in-person, then online work'] },
    { id: 've_start_date', type: 'DATE_PICKER', text: 'Please select the desired final video delivery date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Please incorporate fast-paced editing and memes popular with Philippine Gen Z, thumbnail design for the YouTube channel is also requested, etc.' }
];

const SNS_MARKETING_STEPS = [
    { id: 'sns_platforms', type: 'MULTI_CHOICE', text: 'Please select the target platforms for marketing and management. (Multiple choice)', options: ['Facebook (No. 1 platform in the Philippines)', 'Instagram', 'TikTok', 'LinkedIn', 'YouTube', 'Other (specify in notes)'] },
    { id: 'sns_target_audience', type: 'SINGLE_CHOICE', text: 'Who is the primary target audience?', options: ['Philippine local residents (Taglish/localized content needed)', 'Korean expats in the Philippines', 'Consumers in Korea', 'Global/English-speaking consumers'] },
    { id: 'sns_work_scope', type: 'MULTI_CHOICE', text: 'Please select the main tasks to delegate to the pro/agency. (Multiple choice)', options: ['Initial account/page setup & optimization', 'Regular content planning & design (posting N times/week)', 'Facebook/Instagram paid ads management', 'Customer comment & DM/PM response management', 'Influencer (KOL) sourcing & management'] },
    { id: 'sns_ads_budget_type', type: 'SINGLE_CHOICE', text: '[Important] How will the paid ads budget be handled?', options: ['Management fee only — ad spend charged directly to client\'s card', 'All-in turn-key quote (management fee + actual ad spend combined)', 'Organic page management only — no paid ads'] },
    { id: 'sns_page_status', type: 'SINGLE_CHOICE', text: 'What is the current activity status of the page?', options: ['Just starting out — new page creation needed', 'Page exists but has been neglected — rebranding needed', 'Currently active but needs professional ads/content scale-up'] },
    { id: 'sns_start_date', type: 'DATE_PICKER', text: 'Please select the desired marketing management start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Facebook Page Shop feature setup is essential, looking for a long-term monthly contract rather than a one-time event promotion, etc.' }
];

const DEBUT_STEPS = [
    { id: 'debut_theme', type: 'SINGLE_CHOICE', text: 'Please select the main concept or theme for the debut party.', options: ['Modern/simple style', 'Glamorous fairytale/princess concept', 'Vintage/bohemian', 'K-Pop & modern party', 'Not yet decided (to discuss with the pro)'] },
    { id: 'debut_scope', type: 'MULTI_CHOICE', text: 'Please select the service scope needed. (Multiple choice)', options: ['Full planning & preparation (turn-key)', 'On-the-day coordination only', 'Venue & catering sourcing', 'Dress rental & hair/makeup (HMUA)', 'Photo & video coverage (P&V)', 'Cotillion, 18 Roses & program planning'] },
    { id: 'debut_guest_count', type: 'SINGLE_CHOICE', text: 'Please select the expected number of guests.', options: ['Less than 50 (small)', '50–100', '100–150', '150 or more'] },
    { id: 'debut_venue_status', type: 'SINGLE_CHOICE', text: 'Please describe the venue booking status.', options: ['Hotel ballroom/function hall booked', 'Private event hall/restaurant booked', 'Outdoor/garden venue booked', 'Venue needs to be sourced (pro recommendation needed)'] },
    { id: 'debut_catering_rules', type: 'SINGLE_CHOICE', text: '[Important] Have you checked the venue rules for outside catering and lechon?', options: ['Venue provides in-house catering (no outside food allowed)', 'Outside catering & lechon allowed (corkage fee confirmed)', 'Have not yet checked the venue\'s outside vendor policy', 'Catering needs to be sourced as well'] },
    { id: 'debut_budget', type: 'SINGLE_CHOICE', text: 'Please select the total expected budget for the debut party (PHP).', options: ['Less than 100,000 PHP', '100,000–250,000 PHP', '250,000–500,000 PHP', '500,000 PHP or more'] },
    { id: 'debut_date', type: 'DATE_PICKER', text: 'Please select the planned debut date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Need a team that can choreograph and coach the Cotillion dance, a package for the debutante\'s 2 gowns and entourage dress rental is needed, etc.' }
];

const CHRISTENING_STEPS = [
    { id: 'ch_scope', type: 'MULTI_CHOICE', text: 'Please select the scope of christening/baptism planning you need. (Multiple choice)', options: ['Full planning & execution (church + reception)', 'Church booking & admin support only', 'Reception venue & catering sourcing', 'Souvenirs & decoration setup', 'Photo & video coverage'] },
    { id: 'ch_guest_count', type: 'SINGLE_CHOICE', text: 'Please select the approximate number of godparents and guests.', options: ['Immediate family & a small number of godparents only (less than 30)', 'Mid-size party (30–70)', 'Large party (70 or more)'] },
    { id: 'ch_church_status', type: 'SINGLE_CHOICE', text: 'Please describe the church/parish booking status.', options: ['Church booked and date confirmed', 'Have a preferred church but not yet booked', 'Church recommendation and booking assistance needed'] },
    { id: 'ch_reception_venue', type: 'SINGLE_CHOICE', text: 'Please select the preferred reception venue type after the christening.', options: ['Restaurant private room', 'Parish hall (attached to the church)', 'Hotel or dedicated event hall', 'Home or condo/village clubhouse', 'Undecided (consultation needed)'] },
    { id: 'ch_catering_style', type: 'SINGLE_CHOICE', text: '[Important] Please select the preferred reception style and catering.', options: ['Traditional Filipino (including lechon, local buffet style)', 'Modern and simple Western-style course or buffet', 'Character/themed party style for children', 'To be decided after consultation'] },
    { id: 'ch_date', type: 'DATE_PICKER', text: 'Please select the planned christening (or party) date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Special giveaways for the godparents (Ninong/Ninang) need to be made, need to verify if the church allows only their designated photographer, etc.' }
];

const BIRTHDAY_PARTY_STEPS = [
    { id: 'bday_party_type', type: 'SINGLE_CHOICE', text: 'Please select the type of party you are planning.', options: ['Baby\'s 1st birthday party', '7th birthday party (major Philippine milestone)', 'General adult birthday party', 'Parent\'s milestone birthday (senior/jubilee)', 'Wedding anniversary or other special occasion'] },
    { id: 'bday_scope', type: 'MULTI_CHOICE', text: 'Please select the party planning scope you need. (Multiple choice)', options: ['Full planning & on-site execution', 'Party venue sourcing & catering', 'Party styling (balloons, backdrop, photo zone, etc.)', 'Entertainment (magician, face painting, MC, etc.)', 'Photo & video coverage'] },
    { id: 'bday_guest_count', type: 'SINGLE_CHOICE', text: 'Please select the expected total number of guests.', options: ['Less than 30 (private, small)', '30–70', '70–150', '150 or more'] },
    { id: 'bday_venue_status', type: 'SINGLE_CHOICE', text: 'Please describe the venue booking status.', options: ['Hotel/restaurant booked', 'Condo/village clubhouse (function room) booked', 'Venue needs to be sourced (pro recommendation needed)'] },
    { id: 'bday_vendor_rules', type: 'SINGLE_CHOICE', text: '[Important] Have you checked the venue rules for outside vendors (decorators, entertainers, catering)?', options: ['Outside vendors fully allowed (deposit/work permit paid or not required)', 'Corkage & vendor entry fees apply (confirmed in advance)', 'Have not yet checked the rules (pro guidance needed)', 'Venue not yet confirmed'] },
    { id: 'bday_budget', type: 'SINGLE_CHOICE', text: 'Please select the total expected party budget (PHP).', options: ['Less than 50,000 PHP', '50,000–100,000 PHP', '100,000–200,000 PHP', '200,000 PHP or more'] },
    { id: 'bday_date', type: 'DATE_PICKER', text: 'Please select the planned party date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Need help booking a Jollibee or McDonald\'s party package, this is an outdoor pool party so a rain contingency plan (tent) is needed, etc.' }
];

const WEDDING_STEPS = [
    { id: 'wed_service_scope', type: 'SINGLE_CHOICE', text: 'Please select the scope of wedding planning service you need.', options: ['Full planning (budget, venue, and all vendors — turn-key)', 'Partial planning (some vendors booked, need help coordinating the rest)', 'On-the-day coordination only'] },
    { id: 'wed_venue_type', type: 'SINGLE_CHOICE', text: 'Please select the preferred wedding style and venue.', options: ['Traditional church ceremony followed by hotel reception', 'Beach/destination wedding (Boracay, Cebu, etc.)', 'Garden/outdoor house wedding', 'Indoor dedicated wedding hall or restaurant'] },
    { id: 'wed_guest_count', type: 'SINGLE_CHOICE', text: 'Please select the expected number of guests.', options: ['Less than 50 (small/micro wedding)', '50–100', '100–200', '200 or more (large)'] },
    { id: 'wed_booked_items', type: 'MULTI_CHOICE', text: 'Please check which items are already booked. (Multiple choice)', options: ['Ceremony venue (church/chapel)', 'Reception venue', 'Catering', 'Dress, hair & makeup, and studio (HMUA package)', 'Nothing booked yet (early stage)'] },
    { id: 'wed_logistics', type: 'SINGLE_CHOICE', text: '[Important] Do you need weather contingency plans or long-distance logistics support?', options: ['Outdoor/garden ceremony — rain contingency (tent or indoor backup venue) required', 'Many out-of-town guests — bus charter and hotel accommodation arrangement needed', 'Indoor ceremony — not affected by weather', 'To be coordinated after consultation'] },
    { id: 'wed_budget', type: 'SINGLE_CHOICE', text: 'Please select the total expected wedding budget (PHP).', options: ['Less than 300,000 PHP', '300,000–800,000 PHP', '800,000–1,500,000 PHP', '1,500,000 PHP or more'] },
    { id: 'wed_date', type: 'DATE_PICKER', text: 'Please select the planned ceremony date (or preferred month).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is an international marriage (foreign-Filipino) so guidance on CENOMAR and related admin procedures is needed, custom entourage dress making is also to be included, etc.' }
];

const CORPORATE_EVENT_STEPS = [
    { id: 'corp_event_types', type: 'MULTI_CHOICE', text: 'Please select the type of corporate event you are planning. (Multiple choice)', options: ['Year-end Christmas party', 'Team building & company workshop', 'Product launch & VIP event', 'Conference, seminar & academic forum', 'Awards ceremony & gala dinner'] },
    { id: 'corp_headcount', type: 'SINGLE_CHOICE', text: 'Please select the expected number of attendees.', options: ['Less than 50', '50–150', '150–300', '300–500', '500 or more (large-scale)'] },
    { id: 'corp_work_scope', type: 'MULTI_CHOICE', text: 'Please select the planning and coordination scope needed. (Multiple choice)', options: ['Total event planning & directing', 'Venue, accommodation & catering sourcing', 'Stage, sound, lighting & LED systems (technical)', 'MC, performers & entertainment sourcing', 'On-site staff & registration desk operations on event day'] },
    { id: 'corp_venue_status', type: 'SINGLE_CHOICE', text: 'Please describe the venue preparation status.', options: ['In-house (company office/factory) — stage and system setup only needed', 'External hotel or convention center booked', 'Resort or outdoor space booked', 'Venue needs to be sourced (pro recommendation needed)'] },
    { id: 'corp_billing_req', type: 'MULTI_CHOICE', text: '[Important] Please check the billing and administrative requirements for corporate expense processing. (Multiple choice)', options: ['BIR Official Receipt (OR) issuance required', 'Vendor accreditation process required', 'Corporate payment terms preferred (e.g., 50% upfront, 50% upon completion)', 'Government event — bidding documents and comparative quotes needed', 'Not applicable (simple payment)'] },
    { id: 'corp_setup_timing', type: 'SINGLE_CHOICE', text: 'Have you confirmed the venue\'s ingress/egress (setup/teardown) schedule?', options: ['Ingress allowed the night before the event', 'Ingress on event day morning only (time is tight)', 'Venue not confirmed — to be coordinated with the pro'] },
    { id: 'corp_date', type: 'DATE_PICKER', text: 'Please select the planned event date (or start date).' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Please design team-building games that appeal strongly to Filipino local employees, a large raffle prize draw session program is needed, etc.' }
];

const LECHON_STEPS = [
    { id: 'lechon_type', type: 'SINGLE_CHOICE', text: 'Please select the type and preparation style of lechon you want.', options: ['Original whole roasted pig (Whole Lechon)', 'Spicy Lechon', 'Cebu Style Lechon (lemongrass & herb stuffing)', 'Lechon Belly/Roll (boneless pork belly roll)', 'Other specialty roast (e.g., Baka/veal)'] },
    { id: 'lechon_serving_size', type: 'SINGLE_CHOICE', text: 'Please select the expected number of servings and size.', options: ['15–20 pax (De Leche / extra small)', '30–40 pax (Small)', '50–70 pax (Medium)', '80–100 pax (Large)', '100 pax or more (Jumbo or multiple pigs)'] },
    { id: 'lechon_service_scope', type: 'MULTI_CHOICE', text: 'Please select the service scope you need. (Multiple choice)', options: ['Delivery to venue only (drop-off)', 'On-site carving/chopping station included', 'Rice and basic sauce (sarsa/vinegar) package included', 'Full catering together with other buffet dishes'] },
    { id: 'lechon_venue_rules', type: 'SINGLE_CHOICE', text: '[Important] Please describe the venue\'s rules for outside food delivery.', options: ['Private home or outdoor (no restrictions)', 'Condo/village (prior admin notification for gate access completed)', 'Hotel/restaurant (corkage fee applies — paid by customer)', 'Not yet checked the rules'] },
    { id: 'lechon_accessibility', type: 'SINGLE_CHOICE', text: 'Please describe the floor level and accessibility of the venue.', options: ['Ground floor or building with elevator (easy to carry)', '2nd floor or higher — must be carried up stairs', 'Narrow alley that is difficult for vehicles to enter'] },
    { id: 'lechon_date', type: 'DATE_PICKER', text: 'Please select the desired delivery (or event) date.' },
    { id: 'lechon_delivery_time', type: 'SINGLE_CHOICE', text: 'Please select the preferred delivery arrival (or meal start) time.', options: ['Morning (10am–12pm)', 'Exactly at noon (12pm)', 'Afternoon (2pm–5pm)', 'Dinner time (6pm–8pm)', 'Late night delivery'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Please ensure the skin is very crispy upon arrival, I plan to display it whole without chopping, etc.' }
];

const PARTY_CATERING_STEPS = [
    { id: 'pcatering_event_type', type: 'SINGLE_CHOICE', text: 'Please select the type of event requiring catering.', options: ['Wedding reception', 'Debut (18th birthday party)', 'Corporate event & workshop', 'Children\'s birthday & christening', 'Family or private gathering'] },
    { id: 'pcatering_service_type', type: 'SINGLE_CHOICE', text: 'Please select the catering service style.', options: ['Full-setup catering (food, tables, chairs, tableware & waiters included)', 'Food delivery & setup only (food trays / drop-off buffet)', 'Packed meals / bento delivery', 'Live cooking station'] },
    { id: 'pcatering_menu_theme', type: 'MULTI_CHOICE', text: 'Please select the preferred food menu/theme. (Multiple choice)', options: ['Traditional Filipino food (local fusion included)', 'Western (Continental/Italian, etc.)', 'Asian/Oriental (Chinese, Japanese, etc.)', 'Korean buffet', 'Vegetarian or Halal menu required'] },
    { id: 'pcatering_pax', type: 'SINGLE_CHOICE', text: 'Please select the expected number of guests.', options: ['Less than 30', '30–50', '50–100', '100–200', '200 or more'] },
    { id: 'pcatering_venue_rules', type: 'SINGLE_CHOICE', text: '[Important] Please check the venue booking status and outside catering ingress rules.', options: ['Venue fully allows outside catering (booked)', 'Corkage fee applies for outside catering (paid by customer)', 'Venue provides a prep kitchen area for caterers', 'Have not yet checked the venue\'s rules', 'Venue needs to be sourced as well'] },
    { id: 'pcatering_date', type: 'DATE_PICKER', text: 'Please select the planned event date.' },
    { id: 'pcatering_setup_time', type: 'SINGLE_CHOICE', text: 'Please describe the available setup (ingress) time at the venue.', options: ['3–4 hours before the event start (ample time)', '1–2 hours before the event start only (tight)', 'Setup possible the day before', 'Not yet confirmed'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Separate plated service for the VIP table is needed, want a package that includes Tiffany chairs and floral centerpieces, etc.' }
];

const FOOD_CART_STEPS = [
    { id: 'fc_cart_types', type: 'MULTI_CHOICE', text: 'Please select the type of food cart(s) you want. (Multiple choice)', options: ['Ice cream (Sorbetes/Dirty Ice Cream)', 'Popcorn & cotton candy', 'French fries & hotdog', 'Taho & fishball (local street food)', 'Milk tea & coffee drinks', 'Churros & waffles'] },
    { id: 'fc_cart_count', type: 'SINGLE_CHOICE', text: 'Please select the total number of food carts (types) to rent.', options: ['1 cart (single)', '2–3 cart package', '4 or more (food festival level)', 'Consultation for pro-recommended package'] },
    { id: 'fc_servings', type: 'SINGLE_CHOICE', text: 'Please select the expected servings per cart.', options: ['50 servings (small party)', '100 servings (standard)', '150–200 servings', '200 or more (unlimited service)'] },
    { id: 'fc_electricity', type: 'SINGLE_CHOICE', text: '[Important] Please check the electricity infrastructure at the cart installation location.', options: ['Indoor hall (stable 220V outlet available)', 'Outdoor but extension cord connection is possible', 'Fully outdoor with no electricity (pro must bring own generator or gas equipment)', 'No electricity needed (ice/thermos-based)'] },
    { id: 'fc_service_hours', type: 'SINGLE_CHOICE', text: 'Please select the total desired cart service hours.', options: ['2–3 hours (standard party time)', '4–5 hours', 'Full-day event (8 hours or more)', 'Until the prepared quantity runs out (no time limit)'] },
    { id: 'fc_date', type: 'DATE_PICKER', text: 'Please select the planned event date.' },
    { id: 'fc_ingress', type: 'SINGLE_CHOICE', text: 'Please describe the venue accessibility for cart delivery (ingress).', options: ['Ground floor or large freight elevator available', 'Cart must be carried up stairs only (compact/foldable cart required)', 'Outdoor grass or sandy area — wheeling cart needed'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is a baby\'s 1st birthday — is it possible to attach a custom banner/tarpaulin with the baby\'s photo on the front of the cart? etc.' }
];

const CUSTOM_CAKE_STEPS = [
    { id: 'cake_event_type', type: 'SINGLE_CHOICE', text: 'Please select the type of event the cake is for.', options: ['Birthday / kids party', 'Debut (18th birthday)', 'Wedding', 'Corporate / brand event', 'Anniversary or special celebration', 'Bridal shower & party'] },
    { id: 'cake_tier', type: 'SINGLE_CHOICE', text: 'Please select the number of tiers and cake structure.', options: ['1-tier (single layer cake)', '2-tier cake', '3-tier or more (large cake)', 'Cupcake tower (small top cake + cupcake set)', 'Mini/bento cake — multiple pieces'] },
    { id: 'cake_design_style', type: 'SINGLE_CHOICE', text: 'Please select the main design style and covering method.', options: ['Fondant (3D characters and detailed sculpting)', 'Buttercream / icing (simple or floral design)', 'Edible image / photo cake', 'Naked / rustic style (fresh flowers, etc.)', 'To be decided after consultation'] },
    { id: 'cake_flavor', type: 'MULTI_CHOICE', text: 'Please select the preferred cake flavors. (Multiple choice)', options: ['Moist chocolate', 'Vanilla or butter', 'Red velvet', 'Mocha or coffee', 'Philippine local flavors (Ube, Pandan, etc.)'] },
    { id: 'cake_delivery_type', type: 'SINGLE_CHOICE', text: '[Important] How would you like to receive the cake?', options: ['Direct delivery & setup at the party venue by the baker', 'Customer pick-up at the shop', 'Delivery via Grab/Lalamove car service', 'Multi-tier cake — must be assembled on-site by the baker'] },
    { id: 'cake_date', type: 'DATE_PICKER', text: 'Please select the planned cake pickup/delivery (or event) date.' },
    { id: 'cake_reference_status', type: 'SINGLE_CHOICE', text: 'Do you have reference photos for the design?', options: ['Yes, I have a photo of the exact design I want', 'Yes, I have a general concept and color theme photo', 'Not yet — I need suggestions from the baker'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Only the bottom tier is real cake, the top 2 tiers should be styrofoam (dummy) to reduce cost and weight, my child has a nut allergy, etc.' }
];

const VIDEOKE_STEPS = [
    { id: 'vk_equipment_types', type: 'MULTI_CHOICE', text: 'Please select the type of equipment you want to rent. (Multiple choice)', options: ['Videoke machine (with latest song updates)', 'Basic PA sound system (speakers, mixer, microphone)', 'Band or performance-grade audio equipment', 'Party lighting (party lights/lasers)', 'Projector & screen'] },
    { id: 'vk_headcount', type: 'SINGLE_CHOICE', text: 'Please select the event size and expected number of guests.', options: ['Less than 30 (small videoke / 1 speaker set)', '30–100 (mid-size event system)', '100–200 or more (large function hall / outdoor system)', 'Not sure of the exact size'] },
    { id: 'vk_venue_noise', type: 'SINGLE_CHOICE', text: '[Important] Please describe the venue\'s noise policy and admin permit status.', options: ['Village/barangay (noise curfew after 10pm applies)', 'Condominium (admin approval obtained, volume limits apply)', 'Fully soundproofed indoor hall or hotel (no restrictions)', 'Outdoor / private property (no restrictions)', 'Not yet checked'] },
    { id: 'vk_power_status', type: 'SINGLE_CHOICE', text: 'Please check the power supply status at the equipment installation location.', options: ['Stable 220V outlet available (indoor)', 'Outdoor but can connect via extension cord', 'Fully outdoor with no electricity (pro must bring a generator)', 'Not yet checked'] },
    { id: 'vk_rental_duration', type: 'SINGLE_CHOICE', text: 'Please select the total desired rental duration.', options: ['Half-day (4–6 hours)', 'Full-day event (8 hours or more)', 'Overnight (equipment retrieved the next day)', 'Multi-day rental'] },
    { id: 'vk_accessibility', type: 'SINGLE_CHOICE', text: 'Please describe the venue accessibility for heavy equipment delivery.', options: ['Ground floor or elevator available (trolley/cart possible)', 'Must be carried up stairs manually (additional labor cost may apply)', 'Vehicle can drive directly to the venue entrance'] },
    { id: 'vk_date', type: 'DATE_PICKER', text: 'Please select the desired rental (or event) date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., At least 4 wireless microphones are needed, I want a smart videoke machine with YouTube connectivity, etc.' }
];

const TENT_RENTAL_STEPS = [
    { id: 'tent_items', type: 'MULTI_CHOICE', text: 'Please select the items you need to rent. (Multiple choice)', options: ['Outdoor tent (canopy / monotent / marquee tent)', 'Basic plastic chairs (monobloc)', 'Premium party chairs (Tiffany / ghost / crossback)', 'Round or rectangular tables', 'Table linens & chair covers', 'Outdoor industrial fans & coolers'] },
    { id: 'tent_headcount', type: 'SINGLE_CHOICE', text: 'Please select the expected number of guests (or rental quantity).', options: ['Less than 30 (small set)', '30–50', '50–100', '100 or more (large event)', 'Exact quantity to be decided after consultation'] },
    { id: 'tent_surface', type: 'SINGLE_CHOICE', text: '[Important] Please describe the surface type where the tent and equipment will be set up.', options: ['Concrete/asphalt (pegging not possible — heavy water weights required)', 'Dirt or grass (pegs/stakes can be installed)', 'Indoor hall setup (no tent needed — furniture rental only)', 'Not sure'] },
    { id: 'tent_access', type: 'SINGLE_CHOICE', text: 'Please describe the venue\'s delivery rules and accessibility.', options: ['Village/condo (admin approval and truck gate pass obtained)', 'Private property accessible by large truck', 'Narrow entry — must be delivered in multiple trips with a small vehicle', 'Have not yet checked the rules'] },
    { id: 'tent_weather', type: 'SINGLE_CHOICE', text: 'Please select the weather preparedness level needed.', options: ['Rainy season — fully waterproof tent with sidewalls required', 'Dry season / shade tent is sufficient', 'Indoor use', 'Pro to recommend based on current weather conditions'] },
    { id: 'tent_date', type: 'DATE_PICKER', text: 'Please select the desired rental (or event) date.' },
    { id: 'tent_setup_time', type: 'SINGLE_CHOICE', text: 'Please describe the available setup (ingress) and teardown (egress) schedule.', options: ['Setup the day before and teardown the day after (ample time)', 'Setup a few hours before event and teardown immediately after (tight)', 'Not yet coordinated with the venue'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Table linens and chair ribbon colors should match the party theme \'navy blue\', string lights inside the tent are also needed, etc.' }
];

const PHOTOBOOTH_STEPS = [
    { id: 'pb_service_types', type: 'MULTI_CHOICE', text: 'Please select the service(s) you want to rent. (Multiple choice)', options: ['Standard photo print booth (photobooth)', '360 video booth', 'Magic mirror booth', 'Neon sign & custom backdrop rental', 'Fun props add-on'] },
    { id: 'pb_duration', type: 'SINGLE_CHOICE', text: 'Please select the desired photobooth operation (rental) hours.', options: ['2 hours (basic package)', '3 hours', '4 hours', 'Unlimited operation for the entire event', 'Not a photobooth (props/backdrop rental only)'] },
    { id: 'pb_output_type', type: 'SINGLE_CHOICE', text: '(For photobooth) Please select the preferred print and output format.', options: ['Unlimited standard photo prints (4R)', 'Magnetic fridge prints (popular in the Philippines)', 'Digital only — email/QR code download (no prints)', '360 video file only', 'Not a photobooth'] },
    { id: 'pb_space_power', type: 'SINGLE_CHOICE', text: '[Important] Please check the installation space and electricity infrastructure for the photobooth.', options: ['At least 2x2m flat space and dedicated 220V outlet available', 'Space is sufficient but a long extension cord will be needed', 'Outdoor dirt/grass (plywood flooring needed for leveling)', 'Space size not yet confirmed'] },
    { id: 'pb_template_design', type: 'SINGLE_CHOICE', text: 'Please select the photo template or backdrop design approach.', options: ['Fully custom design with the honoree\'s name or company logo', 'Choose from the vendor\'s standard template library', 'Customer will provide the design file (AI/PSD)'] },
    { id: 'pb_venue_access', type: 'SINGLE_CHOICE', text: 'Please describe the venue type and admin delivery rules.', options: ['Hotel/professional venue (no vendor entry fee)', 'Condo/village (admin permit and gate pass obtained)', 'Not yet checked the rules', 'Private home (no restrictions)'] },
    { id: 'pb_date', type: 'DATE_PICKER', text: 'Please select the desired rental (or event) date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., For wedding guests — is split-time operation possible (1 hour before ceremony, 1 hour after)?, 3 sponsor logos must be added to the photo template, etc.' }
];

const SNAP_PHOTO_STEPS = [
    { id: 'sp_event_types', type: 'MULTI_CHOICE', text: 'Please select the event or purpose requiring photography/videography. (Multiple choice)', options: ['Wedding (ceremony & reception)', 'Pre-nuptial (prenup) & couple shoot', 'Debut (18th birthday), birthday & christening', 'Corporate event & seminar', 'Product or commercial space shoot', 'Family photo & personal profile'] },
    { id: 'sp_service_scope', type: 'MULTI_CHOICE', text: 'Please select the service scope you need. (Multiple choice)', options: ['Photography only', 'Videography only', 'Photo & video package (P&V)', 'Drone aerial photography add-on', 'Same Day Edit (SDE) video screening'] },
    { id: 'sp_duration', type: 'SINGLE_CHOICE', text: 'Please select the expected shooting duration.', options: ['2–4 hours (half-day / simple event)', '5–8 hours (full day / wedding, etc.)', '8 hours or more (overtime pay agreed upon)', 'Until the event ends (no time limit)'] },
    { id: 'sp_venue_type', type: 'SINGLE_CHOICE', text: '[Important] Please describe the venue type and out-of-town (OOTF) requirements.', options: ['Single location within Metro Manila', 'Multiple locations (e.g., hotel prep → church → reception)', 'Outside Metro Manila / provincial trip (out-of-town fee, accommodation & transport needed)', 'Indoor studio rental needed'] },
    { id: 'sp_vendor_rules', type: 'SINGLE_CHOICE', text: 'Have you checked the venue\'s rules for outside photographers?', options: ['Outside photography team fully allowed (no permit needed or already paid)', 'Corkage & entry fee applies (paid by customer)', 'Church/parish rules restrict altar access or require designated photographer', 'Not yet checked the rules'] },
    { id: 'sp_delivery_type', type: 'SINGLE_CHOICE', text: 'Please select how you want to receive the raw and edited files.', options: ['All files via Google Drive/USB only (soft copy)', 'Photo prints, premium album & framing included (hard copy package)', 'To be decided after portfolio consultation'] },
    { id: 'sp_date', type: 'DATE_PICKER', text: 'Please select the desired shooting date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., We will separately provide crew meals at the event buffet, the SDE video to be played during the reception is the top priority, etc.' }
];

const EVENT_MC_STEPS = [
    { id: 'mc_event_type', type: 'SINGLE_CHOICE', text: 'Please select the type of event requiring an MC.', options: ['Wedding reception', 'Debut (18th birthday party)', 'Children\'s birthday party (kiddie party)', 'Corporate year-end party & team building', 'Conference, gala & formal event'] },
    { id: 'mc_language_style', type: 'SINGLE_CHOICE', text: 'Please select the preferred hosting language and MC style.', options: ['100% English (formal, elegant)', 'English + Tagalog mix (Taglish — lively party for local guests)', 'Korean + English mix (mixed PH/Korean guest list)', 'Humorous stand-up comedy style', 'Not yet decided'] },
    { id: 'mc_service_scope', type: 'MULTI_CHOICE', text: 'Please select the scope of MC services needed. (Multiple choice)', options: ['Solo MC (1 host)', '2 or more hosts with co-host', 'Party games & recreation planning/facilitation', 'Program flow planning assistance', 'Special talent included (magic, singing, etc.)'] },
    { id: 'mc_pa_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the venue\'s microphone and PA sound system status.', options: ['Professional sound team & wireless mic fully set up', 'Basic speaker only — MC must verify audio jack/Bluetooth connection', 'No sound equipment at all (MC to provide speaker rental as well — turn-key)', 'Not yet checked'] },
    { id: 'mc_headcount_duration', type: 'SINGLE_CHOICE', text: 'Please select the expected number of guests and event duration.', options: ['Less than 50 guests / 2–3 hours', '50–150 guests / 4–5 hours', '150 or more guests / full-day 8-hour event'] },
    { id: 'mc_venue_type', type: 'SINGLE_CHOICE', text: 'Please describe the venue type and travel requirements.', options: ['Hotel or professional venue within Metro Manila', 'Outdoor or casual restaurant within Metro Manila', 'Out-of-town (provincial trip) — separate transportation fee required', 'Online event (Zoom)'] },
    { id: 'mc_date', type: 'DATE_PICKER', text: 'Please select the desired event date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., This is a K-pop debut party — need someone who can confidently lead a random play dance game, the script will be prepared and provided by the host in advance, etc.' }
];

const LIVE_BAND_STEPS = [
    { id: 'lb_entertainer_types', type: 'MULTI_CHOICE', text: 'Please select the type of entertainer(s) you want to book. (Multiple choice)', options: ['Acoustic duo/trio (vocal + guitar/keyboard)', 'Full band (with drums and bass)', 'Party or club DJ', 'Solo singer (wedding serenade, etc.)', 'String trio/quartet (classical)'] },
    { id: 'lb_music_genre', type: 'SINGLE_CHOICE', text: 'Please select the event character and preferred music genre.', options: ['Wedding/romantic (ballads, acoustic pop)', 'Debut & party (pop, dance, EDM)', 'Corporate event/gala dinner (jazz, bossa nova, lounge)', 'Local/OPM (Original Pilipino Music)', 'Religious event (CCM)'] },
    { id: 'lb_venue_pa', type: 'SINGLE_CHOICE', text: '[Important] Please check the venue\'s instrument/PA sound system setup and noise rules.', options: ['Fully equipped for full band (instruments and PA ready)', 'No sound equipment — band/DJ to bring instruments and speakers (include in quote)', 'Inside a village — loud music not allowed after 10pm (curfew)', 'Not yet checked rules and equipment'] },
    { id: 'lb_performance_duration', type: 'SINGLE_CHOICE', text: 'Please select the expected performance duration (sets).', options: ['1–2 songs only (special moment/event)', '1–2 sets (about 1–1.5 hours)', '3 sets (covers entire reception/dining — about 3 hours)', 'Full-day event or DJ all-night party'] },
    { id: 'lb_song_request', type: 'SINGLE_CHOICE', text: 'Please select the preferred song request approach.', options: ['100% playlist provided by client in advance', 'Leave repertoire choices to the band/DJ', 'Allow flexible live requests from guests'] },
    { id: 'lb_green_room', type: 'SINGLE_CHOICE', text: 'Please describe the green room and meal arrangement for the performers.', options: ['Separate green room and buffet crew meal can be provided', 'No meal provided (please include a meal allowance in the quote)', 'To be coordinated'] },
    { id: 'lb_date', type: 'DATE_PICKER', text: 'Please select the desired performance (event) date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., Please arrange and sing a specific pop song in acoustic version for the bride\'s entrance, DJ equipment (Pioneer CDJ) rental should also be included in the package, etc.' }
];

const HMUA_STEPS = [
    { id: 'hmua_event_type', type: 'SINGLE_CHOICE', text: 'Please select the main event or purpose for the makeup.', options: ['Wedding (bride, main ceremony)', 'Pre-nuptial (prenup) photo/video shoot', 'Debut (18th birthday party debutante)', 'Graduation & prom', 'General party/guest attendance', 'Profile or commercial/advertising shoot'] },
    { id: 'hmua_pax', type: 'MULTI_CHOICE', text: 'Please select all the people who will need makeup. (Multiple choice)', options: ['Main subject only (bride/debutante, etc.)', 'Parents & immediate family', 'Bridesmaids / party entourage', 'Male grooming (groom, etc.)'] },
    { id: 'hmua_style', type: 'SINGLE_CHOICE', text: 'Please select the preferred makeup style.', options: ['Natural/dewy K-Beauty style', 'Bold contour and false lashes (glam style)', 'HD/matte style for photo & video shoots', 'To be decided after portfolio consultation'] },
    { id: 'hmua_location', type: 'SINGLE_CHOICE', text: '[Important] Please select the makeup location and travel requirements.', options: ['Home service / on-location (at a designated hotel or home)', 'Will visit the artist\'s makeup shop/studio', 'Out-of-town trip required (transportation & accommodation support needed)'] },
    { id: 'hmua_retouch', type: 'SINGLE_CHOICE', text: 'Is retouching/touch-up service needed during the shoot or event?', options: ['Artist to accompany throughout the event and provide second-look changes during dress changes', 'Initial hair & makeup setup only — no retouching needed', 'To be decided after consultation'] },
    { id: 'hmua_date', type: 'DATE_PICKER', text: 'Please select the desired makeup (event) date.' },
    { id: 'hmua_call_time', type: 'SINGLE_CHOICE', text: 'Please select the required call time for the makeup artist.', options: ['Pre-dawn (before 6am — early call charge agreed upon)', 'Morning (6am–12pm)', 'Afternoon', 'Evening (for a night party)'] },
    { id: 'hmua_special_tools', type: 'MULTI_CHOICE', text: 'Are any special techniques or tools needed? (Multiple choice)', options: ['Airbrush makeup (sweat & water resistant)', 'Hair extensions (for added volume)', 'Body makeup (shoulder/back coverage)', 'Not applicable (standard brush makeup)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., There are 5 bridesmaids so an assistant must accompany the artist, I have sensitive skin so I would prefer the makeup to be done using my own products, etc.' }
];

const ENG_CONVERSATION_STEPS = [
    { id: 'ec_purpose', type: 'MULTI_CHOICE', text: 'Please select the main purpose for learning English. (Multiple choice)', options: ['Daily survival English in the Philippines (supermarket, restaurants, condo admin, etc.)', 'Making local friends and socializing', 'Preparing for parent-teacher meetings at an international school', 'Travel and hobbies', 'Getting out of beginner level and building a grammar foundation'] },
    { id: 'ec_level', type: 'SINGLE_CHOICE', text: 'What is the current English level of the student?', options: ['Complete beginner (only knows the alphabet and very basic words)', 'Elementary (can communicate with simple sentences, haltingly)', 'Intermediate (can have daily conversations but lacks grammar and vocabulary)', 'Advanced (fluent enough but needs a practice partner to improve further)'] },
    { id: 'ec_tutor_style', type: 'SINGLE_CHOICE', text: 'Please select the preferred tutor accent and teaching style.', options: ['Neutral/American accent (e.g., BPO/call center experienced)', 'Friendly, slow-paced tutor (local-friendly style over pronunciation)', 'Grammar and textbook-focused structured teaching', 'Free-talking focused (conversational practice)'] },
    { id: 'ec_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select the preferred lesson format and location.', options: ['100% online (Zoom, Skype) — no traffic worries', 'Tutor visits student\'s home (condo/village)', 'In-person at a nearby quiet café or study room', 'Student visits tutor\'s designated location (language center/home)'] },
    { id: 'ec_access_rules', type: 'SINGLE_CHOICE', text: '[Important] (For home visits) Please describe the condo/village access requirements.', options: ['Tutor can enter by leaving an ID at the lobby/gate', 'Advance tutor registration with Admin (Work/Visitor permit) required', 'Not applicable — online lesson'] },
    { id: 'ec_schedule', type: 'SINGLE_CHOICE', text: 'Please select the preferred lesson frequency and time.', options: ['2–3x/week weekday daytime (morning/afternoon)', '2–3x/week weekday evenings (after work)', 'Weekends (Sat/Sun) intensive', 'Daily (5x/week or more)', 'Flexible — to be coordinated with the tutor'] },
    { id: 'ec_start_date', type: 'DATE_PICKER', text: 'Please select the desired lesson start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes to pass on to the pro? (Optional)', skippable: true, placeholder: 'e.g., I speak no English so I need a Filipino tutor who knows at least a little Korean, my 2 elementary-school children will join as a group lesson, etc.' }
];

const LOCAL_LANG_STEPS = [
    { id: 'll_language', type: 'SINGLE_CHOICE', text: 'Please select the exact local language you want to learn.', options: ['Standard Tagalog (Manila and Luzon region)', 'Bisaya/Cebuano (Cebu, Davao and Mindanao regions)', 'Ilonggo (Ilonggo/Hiligaynon)', 'Ilocano', 'Other dialect (please specify in notes)'] },
    { id: 'll_purpose', type: 'MULTI_CHOICE', text: 'What is your main purpose for learning this local language? (Multiple choice)', options: ['Giving work instructions to local Filipino staff (drivers, laborers, etc.)', 'Clear communication with household helpers (Ate/Yaya)', 'Intimate conversations with local partners, friends and family', 'Full local integration — government offices, wet markets, etc.', 'Simple language curiosity'] },
    { id: 'll_level', type: 'SINGLE_CHOICE', text: "How would you rate the learner's current proficiency in this local language?", options: ['Complete beginner — only knows basic greetings like "Salamat" or "Po"', 'Can use common daily words and short sentences', 'Can understand fairly well but struggles with speaking'] },
    { id: 'll_instruction_lang', type: 'SINGLE_CHOICE', text: '[Important] Please select the instruction language for the lessons.', options: ['Tutor explains Tagalog/Bisaya grammar and meaning in English', 'Tutor must be able to explain in Korean (rare — may cost more)', 'No English — learn by full immersion in the target local language'] },
    { id: 'll_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson format and location.', options: ['100% online video lessons', "Tutor visits learner's home (condo) or office", 'Meeting at a quiet café outside', "Visiting the tutor's designated location"] },
    { id: 'll_access_rules', type: 'SINGLE_CHOICE', text: '(For in-person visits) Please check the condo/office access rules.', options: ['Can enter gate/lobby with a simple ID', 'Tutor must be pre-registered with Admin', 'Online session — no access rules needed'] },
    { id: 'll_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['2–3 times a week, weekday mornings/afternoons', '2–3 times a week, weekday evenings', 'Weekends only', 'Flexible schedule to be arranged with the pro'] },
    { id: 'll_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: "e.g. I'm being assigned to Cebu so I need Cebuano basics rather than Manila Tagalog; I want to focus on construction site vocabulary, etc." }
];

const BUSINESS_ENG_STEPS = [
    { id: 'be_situation', type: 'MULTI_CHOICE', text: 'Please select the specific situations where you most urgently need Business English. (Multiple choice)', options: ['Writing formal business emails and communicating via Slack or work messengers', 'Preparing English presentations and project pitches', 'Leading video conferences with overseas buyers and clients (Zoom/Teams)', 'Preparing for English job interviews at multinational companies', 'Cold calling and sales pitch training'] },
    { id: 'be_industry', type: 'SINGLE_CHOICE', text: 'Is there a specific industry you would like the tutor to be familiar with?', options: ['IT, software and engineering', 'Trade, import/export and logistics', 'Finance, accounting and banking', 'Medical, pharmaceutical and nursing', 'No specific field (general business English)'] },
    { id: 'be_level', type: 'SINGLE_CHOICE', text: "What is the learner's current Business English proficiency level?", options: ['Can do casual conversation but has no knowledge of professional business vocabulary or formats', 'Intermediate — can write emails but needs to expand to more refined and advanced vocabulary', 'Can communicate with native speakers at work but wants to polish pronunciation and subtle politeness nuances'] },
    { id: 'be_tutor_req', type: 'SINGLE_CHOICE', text: 'What is the most important qualification you expect from the tutor?', options: ['Must have manager-level or above experience at an MNC or large BPO', 'Perfect neutral accent at a native US/UK level', 'Holds a professional business English teaching certificate (TESOL, TEFL, etc.)', 'No preference — will decide based on a skills test'] },
    { id: 'be_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson format and location.', options: ['100% online remote lessons to save time', "Tutor visits client's office (office/meeting room)", "Tutor visits client's home (condo)", 'Meeting at a quiet café or business lounge'] },
    { id: 'be_access_rules', type: 'SINGLE_CHOICE', text: '[Important] (For office/company visits) Please share the access and security requirements.', options: ['Can access meeting room with visitor registration at the lobby only', 'Must pre-register external persons with building Admin and company HR', 'Online session — not applicable'] },
    { id: 'be_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Early morning before work', 'Lunch break (about 1 hour)', 'Evening after work', 'Weekend intensive', 'Flexible schedule with tutor'] },
    { id: 'be_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I need intensive help with scripting and mock presentation feedback for a business performance presentation in front of US HQ executives next month, etc.' }
];

const BPO_PREP_STEPS = [
    { id: 'bpo_account_types', type: 'MULTI_CHOICE', text: 'Please select the main BPO/call center account types and job roles you are targeting. (Multiple choice)', options: ['Inbound Customer Service', 'Outbound Sales and Telemarketing', 'Technical Support (Tech Support/IT)', 'Healthcare and Medical Billing/Coding', 'Financial and Banking', 'Non-Voice (Chat/Email Support)'] },
    { id: 'bpo_english_level', type: 'SINGLE_CHOICE', text: 'How would you rate your current English proficiency and accent level?', options: ['Can only do basic communication', 'Can do casual conversation but needs accent and grammar correction (intermediate)', 'Advanced (near-native) aiming to pass premium BPO accounts (US/UK)', 'Not sure yet (requesting a level test)'] },
    { id: 'bpo_weak_areas', type: 'MULTI_CHOICE', text: 'Please select the areas you need to focus on most during BPO prep. (Multiple choice)', options: ['Initial Phone Screening', 'Vocabulary/Pronunciation Test (Versant, Berlitz, SVAR, etc.)', 'Typing Speed and Computer Navigation Test', 'Final Interview (Behavioral/Situational Questions)', 'Mock Call Simulation'] },
    { id: 'bpo_work_shift', type: 'SINGLE_CHOICE', text: 'Please select your preferred work schedule when employed.', options: ['Applying for US account / Graveyard shift', 'Day shift only (AU/UK/Local)', 'Work From Home (WFH) position preferred', 'Office-based (On-site) preferred'] },
    { id: 'bpo_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson format.', options: ['100% online video lessons (Zoom, Skype, etc.)', "Tutor visits learner's home/condo", "Learner visits tutor's designated location (language center, etc.)", 'Quiet café meeting'] },
    { id: 'bpo_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'bpo_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday daytime (morning/afternoon)', 'Weekday evenings', 'Weekends (Sat/Sun) only', 'Flexible schedule with tutor'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: "e.g. I don't have call center experience but I graduated with an English Literature degree; I've failed BPO interviews 3 times and desperately need final interview tips (STAR method), etc." }
];

const VA_TRAINING_STEPS = [
    { id: 'va_train_fields', type: 'MULTI_CHOICE', text: 'Please select the VA specialization areas you want to focus on. (Multiple choice)', options: ['General Admin / Data Entry', 'Social Media Management (SMM / Facebook, Instagram, TikTok)', 'E-commerce Management (Shopify, Amazon, Lazada, etc.)', 'Real Estate VA (Cold Calling)', 'Bookkeeping (Xero, QuickBooks)', 'Basic Graphic Design and Video Editing'] },
    { id: 'va_train_background', type: 'SINGLE_CHOICE', text: 'Please select your current professional background and experience level.', options: ['Complete beginner with no BPO or freelance experience', 'Has BPO (call center) experience but new to VA/freelance work', 'Has existing VA experience and wants to upskill in a specific niche', 'Office worker background'] },
    { id: 'va_train_tools', type: 'MULTI_CHOICE', text: 'Please check the software/tools you want to cover during training. (Multiple choice)', options: ['Google Workspace (Docs, Sheets, etc.) and MS Office', 'Canva and basic design tools', 'Project management tools (Trello, Asana, Notion, etc.)', 'CRM tools (HubSpot, Salesforce, etc.)', 'Video conferencing and communication tools (Slack, Zoom)', 'Freelance platform setup (Upwork, OnlineJobs.ph profile setup)'] },
    { id: 'va_train_infra', type: 'SINGLE_CHOICE', text: '[Important] Please describe your WFH (work-from-home) infrastructure for VA work and online lessons.', options: ['Have a personal laptop/PC and stable fiber internet', 'Have a laptop/PC but internet is unstable (using mobile data, etc.)', 'No personal PC/laptop yet — still planning to buy'] },
    { id: 'va_train_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson format.', options: ['100% online remote lessons with screen sharing required', "In-person lessons with learner's own laptop", 'Hybrid (mix of online and in-person)'] },
    { id: 'va_train_start_date', type: 'DATE_PICKER', text: 'Please select your preferred training start date.' },
    { id: 'va_train_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday daytime', 'Weekday evenings', 'Weekends only', 'Flexible schedule with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. My English is not perfect so I want to focus on communicating with clients using email templates; please also teach me how to set up PayPal/Wise for receiving payments, etc.' }
];

const CODING_LESSON_STEPS = [
    { id: 'cl_fields', type: 'MULTI_CHOICE', text: 'Please select the programming areas/goals you want to learn. (Multiple choice)', options: ['Web frontend (HTML, CSS, JavaScript, React, Vue, etc.)', 'Web backend (Node.js, Python, PHP, Java, etc.)', 'Mobile app development (Flutter, React Native, Swift, etc.)', 'Data science and AI (Python, SQL, etc.)', 'Game development (Unity, C#, etc.)', 'Algorithms and coding interview preparation'] },
    { id: 'cl_level', type: 'SINGLE_CHOICE', text: "What is the learner's current coding knowledge level?", options: ['Complete beginner — never coded before (non-CS background)', 'Beginner — knows basic syntax (variables, conditionals, etc.)', 'Intermediate — has built simple toy projects (needs architecture/practical tips)', 'Advanced — needs deep-dive into a specific framework or code review/mentoring'] },
    { id: 'cl_goal', type: 'SINGLE_CHOICE', text: 'What is the main reason for learning to code?', options: ['IT job placement and career switch (Developer role)', 'Freelance work (taking on outsourced projects)', 'Supplemental study and exam prep for school/college major', 'Personal hobby and side project development'] },
    { id: 'cl_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select the lesson format and practice environment.', options: ["100% online lessons (screen sharing and Live Share)", "In-person lessons with learner's own laptop", "Learner has no PC — must use tutor's equipment/computer lab (tutor visit)"] },
    { id: 'cl_instruction_lang', type: 'SINGLE_CHOICE', text: 'Please select your preferred instruction language for lessons.', options: ['English (to adapt to global IT environment)', 'Tagalog/Bisaya (to understand fundamentals clearly in a local language)', 'Korean (if tutor is Korean)', 'No preference'] },
    { id: 'cl_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'cl_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday daytime', 'Weekday evenings', 'Weekends only (intensive)', 'Flexible schedule'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I want to build a real SaaS product using Next.js and Supabase; I will be practicing on a MacBook, etc.' }
];

const IELTS_STEPS = [
    { id: 'ielts_exam_type', type: 'SINGLE_CHOICE', text: 'Please select the official English exam you are preparing for.', options: ['IELTS Academic (for university admission and professional employment)', 'IELTS General Training (for immigration and general employment)', 'OET (for medical/nursing professionals)', 'TOEFL iBT', 'Not yet decided (need consultation)'] },
    { id: 'ielts_target_score', type: 'SINGLE_CHOICE', text: 'Please select your target score/band.', options: ['IELTS 5.5–6.0 (basic requirement)', 'IELTS 6.5–7.0 (major universities and general employment)', 'IELTS 7.5 and above (high score)', 'OET Band B or above (UK/AU nurses, etc.)', 'TOEFL 80–100+ points', 'Target score not yet decided'] },
    { id: 'ielts_current_level', type: 'SINGLE_CHOICE', text: 'Please describe your current English level or exam experience.', options: ['First time preparing — needs to build up from basic English (beginner)', 'Can do basic English conversation but needs to understand exam format (intermediate)', 'Has taken the exam before but failed to reach target score (retaker)', 'High scorer who only needs to focus on specific parts'] },
    { id: 'ielts_weak_parts', type: 'MULTI_CHOICE', text: 'Please select the parts you most need to focus on in tutoring. (Multiple choice)', options: ['Speaking (needs mock exam practice with a native/professional tutor)', 'Writing (needs essay structure and grammar correction)', 'Reading (time management and comprehension skills)', 'Listening', 'All sections equally (Full package)'] },
    { id: 'ielts_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred tutoring format.', options: ['100% online video lessons (including online mock exams)', "Tutor visits learner's home/condo", 'In-person meeting at a quiet café or study room', "Visiting tutor's designated location (language center, etc.)"] },
    { id: 'ielts_exam_timeline', type: 'SINGLE_CHOICE', text: 'Please share your planned official exam date.', options: ['Within 1–2 months (very urgent, intensive cramming needed)', 'Within 3–6 months', '6 months or later (flexible)', 'Not yet registered for the exam'] },
    { id: 'ielts_start_date', type: 'DATE_PICKER', text: 'Please select your preferred tutoring start date.' },
    { id: 'ielts_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday intensive', 'Weekday evenings after work', 'Weekends only', 'Flexible schedule with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I need OET Band B for a UK nursing job — it is mandatory; I want lessons focused on Writing Task 2 essay correction, etc.' }
];

const PRC_EXAM_STEPS = [
    { id: 'prc_exam_field', type: 'SINGLE_CHOICE', text: 'Please select the PRC (Professional Regulation Commission) board exam field you are preparing for.', options: ['Nursing (PNLE - Philippine Nurses Licensure Exam)', 'CPA (CPALE - CPA Licensure Exam)', 'Teaching (LET - Licensure Examination for Teachers)', 'Engineering (CE, ME, EE, etc.)', 'Architecture (ALE)', 'Criminology (CLE)', 'Other PRC board exam (please specify in notes)'] },
    { id: 'prc_taker_status', type: 'SINGLE_CHOICE', text: 'Please indicate your current exam status.', options: ['First-time taker — taking the exam right after graduation', 'Retaker — preparing again after a previous failure (Refresher)', 'Foreign applicant — preparing for license conversion, etc.'] },
    { id: 'prc_review_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred exam review format.', options: ['1-on-1 private tutoring for weak subjects', 'Small group tutoring with 2–4 friends (cost-sharing)', 'Consultation and referral to a comprehensive review center program'] },
    { id: 'prc_focus_areas', type: 'MULTI_CHOICE', text: 'Are there specific subjects or areas you want intensive tutoring on? (Multiple choice)', options: ['Complete review of basic concepts and theory', 'Past board exam questions analysis and solving', 'Intensive calculation/math-based problem practice', 'Mock exam and time management training', 'Comprehensive review of all subjects'] },
    { id: 'prc_lesson_type', type: 'SINGLE_CHOICE', text: 'Please select your preferred tutoring format and location.', options: ['100% online remote lessons', "In-person lessons at learner's home", 'In-person at a quiet study café or similar location'] },
    { id: 'prc_exam_timeline', type: 'SINGLE_CHOICE', text: 'Please indicate your target PRC board exam date.', options: ['Next upcoming exam (within 1–3 months)', 'Next session (about 6 months out)', "Long-term preparation for next year's exam"] },
    { id: 'prc_start_date', type: 'DATE_PICKER', text: 'Please select your preferred tutoring start date.' },
    { id: 'prc_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday daytime (full-time review)', 'Weekday evenings (while working)', 'Weekend intensive', 'Flexible schedule with tutor'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. My weakest area in the Nursing board exam is Psychiatric Nursing; I graduated 5 years ago and am coming back to studying so I need a tutor who can review from the basics, etc.' }
];

const SWIMMING_STEPS = [
    { id: 'sw_age_group', type: 'SINGLE_CHOICE', text: 'Please select the age group of the learner.', options: ['Infants and Children (Kids / Toddlers)', 'Teenagers (Teens)', 'Adults', 'Seniors'] },
    { id: 'sw_level', type: 'SINGLE_CHOICE', text: "Please select the learner's approximate swimming ability.", options: ["Complete beginner — afraid of water and doesn't know how to float", 'Beginner/intermediate — can float and move forward but needs form correction', 'Wants to master all 4 strokes (freestyle, breaststroke, backstroke, butterfly)', 'Preparing for triathlon or lifeguard certification (advanced)'] },
    { id: 'sw_group_type', type: 'SINGLE_CHOICE', text: 'Please select the lesson group format.', options: ['1-on-1 private lesson', '2–3 person small group (family, friends, etc.)', 'Joining an existing group lesson'] },
    { id: 'sw_pool_location', type: 'SINGLE_CHOICE', text: '[Important] Please select where the lesson will take place.', options: ['Condo/village swimming pool (instructor can access)', 'External public/private swimming pool', "Instructor's own/designated pool", 'No pool yet — need to find one first'] },
    { id: 'sw_access_rules', type: 'SINGLE_CHOICE', text: '(For condo/village lessons) Have you confirmed the rules for external instructors and guests?', options: ['No guest fee — free entry and coaching allowed', 'Must pre-register coach/guest with Admin and fees apply (paid by client)', 'Commercial coaching strictly prohibited (need to find external venue)', 'Have not yet checked the rules'] },
    { id: 'sw_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'sw_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['Weekday daytime (morning/afternoon)', 'Weekday evenings', 'Weekends only (Sat, Sun)', 'Flexible schedule with instructor'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I have a herniated disc so I prefer strokes that are gentle on my back; I prefer a female instructor, etc.' }
];

const DANCE_STEPS = [
    { id: 'dance_genres', type: 'MULTI_CHOICE', text: 'Please select the dance genres you want to learn. (Multiple choice)', options: ['Zumba and Aerobics', 'K-Pop dance (cover dance)', 'Hip-hop and Street Dance', 'Latin and Ballroom Dance (Social Dance)', 'Ballet', 'Wedding Dance (First Dance) and Cotillion choreography'] },
    { id: 'dance_purpose', type: 'SINGLE_CHOICE', text: 'Please select the main purpose of the lessons.', options: ['Diet, fitness and hobby', 'Preparing a performance for a school/company event', 'Debut party Cotillion and wedding dance choreography', 'Preparing for professional dance auditions'] },
    { id: 'dance_group_type', type: 'SINGLE_CHOICE', text: 'Please select the lesson group format.', options: ['1-on-1 private choreography lesson', '2–5 person small group', 'Large group/corporate or school outreach (6+ people)', 'Joining an existing dance class solo'] },
    { id: 'dance_venue', type: 'SINGLE_CHOICE', text: 'Please select the lesson venue.', options: ['Gym or Function Room within your condo/village', "Dance studio owned/affiliated by the instructor", 'Externally rented dance studio (client covers rental fee)', '100% online video lessons'] },
    { id: 'dance_noise_rules', type: 'SINGLE_CHOICE', text: '[Important] (For condo lessons) Have you confirmed the noise and speaker policy?', options: ['Large Bluetooth speaker and music playback allowed', 'Noise restrictions apply — only headphones or very low volume allowed', 'Commercial external instructor entry and lessons prohibited', 'Have not yet checked Admin rules'] },
    { id: 'dance_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'dance_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['2–3 times a week, weekday daytime', '2–3 times a week, weekday evenings', 'Weekend intensive', 'Daily short intensive sessions ahead of an event'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I need someone to choreograph the 18 Roses entrance dance for a debut party next month; I have two left feet so please start with basic rhythm training, etc.' }
];

const COOKING_LESSON_STEPS = [
    { id: 'ck_fields', type: 'MULTI_CHOICE', text: 'Please select the cooking and baking areas you want to learn. (Multiple choice)', options: ['Filipino local cuisine (Adobo, Sinigang, etc.)', 'Korean cuisine', 'Western dishes (pasta, steak, etc.)', 'Baking (bread, pastries, cookies)', 'Cake decoration (fondant, etc.)', 'Healthy, vegan, keto diet meals'] },
    { id: 'ck_purpose', type: 'SINGLE_CHOICE', text: 'Please select the target learner and the purpose of the lessons.', options: ['Personal hobby and improving home cooking skills', 'Teaching household helpers (Ate/Yaya) hygiene and home/Korean cooking', 'Café/restaurant business and menu development', "Kids' experience-based cooking class"] },
    { id: 'ck_venue', type: 'SINGLE_CHOICE', text: 'Please select the lesson venue.', options: ["Instructor visits learner's home (condo/village) kitchen", "Learner visits instructor's own/affiliated cooking studio", '100% online remote lessons'] },
    { id: 'ck_kitchen_infra', type: 'SINGLE_CHOICE', text: '[Important] (For home visits) Please describe the kitchen infrastructure and equipment available.', options: ['Fully equipped — oven, gas/induction stove, and all cooking tools', 'No oven but has basic stovetop and tools', 'No special equipment like mixers or ovens at all (instructor must bring equipment or home visit not possible)', "Planning to visit instructor's studio"] },
    { id: 'ck_ingredients', type: 'SINGLE_CHOICE', text: 'Please select your preference for ingredient preparation.', options: ['Instructor shops for and prepares all ingredients (turnkey — ingredient cost included)', 'Instructor provides a recipe list and client shops at the market', 'Decide after consultation'] },
    { id: 'ck_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'ck_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson format and frequency.', options: ['One-day workshop (single session)', 'Regular lessons 1–2 times a week (hobby/intensive track)', 'Weekday daytime intensive', 'Weekends only'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. I want to intensively teach my new household helper (Ate) 5 basic Korean dishes like kimchi jjigae and bulgogi over two days; I have a seafood allergy, etc.' }
];

const MUSIC_LESSON_STEPS = [
    { id: 'ml_instruments', type: 'MULTI_CHOICE', text: 'Please select the instruments or areas you want to learn. (Multiple choice)', options: ['Piano and keyboard', 'Acoustic guitar and electric guitar', 'Vocals and singing technique', 'Violin, cello and other string instruments', 'Ukulele', 'Bass or drums'] },
    { id: 'ml_age_level', type: 'SINGLE_CHOICE', text: "Please select the learner's age group and current skill level.", options: ['Young children (cannot read sheet music — beginners)', 'Adult complete beginner', 'Adult intermediate (can play/sing to some degree but needs correction)', 'Advanced (concert, competition, or college entrance preparation)'] },
    { id: 'ml_goal', type: 'SINGLE_CHOICE', text: 'Please select the main goal of the lessons.', options: ['Master one song (short-term goal for a wedding, proposal, talent show, etc.)', 'Ongoing hobby and stress relief', 'Preparing for ABRSM or similar grade exams/certificates', 'Church accompaniment and worship team training', 'Music theory and harmony fundamentals'] },
    { id: 'ml_venue', type: 'SINGLE_CHOICE', text: 'Please select the lesson venue.', options: ["Instructor visits learner's home (condo/village)", "Learner visits instructor's personal studio or rehearsal room", '100% online remote lessons (Zoom, etc.)', 'External practice room rental (client covers rental fee)'] },
    { id: 'ml_instrument_status', type: 'SINGLE_CHOICE', text: '[Important] (For home/online lessons) Please describe the instrument availability.', options: ['Has an acoustic piano (Upright/Grand)', 'Has a digital keyboard (digital piano)', 'Has their own guitar/string instrument', 'No instrument at all (needs rental or consultation before purchase)', 'Vocal lessons — no instrument needed'] },
    { id: 'ml_noise_rules', type: 'SINGLE_CHOICE', text: '(For home visit lessons) Have you confirmed the noise policy at your condo/village?', options: ['No noise restrictions on instrument playing or singing', 'Playing allowed only during daytime hours (e.g., 10 AM–5 PM)', 'Acoustic instrument playing strictly prohibited due to noise complaints (digital instruments with headsets only)', 'Planning to visit a studio'] },
    { id: 'ml_start_date', type: 'DATE_PICKER', text: 'Please select your preferred lesson start date.' },
    { id: 'ml_schedule', type: 'SINGLE_CHOICE', text: 'Please select your preferred lesson frequency and time slot.', options: ['1–2 times a week, weekday daytime', '1–2 times a week, weekday evenings', 'Weekend (Sat, Sun) lessons', 'Flexible schedule with instructor'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the pro? (Optional)', skippable: true, placeholder: 'e.g. My child has a short attention span so I prefer 30-minute sessions 3 times a week; I need a crash course on electric guitar for a company band performance in 3 months, etc.' }
];

const TILE_FLOORING_STEPS = [
    { id: 'tile_spaces', type: 'MULTI_CHOICE', text: 'Please select the spaces to be tiled. (Multiple choice)', options: ['Living room and hallway', 'Bedrooms', 'Kitchen', 'Bathrooms', 'Balcony/terrace', 'Outdoor areas (parking, garden, etc.)'] },
    { id: 'floor_material', type: 'SINGLE_CHOICE', text: 'Please select the type of flooring material you want.', options: ['Ceramic tile', 'Porcelain tile (including large-format)', 'Vinyl/PVC tile', 'Wood flooring', 'Epoxy coating', 'Not yet decided (will consult with pro)'] },
    { id: 'floor_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the floor?', options: ['Existing flooring must be demolished and floor needs leveling', 'Bare concrete floor (bare/turn-over condition)', 'Wants to overlay directly on existing flooring', 'Not sure about condition (site inspection needed)'] },
    { id: 'tile_material_supply', type: 'SINGLE_CHOICE', text: 'How would you like to handle materials (tiles, cement, adhesives, etc.)?', options: ['Client buys the tiles and main materials directly (Labor only)', 'Pro handles material purchase and installation (Turn-key)', 'Decide after consultation'] },
    { id: 'tile_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the property type and Admin/HOA work permit status.', options: ['Condo/commercial (Admin approval and deposit completed)', 'Subdivision/village (HOA approval completed)', 'Standalone house (no permit needed or self-managed)', 'Not yet obtained permit (pro guidance/assistance needed)'] },
    { id: 'tile_site_access', type: 'MULTI_CHOICE', text: 'Please check the site conditions for delivering tiles and cement. (Multiple choice)', options: ['Service elevator available', 'Ground floor or large truck can park/enter', 'Heavy materials must be carried up stairs only', 'Electricity and water are currently available on site'] },
    { id: 'tile_area_sqm', type: 'SINGLE_CHOICE', text: 'Please select the approximate total installation area (sqm).', options: ['Under 20 sqm (small area like a bathroom)', '20–50 sqm', '50–100 sqm', '100 sqm or more', 'Exact area unknown (site inspection needed)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred construction start date.' },
    { id: 'tile_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the allowable work hours per condo/village rules.', options: ['Weekdays daytime only (8 AM–5 PM)', 'Weekdays and Saturday daytime', 'Night work only', 'Rules not yet confirmed — will arrange timing with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Bathroom waterproofing is also needed; large-format tiles (60x120, etc.) will be installed, etc.' }
];

const PAINTING_STEPS = [
    { id: 'paint_scope', type: 'MULTI_CHOICE', text: 'Please select the painting scope. (Multiple choice)', options: ['Entire interior', 'Partial interior (specific room, living room, etc.)', 'Entire exterior walls', 'Ceilings', 'Doors, window frames, moldings, cabinets, etc.', 'Roof paint'] },
    { id: 'paint_site_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the work site?', options: ['Currently occupied/operating (furniture and floor must be covered)', 'Vacant unit or new construction', 'Empty house with some existing furniture'] },
    { id: 'wall_condition', type: 'MULTI_CHOICE', text: 'Please check the existing wall condition and any pre-work needed. (Multiple choice)', options: ['Wallpaper removal needed', 'Severe peeling paint and mold (removal and chemical treatment needed)', 'Crack repair and putty work needed', 'Relatively clean — can paint directly over', 'Exterior texture (high-pressure washing needed)'] },
    { id: 'paint_material_supply', type: 'SINGLE_CHOICE', text: 'Please select the paint material preparation method.', options: ['Client specifies brand (Boysen, Davies, etc.) and color and buys directly (Labor only)', 'Pro provides all materials including paint (Turn-key)', 'Client consults with pro on color, pro handles procurement'] },
    { id: 'paint_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the property type and work permit status.', options: ['Condo/commercial (Admin approval completed)', 'Subdivision/village (HOA approval completed)', 'Standalone house (no permit needed)', 'Not yet obtained permit (pro guidance needed)'] },
    { id: 'floor_height', type: 'SINGLE_CHOICE', text: 'Please indicate the floor level or ceiling height of the work area.', options: ['Standard single-floor ceiling height (can work with a ladder)', '2-story house or high ceiling (scaffolding required)', 'Condo unit'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred construction start date.' },
    { id: 'paint_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the allowable work hours per condo/village rules.', options: ['Weekdays daytime only (8 AM–5 PM)', 'Weekdays and Saturday daytime', 'Night/weekend work available', 'Rules not yet confirmed — will arrange with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. I want odorless (water-based) paint to avoid the strong smell of oil-based enamel; I have a specific Boysen color code, etc.' }
];

const CARPENTRY_STEPS = [
    { id: 'carpentry_work_types', type: 'MULTI_CHOICE', text: 'Please select the carpentry and furniture work needed. (Multiple choice)', options: ['Custom built-in wardrobe and closet', 'Kitchen sink and upper/lower cabinets', 'Door and door frame replacement and repair', 'Bed frame, desk and general furniture', 'Moldings and baseboards', 'Commercial counter and display shelves'] },
    { id: 'carpentry_material', type: 'SINGLE_CHOICE', text: 'Please select the main material and finishing method.', options: ['Plywood/MDF with laminate finish (Laminates/Formica)', 'Plywood/MDF with paint finish', 'Solid wood', 'Decide after consultation with pro'] },
    { id: 'design_doc', type: 'SINGLE_CHOICE', text: 'Do you have drawings with dimensions?', options: ['Have precise drawings with measurements (ready for production)', 'Have reference photos or simple sketches', 'Nothing at all — pro must do on-site measurement and propose design'] },
    { id: 'carpentry_site_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the work location?', options: ["Currently occupied/operating (must strictly prevent sawdust from spreading and protect surfaces)", 'Vacant/new construction', "Fabrication at pro's workshop then on-site assembly/installation only"] },
    { id: 'carpentry_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the property type and Admin/HOA permit status.', options: ['Condo/commercial (Admin approval and deposit completed)', 'Subdivision/village (HOA approval completed)', 'Standalone house (no permit needed)', 'Not yet obtained permit (pro guidance needed)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred work start date (or measurement date).' },
    { id: 'carpentry_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the allowable hours for noisy work per condo/village rules.', options: ['Weekdays daytime always available', 'Weekdays with time restrictions only (e.g., 1 PM–5 PM)', 'Weekends and night work available', 'Have not yet checked the rules'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Large plywood sheets can only be brought in via the service elevator; old furniture also needs to be removed and disposed of, etc.' }
];

const DRYWALL_STEPS = [
    { id: 'drywall_purpose', type: 'MULTI_CHOICE', text: 'Please select the main purpose of the drywall/partition installation. (Multiple choice)', options: ['Dividing a large space (creating a room, partition, etc.)', 'Ceiling installation (drop ceiling, flat ceiling, etc.)', 'Leveling an uneven wall surface', 'Interior framework for commercial space', 'Insulation and soundproofing'] },
    { id: 'insulation_needed', type: 'SINGLE_CHOICE', text: 'Is additional soundproofing or insulation work needed?', options: ['Only need standard partition/ceiling framing (frame + board)', 'Must insert soundproofing/insulation material (e.g., Glasswool) inside wall', 'Decide after consultation with pro based on site conditions'] },
    { id: 'ceiling_height_drywall', type: 'SINGLE_CHOICE', text: 'Please indicate the ceiling height of the space to be worked on.', options: ['Standard ceiling height (under 3m — can work with a ladder)', 'High ceiling (3m or more — scaffolding required)', 'Exact height unknown'] },
    { id: 'finish_level', type: 'SINGLE_CHOICE', text: 'Please select the desired final finish level.', options: ['Frame up and board installation only (Labor & Material)', 'Up to joint tape and putty finish', 'Full turnkey finish including paint or wallpaper (Turn-key)'] },
    { id: 'drywall_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please check the material delivery environment and Admin/HOA permit status.', options: ['Condo/commercial (Admin approval completed, service elevator available)', 'Subdivision/village (HOA approval completed)', 'Standalone house (large truck can enter)', 'Materials must be carried up stairs only', 'Not yet confirmed rules or obtained permit'] },
    { id: 'drywall_material_supply', type: 'SINGLE_CHOICE', text: 'Please select the material preparation method.', options: ['Client buys materials (board, studs, etc.) directly (Labor only)', 'Pro provides all materials (Turn-key)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred construction start date.' },
    { id: 'drywall_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the allowable work hours per condo/village rules.', options: ['Weekdays daytime only (8 AM–5 PM)', 'Weekdays and Saturday daytime', 'After commercial hours at night only', 'Rules not yet confirmed — will arrange with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Near a humid bathroom so moisture-resistant drywall must be used; new electrical outlets also need to be installed inside the partition, etc.' }
];

const ROOFING_STEPS = [
    { id: 'roofing_work_types', type: 'MULTI_CHOICE', text: 'Please select the type of work needed. (Multiple choice)', options: ['Roof leak repair and partial replacement', 'Full roof replacement (new roof)', 'Roof waterproofing coat and paint', 'Roof deck waterproofing', 'Balcony/bathroom interior leak repair', 'Exterior wall waterproofing and crack repair'] },
    { id: 'roof_problem_status', type: 'SINGLE_CHOICE', text: 'Please select the description that best matches your current situation.', options: ['Water is actively dripping or leaking during rain', 'Severe water stains and mold on ceiling or walls', 'Tile lifting or water pooling on floor', 'No current leak — want preventive waterproofing'] },
    { id: 'roof_material', type: 'SINGLE_CHOICE', text: 'Please describe the roofing or floor material.', options: ['Standard metal sheet (GI Sheet / Yero / colored steel)', 'Tiles (Concrete/Clay)', 'Flat concrete roof slab (rooftop)', 'Asphalt shingles', 'Indoor bathroom/balcony tile floor', 'Not sure'] },
    { id: 'roof_access', type: 'SINGLE_CHOICE', text: 'Please describe the floor level and external access for the work.', options: ['Single-story — easy access with a ladder', '2-story house or building', '3 stories or higher — scaffolding or crane required', 'Very steep and dangerous roof slope', 'Indoor work only'] },
    { id: 'roof_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the property type and Admin/HOA permit status.', options: ['Subdivision/village (HOA approval and construction permit completed)', 'Standalone house (no permit needed)', 'Commercial building (management approval completed)', 'Condo unit (bathroom/balcony interior leak case)', 'Not yet obtained permit (pro guidance needed)'] },
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred construction (or urgent inspection) date.' },
    { id: 'roof_work_schedule', type: 'SINGLE_CHOICE', text: 'Please select the available work hours.', options: ['Weekdays daytime only (8 AM–5 PM)', 'Weekdays and weekends daytime available', 'Night work only (after commercial hours)', 'Arrange timing with pro'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: "e.g. It rains every afternoon during rainy season so only morning work is possible; the water is leaking urgently and I need at least a temporary plastic/tarpaulin fix, etc." }
];

const CONDO_INTERIOR_STEPS = [
    { id: 'interior_scope', type: 'MULTI_CHOICE', text: 'Please select the scope of the interior renovation. (Multiple choice)', options: ['Full interior renovation', 'Partial interior (living room, bedroom, etc.)', 'Kitchen renovation (cabinets, etc.)', 'Bathroom renovation', 'Balcony construction'] },
    { id: 'unit_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the condo unit?', options: ['Just received from developer (Turn-over / Bare condition)', 'Has existing interior that needs demolition', 'Currently occupied and needs partial renovation'] },
    { id: 'condo_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the condo management office (Admin) construction permit and construction bond status.', options: ['Admin approval and deposit payment completed', 'Submitted drawings — awaiting approval', 'Have not yet checked rules — need pro guidance/assistance'] },
    { id: 'work_schedule', type: 'SINGLE_CHOICE', text: 'Please indicate the allowable work hours and days per condo management rules.', options: ['Weekdays only (no weekends)', 'Weekdays and Saturday daytime', 'Night work allowed', 'Have not yet confirmed Admin rules'] },
    { id: 'interior_supply', type: 'SINGLE_CHOICE', text: 'How would you like to handle materials and design for the renovation?', options: ['Full turnkey (design to material purchase to installation)', 'Client buys materials and hires for labor only', 'Decide after site inspection with pro'] },
    { id: 'interior_budget', type: 'SINGLE_CHOICE', text: 'Please select your approximate total renovation budget (PHP).', options: ['Under PHP 100,000', 'PHP 100,000–300,000', 'PHP 300,000–600,000', 'PHP 600,000 or more', 'Decide after site inspection'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. The service elevator access is limited; Meralco (electricity) and Maynilad (water) are not yet connected, etc.' }
];

const COMMERCIAL_INTERIOR_STEPS = [
    { id: 'commercial_space_type', type: 'SINGLE_CHOICE', text: 'Please select the type of commercial space for the renovation.', options: ['Restaurant/café (F&B)', 'Office', 'Salon/beauty/spa', 'Mall kiosk or tenant store', 'Road-side commercial unit', 'Other'] },
    { id: 'commercial_unit_condition', type: 'SINGLE_CHOICE', text: 'What is the current condition of the commercial space?', options: ['New/vacant unit (Bare unit)', 'Has existing interior to be demolished', 'Currently operating and needs partial repair outside business hours'] },
    { id: 'commercial_permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the shopping mall/commercial Admin work permit and construction rules.', options: ['Drawings approved and Work Permit issued', 'Drawings submitted — awaiting approval', 'Night shift work only allowed', 'Have not yet checked the rules (need pro assistance)'] },
    { id: 'admin_requirements', type: 'MULTI_CHOICE', text: 'Please check the mandatory administrative and safety requirements for the renovation. (Multiple choice)', options: ['Official BIR receipt (O.R.) issuance required', 'Fire safety permit processing needed', 'New plumbing/grease trap installation needed', 'Electrical upgrade (Meralco 3-phase, etc.) needed', 'Not applicable'] },
    { id: 'design_status', type: 'SINGLE_CHOICE', text: 'Do you have interior design drawings (3D/2D)?', options: ['Have design drawings (installation only)', 'Have a design concept but need to create full drawings', 'Full turnkey — design and construction together'] },
    { id: 'commercial_budget', type: 'SINGLE_CHOICE', text: 'Please select your approximate total renovation budget (PHP).', options: ['Under PHP 300,000', 'PHP 300,000–800,000', 'PHP 800,000–1,500,000', 'PHP 1,500,000 or more', 'Decide after site inspection and drawing review'] },
    { id: 'commercial_start', type: 'SINGLE_CHOICE', text: 'When do you expect construction to start?', options: ['As soon as possible (within 1–2 weeks)', 'Within 1 month', 'Within 2–3 months', 'Undecided (decide after consultation)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. SM Mall rules allow construction only from 10 PM to 5 AM; my rent-free period has 2 weeks remaining, etc.' }
];

const REMODELING_STEPS = [
    { id: 'remodel_scope', type: 'MULTI_CHOICE', text: 'Please select the scope of remodeling or extension work. (Multiple choice)', options: ['Full house remodeling', 'Partial remodeling (room, living room, etc.)', 'Kitchen remodeling', 'Bathroom remodeling', 'Space extension (adding a room, balcony, etc.)', 'Roof and exterior work'] },
    { id: 'remodel_start', type: 'SINGLE_CHOICE', text: 'When do you expect construction to start?', options: ['As soon as possible (within 1 week)', 'Within 1 month', 'Within 2–3 months', 'Undecided (decide after quotation and consultation)'] },
    { id: 'permit_status', type: 'SINGLE_CHOICE', text: '[Important] Please describe the property type and Admin/HOA work permit status.', options: ['Subdivision/village (HOA approval completed)', 'Condominium (Admin approval completed)', 'Standalone house (barangay permit self-managed)', 'Not yet obtained permit (need pro guidance/assistance)'] },
    { id: 'material_supply', type: 'SINGLE_CHOICE', text: 'Please select the material procurement method for the construction.', options: ['Labor and full materials included (Turn-key)', 'Client buys materials directly (Labor only)', 'Decide after site inspection with pro'] },
    { id: 'site_infra', type: 'MULTI_CHOICE', text: 'Please check the site infrastructure and access conditions. (Multiple choice)', options: ['Electricity (Meralco, etc.) currently available', 'Water supply (Maynilad, etc.) currently available', 'Large delivery trucks can enter', 'Service elevator available'] },
    { id: 'remodel_budget', type: 'SINGLE_CHOICE', text: 'Please select your approximate total construction budget (PHP).', options: ['Under PHP 100,000', 'PHP 100,000–500,000', 'PHP 500,000–1,000,000', 'PHP 1,000,000 or more', 'Decide after site inspection'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Rooftop waterproofing is urgent ahead of rainy season; the subdivision rules do not allow noisy construction on weekends; I have floor plan drawings available, etc.' }
];

const LPG_GAS_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and delivery date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['As soon as possible (emergency — gas depleted or suspected leak)', 'Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'gas_service_type', type: 'SINGLE_CHOICE', text: 'Please select the type of service needed.', options: ['LPG gas delivery and cylinder swap only (Refill/Swap)', 'Gas delivery + safety inspection of connection line (hose/regulator)', 'Gas leak inspection and line repair (no delivery needed)', 'New cylinder purchase and initial installation'] },
    { id: 'gas_brand', type: 'SINGLE_CHOICE', text: 'Please select the brand of gas cylinder you use or need. (for valve type verification)', options: ['Petron Gasul', 'Shine Gas (Pol valve/screw-type)', 'Solane (Snap-on valve/one-touch)', 'Fiesta Gas', 'Other brand or not sure'] },
    { id: 'gas_capacity', type: 'SINGLE_CHOICE', text: 'What is the capacity (size) of your cylinder?', options: ['11 kg (standard household size)', '2.7 kg–7 kg (small/camping size)', '22 kg–50 kg (restaurant and commercial size)', 'Not sure'] },
    { id: 'empty_cylinder', type: 'SINGLE_CHOICE', text: '[For delivery customers] Do you have an empty cylinder to exchange?', options: ['Yes, I have an empty cylinder of the same brand (only pay for gas refill)', 'Yes, but it is a different brand (need to check compatibility/exchange)', 'No, I need to buy a new cylinder', 'Not applicable (inspection/repair customer)'] },
    { id: 'gas_symptoms', type: 'MULTI_CHOICE', text: '[For inspection/repair customers] Are there any current problems or suspected symptoms? (Multiple choice)', options: ['Not applicable (delivery only)', 'Strong gas smell (suspected leak — urgent)', "Gas burner won't ignite or flame is very weak", 'Regulator or rubber hose is old or cracked', 'Hissing sound from the valve'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. I have obtained LPG delivery permission from condo Admin; it is on the 3rd floor with no elevator; it is a commercial kitchen, etc.' }
];

const WINDOW_SCREEN_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit date for measurement/installation.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'screen_locations', type: 'MULTI_CHOICE', text: 'Please select the type of windows or doors that need screen installation. (Multiple choice)', options: ['Standard sliding windows', 'Large balcony glass sliding door', 'Front door (Screen door)', 'Other'] },
    { id: 'screen_qty', type: 'SINGLE_CHOICE', text: 'How many screens approximately need to be installed?', options: ['1–2 units (partial)', '3–5 units', '6 or more (entire house)', 'Not sure (on-site measurement needed)'] },
    { id: 'screen_material', type: 'SINGLE_CHOICE', text: 'Do you have a preference for screen material or feature?', options: ['Standard aluminum/fiberglass mesh (basic)', 'Fine mesh (for fine dust and very small insects)', 'Pet-resistant screen (scratch-proof)', 'Decide after consultation'] },
    { id: 'screen_frame_status', type: 'SINGLE_CHOICE', text: 'What is the current condition of the window frame?', options: ['Existing screen frame available — only mesh replacement needed (rewiring)', 'Frame is missing or damaged — full new frame and mesh required (new installation)', 'Not sure'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Dengue fever is a concern so mosquito blocking is urgent; my cat keeps tearing through the existing mesh, etc.' }
];

const LOCKSMITH_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['As soon as possible (emergency — locked out)', 'Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'lock_service_type', type: 'SINGLE_CHOICE', text: 'What is the current problem or service you need?', options: ['Door is locked and needs to be opened (lost key / dead digital lock)', 'Existing key/lock malfunction repair', 'Full replacement with a new digital lock/key and new installation'] },
    { id: 'door_material', type: 'SINGLE_CHOICE', text: 'What is the material of the door? (Important for choosing drilling tools)', options: ['Wooden door', 'Metal/steel door', 'Glass door', 'Fire door', 'Not sure'] },
    { id: 'lock_type_new', type: 'SINGLE_CHOICE', text: '[For new installation/replacement] What type of lock do you want? (Select "Not applicable" if repair/unlock only)', options: ['Not applicable (repair and unlock only)', 'Traditional key lock (Knob/Deadbolt)', 'Digital door lock (password/card)', 'Smart/fingerprint door lock'] },
    { id: 'lock_product_supply', type: 'SINGLE_CHOICE', text: '[For new installation/replacement] How will the product be sourced?', options: ['Not applicable (repair and unlock only)', 'Client has already purchased the door lock', 'Pro must purchase and bring the product', 'Decide after consultation'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Condo Admin rules require a permit for drilling; I have lost the master key, etc.' }
];

const FURNITURE_ASSEMBLY_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and work date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'furniture_types', type: 'MULTI_CHOICE', text: 'What furniture needs to be assembled and arranged? (Multiple choice)', options: ['Bed frame', 'Wardrobe and large drawers', 'Dining table and chairs', 'Desk and office furniture', 'TV stand and storage unit', 'Other'] },
    { id: 'furniture_brand', type: 'SINGLE_CHOICE', text: 'Please indicate the brand or purchase source of the furniture.', options: ['IKEA product', 'Online shopping (Shopee/Lazada, etc.) flat-pack furniture', 'Custom-made furniture', 'Disassembly and reassembly of existing furniture'] },
    { id: 'furniture_qty', type: 'SINGLE_CHOICE', text: 'Approximately how many and how large are the items to be assembled?', options: ['1–2 pieces (simple task)', '3–5 pieces (enough for 1 room)', 'Large volume assembly (moving in — needs 2+ people)'] },
    { id: 'wall_mount_needed', type: 'SINGLE_CHOICE', text: 'Is there any furniture that needs to be drilled and firmly fixed to the wall (wall mounting)?', options: ['No, just needs to be placed on the floor', 'Yes, it is heavy and needs wall anchors', 'Not sure (expert judgment needed)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. It is an IKEA PAX wardrobe with many parts; the furniture is very heavy and may need 2 adult men, etc.' }
];

const AC_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'ac_types', type: 'MULTI_CHOICE', text: 'Please select the type(s) of air conditioner to be repaired. (Multiple choice)', options: ['Window-type', 'Split/wall-mounted type', 'Floor-standing type', 'Ceiling/cassette/ducted type', 'Not sure'] },
    { id: 'ac_symptoms', type: 'MULTI_CHOICE', text: 'What are the main symptoms? (Multiple choice)', options: ['Not cooling at all (suspected refrigerant gas leak)', 'Will not turn on at all', 'Water dripping heavily from the indoor unit (leak)', 'Excessive noise and vibration', 'Error code blinking'] },
    { id: 'ac_hp', type: 'SINGLE_CHOICE', text: 'Do you know the approximate horsepower (HP) of the AC unit?', options: ['1.0 HP or less (small)', '1.5–2.0 HP (medium-large)', '2.5 HP or more (extra-large/commercial)', 'Not sure'] },
    { id: 'outdoor_unit_location', type: 'SINGLE_CHOICE', text: 'Where is the outdoor unit installed?', options: ['Easy-access location like balcony floor', 'Exterior wall ledge or rooftop (dangerous — ladder required)', 'Window-type — no separate outdoor unit', 'Not sure'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. The remote control is not working; the circuit breaker keeps tripping, etc.' }
];

const APPLIANCE_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'appliance_type', type: 'SINGLE_CHOICE', text: 'Which appliance needs repair?', options: ['Refrigerator', 'Freezer', 'Top-load washing machine', 'Front-load (drum) washing machine', 'Clothes dryer', 'Other large home appliance'] },
    { id: 'appliance_symptoms', type: 'MULTI_CHOICE', text: 'Please select the main malfunction symptoms. (Multiple choice)', options: ['Will not turn on', 'Cooling/freezing is weak or not working (refrigerator)', 'Spin/drain/water fill not working (washing machine)', 'Excessive noise and vibration', 'Water leaking from unit or error code showing'] },
    { id: 'appliance_brand', type: 'SINGLE_CHOICE', text: 'Please select the brand of the appliance.', options: ['Samsung', 'LG', 'Panasonic or Condura', 'Other brand or not sure'] },
    { id: 'appliance_age', type: 'SINGLE_CHOICE', text: 'Approximately when was the product purchased (how old is it)?', options: ['Within 1–2 years (may still be under warranty)', '3–5 years', '5 years or more (aging unit)', 'Not sure'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: "e.g. The washing machine door won't open; there was a burning smell from the refrigerator, etc." }
];

const TV_INSTALLATION_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred installation date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'tv_size', type: 'SINGLE_CHOICE', text: 'Please select the size of the TV to be installed.', options: ['40 inches or less', '41–55 inches', '56–70 inches', '71 inches or more (large)'] },
    { id: 'install_type', type: 'SINGLE_CHOICE', text: 'Please select the installation method.', options: ['New wall-mount installation with a new bracket', 'Relocate and reinstall existing wall-mounted TV', 'Standard stand assembly and setup', 'Ceiling mount installation'] },
    { id: 'bracket_ready', type: 'SINGLE_CHOICE', text: 'Do you already have a wall-mount bracket?', options: ['Yes, the client already has one', 'No, the pro must purchase and bring one', 'Stand type — no bracket needed'] },
    { id: 'wall_type', type: 'SINGLE_CHOICE', text: 'What is the wall material where the TV will be mounted?', options: ['Standard concrete wall', 'Drywall/plywood (partition wall)', 'Marble or tile (special drilling required)', 'Not sure'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. Please hide the set-top box and router behind the TV (cable management); a soundbar also needs to be installed, etc.' }
];

const CCTV_INSTALLATION_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and installation/inspection date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'service_type_cctv', type: 'SINGLE_CHOICE', text: 'Please select the type of service needed.', options: ['New CCTV camera installation', 'Repair and inspection of existing CCTV', 'Digital door lock and access control installation', 'Fire and intrusion alarm installation'] },
    { id: 'camera_count', type: 'SINGLE_CHOICE', text: '[For new installation] How many cameras do you want installed?', options: ['1–2 cameras (small scale)', '3–4 cameras (standard house/shop)', '5–8 cameras (medium-large building)', '9 or more cameras (commercial)', 'Not applicable (repair customer)'] },
    { id: 'install_location', type: 'SINGLE_CHOICE', text: 'What is the type of installation location?', options: ['Condo/apartment interior', 'Standalone house (indoor and outdoor yard)', 'Restaurant, café or other commercial space', 'Office and warehouse/factory'] },
    { id: 'wifi_available', type: 'SINGLE_CHOICE', text: 'Is internet (Wi-Fi) available for smartphone connectivity?', options: ['Yes, internet is available', 'No, internet is not yet set up', 'Not sure'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. I need infrared cameras for good visibility at night; the existing cable is cut, etc.' }
];

const SOLAR_PANEL_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and consultation date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'service_type_solar', type: 'SINGLE_CHOICE', text: 'Please select the type of service needed.', options: ['New system design and installation', 'Repair of existing panel failure and inverter replacement', 'Regular cleaning and inspection', 'System expansion (adding panels or batteries)'] },
    { id: 'system_type', type: 'SINGLE_CHOICE', text: 'What type of system are you considering or currently using?', options: ['Grid-Tied (no batteries — connected to Meralco, etc.)', 'Off-Grid (batteries required)', 'Hybrid (grid-connected + batteries)', 'Not yet decided (need consultation)'] },
    { id: 'system_capacity', type: 'SINGLE_CHOICE', text: 'Please select the approximate system size (capacity).', options: ['3 kWp or less (small residential)', '3–5 kWp (standard residential)', '5–10 kWp (large residential or small commercial)', '10 kWp or more', 'Not sure (need consultation based on electric bill)'] },
    { id: 'roof_type', type: 'SINGLE_CHOICE', text: 'What is the shape of the roof where panels are/will be installed?', options: ['Standard metal sheet roof (GI Sheet / Yero)', 'Flat concrete slab rooftop', 'Tile roof', 'Ground mount (yard or empty lot, not a roof)'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. The inverter is showing an error code; I am looking for a company that can also handle Net Metering paperwork, etc.' }
];

const LIGHTING_WIRING_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred construction and visit date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'work_types', type: 'MULTI_CHOICE', text: 'What type of work do you need? (Multiple choice)', options: ['General light/LED bulb replacement and repair', 'Large chandelier installation', 'New outlet and switch addition', 'Full wiring replacement and overhaul', 'Sub-meter installation'] },
    { id: 'ceiling_type', type: 'SINGLE_CHOICE', text: 'What is the ceiling type and height where lighting will be installed? (Required for wiring work)', options: ['Standard height (can work with a ladder)', 'High ceiling (3m or more — long ladder or scaffolding needed)', 'Concrete ceiling (difficult to drill)', 'Dropped ceiling (gypsum or similar false ceiling)'] },
    { id: 'materials_ready', type: 'SINGLE_CHOICE', text: 'Are the lighting fixtures or materials already prepared?', options: ['Yes, the client has already purchased the lights/materials', 'No, the pro must purchase and bring all materials (extra cost)', 'Would like to decide through consultation'] },
    { id: 'wiring_condition', type: 'SINGLE_CHOICE', text: 'What is the current wall/ceiling condition for wiring work?', options: ['Can reuse existing wiring', 'Existing wiring is too short or missing — need to run new wires inside ceiling/walls (embedded)', 'Exposed wiring on surface is acceptable (molding finish)', 'Professional inspection needed'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. 20 downlights need to be installed; the chandelier is quite heavy, etc.' }
];

const GENERATOR_REPAIR_STEPS = [
    { id: 'visit_date', type: 'DATE_PICKER', text: 'Please select your preferred visit and diagnostic date.' },
    { id: 'visit_time', type: 'SINGLE_CHOICE', text: 'Please select your preferred visit time slot.', options: ['Morning (8 AM–12 PM)', 'Afternoon (1 PM–5 PM)', 'Arrange time with pro'] },
    { id: 'service_type_gen', type: 'SINGLE_CHOICE', text: 'Please select the type of service needed.', options: ['New generator (genset) installation and wiring connection', 'Existing generator repair', 'Routine maintenance (oil and filter replacement, etc.)', 'ATS (Automatic Transfer Switch) installation and repair'] },
    { id: 'fuel_type', type: 'SINGLE_CHOICE', text: 'What is the fuel type and type of generator?', options: ['Gasoline (portable small unit)', 'Diesel (stand-type medium-large unit)', 'Inverter generator', 'Not sure (expert verification needed)'] },
    { id: 'gen_capacity', type: 'SINGLE_CHOICE', text: 'Do you know the approximate capacity of the generator?', options: ['5 kVA or less (household emergency power)', '5–10 kVA', '10 kVA or more (commercial/large residential)', 'Not sure'] },
    { id: 'gen_symptoms', type: 'MULTI_CHOICE', text: "[For repair/maintenance customers only] What is the current problem? (Select 'Not applicable' for new installation)", options: ['Not applicable (new installation)', 'Will not start', 'Starts but no electricity output', 'Excessive engine noise or exhaust smoke', 'Engine oil or fuel is leaking', 'Auto-transfer (ATS) is not working during a power outage'] },
    { id: 'details', type: 'TEXTAREA_INPUT', text: 'Any special notes for the work site? (Optional)', skippable: true, placeholder: 'e.g. The brand is Honda (or Cummins); it will be installed in the yard, etc.' }
];

const DEFAULT_DETAILS_STEP = { id: 'details', type: 'TEXT_INPUT', text: 'Please enter any special notes for the pro.', skippable: true };

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
    const locale = typeof document !== 'undefined'
        ? (document.cookie.split('; ').find(r => r.startsWith('locale='))?.split('=')[1] ?? 'en')
        : 'en';
    const t = useTranslations();
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [history, setHistory] = useState<{ stepText: string, userAnswer: any }[]>([]);
    const [serviceCategories, setServiceCategories] = useState<Record<string, Record<string, string[]>>>({});
    const [nameEnToKo, setNameEnToKo] = useState<Record<string, string>>({});
    const [koToEn, setKoToEn] = useState<Record<string, string>>({});

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
            const { data } = await supabase.from('categories').select('name, name_en, depth1, depth2').eq('is_active', true).order('sort_order', { ascending: true });
            if (data) {
                const tree: Record<string, Record<string, string[]>> = {};
                data.forEach(item => {
                    if (!item.depth1 || !item.depth2) return;
                    const displayName = (locale === 'en' && item.name_en) ? item.name_en : item.name;
                    if (!tree[item.depth1]) tree[item.depth1] = {};
                    if (!tree[item.depth1][item.depth2]) tree[item.depth1][item.depth2] = [];
                    tree[item.depth1][item.depth2].push(displayName);
                });
                setServiceCategories(tree);
                const enToKo: Record<string, string> = {};
                const koToEnMap: Record<string, string> = {};
                data.forEach(item => {
                    if (item.name_en) {
                        enToKo[item.name_en] = item.name;
                        koToEnMap[item.name] = item.name_en;
                    }
                });
                setNameEnToKo(enToKo);
                setKoToEn(koToEnMap);
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
            case 'depth1': return Object.keys(serviceCategories).map(k => locale === 'en' ? (DEPTH1_EN[k] ?? k) : k);
            case 'depth2': return Object.keys(serviceCategories[answers.depth1] || {}).map(k => locale === 'en' ? (DEPTH2_EN[k] ?? k) : k);
            case 'service_type': return serviceCategories[answers.depth1]?.[answers.depth2] || [];
            case 'region_reg': return Object.keys(PHILIPPINES_REGIONS).map(k =>
                (locale === 'en' && k === '전체') ? 'All Regions' : k
            );
            case 'region_city': return PHILIPPINES_REGIONS[answers.region_reg] || [];
            default: return currentQuestion.options || [];
        }
    };

    const commitAnswer = (answerValue: any, displayValue: string) => {
        const depth1EnToKo: Record<string, string> = Object.fromEntries(Object.entries(DEPTH1_EN).map(([k, v]) => [v, k]));
        const depth2EnToKo: Record<string, string> = Object.fromEntries(Object.entries(DEPTH2_EN).map(([k, v]) => [v, k]));

        const normalizedValue =
            (currentQuestion.id === 'service_type' && nameEnToKo[answerValue]) ? nameEnToKo[answerValue] :
            (currentQuestion.id === 'depth1' && depth1EnToKo[answerValue]) ? depth1EnToKo[answerValue] :
            (currentQuestion.id === 'depth2' && depth2EnToKo[answerValue]) ? depth2EnToKo[answerValue] :
            (currentQuestion.id === 'region_reg' && answerValue === 'All Regions') ? '전체' :
            answerValue;
        setAnswers(prev => ({ ...prev, [currentQuestion.id]: normalizedValue }));
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
                const displayValue = (locale === 'en' && DEPTH1_EN[categoryId]) ? DEPTH1_EN[categoryId] : categoryId;
                commitAnswer(categoryId, displayValue);
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
                const displayValue = (locale === 'en' && DEPTH2_EN[serviceId]) ? DEPTH2_EN[serviceId] : serviceId;
                commitAnswer(serviceId, displayValue);
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
                const displayValue = (locale === 'en' && DEPTH2_EN[depth2Param]) ? DEPTH2_EN[depth2Param] : depth2Param;
                commitAnswer(depth2Param, displayValue);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories]);

    // service_type(3뎁스) 자동 진행: depth2 완료 후 serviceType 파라미터로 진행 (전체 서비스용)
    useEffect(() => {
        const serviceType = searchParams?.get('serviceType');
        const categoryId = searchParams?.get('categoryId');
        const depth2Param = searchParams?.get('depth2');
        if (serviceType && depth2Param && categoryId && currentIndex === 2 && currentQuestion?.id === 'service_type' && !isServiceTypeAutoAdvanced.current) {
            const serviceTypes = serviceCategories[categoryId]?.[depth2Param] || [];

            // serviceCategories 비동기 로드 대기
            if (serviceTypes.length === 0) return;

            // EN 모드에서 serviceTypes 배열은 영문이므로, 한글 serviceType을 영문으로 변환하여 매칭
            if (locale === 'en' && Object.keys(koToEn).length === 0) return;
            const matchValue = (locale === 'en') ? koToEn[serviceType] : serviceType;
            const displayValue = matchValue ?? serviceType;

            if (matchValue && serviceTypes.includes(matchValue)) {
                isServiceTypeAutoAdvanced.current = true;
                commitAnswer(serviceType, displayValue);
            } else if (serviceTypes.includes(serviceType)) {
                // fallback: 한글 직접 매칭 (KO 모드 또는 koToEn에 없는 경우)
                isServiceTypeAutoAdvanced.current = true;
                commitAnswer(serviceType, serviceType);
            }
        }
    }, [searchParams, currentIndex, currentQuestion, serviceCategories, koToEn, locale]);

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
                dynamic_answers: { ...answers, _history: history },
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
                    <h1 className="text-[16px] font-bold text-gray-800">{t('requestForm.headerTitle')}</h1>
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
                                                            {t('requestForm.select')}
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
                                                {t('requestForm.next')}
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
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">{t('requestForm.skip')}</button>
                                            )}
                                            <button
                                                onClick={() => tempText && commitAnswer(tempText, tempText)}
                                                disabled={!tempText}
                                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold disabled:opacity-50"
                                            >
                                                {t('requestForm.next')}
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
                                            {t('requestForm.next')}
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
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">{t('requestForm.skip')}</button>
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
                                                {t('requestForm.select')}
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
                                                        {t('requestForm.imageUploading')}
                                                    </div>
                                                ) : (
                                                    <div className="text-center text-blue-700">
                                                        <svg className="w-8 h-8 mx-auto mb-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                                        <span className="font-bold text-sm">{t('requestForm.imageAdd')} ({imagesState.length}/5)</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            {currentQuestion.skippable && (
                                                <button onClick={handleSkip} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold">{t('requestForm.skip')}</button>
                                            )}
                                            <button
                                                onClick={() => commitAnswer(imagesState, imagesState.length > 0 ? `${t('requestForm.imageAdd')} ${imagesState.length}${t('requestForm.imageAttached')}` : t('requestForm.imageSkipped'))}
                                                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
                                            >
                                                {t('requestForm.next')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 7. DETAILS_CHOICE */}
                                {currentQuestion.type === 'DETAILS_CHOICE' && (
                                    <div className="flex flex-col gap-2">
                                        <button onClick={() => commitAnswer('지금 작성할게요', '💬 지금 작성할게요')} className="bg-blue-50 text-blue-700 py-3 px-4 rounded-xl border border-blue-200 font-medium text-left">
                                            {t('requestForm.detailsNow')}
                                        </button>
                                        <button onClick={() => commitAnswer('고수와 상담 시 논의할게요', '🤝 상담 시 논의할게요')} className="bg-gray-50 text-gray-700 py-3 px-4 rounded-xl border border-gray-200 font-medium text-left">
                                            {t('requestForm.detailsLater')}
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
                            <h2 className="text-xl font-bold text-gray-800">{t('requestForm.allDone')}</h2>
                            <p className="text-sm text-gray-500 mt-2">{t('requestForm.allDoneSub')}</p>
                        </div>
                        <button
                            onClick={submitAction}
                            disabled={isSubmitting}
                            className={`w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg mt-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? t('requestForm.submitting') : t('requestForm.submitBtn')}
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
                        <h2 className="text-xl font-bold text-center text-gray-800">{t('requestForm.phoneTitle')}</h2>
                        <p className="text-sm text-gray-500 text-center leading-relaxed">
                            {t('requestForm.phoneDesc')}
                        </p>
                        <input
                            type="tel"
                            value={phoneInput}
                            onChange={e => setPhoneInput(e.target.value)}
                            placeholder={t('requestForm.phonePlaceholder')}
                            className="p-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white focus:outline-none transition text-center text-lg font-medium tracking-wider mt-2"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowPhoneModal(false)}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-4 rounded-2xl transition text-sm"
                            >
                                {t('requestForm.phoneLater')}
                            </button>
                            <button
                                onClick={handlePhoneVerifyAndSubmit}
                                disabled={verifyingPhone}
                                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg transition text-sm disabled:opacity-50"
                            >
                                {verifyingPhone ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        {t('requestForm.phoneVerifying')}
                                    </span>
                                ) : t('requestForm.phoneVerifyBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
