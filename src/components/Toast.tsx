"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle, XCircle, Info, Loader2, X } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "loading";
}

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => 0,
  dismiss: () => {},
});

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
      if (type !== "loading") {
        setTimeout(() => dismiss(id), 4000);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border animate-scale-in bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          >
            {t.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
            {t.type === "error" && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            {t.type === "info" && <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />}
            {t.type === "loading" && <Loader2 className="w-5 h-5 text-purple-500 animate-spin flex-shrink-0" />}
            <p className="text-sm text-slate-700 dark:text-slate-200 flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
