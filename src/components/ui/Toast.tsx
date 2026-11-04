import { AlertTriangle, Check, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ToastContext } from './toastContext';
import type { ToastApi } from './toastContext';

type ToastItem = { id: number; tone: 'success' | 'error'; message: string };

let nextId = 1;

/** Short confirmations ("December published.") and failures. Announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const push = useCallback(
    (tone: ToastItem['tone'], message: string) => {
      const id = nextId++;
      setItems((list) => [...list, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 9000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 print:hidden"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-lg items-start gap-3 rounded-panel px-4 py-3 text-white shadow-pop ${
              t.tone === 'error' ? 'bg-danger' : 'bg-deep'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 size-5 shrink-0 text-sky-b" aria-hidden="true" />
            )}
            <p>{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-mr-1 grid size-6 shrink-0 place-items-center rounded text-white/90 hover:bg-white/15"
              aria-label="Dismiss"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
