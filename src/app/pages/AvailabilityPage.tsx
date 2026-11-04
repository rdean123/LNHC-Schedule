import { Ban, Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { MonthNav, PageHead, Panel, PanelHead } from '../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import {
  getMyAvailability,
  setMyAvailability,
} from '../../features/availability/availabilityService';
import { listServices } from '../../features/scheduling/scheduleService';
import { useAsync } from '../../hooks/useAsync';
import {
  currentMonth,
  formatLongDate,
  isValidMonth,
  monthRange,
  monthTitle,
  parseIso,
  shiftMonth,
  sundaysOfMonth,
} from '../../lib/format';
import { useSignedIn } from '../auth';

type Answer = { isAvailable: boolean; note: string };
type Edits = { month: string; answers: Record<string, Answer> };

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Tap a Sunday to switch between Can serve and Away. Days you're already serving are locked. */
export function AvailabilityPage() {
  const { volunteer } = useSignedIn();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [defaultMonth] = useState(() => currentMonth());
  const monthParam = params.get('month');
  const month = isValidMonth(monthParam) ? monthParam : defaultMonth;
  const myId = volunteer?.id ?? null;

  const [edits, setEdits] = useState<Edits>({ month, answers: {} });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { from, to } = monthRange(month);
    const [saved, published] = await Promise.all([
      getMyAvailability(from, to),
      listServices({ status: 'published', from, to }),
    ]);
    const serving = new Map<string, string>();
    for (const s of published) {
      if (s.assignments.some((a) => a.volunteer_id === myId)) serving.set(s.service_date, s.id);
    }
    return {
      saved: new Map(
        saved.map((a) => [a.service_date, { isAvailable: a.is_available, note: a.note ?? '' }]),
      ),
      serving,
    };
  }, [month, myId]);
  const { data, loading, error, reload } = useAsync(load);

  if (!volunteer) {
    return (
      <div>
        <PageHead title="My availability" />
        <Notice tone="warn" title="Your account isn’t linked to a volunteer yet.">
          Ask your administrator to link it, and then you can set which Sundays you can serve.
        </Notice>
      </div>
    );
  }
  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;

  const sundays = sundaysOfMonth(month);
  const pending = edits.month === month ? edits.answers : {};
  const answerFor = (date: string): Answer | undefined => pending[date] ?? data?.saved.get(date);
  const dirty = Object.keys(pending).length > 0;

  function setAnswer(date: string, patch: Partial<Answer>) {
    const current = answerFor(date) ?? { isAvailable: true, note: '' };
    setEdits({ month, answers: { ...pending, [date]: { ...current, ...patch } } });
  }

  function toggle(date: string) {
    const current = answerFor(date);
    setAnswer(date, { isAvailable: current ? !current.isAvailable : true });
  }

  function setAll() {
    const answers = { ...pending };
    for (const d of sundays) {
      if (data?.serving.has(d)) continue;
      answers[d] = { isAvailable: true, note: answerFor(d)?.note ?? '' };
    }
    setEdits({ month, answers });
  }

  async function save() {
    setSaving(true);
    let saved = 0;
    try {
      for (const [date, a] of Object.entries(pending)) {
        await setMyAvailability(date, a.isAvailable, a.isAvailable ? '' : a.note);
        saved += 1;
      }
      setEdits({ month, answers: {} });
      reload();
      toast.success('Saved. Your administrator can see this now.');
    } catch (err) {
      reload();
      if (saved > 0)
        setEdits({ month, answers: Object.fromEntries(Object.entries(pending).slice(saved)) });
      toast.error(err instanceof Error ? err.message : 'We couldn’t save your availability.');
    } finally {
      setSaving(false);
    }
  }

  // Calendar cells: blanks before the 1st, then each day.
  const first = `${month}-01`;
  const blanks = parseIso(first).getUTCDay();
  const lastDay = Number(monthRange(month).to.slice(8));
  const days = Array.from(
    { length: lastDay },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  );
  const awayDays = sundays.filter((d) => answerFor(d)?.isAvailable === false);

  return (
    <div>
      <PageHead
        title="My availability"
        subtitle="Tap a Sunday to switch between “Can serve” and “Away”. Your administrator sees this when building the roster."
      />

      <Panel>
        <PanelHead title="Choose your Sundays">
          <div className="flex flex-wrap items-center gap-3">
            <MonthNav
              title={monthTitle(month)}
              onPrevious={() => setParams({ month: shiftMonth(month, -1) }, { replace: true })}
              onNext={() => setParams({ month: shiftMonth(month, 1) }, { replace: true })}
            />
            <Button size="sm" onClick={setAll} disabled={!data}>
              Mark every Sunday “Can serve”
            </Button>
          </div>
        </PanelHead>

        <div className="p-5 md:p-6">
          {!data || loading ? (
            <LoadingBlock rows={4} label="Loading your availability" />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted" aria-hidden="true">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4" /> Can serve
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Ban className="size-4" /> Away
                </span>
                <span className="inline-flex items-center gap-1.5">No answer yet</span>
              </div>

              <div
                className="grid max-w-[42rem] grid-cols-7 gap-1.5 sm:gap-2"
                role="group"
                aria-label={monthTitle(month)}
              >
                {weekdays.map((d) => (
                  <div key={d} className="pb-1 text-center text-[0.8125rem] font-bold text-muted">
                    {d}
                  </div>
                ))}
                {Array.from({ length: blanks }, (_, i) => (
                  <span key={`b${i}`} />
                ))}
                {days.map((date) => {
                  const day = Number(date.slice(8));
                  if (parseIso(date).getUTCDay() !== 0) {
                    return (
                      <div
                        key={date}
                        className="grid min-h-11 place-items-center rounded-control text-[0.9375rem] text-muted"
                      >
                        {day}
                      </div>
                    );
                  }
                  if (data.serving.has(date)) {
                    return (
                      <div
                        key={date}
                        role="img"
                        aria-label={`${formatLongDate(date)}: you are serving`}
                        className="grid min-h-16 content-center justify-items-center rounded-control bg-deep px-0.5 text-white"
                      >
                        <span className="font-bold">{day}</span>
                        <span className="text-[0.6875rem] font-semibold">Serving</span>
                      </div>
                    );
                  }
                  const a = answerFor(date);
                  const state = a === undefined ? 'none' : a.isAvailable ? 'yes' : 'away';
                  const tone =
                    state === 'yes'
                      ? 'border-success bg-success-50 text-success'
                      : state === 'away'
                        ? 'border-line-strong bg-draft-50 text-draft'
                        : 'border-line-strong bg-surface text-ink';
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => toggle(date)}
                      aria-pressed={state === 'yes' ? true : state === 'away' ? false : undefined}
                      className={`grid min-h-16 content-center justify-items-center rounded-control border font-bold transition-[transform,background-color,border-color,color] duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-95 ${tone}`}
                    >
                      <span className="sr-only">{formatLongDate(date)}. </span>
                      <span>{day}</span>
                      {state === 'yes' && (
                        <span className="pop flex items-center gap-0.5 text-[0.6875rem] font-semibold">
                          <Check className="size-3.5" aria-hidden="true" />
                          <span className="max-sm:sr-only">Can serve</span>
                        </span>
                      )}
                      {state === 'away' && (
                        <span className="pop flex items-center gap-0.5 text-[0.6875rem] font-semibold">
                          <Ban className="size-3.5" aria-hidden="true" />
                          <span className="max-sm:sr-only">Away</span>
                        </span>
                      )}
                      {state === 'none' && (
                        <span className="text-[0.6875rem] font-normal text-muted max-sm:sr-only">
                          No answer
                        </span>
                      )}
                      <span className="sr-only"> Tap to change.</span>
                    </button>
                  );
                })}
              </div>

              {awayDays.length > 0 && (
                <div className="mt-6 max-w-[42rem]">
                  <h2 className="mb-3 text-xl">Notes for your administrator (optional)</h2>
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {awayDays.map((date) => (
                      <li
                        key={date}
                        className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:items-center"
                      >
                        <label htmlFor={`note-${date}`} className="font-semibold text-deep">
                          Away {formatLongDate(date).replace(/^\w+, /, '')}
                        </label>
                        <TextInput
                          id={`note-${date}`}
                          placeholder="For example: back from a trip"
                          maxLength={200}
                          value={answerFor(date)?.note ?? ''}
                          onChange={(e) => setAnswer(date, { note: e.target.value })}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* With changes pending, Save stays pinned above the tab bar on a phone. */}
              <div
                className={`mt-6 flex flex-wrap items-center gap-3 ${
                  dirty
                    ? 'max-md:fixed max-md:inset-x-0 max-md:bottom-14 max-md:z-20 max-md:mt-0 max-md:border-t max-md:border-line max-md:bg-surface max-md:p-3 max-md:shadow-pop'
                    : ''
                }`}
              >
                <Button
                  variant="primary"
                  onClick={() => void save()}
                  busy={saving}
                  disabled={!dirty}
                >
                  <Check className="size-5" aria-hidden="true" />
                  Save availability
                </Button>
                {dirty && <span className="text-sm text-muted">You have unsaved changes.</span>}
              </div>
            </>
          )}
        </div>
      </Panel>

      <div className="mt-4">
        <Notice tone="info">
          Sundays you’re already scheduled on show as “Serving” and can’t be changed here. To step
          out of one, message your administrator.
        </Notice>
      </div>
    </div>
  );
}
