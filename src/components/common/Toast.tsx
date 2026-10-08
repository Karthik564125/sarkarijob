import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'warning';
  text: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-start justify-between p-3 rounded-lg border shadow-md bg-white text-xs font-medium transition-all duration-200 animate-in slide-in-from-bottom-2
            ${t.type === 'success' ? 'border-emerald-200 text-emerald-900 bg-emerald-50/90' : ''}
            ${t.type === 'info' ? 'border-indigo-200 text-indigo-900 bg-indigo-50/90' : ''}
            ${t.type === 'warning' ? 'border-amber-200 text-amber-900 bg-amber-50/90' : ''}
          `}
        >
          <div className="flex items-center space-x-2">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
            {t.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />}
            <span>{t.text}</span>
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-600 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
