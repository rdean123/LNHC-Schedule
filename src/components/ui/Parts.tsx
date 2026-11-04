import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-deep font-bold text-white ${
        large ? 'size-14 font-display text-xl' : 'size-6 text-[0.6875rem]'
      }`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** A person in a roster: initial and name, with an optional remove button. */
export function PersonPill({
  name,
  onRemove,
  removeLabel,
}: {
  name: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-wash py-0.5 pl-1 pr-2.5 font-medium text-deep">
      <Avatar name={name} />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${name}`}
          className="-mr-1 grid size-6 place-items-center rounded-full text-muted hover:bg-mist hover:text-deep"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
      )}
    </span>
  );
}

export function Panel({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`rounded-panel border border-line bg-surface ${className}`} {...rest}>
      {children}
    </section>
  );
}

export function PanelHead({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
      <h2 id={id} className="text-xl md:text-2xl">
        {title}
      </h2>
      {children}
    </div>
  );
}

/** Segmented buttons for choosing one thing (a venue). */
export function SegmentedChoice<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: T; label: string }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-panel border border-line bg-surface p-1"
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={`min-h-10 rounded-control px-4 font-semibold ${
              active ? 'bg-deep text-white' : 'text-muted hover:bg-wash hover:text-deep'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function MonthNav({
  title,
  onPrevious,
  onNext,
}: {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div role="group" aria-label="Month" className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous month"
        className="grid size-11 place-items-center rounded-control text-brand hover:bg-wash"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <strong
        aria-live="polite"
        className="min-w-40 text-center font-display text-xl font-semibold text-deep"
      >
        {title}
      </strong>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next month"
        className="grid size-11 place-items-center rounded-control text-brand hover:bg-wash"
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function PageHead({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[68ch] text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
