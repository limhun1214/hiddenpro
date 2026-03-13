import dynamic from 'next/dynamic';

const ProRequestListClient = dynamic(
    () => import('./ProRequestListClient'),
    { ssr: false, loading: () => <div className="p-8 text-center text-gray-500">Loading...</div> }
);

export default function ProRequestsPage() {
    return <ProRequestListClient />;
}
