import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '../../store/ui';

const icons = {
  success: <CheckCircle size={18} className="text-nc-green" />,
  error: <XCircle size={18} className="text-nc-red" />,
  warning: <AlertTriangle size={18} className="text-nc-yellow" />,
  info: <Info size={18} className="text-nc-brand" />,
};

export function Toaster() {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-nc-bg-floating border border-nc-divider rounded-lg shadow-xl px-4 py-3 min-w-[280px] max-w-sm animate-slide-up pointer-events-auto"
        >
          {icons[toast.type] || icons.info}
          <span className="flex-1 text-sm text-nc-text-normal">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-nc-text-muted hover:text-nc-interactive-hover"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
