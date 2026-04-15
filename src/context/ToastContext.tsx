import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; bg: string; iconClass: string; border: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-white',   iconClass: 'text-emerald-500', border: 'border-l-4 border-l-emerald-400' },
  error:   { icon: XCircle,      bg: 'bg-white',   iconClass: 'text-red-500',     border: 'border-l-4 border-l-red-400' },
  info:    { icon: Info,         bg: 'bg-white',   iconClass: 'text-sky-500',     border: 'border-l-4 border-l-sky-400' },
  warning: { icon: AlertTriangle, bg: 'bg-white',  iconClass: 'text-amber-500',   border: 'border-l-4 border-l-amber-400' },
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  function dismiss(id: number) {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
    const removeTimer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 300);
    timers.current.set(id, removeTimer);
  }

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, visible: true }]);
    const t = setTimeout(() => dismiss(id), 3500);
    timers.current.set(id, t);
  }, []);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error   = useCallback((m: string) => toast(m, 'error'),   [toast]);
  const info    = useCallback((m: string) => toast(m, 'info'),    [toast]);
  const warning = useCallback((m: string) => toast(m, 'warning'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2.5 pointer-events-none" aria-live="polite">
        {toasts.map((t) => {
          const cfg = TOAST_CONFIG[t.type];
          const Icon = cfg.icon;
          return (
            <div
              key={t.id}
              className={`
                pointer-events-auto flex items-center gap-3 min-w-[280px] max-w-sm
                ${cfg.bg} ${cfg.border} border border-gray-200
                rounded-xl px-4 py-3 shadow-lg shadow-black/10
                transition-all duration-300 ease-out
                ${t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}
              `}
            >
              <Icon size={16} className={`${cfg.iconClass} shrink-0`} />
              <span className="text-sm font-body text-gray-700 flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-gray-300 hover:text-gray-500 transition-colors shrink-0 ml-1"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
