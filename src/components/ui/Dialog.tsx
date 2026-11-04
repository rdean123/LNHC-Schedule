import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** role="alertdialog" for confirmations of irreversible actions. */
  alert?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
};

/**
 * A modal built on the native <dialog>: focus is trapped, Escape closes it, and focus
 * returns to where it was. Use only when a task needs interruption (adding a person, or
 * confirming something that can't be undone).
 */
export function Dialog({ open, onClose, title, description, alert, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={alert ? 'alertdialog' : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-panel border-0 bg-surface p-0 text-ink shadow-pop backdrop:bg-deep/45"
    >
      {open && (
        <div className="p-6">
          <h2 id={titleId} className="text-2xl">
            {title}
          </h2>
          {description && (
            <p id={descId} className="mt-2 text-muted">
              {description}
            </p>
          )}
          {children && <div className="mt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
