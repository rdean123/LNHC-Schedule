import { AlertTriangle, Ban, Check, Info, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChipTone = 'published' | 'draft' | 'attention' | 'error' | 'info' | 'you';

const tones: Record<ChipTone, string> = {
  published: 'bg-success-50 text-success',
  draft: 'bg-draft-50 text-draft',
  attention: 'bg-warn-50 text-warn',
  error: 'bg-danger-50 text-danger',
  info: 'bg-wash text-brand-hover',
  you: 'bg-deep text-white',
};

const icons: Partial<Record<ChipTone, ReactNode>> = {
  published: <Check className="size-4" aria-hidden="true" />,
  draft: <Pencil className="size-4" aria-hidden="true" />,
  attention: <AlertTriangle className="size-4" aria-hidden="true" />,
  error: <Ban className="size-4" aria-hidden="true" />,
  info: <Info className="size-4" aria-hidden="true" />,
};

/** A status label. Always icon plus words, so colour is never the only signal. */
export function Chip({
  tone,
  children,
  icon = true,
}: {
  tone: ChipTone;
  children: ReactNode;
  icon?: boolean;
}) {
  const small = tone === 'you';
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${tones[tone]} ${
        small ? 'min-h-5.5 px-2 text-xs' : 'min-h-7 px-2.5 text-sm'
      }`}
    >
      {icon && icons[tone]}
      {children}
    </span>
  );
}
