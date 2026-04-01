# 작업: Referral 목록 — 가입 즉시 표시되도록 수정

## 배경

현재 referral/page.tsx의 "My Referrals" 목록은 `referral_rewards` 테이블만 조회한다.
이 테이블은 피추천인이 첫 견적 요청을 완료해야 INSERT되므로, 가입만 한 피추천인은 목록에 안 보인다.
추천인 입장에서 "No referrals yet"으로 보이는 건 UX 결함이다.
SQL 수동 수정은 이미 완료됨 — limhunkc@gmail.com의 referred_by가 설정된 상태다.

## 요구사항

- 추천 링크로 가입한 유저는 **가입 즉시** 추천인의 "My Referrals" 목록에 표시되어야 한다
- 보상(크레딧 지급)은 기존대로 첫 견적 요청 시 처리 — 이 로직은 건드리지 않는다

## 구현 방향

1. `referral/page.tsx` 분석 — 현재 `referral_rewards` 조회 로직 확인
2. 목록 데이터 소스를 변경:
   - `users` 테이블에서 `referred_by = 현재 로그인 유저 ID`인 유저 목록을 조회
   - 각 피추천인에 대해 `referral_rewards`에 보상 레코드가 있으면 "보상 완료", 없으면 "가입 완료 (보상 대기)" 등 상태 표시
3. 표시 항목: 피추천인 이메일(또는 이름), 가입일, 보상 상태

## 5대 충돌 검수

- DB 스키마: users 테이블의 referred_by 컬럼 + referral_rewards 테이블 — 기존 구조 그대로 사용, 스키마 변경 없음
- 금융 RPC: process_referral_reward RPC 수정 없음, 기존 보상 로직 유지
- 인증 우회: 로그인 유저 본인의 referred_by 데이터만 조회 — RLS 확인 필요
- 상태 전환: 없음
- N+1/CCU: users 1회 조회 + referral_rewards LEFT JOIN 1회로 처리, N+1 없음

## 제약

- 기존 referral_rewards 기반 로직(보상 처리)은 절대 삭제하지 않는다
- 확장(Extension) 방식으로만 접근한다
- RLS 정책상 다른 유저의 users 레코드 조회가 가능한지 반드시 확인하고, 불가능하면 서버 사이드(API route 또는 RPC)로 처리한다
