import { Ban, Check, Info, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import { useSignedIn } from '../../app/auth';
import { useAsync } from '../../hooks/useAsync';
import { staffPaths } from '../../lib/roles';
import { formatLongDate, formatShortDate } from '../../lib/format';
import { assignVolunteer, getOrCreateService, suggestVolunteers } from './scheduleService';
import type { VolunteerSuggestion } from '../../types/database';

type Props = {
  venueId: string;
  venueName: string;
  date: string;
  positionId: string;
  positionLabel: string;
  /** Who already holds this position this Sunday. */
  current: string[];
  onClose: () => void;
  /** Called after someone is added so the roster behind can refresh. */
  onChanged: () => void;
};

/**
 * Choose who serves in one position on one Sunday. Only qualified, active people are listed;
 * each person who can't be added shows why, in plain words. A right-hand panel on wide
 * screens and a bottom sheet on phones. Recommendations only: the administrator decides.
 */
export function AssignmentDrawer({
  venueId,
  venueName,
  date,
  positionId,
  positionLabel,
  current,
  onClose,
  onChanged,
}: Props) {
  const toast = useToast();
  const { role } = useSignedIn();
  const panelRef = useRef<HTMLElement>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Move focus into the panel, and give it back to whatever opened it when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  // Escape closes the panel wherever focus is (it leaves the panel when a button is pressed).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const load = useCallback(async () => {
    const service = await getOrCreateService(venueId, date);
    const suggestions = await suggestVolunteers(service.id, positionId);
    return { service, suggestions };
  }, [venueId, date, positionId]);
  const { data, loading, error, reload } = useAsync(load);

  async function add(s: VolunteerSuggestion) {
    if (!data) return;
    setAddingId(s.volunteer_id);
    try {
      await assignVolunteer(data.service, positionId, s.volunteer_id);
      toast.success(`${s.display_name} added to ${positionLabel}.`);
      onChanged();
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t add that person.');
    } finally {
      setAddingId(null);
    }
  }

  const firstAssignable = data?.suggestions.findIndex((s) => s.can_assign) ?? -1;

  // Rendered at the top of the page so no animated or transformed ancestor can move it.
  return createPortal(
    <aside
      ref={panelRef}
      role="dialog"
      aria-labelledby="drawer-title"
      tabIndex={-1}
      className="panel-in fixed inset-x-2 bottom-16 z-40 flex max-h-[62vh] flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-pop outline-none md:inset-x-auto md:inset-y-0 md:bottom-0 md:right-0 md:max-h-none md:w-[24rem] md:rounded-none md:border-y-0 md:border-r-0 print:hidden"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="drawer-title" className="text-2xl">
            {positionLabel}
          </h2>
          <p className="text-muted">
            {venueName} · {formatLongDate(date)}
          </p>
          {current.length > 0 && (
            <p className="mt-1 text-sm text-muted">Already here: {current.join(', ')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="grid size-9 shrink-0 place-items-center rounded-control text-muted hover:bg-wash hover:text-deep"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && !data ? (
          <div className="p-5">
            <ErrorBlock message={error.message} onRetry={reload} />
          </div>
        ) : !data || loading ? (
          <div className="p-5">
            <LoadingBlock rows={4} label="Loading suggestions" />
          </div>
        ) : data.suggestions.length === 0 ? (
          <div className="p-5 text-muted">
            <p className="font-semibold text-deep">No one is qualified for {positionLabel} yet.</p>
            <p className="mt-1">
              Choose who can do it under <Link to={staffPaths(role).people}>Volunteers</Link>, then
              come back.
            </p>
          </div>
        ) : (
          <ul
            className="m-0 list-none p-0"
            aria-label={`Volunteers qualified for ${positionLabel}`}
          >
            {data.suggestions.map((s, i) => (
              <li
                key={s.volunteer_id}
                className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-5 py-3 last:border-b-0 ${
                  s.can_assign ? '' : 'bg-page'
                }`}
              >
                <Avatar name={s.display_name} />
                <div className="min-w-0">
                  <p className={`font-bold ${s.can_assign ? 'text-ink' : 'text-muted'}`}>
                    {s.display_name}
                  </p>
                  <p
                    className={`mt-0.5 flex items-start gap-1.5 text-sm ${
                      s.can_assign
                        ? s.status === 'available'
                          ? 'text-success'
                          : 'text-muted'
                        : 'text-danger'
                    }`}
                  >
                    {s.can_assign ? (
                      s.status === 'available' ? (
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      )
                    ) : (
                      <Ban className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {s.reason}
                      {s.can_assign && (
                        <span className="text-muted">
                          {' '}
                          {s.last_served
                            ? `Last served ${formatShortDate(s.last_served)}.`
                            : 'Hasn’t served yet.'}
                          {s.times_served_8_weeks >= 3 &&
                            ` Served ${s.times_served_8_weeks} times in the last 8 weeks.`}
                        </span>
                      )}
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={i === firstAssignable ? 'primary' : 'secondary'}
                  disabled={!s.can_assign}
                  busy={addingId === s.volunteer_id}
                  onClick={() => void add(s)}
                  aria-label={
                    s.can_assign
                      ? `Add ${s.display_name} to ${positionLabel}`
                      : `${s.display_name} can’t be added`
                  }
                >
                  {s.can_assign ? 'Add' : 'Can’t add'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-line px-5 py-3 text-sm text-muted">
        Only people qualified for {positionLabel} are listed, longest-rested first.{' '}
        <Link to={staffPaths(role).people}>Change qualifications</Link>
      </footer>
    </aside>,
    document.body,
  );
}
