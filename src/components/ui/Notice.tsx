import { AlertTriangle, Ban, Check, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'warn' | 'error' | 'success';

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'bg-wash text-brand-hover',
    icon: <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />,
  },
  warn: {
    box: 'bg-warn-50 text-warn',
    icon: <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />,
  },
  error: {
    box: 'bg-danger-50 text-danger',
    icon: <Ban className="mt-0.5 size-5 shrink-0" aria-hidden="true" />,
  },
  success: {
    box: 'bg-success-50 text-success',
    icon: <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />,
  },
};

/** A callout: a bold line saying what happened, then what to do. */
export function Notice({
  tone,
  title,
  children,
  action,
}: {
  tone: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const t = tones[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={`flex gap-3 rounded-panel px-4 py-3 ${t.box}`}
    >
      {t.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
