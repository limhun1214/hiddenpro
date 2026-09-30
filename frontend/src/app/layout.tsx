import React from "react";
import ClientLayout from "./ClientLayout";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";

export const viewport: Viewport = {
  themeColor: "#176b57",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isKorean = locale === "ko";
  const title = isKorean
    ? "HiddenPro | 내 일상에 꼭 맞는 전문가"
    : "HiddenPro | Find your everyday expert";
  const description = isKorean
    ? "홈케어부터 레슨, 비즈니스까지. HiddenPro에서 필요한 서비스를 찾고, 전문가의 견적을 비교하고, 나에게 맞는 전문가와 연결하세요."
    : "From home care to lessons and business services, find local experts on HiddenPro. Share what you need, compare quotes, and connect with the right professional.";

  return {
    title: { default: title, template: "%s | HiddenPro" },
    description,
    applicationName: "HiddenPro",
    icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
    openGraph: {
      type: "website",
      siteName: "HiddenPro",
      title,
      description,
      locale: isKorean ? "ko_KR" : "en_PH",
      alternateLocale: isKorean ? "en_PH" : "ko_KR",
    },
    twitter: { card: "summary", title, description },
  };
}

function GoogleFonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
    </>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <head>
        <GoogleFonts />
      </head>
      <body suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ClientLayout>{children}</ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
