[2026-03-31] 환불정책 CMS 경로 불일치 버그 수정 — admin legal_documents 드롭다운에 REFUND 옵션 추가, 목록 라벨에 "Refund Policy" 케이스 추가 / frontend/src/app/admin/page.tsx / DB변경 없음 (데이터 마이그레이션은 디렉터 직접 실행 필요)
[2026-03-31] 모달 하단 네비 위 가두기 — CustomerQuotesClient 3개 모달(리뷰/My Request/취소확인) max-h-[90vh|80vh] → max-h-[calc(100vh-72px)], ProProfileDetailModal overlay pb-[72px] 추가 + 내부박스 max-h-[calc(100vh-72px)] / CustomerQuotesClient.tsx, ProProfileDetailModal.tsx / DB변경 없음
[2026-03-31] /quotes/received "My Request" 모달 Close 버튼 항상 노출 — 외부 div overflow-y-auto 제거, flex flex-col 구조로 변경, 본문만 flex-1 overflow-y-auto, 헤더·푸터 flex-none 고정 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-31] /request 페이지 Stitch Sapphire 디자인 적용 — 헤더(Manrope/ambient-shadow/h-16), depth1 카드(w-14 아이콘/Sapphire shadow/그룹호버), Pro Verification 배너 추가, #D32D7D→#0020a0 전체 교체 / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-31] Chat Room 헤더 아이콘 버튼 압축 — "Quote/Request Details" 텍스트 제거, 32×32 description/priority_high 아이콘 버튼으로 교체, gap-[6px], 클릭 이벤트 유지 / frontend/src/app/chat/[room_id]/page.tsx / DB변경 없음
[2026-03-31] /chat 페이지 Stitch Sapphire Ledger 디자인 적용 — fixed 헤더(Manrope/햄버거/wallet/notifications), 검색바(animated underline), 채팅 카드(ambient-shadow/ring/uppercase badge), FAB(add_comment) 추가 / frontend/src/app/chat/page.tsx, messages/en.json, messages/ko.json / DB변경 없음
[2026-03-31] Quote Details 모달 날짜/시간 영어 형식 변환 — toLocaleString([]→"en-US") + year 추가 + hour12:true → "Mar 30, 2026, 10:52 PM" / frontend/src/components/customer/QuoteDetailModal.tsx / DB변경 없음
[2026-03-31] Quote Details 모달 레이아웃 개선 — PROPOSED AMOUNT 섹션 p-5→py-3 px-5 패딩 축소; 하단 sticky 노란 CTA 버튼 바 완전 제거 / frontend/src/components/customer/QuoteDetailModal.tsx / DB변경 없음
[2026-03-31] /quotes/received 한글 텍스트·날짜/시간 영어 형식 변환 — "전문가"→"Pro", {proName}님→{proName} ×2, toLocaleDateString→en-US short ×2, toLocaleTimeString→en-US hour12:true ×1 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-31] /quotes/received 카드 Closes in 텍스트 누락 수정 — 하드코딩 ⏱ 를 t("customerQuotes.timeLeft")로 교체 (EN: "⏳ Closes in ", KO: "⏳ 마감까지 "); 계산 로직 변경 없음 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-31] /quotes/received 카드 마감시간 위치 개선 — "Closes in Xh Ym"을 날짜 행 grid에서 제거하고 배지(Recruiting Quotes) 바로 아래로 이동; 배지 래퍼를 flex-col div로 변경, isExpired 조건으로 만료 시 미표시 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-31] /quotes/received 페이지 Stitch "Requests & Quotes (Sapphire Ledger)" 디자인 적용 — bg-[#f7f9fc]; 탭 pill→underline 네비; 카드 shadow-[0_32px_32px_rgba(0,15,93,0.06)]+border-[#c5c5d6]/10; ID 레이블(#로 시작); status badge bg-[#c2c9fe]/[#ffdad3]/[#e0e3e6]+Material Symbols 아이콘; info 그리드(location_on/groups/calendar_today/schedule); ViewMyRequest 버튼 primary CTA(bg-[#0020a0]); quote count bar 제거; 고수 배지 Stitch 색상; ACCEPTED 뱃지 handshake 아이콘; Discovery Banner(indigo-900); i18n bannerTitle/bannerDesc 추가; 비즈니스 로직 전량 보존 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx, messages/en.json, messages/ko.json / DB변경 없음
[2026-03-31] /support/inquiry 스크롤바 숨김 처리 — 페이지 마운트 시 <style> 주입(scrollbar-width:none / ::-webkit-scrollbar display:none), 언마운트 시 제거 → 다른 페이지 영향 없음 / frontend/src/app/support/inquiry/page.tsx / DB변경 없음
[2026-03-31] /support/inquiry 히어로 SVG 아이콘 재정비 — support_agent 배지(absolute 파란 사각형) 삭제; SVG 파란 body ellipse 제거; 마이크 끝 파란점(circle fill=#0020a0) 제거; 얼굴 y좌표 상향 조정으로 헤드셋 캐릭터 비율 개선 / frontend/src/app/support/inquiry/page.tsx / DB변경 없음
[2026-03-31] /support/inquiry 피드백 UI 보정 — 히어로 이미지 실사진→인라인 SVG 헤드셋 캐릭터; 인풋 underline→전체 border(border-[#c5c5d6] rounded-lg); Attach Photos 레이블 텍스트 크기 통일(11px); Add버튼 grid-cols-4+gap-3, 레이블 "Add"로 단순화 / frontend/src/app/support/inquiry/page.tsx / DB변경 없음
[2026-03-31] /support/inquiry 페이지 Stitch "1:1 Support Redesign" 사파이어 테마 적용 — 배경 bg-[#f7f9fc]; 헤더 glass-header(backdrop-blur); 탭 pill→underline(active-pill after 바); 폼 인풋 박스형→언더라인형(bg-[#f2f4f7] border-b-2 rounded-t-lg); 레이블 uppercase tracking-widest; 히어로 이미지 border-4+support_agent 배지; 제출버튼 bg-[#0020a0] rounded-xl; admin reply 박스 사파이어 tint; 색상 전체 핑크→사파이어(#001269/#0020a0); 비즈니스 로직 전량 보존 / frontend/src/app/support/inquiry/page.tsx / DB변경 없음
[2026-03-31] Pro Requests "Quote already sent" 배지 이모지 제거 및 SVG 체크 아이콘 교체 — <span>✅</span> → inline SVG(checkmark); i18n en.json/ko.json proRequestList.alreadySent 이모지 제거 / frontend/src/app/pro/requests/ProRequestListClient.tsx, messages/en.json, messages/ko.json / DB변경 없음
[2026-03-31] /profile 페이지 Stitch "Profile & Support (Added Services)" 라이트 테마 적용 — ProfileHeader(editorial-shadow 카드, 아바타 링, 세팅 패널 bottom-border 인풋), CustomerProfile(divide 리스트, 전화번호 인풋, 리뷰 링크), ProProfile(toggle+뱃지+바텀보더인풋+서비스칩+저장버튼), CustomerSupportSection(no-border shadow 카드, 아이콘 no-circle, slate-50 hover, Sapphire 셰브론), CUSTOMER/PRO 경로 헤더+배경+Invite Banner+로그아웃/탈퇴/법적 링크; 비즈니스 로직 전량 보존 / frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-31] /notifications 페이지 Stitch "Notifications Redesign (Sapphire Ledger)" 라이트 테마 적용 — bg-white→bg-[#f7f9fc]; 헤더 slate-200/50+shadow-sm; 빈 상태 rounded-3xl gradient 벨 아이콘(#0020a0→#001269)+스켈레톤 미리보기+새로고침 버튼; 알림 카드 border-[#c5c5d6]/bg-white(읽음), bg-[#001269]/5(안읽음); 배경 그라디언트 장식 2개; i18n refresh 키 추가; 비즈니스 로직 전량 보존 / frontend/src/app/notifications/page.tsx, messages/en.json, messages/ko.json / DB변경 없음
[2026-03-31] /pro/wallet Referral Banner 아이콘 SVG 교체 — Material Symbols text-[160px] 미적용 문제 → inline SVG 140×140 gift 아이콘으로 교체, opacity-20 우측 중앙 고정 / frontend/src/app/pro/wallet/page.tsx / DB변경 없음
[2026-03-31] /pro/wallet 디자인 2차 미세조정 — Top-up 버튼 SVG 아이콘(add_circle filled)+max-w-[300px] 폭 제한; Referral Banner redeem 아이콘 w-32→w-48/text-96→text-160 대폭 확대+수직 중앙 정렬; 루트 div font-body(Manrope) 추가로 전체 폰트 통일 / frontend/src/app/pro/wallet/page.tsx / DB변경 없음
[2026-03-30] /pro/wallet 이미지 피드백 반영 — 폰트 font-headline 적용; Credits 글자 크기 통일(text-5xl); Top-up 버튼 add_circle 아이콘 추가; Credit Summary 섹션 Referral Banner 위로 이동; ledgerTitle "Credit History"→"History"; 날짜 en-US 영어 표기; Referral Banner redeem 아이콘+Send Invite 버튼 추가 / frontend/src/app/pro/wallet/page.tsx, messages/en.json / DB변경 없음
[2026-03-30] /pro/wallet Stitch "Credit Management (Fixed Filters)" 라이트 테마 적용 — bg-white→bg-[#f7f9fc]; Hero CTA 그라디언트→솔리드 #0020A0; 보너스 뱃지 c2c9fe/20; Referral Banner bg-[#c2c9fe]/30+아이콘 #0020A0; Credit Summary bento 2-col 그리드(shadow ambient-lift); 필터 rounded-full→rounded-lg 개별 버튼; 거래 아이템 indigo-50 아이콘 bg+border; 모달 그라디언트→솔리드; 비즈니스 로직 전량 보존 / frontend/src/app/pro/wallet/page.tsx / DB변경 없음
[2026-03-29] /referral 페이지 Stitch Dark Pulse 전면 적용 — light(bg-gray-50/white) → Dark Pulse 테마; 추천코드 히어로(gradient glow 카드, 핑크+Copy/Share 버튼), 보상 벤토 그리드(pink border-l, total/pending), 추천 리스트(다크 카드), 쿠폰 티켓(notch 이펙트), 쿠폰 등록(PRO), 배너(horizontal scroll), How It Works 아코디언, 법적 고지 다크화; 비즈니스 로직 전량 보존 / frontend/src/app/referral/page.tsx / DB변경 없음
[2026-03-29] /pro/wallet 페이지 Stitch Dark Pulse 전면 적용 — light(bg-gray-50/white) → Dark Pulse 테마; Balance Hero(핑크 gradient 버튼), Referral Bento 카드(보라 glow), 요약 카드(horizontal scroll, green/red border-l), 히스토리 아이템(아이콘 원형+dark bg), 필터 탭(pill), 모달 전체 다크화; 비즈니스 로직 전량 보존; 상단/하단 네비 ClientLayout 유지 / frontend/src/app/pro/wallet/page.tsx / DB변경 없음
[2026-03-29] 지갑 아이콘 active 색상 제거 — PC(PCTopNav) + 모바일(ClientLayout) 지갑 아이콘 active 색상 구분 없애고 벨 아이콘과 동일한 기본색(white/50, white/70)으로 통일 / frontend/src/components/common/PCTopNav.tsx, frontend/src/app/ClientLayout.tsx / DB변경 없음
[2026-03-29] ClientLayout 모바일 헤더 지갑 아이콘 추가 — 알림 벨 왼쪽에 account_balance_wallet 버튼 삽입(isProUser 조건, 아이콘 전용); /pro/wallet 라우팅; currentPath 기반 active 상태(text-[#ff88b5]+FILL 1); aria-label pcTopNav.wallet 활용 / frontend/src/app/ClientLayout.tsx / DB변경 없음
[2026-03-29] PCTopNav 지갑·알림 아이콘 라벨 추가 — 아이콘 단독→flex(아이콘+라벨) 패턴 통일; active 상태 text-[#ff88b5]+FILL 1 적용; 알림은 unreadCount>0일 때도 FILL 1; i18n 수정 없음 / frontend/src/components/common/PCTopNav.tsx / DB변경 없음
[2026-03-29] PCTopNav 지갑 아이콘 추가 — 알림 아이콘 왼쪽에 account_balance_wallet 버튼 삽입(PRO 전용, navState.isProUser 조건); /pro/wallet 라우팅; pcTopNav.wallet aria-label 활용; i18n 추가 없음(키 기존 존재) / frontend/src/components/common/PCTopNav.tsx / DB변경 없음
[2026-03-29] Archive 배너 Stitch 디자인 반영 — 단순 텍스트→lightbulb material icon + 왼쪽 핑크 accent border(border-l 3px #ff6ea9) + dark glass 카드 구조로 교체; archiveBanner i18n 이모지 제거(en/ko) / frontend/src/app/pro/requests/ProRequestListClient.tsx, messages/en.json, ko.json / DB변경 없음
[2026-03-29] Archive empty state Stitch 디자인 반영 — inventory_2 아이콘+glass card(#ff6ea9 glow)+noArchived 제목+noArchivedSubtext 서브텍스트 구조로 교체; noArchivedSubtext i18n 키 추가(en/ko) / frontend/src/app/pro/requests/ProRequestListClient.tsx, messages/en.json, ko.json / DB변경 없음
[2026-03-29] ProRequestListClient Stitch Dark Pulse 테마 전면 적용 — bg-[#0f0d13] 배경, pill 토글(#211e26 wrapper/#ff88b5 active), glass-panel 카드(backdrop-blur+border-white/10), 빈 상태(assignment_late 아이콘 -rotate-6+장식 glow+bolt/history 부동카드+Refresh Feed 버튼), 상태 배지/버튼 다크 팔레트 전환; emptyTitle/emptySubtext/refreshFeed i18n 키 추가 / frontend/src/app/pro/requests/ProRequestListClient.tsx, messages/en.json, ko.json / DB변경 없음
[2026-03-29] CustomerQuotesClient empty state 아이콘 확대 — 원형 w-20→w-28/opacity 30→40, 내부박스 w-14→w-20+shadow-lg, SVG 28→48px/strokeWidth 1.5→1.2/opacity 0.5→0.7, 점선 패턴→긴 가로줄 2개(M9 12h6,M9 16h6) / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-29] CustomerQuotesClient empty state 최종 확정 — 아이콘 구조(w-14 h-14 내부, 28px SVG, opacity 0.5) 교체; CTA 버튼 ⊕ 아이콘+createNewRequest i18n 키 적용; en/ko.json에 createNewRequest 키 추가; tsc 컴파일 에러 없음 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx, frontend/messages/en.json, ko.json / DB변경 없음
[2026-03-29] lucide-react 미설치 hotfix — ClipboardList import 제거 → 인라인 SVG 교체 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음
[2026-03-29] CustomerQuotesClient IN_PROGRESS empty state 리디자인 — ClipboardList 아이콘+헤딩+서브텍스트+CTA버튼+텍스트링크 구조로 교체; i18n 키 2개 추가(noActiveRequests, browseProfessionals); 외부컨테이너 p-4→p-6 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx, frontend/messages/en.json, ko.json / DB변경 없음
[2026-03-29] CustomerQuotesClient 다크 에디토리얼 UI 전면 적용 — Stitch 디자인(#0f0d13/#ff88b5/#a68cff/#b5ffc2) 팔레트로 전체 UI 교체; 탭바·카드·빈 상태·뱃지·버튼·3개 모달(리뷰/요청보기/취소확인) 다크화; page.tsx 배경도 bg-[#0f0d13]로 통일; 비즈니스 로직 전량 보존 / frontend/src/app/quotes/received/CustomerQuotesClient.tsx, page.tsx / DB변경 없음
[2026-03-28] ClientLayout 로그인 내부 페이지 전체 다크 배경 적용 — isInternalPage(!!userId&&!isAdminPage&&!isLandingPage) 조건 추가; rootContainerClasses+rightPanelClasses bg-white→bg-[#0f0d13] 조건부 전환; 랜딩/어드민 무영향 / frontend/src/app/ClientLayout.tsx / DB변경 없음
[2026-03-28] Profile 페이지 화살표 크기 통일 + PRO 배경 + 카드 너비 통일 — 1:1 Support ›(text-sm)→chevron_right material-symbols text-[20px]; PRO main bg-[#0f0d13] 추가; ProfileHeader/CustomerProfile/ProProfile/CustomerSupportSection 호출부 px-4 래퍼 추가(Invite&Earn과 동일 너비) / frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-28] Profile 페이지 PC 배경 다크 통일 + View History 제거 — CUSTOMER+PRO main에 bg-[#0f0d13] 추가(ClientLayout bg-white 오버라이드), 1:1 Support inquiryHistory span 완전 제거(›만 유지) / frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-28] Profile 페이지 CustomerSupport+하단 레이아웃 리디자인 — CustomerSupportSection: 드롭다운▼→아이콘(bg원형)+텍스트+›화살표 방식, getCatIcon 매핑 함수 추가, 펼침로직 보존; Invite & Earn: Send Invite 버튼(#ff88b5) 추가+설명 텍스트 변경; 순서변경: Invite&Earn→로그아웃|탈퇴(가로flex)→법적링크; CUSTOMER+PRO 동일 적용 / frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-28] Profile 페이지 Stitch 다크 테마 전면 적용 — CUSTOMER+PRO 공통: bg-[#0f0d13] 배경, #ff88b5/#a68cff/#b5ffc2 팔레트, 섹션헤더 uppercase pink, Invite & Earn 그라디언트 배너, ProfileHeader/CustomerProfile/ProProfile/CustomerSupportSection 컴포넌트 전체 다크화, 비즈니스 로직 100% 보존 / frontend/src/app/profile/page.tsx / DB변경 없음
[2026-03-28] 모바일 알림 헤더 + 홈 네비 + 로그인 상태 헤더 수정 — pcTopNav.home 번역키 추가(en/ko), NavStateContext에 isLoggedIn 추가, ClientLayout에 모바일 sticky 헤더(알림벨+언어전환) 추가, 로그인 시 홈(/) 하단 네비 표시, PCTopNav 랜딩 로그인 시 표시, page.tsx 로그인 시 랜딩 헤더 숨김+pt-20 제거 / en.json, ko.json, NavStateContext.tsx, ClientLayout.tsx, page.tsx / DB변경 없음
[2026-03-28] 하단 nav 6→4 축소 + PC 상단 알림 아이콘 + Profile Invite & Earn 항목 추가 — customerNav/proNav 4개로 축소(Home 추가, Request/Invite/Notifications/Wallet 제거), PCTopNav 4탭+notifications 벨 아이콘, profile/page.tsx CUSTOMER+PRO 섹션에 Invite & Earn → /referral 링크 카드 추가 / ClientLayout.tsx, PCTopNav.tsx, profile/page.tsx / DB변경 없음
[2026-03-28] /request 헤더 요소 삭제 + 카테고리 카드 독립 카드화 — ← 뒤로가기 버튼·HiddenPro 배지·Hidden AI 라벨(history+active 모두) 삭제, depth1 외부 컨테이너 제거, 각 카드 bg-[#211e26] rounded-xl border-white/10 독립 카드로 전환, gap-3 / DynamicRequestForm.tsx / DB변경 없음
[2026-03-28] /request 히어로 타이틀 스타일 + 카드 desc 업데이트 — depth1 질문 텍스트를 text-2xl/3xl bold 중앙정렬로 교체, 서브텍스트 추가, Moving & Cleaning / 이사/청소 desc → "Residential, commercial, and specialty cleaning" / DynamicRequestForm.tsx / DB변경 없음
[2026-03-28] PC 상단 네비게이션 이모지 → Material Symbols Outlined 교체 — customerItems/proItems icon 필드를 symbol 필드로 전환, 아이콘 렌더링을 material-symbols-outlined span으로 교체, active FILL 1/inactive FILL 0 적용 / PCTopNav.tsx / DB변경 없음
[2026-03-28] PC 상단 네비게이션 Stitch 다크 테마 통일 — bg-[#0f0d13] border-white/10, active text-[#ff88b5], inactive text-white/50, 뱃지 border 다크화 / PCTopNav.tsx / DB변경 없음
[2026-03-28] /request 카테고리 카드 영어 모드 아이콘+설명 미반영 수정 — DEPTH1_STITCH에 영어 키 6개 추가(Moving & Cleaning 등), 한국어 동작 보존 / DynamicRequestForm.tsx / DB변경 없음
[2026-03-28] /request 카테고리 카드 desc 수정 + 하단 nav Stitch 다크 스타일 적용 — 이사/청소 desc 교체, NAV_ICONS 맵 추가(Material Symbols), nav bg-[#1a1721] border-white/10, active text-[#ff88b5], inactive text-white/50, 뱃지 border 다크화 / DynamicRequestForm.tsx, ClientLayout.tsx / DB변경 없음
[2026-03-28] 전체 내부 페이지 BrandSidePanel 및 max-w-4xl 너비 제약 포괄 제거 — BrandSidePanel 완전 미렌더(import 제거), main 태그 max-w-4xl mx-auto 삭제, lg:overflow-y-auto custom-scrollbar는 유지 / frontend/src/app/ClientLayout.tsx / DB변경 없음
[2026-03-28] /request 페이지 좌측 사이드바 제거 및 폼 전체 너비 확장 — ClientLayout.tsx에서 isRequestForm 조건 추가: BrandSidePanel 비렌더, max-w-4xl 제약 제거 / frontend/src/app/ClientLayout.tsx / DB변경 없음
[2026-03-28] /request 페이지 Stitch 다크 디자인 적용 — DynamicRequestForm.tsx UI 레이어 전면 교체(비즈니스 로직 보존), depth1 카테고리 카드 UI, bg-[#0f0d13] 다크테마, #a68cff primary, #ff88b5 submit, 전화번호 모달 다크화 / frontend/src/components/customer/DynamicRequestForm.tsx / DB변경 없음
[2026-03-28] 서비스 카드 구조 변경 — 카드 내부 순서 [아이콘→제목→설명→태그]로 재배치, 하단 화살표 링크 삭제, 설명 text-sm text-gray-400 전문 표시 / frontend/src/app/page.tsx / DB변경 없음
[2026-03-28] 서비스 섹션 텍스트·링크 수정 — 섹션 타이틀/서브타이틀 하드코딩, "View All Services →" 링크 추가, categoryStitchUI에 title+desc 필드 추가하여 카드 6개 영문 하드코딩 / frontend/src/app/page.tsx / DB변경 없음
[2026-03-28] 히어로 섹션 텍스트·레이아웃 수정 — 타이틀 하드코딩("HiddenPro: Your Trusted Home Service"), 서브텍스트 교체, searchBtn 삭제, 전폭 CTA 버튼 추가("Get a Free Quote in 1 Minute"), 아바타 통계 "12k+ professionals active this week" 변경 / frontend/src/app/page.tsx / DB변경 없음
[2026-03-28] 메인 홈 화면 Stitch 디자인 교체 완료 — JSX return 블록 전체 교체 (비즈니스 로직 100% 보존), 섹션: Header/Hero/Explore Services/Live Reviews/HiddenPro Difference/Join as a Pro/Footer, Stitch 다크테마 색상+폰트+Material Symbols 적용 / frontend/src/app/page.tsx, tailwind.config.ts, layout.tsx, public/images/ / DB변경 없음
[System Core Prerequisite: 비파괴적 확장 및 회귀 방지]

# HiddenPro - CLAUDE Task History

이 문서는 AI 세션의 토큰 절약을 위해 완료된 작업 내역을 분리 보관하는 로그 저장소입니다. 전체 작업 히스토리 파악이 필수적인 경우에만 열람합니다. 가장 최근 작업이 상단에 오도록 1줄씩 누적 기록합니다.

2026-03-09 / backup_db.js 개선: SERVICE_ROLE_KEY 교체(RLS 우회), 타임스탬프 폴더 자동생성, restore.sql 생성(즉시 롤백 가능), env_backup + source_code_backup.zip(node_modules 제외) 포함 / scripts/backup_db.js, scripts/backup_db_legacy.js 신규 생성 / DB변경 없음

2026-03-09 / reset_test_transaction_data RPC SECURITY DEFINER + OWNER TO postgres 재정의, WHERE 1=1 추가(Supabase DELETE 정책 대응) / supabase/migrations/20260309000003_fix_reset_test_transaction_data_security_invoker.sql 업데이트 / DB변경: reset_test_transaction_data 함수 재정의

| 2026-03-09 | backup_db.js 개선 — SERVICE_ROLE_KEY 사용, 타임스탬프 폴더 자동생성, restore.sql(BEGIN/COMMIT 트랜잭션 포함) + env_backup + source_code_backup.zip 동시 생성 | scripts/backup_db.js (신규), scripts/backup_db_legacy.js (기존 db_backup.js 보존) | DB변경없음 |

2026-03-09 / 에러 토스트 표시 시간 연장: type=error 시 10초, 그 외 3초 유지 (duration 조건 분기) / src/components/ui/Toast.tsx / DB변경 없음

2026-03-09 / reset_test_transaction_data SECURITY INVOKER 재정의: SECURITY DEFINER 시 auth.uid() NULL 반환 버그 수정 / supabase/migrations/20260309000003_fix_reset_test_transaction_data_security_invoker.sql / DB변경: RPC 재정의

2026-03-09 / chat/[room_id]/page.tsx handleMatchConfirm → confirm_match RPC 교체: match_requests/match_quotes 직접 UPDATE 제거, RLS 우회 RPC 1호출로 대체 / src/app/chat/[room_id]/page.tsx / DB변경 없음

2026-03-09 / ChatRoom.tsx 매칭 확정 DB 연동: confirm_match RPC 호출 추가, currentUserId state, request.status→setStatus 반영 / src/components/common/ChatRoom.tsx / DB변경 없음

2026-03-09 / 확정 후 미확정 고수 카드 축소 표시: MATCHED+미선택 고수는 이름+"미선택" 태그만 렌더, 클릭/프로필/버튼 전부 차단 (early return 패턴) / src/app/quotes/received/CustomerQuotesClient.tsx / DB변경 없음

2026-03-09 / 중복 확정 버그 실근본 수정: Realtime 구독에 match_requests UPDATE 이벤트 추가하여 데이터 실시간 동기화 (CustomerQuotesClient 리패치 트리거 + 채팅 requestData 즉각 갱신) / src/app/quotes/received/CustomerQuotesClient.tsx, src/app/chat/[room_id]/page.tsx / DB변경 없음

2026-03-09 / 중복 서비스 확정 버그 수정: MATCHED 요청건의 미확정 고수 카드 버튼 비활성화(CustomerQuotesClient.tsx), 채팅방 확정 버튼 requestData.status 체크 추가(chat/[room_id]/page.tsx) / src/app/quotes/received/CustomerQuotesClient.tsx, src/app/chat/[room_id]/page.tsx / DB변경 없음

2026-03-09 / profile/page.tsx getUser 실패 시 세션 복구 재시도 로직 추가: refreshSession 후 1회 재시도, 최종 실패 시 메인으로 이동 / src/app/profile/page.tsx / DB변경 없음

2026-03-09 / 로그인 후 쿠키 동기화 타이밍 버그 수정: refreshSession() 후 500ms 대기 추가로 createBrowserClient 쿠키 갱신 완료 보장 (기존유저/최종 라우팅 전 2곳) / src/app/page.tsx / DB변경 없음

2026-03-09 / profile/page.tsx 세션 처리 코드 레벨 검증: createBrowserClient + getUser() 이미 정상 사용 중 확인, 수정 불필요 판정 / 수정 파일 없음 / DB변경 없음

2026-03-09 / 이메일 회원가입 시 역할 메타데이터 누락 수정: signUp options.data.role 주입으로 on_auth_user_sync 트리거 정상 동작 보장 / src/app/page.tsx / DB변경 없음

2026-03-09 / PRO 가입 시 pro_profiles INSERT 실패 수정: 3회 재시도 + refreshSession 로직 추가 / src/app/auth/complete/page.tsx / DB변경 없음

2026-03-09 / DEDUCT_BONUS_QUOTE ENUM 마이그레이션 파일 영속화 (20260309000002) / supabase/migrations/20260309000002_add_deduct_bonus_quote_enum.sql 생성 / DB변경 없음
2026-03-09 / CLAUDE.md PHASE 6 추가: 고난이도 작업 시 Opus 모델 에스컬레이션 규칙 / CLAUDE.md / DB변경 없음

2026-03-09 / send_quote_and_deduct_cash RPC 보너스 캐시 우선 차감 로직 구현 + 검증 스크립트 생성 / supabase/migrations/20260309000001_fix_send_quote_bonus_priority.sql, scripts/test_bonus_priority.ts / DB변경: send_quote_and_deduct_cash 함수 재정의 (bonus_cash 우선 차감, DEDUCT_BONUS_QUOTE tx_type 신규 추가)

2026-03-09 / CS 관제탑 견적 첨부 이미지 엑박 수정: image_url JSON 배열 파싱 처리 (ProBiddingDetail과 동일 방식 적용) / frontend/src/app/admin/page.tsx / DB변경 없음

2026-03-09 / CS 관제탑 견적 카드에 첨부 이미지 썸네일 추가 (image_url 존재 시 80x80 표시, 클릭 시 새 탭) / frontend/src/app/admin/page.tsx / DB변경 없음

2026-03-09 / 캐시내역 탭 ref UUID 노출 제거 (모달 렌더링 JSX 3줄 삭제) / frontend/src/app/admin/page.tsx / DB변경 없음

2026-03-09 / 캐시내역 탭 버그 2건 수정: 모달 select 'id' 컬럼 오류→'\*' 교체(내역 미표시 수정), txDesc 헬퍼 추가 및 3곳 description 폴백 적용 / frontend/src/app/admin/page.tsx / DB변경 없음

2026-03-09 / 고수 상세보기 모달 캐시내역 탭 reference_id 표시 + 20건 페이지네이션 "더 보기" 추가 / frontend/src/app/admin/page.tsx / DB변경 없음

2026-03-09 / send_quote_and_deduct_cash RPC v_max_quotes 하드코딩 버그 수정 → platform_settings 동적 조회로 변경 / supabase/migrations/20260309000000_fix_send_quote_dynamic_max.sql, database/rpc_send_quote.sql, frontend/database/rpc_send_quote.sql / DB변경: send_quote_and_deduct_cash 함수 재정의
2026-03-09 / 최대 견적 수신 수 동적 설정 검증 테스트 스크립트 생성 / scripts/test_max_quotes.ts / DB변경 없음

2026-03-09 / CLAUDE.md에 PHASE 5 테스트 자동화 규칙 추가 / CLAUDE.md / DB변경 없음

2026-03-09 / 선착순 5명 동시성 방어 자동 테스트 스크립트 신규 생성 (RPC 10개 동시 호출 → DB COUNT 검증 → 자동 정리) / scripts/test_concurrency.ts / DB변경 없음

2026-03-09 / CS 관제탑 견적 카드 "💬 채팅보기" 버튼 추가 + 채팅 팝업 모달 구현, 인라인 채팅 섹션 JSX 제거 / admin/page.tsx / DB변경 없음

2026-03-09 / CS 관제탑 상세 페이지 "💬 채팅 내역" 섹션 추가 — lazy fetch(30건)+더보기, users JOIN(N+1방지) / admin/page.tsx / DB변경 없음

2026-03-09 / 채팅방 헤더 room UUID 노출 제거 — `room: {params.room_id.slice(0,8)}...` 렌더링 라인 삭제 / chat/[room_id]/page.tsx / DB변경 없음

2026-03-09 / 고수 전화번호 미표시 버그 수정 — loadUserDetail·handleOpenProDetail 양쪽에 pro_profiles.phone fallback 추가 / admin/page.tsx / DB변경 없음
2026-03-09 / 견적·매칭 페이지 고수 상세보기 모달 4탭(기본정보/캐시내역/견적/리뷰) 업그레이드, lazy fetch + 탭 캐시 적용 / admin/page.tsx / DB변경 없음

- [2026-03-08 / 고객 받은견적 리스트 3단계 동적 정렬 로직 (미읽음>견적있음>최신순) 적용 / CustomerQuotesClient.tsx / DB 변경없음]
- [2026-03-08 / [핫픽스] 견적/매칭 탭 500 에러 해결 (answers 컬럼명 오타 수정) / admin/page.tsx / DB 변경없음]
- [2026-03-08 / 관리자 견적 상세 관리 페이지 UI 개선 및 상세답변 렌더링 추가 / admin/page.tsx / DB 변경없음]
- [2026-03-08 / 견적 요청 버튼 중복 제출 방지 로직 적용 / DynamicRequestForm.tsx / DB 변경없음]
- [2026-03-08 / DB 전체 자동 백업 스크립트 작성 및 실행 완료 / scripts/backup_db.ts 생성 / Service Role Key 누락으로 일부 테이블(users, pro_profiles) RLS 차단 발생]
- [2026-03-08 / 최신화된 전체 프로젝트 및 환경변수(env) 파일 로컬 백업 완료 / 압축(source_code_backup.zip) / Supabase SQL DB Export 진행 필요]
  2026-03-10 / DB 레벨 가격 방어 제약 조건 추가 / DB변경: match_quotes.price CHECK(>0, <=10000000, 정수), cash_ledger.amount CHECK(정수)
  [2026-03-10] 어뷰징/패널티 탭 DB 연동 + 전체 보기 필터 수정 (is_abuse_target = true) / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: user_penalty_stats 뷰 생성, auto_detect_noshow() 함수, pg_cron 등록, admin_unflag_abuser() RPC
  [2026-03-10] 신고 관리 탭 제재 모달 state 분리 — reportSuspendModal/reportSuspendReason 신규 분리, suspendModal 충돌 해소 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음
  [2026-03-10] 어뷰징/신고 관리 기능 검증 완료 — auto_detect_noshow() 'pending'→'OPEN' ENUM 버그 수정, 전체 보기 필터 is_abuse_target=true 적용, 신고 탭 제재 모달 state 분리 / 수정파일: frontend/src/app/admin/page.tsx, DB auto_detect_noshow() 함수 재정의 / DB변경점: auto_detect_noshow 함수 request_status ENUM 수정
  [2026-03-10] 어뷰징 해제 버튼 RPC 파라미터 버그 수정 — admin_unflag_abuser 호출 파라미터 p_admin_id/p_customer_id → target_user_id 교체 / 수정파일: frontend/src/app/admin/page.tsx / DB변경점: 없음

[2026-03-10] 고객 받은견적 탭 분류 스펙 동기화 — MATCHED→IN_PROGRESS 유지(리뷰완료/30일경과 시 CLOSED), isFull 조건 제거, updated_at SELECT 추가 / 수정파일: frontend/src/app/quotes/received/CustomerQuotesClient.tsx / DB변경점: 없음

[2026-03-10] 고수 보낸견적 탭 분류 스펙 동기화 — 48시간 만료/리뷰완료/ACCEPTED 후 30일 경과 건 보관함 이동 추가, 7일 숨김 기준 updated_at 우선 적용 / 수정파일: frontend/src/app/pro/requests/ProRequestListClient.tsx / DB변경점: 없음

[2026-03-10] 고객/고수화면 탭 분류 스펙 자동화 테스트 스크립트 생성 및 전 시나리오 8개 검증 완료 / 생성파일: scripts/test_tab_classification.ts / DB변경점: 없음

[2026-03-11] confirm_match_and_close_others RPC 6단계 확장 — 패배 고수 방 SYSTEM_CLOSE 메시지 INSERT 추가, 실시간 종료 감지 보완 / 수정파일: DB RPC only / DB변경점: confirm_match_and_close_others 함수 교체
[2026-03-11] confirm_match → confirm_match_and_close_others 프론트 RPC 교체 — 고아 방 CLOSED 처리 누락 해소, 비원자적 트랜잭션 3건 제거 / 수정파일: frontend/src/app/chat/[room_id]/page.tsx / DB변경점: 없음
