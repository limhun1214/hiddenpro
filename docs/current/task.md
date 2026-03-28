## 작업: Profile 페이지 좌우 흰색 배경 완전 제거

### 문제:

Profile 페이지의 카드 영역 좌우 바깥에 여전히 밝은(흰색/회색) 배경이 보임. 페이지 최상위 래퍼보다 상위 레벨(body 또는 ClientLayout)에서 배경색이 적용되고 있는 것으로 추정.

### 수정 파일: frontend/src/app/ClientLayout.tsx (또는 profile 페이지 관련 래퍼)

### 확인 및 수정:

1. ClientLayout.tsx에서 Profile 페이지일 때 main/body 래퍼의 배경색 확인
2. 최상위 컨테이너(html, body, main, div 등)에 bg-white 또는 bg-gray-50이 있다면 Profile 경로에서는 bg-[#0f0d13]으로 오버라이드
3. 페이지 전체 너비(w-full)에 걸쳐 bg-[#0f0d13]이 적용되도록 수정
4. max-w 제약이 있는 래퍼 바깥 영역도 동일 배경색 적용

### 주의사항:

- 랜딩 페이지 등 다른 페이지에 영향 주지 않도록 Profile 경로 조건부 적용
- 비즈니스 로직 변경 금지
