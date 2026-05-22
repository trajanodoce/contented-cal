import React from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import type { Toast } from '../../hooks/useToast';

interface Props {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium pointer-events-auto
            animate-[slideIn_0.2s_ease-out] min-w-[280px] max-w-[400px]
            ${toast.type === 'success' ? 'bg-white border border-gray-200 text-gray-800' :
              toast.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
              'bg-mint border border-brand-100 text-brand-800'}`}
        >
          {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-brand-500 shrink-0" />}
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => onRemove(toast.id)} className="shrink-0 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
