# HiddenPro MVP 데이터베이스 아키텍처 (03_DB_Architecture)

## 📌 설계 원칙 및 권장 엔진
- **RDBMS + JSON 하이브리드:** PostgreSQL(권장)의 `JSONB` 타입과 `GIN` 인덱스를 활용하여 동적 폼 데이터의 확장성을 확보하되, 검색 쿼리 시 Full Table Scan을 방지합니다.
- **Insert-Only Ledger:** 모든 캐시 결제 및 차감 내역은 삭제/수정이 불가능한 원장(Ledger) 형태로 기록하여 재무 정합성을 100% 보장합니다.
- **대용량 트래픽 방어 인덱싱:** 조회 API 동시 호출 시 DB I/O 병목을 막기 위해, `WHERE` 절과 `JOIN`에 사용되는 모든 Foreign Key 및 상태 조회용 핵심 컬럼(`status`, `is_read` 등)에는 반드시 인덱스를 설정합니다.
- **N+1 쿼리 원천 차단:** 리스트 호출 시 반복문 내 쿼리 실행(N+1 문제)을 엄격히 금지하며, Supabase의 내장 Join 쿼리나 단일 RPC 함수를 활용해 네트워크 통신 횟수를 무조건 1회로 단축합니다.

---

### 🗄️ 1. 통합 계정 및 권한 분리 (Users & Auth)

#### Table: `Users`
고객과 고수를 하나의 테이블에서 관리하며, `role` 값으로 권한을 스위칭합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `user_id` | UUID (PK) | N | 유저 고유 식별자 |
| `social_provider` | VARCHAR | Y | 소셜 가입 출처 (Google, Apple, FB 등) |
| `social_id` | VARCHAR | Y | 소셜 고유 ID (선 작성 후 로그인 매핑용) |
| `role` | ENUM | N | 'CUSTOMER', 'PRO', 'ADMIN' |
| `name` | VARCHAR | N | 유저 닉네임 또는 이름 |
| `device_token` | VARCHAR | Y | [MVP] 앱 푸시(FCM) 발송용 기기 토큰 |
| `sns_messenger_id` | VARCHAR | Y | [V2 대비] 추후 외부 메신저 알림용 빈 공간 |
| `status` | ENUM | N | 'ACTIVE', 'SUSPENDED'(어뷰징 정지), 'DELETED' |
| `created_at` | TIMESTAMP | N | 가입 일시 |

#### Table: `Pro_Profiles`
`Users` 테이블과 1:1 관계. 고수 권한('PRO')을 가진 유저의 추가 정보만 저장합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `pro_id` | UUID (PK) | N | 고수 프로필 고유 식별자 |
| `user_id` | UUID (FK) | N | `Users` 테이블 연동 (UNIQUE) |
| `biz_reg_number` | VARCHAR | Y | 사업자 등록 번호 |
| `is_verified` | BOOLEAN | N | 신분/사업자 인증 완료 여부 (기본값: false) |
| `service_region_id`| INT (Index) | N | 주요 활동 지역 코드 (빠른 검색 인덱싱) |
| `current_cash` | DECIMAL | N | 현재 보유 캐시 잔액 (원장 캐싱 데이터) |
| `portfolio_urls` | JSONB | Y | 전/후 사진 등 포트폴리오 이미지 링크 배열 |

---

### 🗄️ 2. 캐시 원장 시스템 (Cash Ledger)

#### Table: `Cash_Ledger`
에스크로 정산을 배제하고, 오직 플랫폼 내 캐시의 흐름만 기록하는 단방향 재무 테이블입니다. (UPDATE/DELETE 절대 금지)
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `transaction_id` | UUID (PK) | N | 거래 고유 식별자 |
| `pro_id` | UUID (FK) | N | 거래 발생 고수 ID (`Pro_Profiles` 연동) |
| `tx_type` | ENUM | N | 'CHARGE'(충전), 'DEDUCT_QUOTE'(견적차감), 'REFUND'(환불), 'BONUS'(웰컴캐시) |
| `amount` | DECIMAL | N | 변동 금액 (충전/환불은 +, 차감은 -) |
| `balance_snapshot` | DECIMAL | N | 거래 직후의 잔액 (환불/어뷰징 추적용 핵심 데이터) |
| `reference_id` | UUID | Y | 연관 데이터 ID (요청서 ID 또는 PG사 결제 고유번호) |
| `created_at` | TIMESTAMP | N | 거래 발생 일시 (수정 불가) |

---

### 🗄️ 3. 핵심 매칭 시스템 (Core Matching & 1:N Bidding)

#### Table: `Match_Requests`
서버 마비 방지를 위해 핵심 검색 조건(카테고리, 지역)은 인덱싱 컬럼으로 빼고, 세부 질문만 JSONB로 저장합니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `request_id` | UUID (PK) | N | 매칭 요청서 고유 식별자 |
| `customer_id` | UUID (FK) | N | 요청자 ID (`Users` 연동) |
| `category_id` | INT (Index) | N | 서비스 카테고리 (검색 속도 최적화용 핵심 컬럼) |
| `region_id` | INT (Index) | N | 서비스 요청 지역 (검색 속도 최적화용 핵심 컬럼) |
| `dynamic_answers`| JSONB | N | 카테고리별 세부 챗봇 응답 데이터 (무한 확장) |
| `status` | ENUM | N | 'OPEN', 'CLOSED'(마감/매칭완료), 'CANCELED' |
| `quote_count` | INT | N | 현재 입찰한 고수 수 (1:N 제한 검증용, 기본값: 0) |
| `expires_at` | TIMESTAMP | N | 48시간 자동 마감 타이머 (생성 시점 + 48h) |
| `created_at` | TIMESTAMP | N | 작성 일시 |

#### Table: `Match_Quotes`
고수가 고객의 요청서에 캐시를 소모하여 견적을 보낸 내역입니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `quote_id` | UUID (PK) | N | 견적 발송 고유 식별자 |
| `request_id` | UUID (FK) | N | 연관된 요청서 ID (`Match_Requests` 연동) |
| `pro_id` | UUID (FK) | N | 견적을 보낸 고수 ID |
| `cost_deducted` | DECIMAL | N | 이 견적 발송에 소모된 캐시 비용 |
| `is_read` | BOOLEAN | N | 고객의 견적 열람 여부 (48시간 미열람 자동 환불 체크용) |
| `is_matched` | BOOLEAN | N | 최종 거래 성사 여부 (1방향 리뷰 작성 권한 트리거) |
| `created_at` | TIMESTAMP | N | 견적 발송 일시 |


### 🗄️ 4. 실시간 소통 및 검증 리뷰 시스템 (Communication & Review)

#### Table: `Chat_Rooms`
고객과 고수 간의 1:1 채팅방입니다. 견적이 발송되면 생성되며, [매칭 확정하기] 스위치 작동 시 상태가 변경됩니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `room_id` | UUID (PK) | N | 채팅방 고유 식별자 |
| `request_id` | UUID (FK) | N | 연관된 요청서 ID (`Match_Requests` 연동) |
| `customer_id` | UUID (FK) | N | 방을 개설한(요청한) 고객 ID |
| `pro_id` | UUID (FK) | N | 견적을 보낸 고수 ID |
| `status` | ENUM | N | 'OPEN'(대화중), 'MATCHED'(거래성사/리뷰가능), 'CLOSED'(종료) |
| `created_at` | TIMESTAMP | N | 채팅방 생성 일시 |

#### Table: `Chat_Messages`
WebSocket 서버와 통신하여 텍스트 및 이미지를 저장합니다. V2 보이스콜(WebRTC) 확장을 위한 뼈대가 포함되어 있습니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `message_id` | UUID (PK) | N | 메시지 고유 식별자 |
| `room_id` | UUID (FK) | N | 소속 채팅방 ID (`Chat_Rooms` 연동) |
| `sender_id` | UUID (FK) | N | 메시지 발송자 ID (`Users` 연동) |
| `message_type` | ENUM | N | 'TEXT', 'IMAGE', **'CALL_LOG' (V2 보이스콜 통화 기록 확장용 뼈대)** |
| `content` | TEXT | Y | 텍스트 내용, 이미지 URL, 또는 통화 기록 메타데이터 |
| `is_read` | BOOLEAN | N | 상대방 읽음 여부 (안 읽음 탭 구현용) |
| `created_at` | TIMESTAMP | N | 메시지 전송 일시 |

#### Table: `Reviews`
어뷰징 방지를 위해 `Chat_Rooms`의 상태가 'MATCHED'인 경우에만 고객이 작성할 수 있는 1방향 검증 리뷰 테이블입니다.
| 컬럼명 | 타입 | Null | 설명 및 비즈니스 로직 |
| :--- | :--- | :---: | :--- |
| `review_id` | UUID (PK) | N | 리뷰 고유 식별자 |
| `room_id` | UUID (FK) | N | 매칭이 성사된 채팅방 ID (1방향 검증용 필수 키, UNIQUE) |
| `pro_id` | UUID (FK) | N | 평가를 받는 고수 ID |
| `customer_id` | UUID (FK) | N | 평가를 작성하는 고객 ID |
| `rating` | DECIMAL | N | 평점 (1.0 ~ 5.0) |
| `comment` | TEXT | Y | 텍스트 리뷰 내용 |
| `created_at` | TIMESTAMP | N | 리뷰 작성 일시 |