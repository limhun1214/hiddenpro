"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[HiddenPro] Application error", error); }, [error]);
  return <html lang="en"><body style={{ margin: 0, background: "#f7f8f2", color: "#142522", fontFamily: "system-ui, sans-serif" }}>
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", boxSizing: "border-box" }}>
      <p style={{ color: "#176b57", fontWeight: 800, fontSize: 22 }}>HiddenPro</p>
      <h1 style={{ fontSize: 30, letterSpacing: "-1px" }}>A small interruption.</h1>
      <p style={{ fontSize: 14, color: "#64726b", lineHeight: 1.8 }}>Please try again in a moment.<br />잠시 후 다시 시도해 주세요.</p>
      <button onClick={reset} style={{ marginTop: 20, background: "#173e31", color: "white", fontWeight: 700, padding: "15px 25px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 14 }}>Try again · 다시 시도</button>
    </main>
  </body></html>;
}
