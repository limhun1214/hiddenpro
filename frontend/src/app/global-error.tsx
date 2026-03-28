"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🚨</div>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "#1f2937",
              marginBottom: "8px",
            }}
          >
            앱에 심각한 오류가 발생했습니다
          </h2>
          <p
            style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}
          >
            {error.message ||
              "페이지를 새로고침하거나 나중에 다시 시도해주세요."}
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: "bold",
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            앱 다시 시작
          </button>
        </div>
      </body>
    </html>
  );
}
