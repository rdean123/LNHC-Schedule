import type { ReactNode } from 'react';
import { Button } from './Button';
import { Notice } from './Notice';

/** Loading placeholder shaped like the content it stands in for, so nothing jumps. */
export function LoadingBlock({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-3">
      <div className="skeleton h-7 w-2/5" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-11" style={{ width: i === rows - 1 ? '80%' : '100%' }} />
      ))}
    </div>
  );
}

/** A plain cause and a way forward. Nothing the person typed is lost. */
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice
      tone="error"
      title={message}
      action={
        onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  );
}

/** An empty screen is an invitation to act. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <h2 className="mb-2 text-2xl">{title}</h2>
      {children && <p className="mx-auto mb-5 max-w-md text-muted">{children}</p>}
      {action && <div className="flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
