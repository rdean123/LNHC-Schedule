import { AlertTriangle } from 'lucide-react';
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export const inputClasses =
  'block min-h-11 w-full rounded-control border border-line-strong bg-surface px-3 text-base text-ink placeholder:text-placeholder hover:border-deep aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-50';

type ControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

type FieldProps = {
  label: string;
  hint?: string;
  /** Says what's wrong and how to fix it. */
  error?: string | null;
  children: (control: ControlProps) => ReactNode;
};

/** A visible label, optional hint, and an error shown next to the field (never placeholder-only). */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="mb-4 grid gap-1">
      <label htmlFor={id} className="font-semibold text-deep">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClasses} ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputClasses} min-h-24 py-2 ${className}`} {...rest} />;
}
