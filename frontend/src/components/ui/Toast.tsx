'use client';

import React, { useState, useCallback, createContext, useContext, useRef, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
    requireConfirm?: boolean;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, requireConfirm?: boolean) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => { } });

export const useToast = () => useContext(ToastContext);

function ToastEntry({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
    const needsConfirm = toast.type === 'error' || !!toast.requireConfirm;
    const [exiting, setExiting] = useState(false);

    const remove = useCallback(() => {
        setExiting(true);
        setTimeout(() => onRemove(toast.id), 400);
    }, [toast.id, onRemove]);

    useEffect(() => {
        if (needsConfirm) return;
        const timer = setTimeout(remove, 10000);
        return () => clearTimeout(timer);
    }, [toast.id, needsConfirm, remove]);

    const colorMap: Record<ToastType, string> = {
        success: 'bg-emerald-600 border-emerald-400 text-white',
        error: 'bg-red-600 border-red-400 text-white',
        warning: 'bg-gray-900 border-gray-700 text-white',
        info: 'bg-blue-600 border-blue-400 text-white',
    };
    const iconMap: Record<ToastType, string> = {
        success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️',
    };

    return (
        <div
            className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl flex flex-col gap-1 transition-all duration-300 ${colorMap[toast.type]} ${exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0 animate-[slideInRight_0.3s_ease-out]'}`}
        >
            <div className="flex items-start gap-2.5">
                <span className="text-lg flex-shrink-0 mt-0.5">{iconMap[toast.type]}</span>
                <p className="text-sm font-medium leading-snug break-keep flex-1">{toast.message}</p>
                <button
                    onClick={remove}
                    className="flex-shrink-0 text-white/70 hover:text-white text-sm ml-1 transition"
                    aria-label="닫기"
                >✕</button>
            </div>
            {needsConfirm && (
                <button
                    onClick={remove}
                    className="mt-2 w-full text-xs font-bold py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
                >
                    확인
                </button>
            )}
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(0);

    const showToast = useCallback((message: string, type: ToastType = 'info', requireConfirm?: boolean) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { id, message, type, requireConfirm }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none max-w-sm w-full">
                {toasts.map(toast => (
                    <ToastEntry key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>

            <style jsx global>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(40px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </ToastContext.Provider>
    );
}
