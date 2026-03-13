'use client';

import ProBiddingDetail from '@/components/pro/ProBiddingDetail';

export const runtime = 'edge';

export default function RequestDetailPage({ params }: { params: { id: string } }) {
    return <ProBiddingDetail requestId={params.id} />;
}
