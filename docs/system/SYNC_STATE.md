# HiddenPro - SYNC_STATE (현재 작업 동기화 상태)

이 문서는 Claude Sonnet 4.6(AI 에이전트)가 현재 진행 중인 단기 작업의 맥락을 유지하기 위한 휘발성 상태 파일입니다.
작업이 완료되면 [Current Workflow]는 비워집니다.

## [Current Workflow]

**푸터 링크 추가 + 로그인 상태별 분기 + Profile 법적 링크 메뉴**
- GlobalFooter.tsx: Refund Policy, Contact Us, 사업자등록번호 추가
- ClientLayout.tsx: 로그인 시 푸터 숨김 (hideFooter에 !!userId 추가)
- profile/page.tsx: Invite & Earn 아래 legal links 섹션 추가
- messages/en.json + ko.json: footer i18n 키 추가

## [Next To-Do]

- 디렉터님의 다음 개발 마일스톤 지시 대기 중
