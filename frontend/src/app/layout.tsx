import React from 'react';
import ClientLayout from './ClientLayout';
import './globals.css';
import GlobalFooter from '@/components/common/GlobalFooter';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

export const metadata: Metadata = {
    icons: {
        icon: '/favicon.svg',
        apple: '/favicon.svg',
    },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();
    return (
        <html lang={locale}>
            <body suppressHydrationWarning>
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <ClientLayout>{children}</ClientLayout>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
