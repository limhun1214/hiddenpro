# 작업: 추천 쿠폰 만료 기간 3년 → 1년 전체 변경

## 요구사항

추천 보상 쿠폰의 만료 기간을 3년에서 1년으로 일괄 변경한다.

## 작업 범위

### 1. DB RPC 수정 (SQL 제공 → 디렉터 실행)

- `process_referral_reward` RPC 소스에서 expires_at 계산 부분을 3년 → 1년으로 변경
- 먼저 `SELECT prosrc FROM pg_proc WHERE proname = 'process_referral_reward';`로 현재 소스를 확인하고, 수정된 CREATE OR REPLACE FUNCTION 전문을 SQL로 제공하라

### 2. 프론트엔드 수정

- `referral/page.tsx` 및 프로젝트 전체에서 "3년", "3 year", "3-year", "36개월" 등 3년 관련 문구를 모두 찾아서 1년으로 변경
- grep으로 전체 검색: `grep -rn "3년\|3 year\|3-year\|36개월\|3 years\|three year" frontend/src`

### 3. 설계 문서 반영

- `docs/supabase_schema.md`에서 쿠폰 만료 기간 "3년" → "1년"으로 변경
- 기타 docs 폴더 내 관련 문서도 grep으로 확인 후 일괄 수정

## 5대 충돌 검수

- DB 스키마: process_referral_reward RPC만 수정, 테이블 구조 변경 없음
- 금융 RPC: expires_at 기간만 변경, 보상 금액/로직 변경 없음
- 인증 우회: 없음
- 상태 전환: 없음
- N+1/CCU: 없음

## 제약

- RPC SQL은 디렉터가 Supabase SQL Editor에서 직접 실행한다
- 기존 발급된 쿠폰의 만료일은 소급 변경하지 않는다 (신규 발급분부터 적용)
