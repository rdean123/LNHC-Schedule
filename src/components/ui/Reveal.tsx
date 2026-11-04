import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Eases a section in the first time it scrolls into view. Without IntersectionObserver, or with
 * "reduce motion" on (the stylesheet then never hides it), the content is simply there.
 * `delay` (milliseconds) staggers neighbours.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen]);

  return (
    <div
      ref={ref}
      data-seen={seen}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`reveal ${className}`}
    >
      {children}
    </div>
  );
}
