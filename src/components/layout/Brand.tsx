import { Link } from 'react-router-dom';

/** The seal and name. The logo is used at 40px or larger with the name beside it. */
export function Brand({
  to,
  subtitle,
  className = '',
}: {
  to: string;
  subtitle: string;
  className?: string;
}) {
  return (
    <Link to={to} className={`flex items-center gap-3 no-underline ${className}`}>
      <img src="/lnhc-logo.png" alt="" width="40" height="40" className="size-10 rounded-full" />
      <span className="whitespace-nowrap leading-none">
        <span className="font-display text-xl font-semibold">LNHC Schedule</span>
        <span className="mt-0.5 block text-xs text-muted">{subtitle}</span>
      </span>
    </Link>
  );
}

/** Shown only in `npm run demo`, so nobody mistakes sample data for the real thing. */
export function DemoBanner() {
  if (import.meta.env.MODE !== 'demo') return null;
  return (
    <div className="bg-deep px-4 py-1.5 text-center text-sm text-white print:hidden" role="note">
      Preview with sample data. Nothing you do here is saved, and a reload resets it.
    </div>
  );
}
