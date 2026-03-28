# HiddenPro - History Archive (2026-03)

[2026-03-22] 레거시 데이터 도메인 문서 이관 2차 완료 — supabase_schema.md (RLS 사고 사례 상세 표+재발 방지 4규칙), system_architecture.md (i18n 네임스페이스 23개 목록+신규 언어 추가 3단계+Vercel 이전 체크리스트), nextjs_frontend.md (디렉토리 트리 최신화: referral/support/AdminReferralTab/ProRequestListClient 등 반영) / DB변경 없음
[2026-03-22] SYNC_STATE.md 레거시 데이터 도메인 문서 분산 이관 완료 — abuse_prevention.md (상태전환 전체표+추천인 시스템 6절), system_architecture.md (PgBouncer 풀링 모드 상세+i18n 인프라 현황 섹션), nextjs_frontend.md (인증 클라이언트 강제 규칙+AUP 준수+체크리스트 4항 추가), supabase_schema.md (referral_rewards/coupons 테이블+users 컬럼 확장+RPC 함수 2개), DEPLOY_CHECKLIST.md 신규 생성 (Go-Live 7개 항목) / DB변경 없음
[2026-03-22] 누락된 2개 도메인 문서 세팅 완료 — docs/supabase_schema.md (DB 스키마+RLS 정책+N+1 방지 원칙), docs/nextjs_frontend.md (프론트엔드 아키텍처+무관용 에러처리+상태관리 규칙) 신규 생성 / DB변경 없음
[2026-03-22] CLAUDE.md 도메인 문서 분리 완료 — docs/system_architecture.md (플랫폼 중립 아키텍처 + i18n 규칙), docs/abuse_prevention.md (비즈니스 룰 + 3-15-0 어뷰징 방지 정책), scripts/README.md (테스트 자동화 스크립트 작성 규칙) 신규 생성 / DB변경 없음
[2026-03-17] Credits Phase 3 완료 — ₱ 제거 및 캐시→Credits 한글 하드코딩 수정 (4개 파일: pro/wallet/page.tsx L364/370/376, ProBiddingDetail.tsx L443/844/848/854, ChatRoom.tsx L186, QuoteDetailModal.tsx L101) / DB변경 없음
[2026-03-16] admin/page.tsx JSX 한글→영어 직치환 완료 — Reviews/SearchLogs/Settings(BillingCtrl)/CMS(배너+카테고리+Support+Legal)/Inquiries/Payout/AuditLog 탭 + 전체 모달(Inquiry/Cash/Drilldown/ChatLog/Suspend/CSChat/ProDetail/Confirm/SuspendReason/Timeout) + Suspense fallback / frontend/src/app/admin/page.tsx / DB변경 없음
[2026-03-16] i18n: admin/page.tsx ④-C단계 완료 — 대시보드 개요 + 미답변 문의 + 카드 라벨 10개 + 캐시 원장 제목 + stat 카드 4개 + 카테고리 탭 + 검색 placeholder/버튼 + 기간 옵션 + CSV 헤더/버튼 + 로딩 + 테이블 헤더 8개 + 빈 상태 + 페이지네이션 / frontend/src/app/admin/page.tsx / DB변경 없음
[2026-03-16] CLAUDE.md PHASE 11 i18n 규칙 추가 완료 — next-intl 기반 신규 컴포넌트/페이지 작성 시 번역 키 의무화 + 기존 네임스페이스 목록 + 인프라 파일 위치 + 신규 언어 추가 3단계 정의 / CLAUDE.md / DB변경 없음
[2026-03-16] i18n: PCTopNav next-intl 연동 완료 (pcTopNav 네임스페이스 8키) — customerItems/proItems t() 연동 + 배지 조건 7곳 동기화 / frontend/src/components/common/PCTopNav.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-16] i18n: PCTopNav nav label 영어 직치환 완료 + profile/page.tsx joinDate locale ko-KR→en-US 교체 / frontend/src/components/common/PCTopNav.tsx, frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-16] i18n: app/page.tsx (랜딩) next-intl 연동 완료 (landing 네임스페이스 52키) — placeholderTexts 영어직치환 + categoryUI desc 6개 영어직치환 + fallback + alert + 배너 + 헤더 + 히어로 + 리뷰 + 신뢰도 + 고수배너 + 모달 전체 / frontend/src/app/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-16] i18n: auth/complete/page.tsx next-intl 연동 완료 (authComplete 네임스페이스 9키) — setStatus 4개 + 역할충돌 msg + sessionStorage 2개 + JSX fallback / frontend/src/app/auth/complete/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-16] i18n: chat/[room_id]/page.tsx next-intl 연동 완료 (chatRoom 네임스페이스 51키) — showToast 4개 + alert 2개 + locale 교체 2곳 + JSX 텍스트 전체 / frontend/src/app/chat/[room_id]/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: chat/page.tsx next-intl 연동 완료 (chatList 네임스페이스 20키) — formatChatTime + userMap/mappedRooms fallback + lastMsgMap + JSX 텍스트 전체 / frontend/src/app/chat/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: Toast next-intl 연동 완료 (toast 네임스페이스 2키) — aria-label 닫기 + 확인 버튼 t() 연동 / frontend/src/components/ui/Toast.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: ProBiddingDetail 전체 next-intl 연동 완료 (proBidding 네임스페이스 78키) — showToast 14개 + JSX 텍스트 40개 + labelMap 19개 + 플로팅버튼 삼항 전체 / frontend/src/components/pro/ProBiddingDetail.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: QuoteDetailModal next-intl 연동 완료 (quoteModal 네임스페이스 18키) + labelMap 전체 영문 직변환 (~140개 키) / frontend/src/components/customer/QuoteDetailModal.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: ProProfileDetailModal next-intl 연동 완료 (proProfileModal 네임스페이스 20키) / frontend/src/components/customer/ProProfileDetailModal.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: DynamicRequestForm 전체 next-intl 연동 완료 — STEP 배열 70+개 영문 직변환(PART 1) + JSX UI t() 연동 22키 (requestForm 네임스페이스 22키) / frontend/src/components/customer/DynamicRequestForm.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: ChatRoom next-intl 연동 완료 (chatRoom 네임스페이스 25키) / frontend/src/components/common/ChatRoom.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: BrandSidePanel next-intl 연동 완료 (brandPanel 네임스페이스 7키) / frontend/src/components/common/BrandSidePanel.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: GlobalFooter next-intl 연동 완료 (footer 네임스페이스 3키) / frontend/src/components/common/GlobalFooter.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: CustomerQuotesClient 전체 next-intl 연동 완료 (customerQuotes 네임스페이스 73키) / frontend/src/app/quotes/received/CustomerQuotesClient.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: ProRequestListClient 전체 next-intl 연동 완료 (proRequestList 네임스페이스 36키) / frontend/src/app/pro/requests/ProRequestListClient.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: wallet 페이지 전체 next-intl 연동 완료 / frontend/src/app/pro/wallet/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] i18n: profile 페이지 전체 next-intl 연동 완료 (ProfilePage, ProfileHeader, CustomerProfile, CustomerSupportSection, ProProfile) / frontend/src/app/profile/page.tsx, frontend/messages/en.json, frontend/messages/ko.json / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 4개 추가 (수영 레슨 / 댄스·줌바 레슨 / 요리·베이킹 레슨 / 피아노·기타·보컬 레슨) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 2개 추가 (IELTS/OET/TOEFL 준비 / PRC 보드 시험 준비) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 3개 추가 (BPO/콜센터 취업 준비 / 가상 비서 실무 교육 / 프로그래밍/코딩 레슨) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 3개 추가 (외국인 대상 영어 회화 / 기초 타갈로그어/비사야어 레슨 / 비즈니스 영어 튜터링) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 4개 추가 (스냅 사진 및 영상 촬영 / 행사 진행자 섭외 / 라이브 밴드/DJ/가수 섭외 / 헤어 및 메이크업) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-15] 견적 요청 플로우 신규 서비스 전용 질문 3개 추가 (비디오케 및 사운드 시스템 대여 / 텐트/테이블/의자 대여 / 파티 소품/포토부스 대여) / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-13] 감사 로그 "관리자 지정/해제" 필터 탭 추가 (PROMOTE_ADMIN + REVOKE_ADMIN) / admin/page.tsx / DB변경 없음
[2026-03-13 / auth/complete 역할 충돌 감지 추가 — ADMIN 계열 예외, PRO·CUSTOMER 불일치 시 강제 로그아웃 및 에러 안내 / frontend/src/app/auth/complete/page.tsx 수정 / DB변경: 없음]
[2026-03-13 / auth/callback route.ts 교체 (/auth/complete 위임 방식) + auth/complete ADMIN_OPERATION·ADMIN_VIEWER 라우팅 보완 / frontend/src/app/auth/callback/route.ts, frontend/src/app/auth/complete/page.tsx 수정 / DB변경: 없음]
[2026-03-13 / 로그인 모달 이메일/비밀번호 폼·프로덕션 가드 제거 (소셜 로그인 전용 전환) / frontend/src/app/page.tsx 수정 / DB변경: 없음]
[2026-03-13 / middleware.ts isProRoute 버그 수정 (/pro → /pro/) — 고객의 /profile 접근 시 잘못된 리다이렉트 방지 / frontend/src/middleware.ts 수정 / DB변경: 없음]
[2026-03-13 / 대시보드 카드 중복 제거·레이블 명확화·배치 재정렬·문의 클릭 이동 추가 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음]
[2026-03-13 / 대시보드 미답변 1:1문의·신규 출금신청 카드 추가 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음]
[2026-03-13] 정지 해제 시 사유 입력 필수화 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음
[2026-03-13] 고수/고객 정지·해제 사유 입력 및 감사 로그 기록 버그 수정 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음
[2026-03-13] 고수/고객 관리 페이지 커스텀 모달 교체 / 고수·고객 관리 관련 admin 페이지 수정 / DB변경: 없음
[2026-03-13] ADMIN_OPERATION·ADMIN_VIEWER 로그인 후 /admin 리다이렉트 버그 수정 / frontend/src/app/page.tsx 수정 / DB변경: 없음
[2026-03-13] 관리자 승급/권한 회수 RPC 방식으로 교체 (auth.users JWT 동시 업데이트) / frontend/src/app/admin/page.tsx 수정 / DB변경: promote_admin, revoke_admin RPC 함수 신규 생성
[2026-03-13] 관리자 관리 탭 커스텀 모달 교체 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음
[2026-03-13] 관리자 승급 및 권한 회수 기능 구현 / frontend/src/app/admin/page.tsx 수정 / DB변경: 없음 (admin_action_logs INSERT, users role+status UPDATE)
[2026-03-13] 관리자 등급별(ADMIN/ADMIN_OPERATION/ADMIN_VIEWER) 사이드바 메뉴 접근제어 및 버튼 권한 분리 / 수정파일: frontend/src/app/admin/page.tsx, frontend/src/lib/adminAuth.ts(신규) / DB변경없음
[2026-03-12] 어드민 사이드바 전체 그룹 접이식(Accordion) 구조 전환 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 채팅 읽음 처리 RLS 정책 누락 수정 — chat_messages UPDATE 정책 추가 / 수정파일: 없음 (SQL만) / DB변경: chat_messages_update_read RLS 정책 생성 + mark_messages_as_read RPC 함수 생성
[2026-03-12] 채팅방 목록 UI 카카오톡 스타일 개선 / 수정파일: frontend/src/app/chat/page.tsx / DB변경없음
[2026-03-12] 지갑 충전 안내/완료 모달 (alert 교체) / 수정파일: frontend/src/app/pro/wallet/page.tsx / DB변경없음
[2026-03-12] 관리자 고객 상세 모달 내 캐시 내역 탭 비활성화 (운영정책) / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] ProfileHeader useToast 누락에 따른 ReferenceError 수정 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-12] 관리자 회원 정지 기능을 사유 입력 모달(suspendModal)로 교체 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 빠른 정지(toggleSuspend) 시 감사 로그 누락 버그 수정 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 뷰어 관리자 전용 개인정보 마스킹(가림 처리) 기능 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 등급별 권한/접근 제어(UI/메뉴 노출 제한) 적용 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 권한 승급 UI(검색/변경) 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 권한 승급 API 구현 (`/api/admin/promote`) / 수정파일: frontend/src/app/api/admin/promote/route.ts (신규) / DB변경없음
[2026-03-12] 미들웨어 관리자 접근 권한(ADMIN_OPERATION, ADMIN_VIEWER) 확장 / 수정파일: frontend/src/middleware.ts / DB변경없음
[2026-03-12] 관리자 감사 로그(Audit Log) 탭 UI/목록 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 주요 액션 감사 로그 추가 (충전/환불,출금,리뷰) / 수정파일: frontend/src/app/admin/page.tsx / DB추가점검요망(ENUM)
[2026-03-12] 관리자 고수/고객 관리 삭제 버튼 주석 처리 (운영정책) / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 대시보드 통계 카드 출금상태 연동 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 출금 관리 상태 필터 추가 및 승인/거절 UI 보강 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 관리자 출금 관리 탭 렌더링 위치 수정 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-12] 캐시 충전 금액 및 단위(₱) 수정 / 수정파일: frontend/src/app/pro/wallet/page.tsx / DB변경없음
[2026-03-11] 관리자 출금 관리 탭 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] 고수 지갑 출금 신청 폼 추가 / 수정파일: frontend/src/app/pro/wallet/page.tsx / DB변경없음
[2026-03-11] 캐시 시스템 메커니즘 스캔 및 리포트 작성 / 수정파일: CASH_SYSTEM_REPORT.md (신규) / DB변경없음
[2026-03-11] 고수 관리 탈퇴 필터 추가 + DELETED 버튼 비활성화 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] 탈퇴 nickname unique 제약 오류 수정 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-11] 탈퇴 처리 에러 핸들링 강화 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-11] DELETED 계정 로그인 사전 차단 / 수정파일: frontend/src/app/page.tsx / DB변경없음
[2026-03-11] DELETED 계정 탈퇴 배너 파라미터 추가 / 수정파일: frontend/src/middleware.ts / DB변경없음
[2026-03-11] 탈퇴 후 withdrawn 파라미터 전달 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-11] 프로필 alert → Toast 전환 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-11] 탈퇴 완료 안내 배너 추가 / 수정파일: frontend/src/app/page.tsx / DB변경없음
[2026-03-11] 탈퇴 완전 차단 (middleware DELETED 추가 + JWT 메타데이터 업데이트) / 수정파일: middleware.ts, profile/page.tsx / DB변경없음
[2026-03-11] 탈퇴 후 재로그인 차단 버그 수정 / 수정파일: frontend/src/app/profile/page.tsx / DB변경없음
[2026-03-11] 회원 탈퇴 기능 추가 (withdrawal_logs 보존 + 마스킹) / 수정파일: frontend/src/app/profile/page.tsx / withdrawal_logs 테이블 신규
[2026-03-11] admin_action_logs DELETE 타입 에러 수정 (neq UUID → gt 0) / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] DANGER ZONE FK 에러 수정 (admin_action_logs 선삭제) / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] DANGER ZONE 초기화에 inquiries 삭제 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] 관리자 팝업 답변이미지 표시 버그 수정 / 수정파일: frontend/src/app/admin/page.tsx / DB변경없음
[2026-03-11] 1:1 문의 상태전환버튼 추가 — 팝업 모달 하단에 접수대기/처리중/답변완료 상태 전환 버튼 추가, inquiryStatusUpdating 상태 및 handleUpdateInquiryStatus 함수 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-11] 1:1 문의 관리 개선 — 닉네임/이메일 검색창, 답변보기 버튼(resolved), 팝업 읽기전용 처리, 상태표시 개선(in_progress 포함) / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-11] 1:1 문의 추가 기능 — 관리자 답변 이미지 첨부(최대 5장, imageOptimizer/webp), 고객 하루 10건 제한, 고객 내역에서 답변 이미지 표시 / 수정파일: frontend/src/app/admin/page.tsx, frontend/src/app/support/inquiry/page.tsx / DB변경점: inquiries.admin_reply_images TEXT[] 컬럼 추가(완료)
[2026-03-11] 알림 클릭 라우팅 추가 — 1:1 문의 답변 알림 클릭 시 /support/inquiry?tab=history 이동, inquiry 페이지 tab 파라미터 초기값 처리 / 수정파일: frontend/src/app/notifications/page.tsx, frontend/src/app/support/inquiry/page.tsx / DB변경점: 없음
[2026-03-11] 관리자 1:1 문의 버그 수정 완료 — loadInquiries JOIN 제거(별도 조회 병합), 답변 저장 alert→showToast 교체 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-11] 1:1 문의 기능 개선 — 이미지 첨부 5장(imageOptimizer/webp/quote_images 버킷), 406 에러 수정(.maybeSingle), 관리자 답변 시 작성자 알림 발송, 관리자 모달 첨부 이미지 표시 / 수정파일: frontend/src/app/support/inquiry/page.tsx, frontend/src/app/admin/page.tsx / DB변경점: inquiries.image_urls TEXT[] 컬럼 추가(완료)
[2026-03-11] reports 조회 406 에러 수정 — .single() → .maybeSingle() 교체 (신고내역 0건 케이스 정상 처리) / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-11] 스크롤 useEffect isInitialLoad 빈 배열 소비 버그 방어 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-11] 채팅 메시지 커서 기반 페이지네이션 구현 — 최초 30개 로드, 위로 스크롤 시 추가 로드, 읽음 처리 분리, 스크롤 위치 유지 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-11] confirm_match → confirm_match_and_close_others RPC 교체 — 고아 채팅방 CLOSED 처리 누락 해소, 프론트 비원자적 트랜잭션 3건 제거 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-10] 고수 요청 리스트 고객 이름/아바타 미표시 버그 수정 — else 분기에 고객 맵 구성 로직 추가 / 수정파일: frontend/src/app/pro/requests/ProRequestListClient.tsx / DB변경점: 없음
[2026-03-10] MATCH_SUCCESS 알림 클릭 라우팅 수정 — /pro/requests/[id] → chat_rooms 조회 후 채팅방 이동 / 수정파일: frontend/src/app/notifications/page.tsx / DB변경점: 없음
[2026-03-10] 확정 시스템 메시지 문구 중립화 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-10] 서비스 확정 완료 alert() → 커스텀 성공 모달 교체 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-10] 서비스 확정 confirm() 팝업 → 커스텀 모달 교체 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-10] 견적 발송 가격 제약 에러 메시지 한국어화 — chk_price_max 위반 시 토스트 안내 추가 / 수정파일: frontend/src/components/pro/ProBiddingDetail.tsx / DB변경점: 없음
[2026-03-10] 받은견적 GNB 배지 즉시 미소멸 버그 수정 — quotes-read 이벤트 발송을 RPC 완료 후로 이동 / 수정파일: frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경점: 없음
[2026-03-10] 새 견적 확인하기 미변경 버그 수정 — match_requests Realtime UPDATE 전체 리패치 제거, 부분 state 업데이트로 교체 / 수정파일: frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경점: 없음
[2026-03-10] 채팅방 실시간 제재 미반영 버그 수정 — UPDATE 구독 3개 제거(chat_rooms/users/reports), SYSTEM_CLOSE/SYSTEM_REVIEWED INSERT 기반 감지 전환 / 수정파일: frontend/src/app/admin/page.tsx, frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
[2026-03-10] 신고 탭 제재 모달 state 완전 분리 — reportSuspendModal/reportSuspendReason 추가, handleSuspend 내부 전면 교체, 사용자 탭 suspendModal 무결성 확인 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-10] 신고 관리 탭 빌드 에러 수정 — 중복 state(suspendModal, suspendReason) 제거 및 기존 타입 재사용 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-10] 관리자 신고 관리 탭(reports) 추가 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
[2026-03-10] 채팅방 신고 기능 + 관리자 3단계 제재 추가 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx, frontend/src/app/admin/AdminDashboard.tsx, frontend/src/components/common/ChatRoom.tsx / DB변경점: 없음 (reports 테이블, users.suspended_until, users.suspension_type 컬럼은 기존 DB 준비 완료 상태)
