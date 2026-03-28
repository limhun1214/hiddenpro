## 작업: 푸터 중복 제거 및 레이아웃 수정

### 수정 파일: frontend/src/app/page.tsx (푸터 영역만)

### 현재 문제:
푸터가 2개 중복 렌더링됨:
- 첫 번째: "© 2026 HiddenPro. All rights reserved." + "Terms of Service  Privacy Policy  Business Information" (가로 나열)
- 두 번째: "Terms of Service | Privacy Policy | Business Information" + "© 2026 HiddenPro. All rights reserved."

### 변경 내용:

1. 중복 푸터 중 하나 삭제하여 1개만 남김

2. 남은 푸터를 우측 Stitch 레이아웃으로 수정:
   - 1줄: "Terms of Service    Privacy Policy" (가로 나열, 구분자 없음, 간격으로 구분)
   - 2줄: "Business Information" (중앙 정렬)
   - 3줄: "© 2026 HiddenPro. All rights reserved." (중앙 정렬)
   - 전체 중앙 정렬, 텍스트 색상 text-gray-500

### 주의사항:
- 링크 href 등 기존 로직 유지
- 디자인 레이어만 수정