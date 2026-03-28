"use client";

import { useEffect } from "react";

/**
 * 페이지 진입 시 GNB 배지를 소멸시키는 경량 클라이언트 컴포넌트.
 * 서버/클라이언트 경계 충돌 방지를 위해 별도 파일로 분리.
 *
 * 사용법: <BadgeCleaner type="quotes-read" /> 또는 <BadgeCleaner type="requests-read" />
 */
export default function BadgeCleaner({ type }: { type: string }) {
  useEffect(() => {
    // 렌더링 충돌 방지를 위해 다음 틱(Tick)으로 이벤트 발송 지연
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event(type));
    }, 0);
    return () => clearTimeout(timer);
  }, [type]);

  return null; // UI 없음 — 이벤트만 발송
}
