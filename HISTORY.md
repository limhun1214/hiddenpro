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

2026-03-09 / 캐시내역 탭 버그 2건 수정: 모달 select 'id' 컬럼 오류→'*' 교체(내역 미표시 수정), txDesc 헬퍼 추가 및 3곳 description 폴백 적용 / frontend/src/app/admin/page.tsx / DB변경 없음

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

* [2026-03-08 / 고객 받은견적 리스트 3단계 동적 정렬 로직 (미읽음>견적있음>최신순) 적용 / CustomerQuotesClient.tsx / DB 변경없음]
* [2026-03-08 / [핫픽스] 견적/매칭 탭 500 에러 해결 (answers 컬럼명 오타 수정) / admin/page.tsx / DB 변경없음]
* [2026-03-08 / 관리자 견적 상세 관리 페이지 UI 개선 및 상세답변 렌더링 추가 / admin/page.tsx / DB 변경없음]
* [2026-03-08 / 견적 요청 버튼 중복 제출 방지 로직 적용 / DynamicRequestForm.tsx / DB 변경없음]
* [2026-03-08 / DB 전체 자동 백업 스크립트 작성 및 실행 완료 / scripts/backup_db.ts 생성 / Service Role Key 누락으로 일부 테이블(users, pro_profiles) RLS 차단 발생]
* [2026-03-08 / 최신화된 전체 프로젝트 및 환경변수(env) 파일 로컬 백업 완료 / 압축(source_code_backup.zip) / Supabase SQL DB Export 진행 필요]
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