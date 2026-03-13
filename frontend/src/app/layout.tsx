import React from 'react';
import ClientLayout from './ClientLayout';
import './globals.css';
import GlobalFooter from '@/components/common/GlobalFooter';

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
            <body suppressHydrationWarning>
                <ClientLayout>{children}</ClientLayout>
            </body>
        </html>
    );
}
