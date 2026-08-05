import React, { useCallback, useEffect, useRef, useState } from 'react';

export type ToastKind = 'success' | 'error';

export interface ToastMessage {
  id: number;
  kind: ToastKind;
  text: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

/**
 * A minimal toast stack.
 *
 * Deliberately not a context provider: the admin dashboard is the only surface
 * that needs it, so `useToasts` is passed down rather than made ambient.
 */
export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[60] flex flex-col gap-3 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl font-body-md text-sm ${
            toast.kind === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/80 text-emerald-200'
              : 'border-red-500/40 bg-red-950/80 text-red-200'
          }`}
        >
          <span className="material-symbols-outlined text-lg leading-none">
            {toast.kind === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={() => {
              onDismiss(toast.id);
            }}
            aria-label="Dismiss notification"
            className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <span className="material-symbols-outlined text-base leading-none">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

export interface UseToastsResult {
  toasts: ToastMessage[];
  push: (kind: ToastKind, text: string) => void;
  dismiss: (id: number) => void;
}

export function useToasts(timeoutMs = 5000): UseToastsResult {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, text: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, text }]);
      const handle = window.setTimeout(() => {
        dismiss(id);
      }, timeoutMs);
      timers.current.push(handle);
    },
    [dismiss, timeoutMs],
  );

  // Clear pending timers so an unmount mid-toast cannot fire a setState.
  useEffect(
    () => () => {
      timers.current.forEach((handle) => {
        window.clearTimeout(handle);
      });
      timers.current = [];
    },
    [],
  );

  return { toasts, push, dismiss };
}
