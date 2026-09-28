"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLocale } from "next-intl";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ko = useLocale() === "ko";
  useEffect(() => { console.error("[HiddenPro] Page error", error); }, [error]);
  return (
    <section className="flex min-h-[65vh] flex-col items-center justify-center bg-[#f7f8f2] px-6 py-20 text-center">
      <span aria-hidden="true" className="material-symbols-outlined mb-6 rounded-2xl bg-[#e8f3ed] p-5 text-4xl text-[#176b57]">refresh</span>
      <h1 className="text-3xl font-bold tracking-tight text-[#142522]">{ko ? "잠시 연결이 원활하지 않아요." : "Let’s give that another try."}</h1>
      <p className="mt-4 max-w-sm text-sm leading-7 text-[#64726b]">{ko ? "페이지를 불러오지 못했어요. 다시 시도하거나 홈으로 돌아가 주세요." : "We couldn’t load this page. Please try again, or return home to keep exploring."}</p>
      <div className="mt-8 flex items-center gap-5"><button onClick={reset} className="hp-button hp-button-dark">{ko ? "다시 시도" : "Try again"}</button><Link href="/" className="text-sm font-semibold text-[#176b57] underline underline-offset-4">{ko ? "홈으로" : "Back home"}</Link></div>
    </section>
  );
}
