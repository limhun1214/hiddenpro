"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "./globals.css";

// Unmatched URLs use a static document; locale is restored after hydration.
// This keeps 404 responses independent of server cookies and the auth layout.
export default function GlobalNotFound() {
  const [ko, setKo] = useState(false);
  useEffect(() => {
    setKo(document.cookie.split(";").some(cookie => cookie.trim() === "locale=ko"));
  }, []);

  return (
    <html lang={ko ? "ko" : "en"}>
      <head><title>404 | HiddenPro</title><meta name="robots" content="noindex" /></head>
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#f7f8f2] px-6 py-20 text-center">
          <Link href="/" className="hp-brand mb-12" aria-label="HiddenPro home"><span aria-hidden="true" className="hp-brand-symbol">h<span>.</span></span>Hidden<span className="hp-brand-light">Pro</span></Link>
          <p className="mb-5 font-headline text-7xl font-extrabold tracking-tighter text-[#bed0ae]">404</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#142522]">{ko ? "여기는 잠시 길을 벗어났네요." : "A little off the beaten path."}</h1>
          <p className="mt-4 max-w-sm text-sm leading-7 text-[#64726b]">{ko ? "페이지가 이동했거나 주소가 바뀌었어요. 홈에서 필요한 서비스를 찾아보세요." : "This page may have moved, or the link has changed. Let’s find the right place to start."}</p>
          <Link href="/" className="hp-button hp-button-dark mt-8">{ko ? "홈으로 돌아가기" : "Back to home"}<span aria-hidden="true">↗</span></Link>
        </main>
      </body>
    </html>
  );
}
