import { Suspense } from 'react';
import CustomerQuotesClient from './CustomerQuotesClient';

export default function CustomerQuotesPage() {
    return (
        <div className="flex flex-col flex-1 min-h-0 w-full overflow-y-auto bg-gray-50 lg:bg-[#F4F5F7]">
            <Suspense fallback={<div className="p-8 text-center text-gray-500 flex-1 flex flex-col justify-center min-h-0">Loading...</div>}>
                <CustomerQuotesClient />
            </Suspense>
        </div>
    );
}
