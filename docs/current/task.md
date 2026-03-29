# 지시: 모바일 상단 헤더에 지갑 아이콘 추가 (알림 벨 왼쪽, PRO 전용)

## 수정 대상: frontend/src/app/ClientLayout.tsx — 모바일 상단 헤더 영역만

## 수정 내용

모바일 상단 헤더의 `<div className="flex justify-end items-center px-4 py-3 gap-3">` 내부에서, 알림 벨 버튼 바로 위(앞)에 아래 지갑 버튼 코드를 추가한다.

추가할 코드:

```tsx
{
  isProUser && (
    <button
      onClick={() => router.push("/pro/wallet")}
      aria-label={t("pcTopNav.wallet")}
      className={`relative transition-colors ${
        currentPath === "/pro/wallet"
          ? "text-[#ff88b5]"
          : "text-white/70 hover:text-white"
      }`}
    >
      <span
        className="material-symbols-outlined text-[22px]"
        style={{
          fontVariationSettings:
            currentPath === "/pro/wallet" ? "'FILL' 1" : "'FILL' 0",
        }}
      >
        account_balance_wallet
      </span>
    </button>
  );
}
```

### 주의 사항

- 조건 변수는 `navState.isProUser`가 아닌 `isProUser` (직접 state 변수) 사용
- 경로 비교는 `pathname`이 아닌 `currentPath` 사용
- 라벨 텍스트 없음 (모바일 상단은 아이콘만)
- 알림 벨 버튼 코드는 일절 수정하지 않는다
- 삽입 위치: 알림 벨 `<button onClick={() => router.push("/notifications")}` 바로 위

## 금지 사항

- PCTopNav.tsx 수정 금지 (이미 완료됨)
- 모바일 하단 내비바 코드 수정 금지
- 알림 벨 기존 코드 삭제/변경 금지
- en.json, ko.json 수정 금지 (키 이미 존재)

## 5대 충돌 검수

- DB 스키마: 변경 없음 ✅
- 금융 RPC 사이드이펙트: 없음 ✅
- 인증 우회: 없음 ✅
- 상태 전환: 없음 ✅
- N+1/CCU 성능: 추가 쿼리 없음 ✅

## 완료 후

1. docs/history_archive/HISTORY.md 상단에 기록 추가
2. 변경된 파일 목록과 삽입된 코드 위치(라인 번호) 보고

❓ 위 계획대로 진행할까요? "OK"를 입력하시면 코딩을 시작합니다.
