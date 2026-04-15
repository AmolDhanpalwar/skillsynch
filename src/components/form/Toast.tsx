import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function Toast({ message, visible, onDismiss }: ToastProps) {
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
    } else {
      const t = setTimeout(() => setRendered(false), 300);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50 flex items-center gap-2.5
        bg-white border border-gray-200 shadow-lg shadow-gray-200/60
        rounded-xl px-4 py-3 transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
      <span className="text-sm font-medium font-body text-gray-700">{message}</span>
      <button
        onClick={onDismiss}
        className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
