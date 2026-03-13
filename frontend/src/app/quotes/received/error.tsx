'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
            <h2 className="text-xl font-bold text-gray-800 mb-4">견적 목록을 불러오는 중 오류가 발생했습니다.</h2>
            <p className="text-sm text-gray-600 mb-6">{error.message}</p>
            <button
                onClick={() => reset()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-sm transition"
            >
                다시 시도
            </button>
        </div>
    );
}
