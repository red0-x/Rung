import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastMsg {
  text: string;
  tone?: 'ok' | 'error';
  action?: { label: string; run: () => void };
}

/** One toast at a time, bottom-center. Replaces the previous one; auto-hides. */
export function useToast() {
  const [toast, setToast] = useState<(ToastMsg & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((t: ToastMsg) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.tone === 'error' ? 7000 : t.action ? 6000 : 3500);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show, hide };
}

export function Toast({ toast, onHide }: { toast: (ToastMsg & { id: number }) | null; onHide: () => void }) {
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className={`toast${toast.tone === 'error' ? ' is-error' : ''}`}>
          <span>{toast.text}</span>
          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action!.run();
                onHide();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast-x" aria-label="Dismiss" onClick={onHide}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
