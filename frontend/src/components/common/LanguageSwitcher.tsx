'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LOCALES = [
    { code: 'en', label: 'EN' },
    { code: 'ko', label: '한' },
    // 나중에 여기에 추가: { code: 'tl', label: 'TL' }
];

export default function LanguageSwitcher() {
    const router = useRouter();
    const [current, setCurrent] = useState('en');

    useEffect(() => {
        const saved = document.cookie
            .split('; ')
            .find(row => row.startsWith('locale='))
            ?.split('=')[1] ?? 'en';
        setCurrent(saved);
    }, []);

    const switchLocale = (code: string) => {
        document.cookie = `locale=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
        setCurrent(code);
        router.refresh();
    };

    return (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {LOCALES.map(({ code, label }) => (
                <button
                    key={code}
                    onClick={() => switchLocale(code)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                        current === code
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
