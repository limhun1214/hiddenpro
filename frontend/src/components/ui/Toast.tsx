"use client";

import React, {
  useState,
  useCallback,
  createContext,
  useContext,
  useRef,
  useEffect,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  requireConfirm?: boolean;
  href?: string;
}

interface ToastContextType {
  showToast: (
    message: string,
    type?: ToastType,
    requireConfirm?: boolean,
    href?: string,
  ) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

function ToastEntry({
  toast,
  onRemove,
}: {
  toast: ToastItem;
  onRemove: (id: number) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const needsConfirm = toast.type === "error" || !!toast.requireConfirm;
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

  const handleBannerClick = useCallback(() => {
    if (!toast.href) return;
    remove();
    router.push(toast.href);
  }, [toast.href, remove, router]);

  const colorMap: Record<ToastType, string> = {
    success:
      "bg-gradient-to-r from-[#07101F] to-[#1840C8] border-[#1840C8]/50 text-white",
    error:
      "bg-gradient-to-r from-[#07101F] to-[#1840C8] border-[#1840C8]/50 text-white",
    warning:
      "bg-gradient-to-r from-[#07101F] to-[#1840C8] border-[#1840C8]/50 text-white",
    info: "bg-gradient-to-r from-[#07101F] to-[#1840C8] border-[#1840C8]/50 text-white",
  };
  const iconMap: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div
      onClick={toast.href ? handleBannerClick : undefined}
      className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl flex flex-col gap-1 transition-all duration-300 ${colorMap[toast.type]} ${toast.href ? "cursor-pointer" : ""} ${exiting ? "opacity-0 -translate-y-2" : "opacity-100 translate-y-0 animate-[slideInDown_0.3s_ease-out]"}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg flex-shrink-0 mt-0.5">
          {iconMap[toast.type]}
        </span>
        <p className="text-sm font-medium leading-snug break-keep flex-1">
          {toast.message}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          className="flex-shrink-0 text-white/70 hover:text-white text-sm ml-1 transition"
          aria-label={t("toast.close")}
        >
          ✕
        </button>
      </div>
      {needsConfirm && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            remove();
          }}
          className="mt-2 w-full text-xs font-bold py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
        >
          {t("toast.confirm")}
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info",
      requireConfirm?: boolean,
      href?: string,
    ) => {
      const id = ++idRef.current;
      setToasts((prev) => [
        ...prev,
        { id, message, type, requireConfirm, href },
      ]);
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)]">
        {toasts.map((toast) => (
          <ToastEntry key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      <style jsx global>{`
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
