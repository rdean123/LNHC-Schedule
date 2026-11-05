import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSignedIn } from '../../app/auth';
import { roleLabel } from '../../lib/roles';
import type { AppRole } from '../../types/database';

const views: AppRole[] = ['admin', 'scheduler', 'volunteer'];

/**
 * Lets an administrator preview the app as a schedule maker or a volunteer. It changes only
 * what the screens show: the account keeps its administrator permissions in the database.
 * Renders nothing for anyone else.
 */
export function ViewSwitcher({ className = '' }: { className?: string }) {
  const { role, realRole, setViewAs } = useSignedIn();
  const navigate = useNavigate();
  if (realRole !== 'admin') return null;

  const change = (next: AppRole) => {
    setViewAs(next === 'admin' ? null : next);
    navigate(next === 'admin' ? '/admin' : '/');
  };

  return (
    <label
      className={`flex min-w-0 items-center gap-2 text-sm font-semibold text-muted ${className}`}
    >
      <Eye className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">View as</span>
      <select
        value={role}
        onChange={(e) => change(e.target.value as AppRole)}
        className="min-h-9 min-w-0 rounded-control border border-line bg-surface px-2 font-semibold text-ink"
      >
        {views.map((v) => (
          <option key={v} value={v}>
            {roleLabel(v)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A reminder strip shown while an administrator is previewing another role. */
export function ViewAsBanner() {
  const { role, realRole, setViewAs } = useSignedIn();
  const navigate = useNavigate();
  if (realRole !== 'admin' || role === 'admin') return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-deep px-4 py-2 text-sm text-white print:hidden"
    >
      <span>
        Previewing as <strong>{roleLabel(role)}</strong>. You still have administrator access.
      </span>
      <button
        type="button"
        onClick={() => {
          setViewAs(null);
          navigate('/admin');
        }}
        className="font-semibold underline underline-offset-2"
      >
        Back to Administrator
      </button>
    </div>
  );
}
