import { Copy, Eye, History, Plus, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { Chip } from '../../components/ui/Chip';
import { Dialog } from '../../components/ui/Dialog';
import { Notice } from '../../components/ui/Notice';
import { MonthNav, PageHead, Panel, SegmentedChoice } from '../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import { listVenuePositions, listVenues } from '../../features/ministries/catalogService';
import { AssignmentDrawer } from '../../features/scheduling/AssignmentDrawer';
import { EditablePerson, RosterView } from '../../features/scheduling/RosterView';
import {
  copySchedule,
  getAssignmentHistory,
  getScheduleProblems,
  listServices,
  publishServices,
  removeAssignment,
  unpublishServices,
} from '../../features/scheduling/scheduleService';
import { useAsync } from '../../hooks/useAsync';
import { useVenueMonth } from '../../hooks/useVenueMonth';
import {
  addDays,
  formatFullDate,
  formatMonthDay,
  monthRange,
  monthTitle,
  shiftMonth,
  sundaysOfMonth,
} from '../../lib/format';
import { buildRoster } from '../../lib/roster';
import type { RosterCell, RosterRow } from '../../lib/roster';
import type { CopyScheduleResult } from '../../types/database';

type Slot = { date: string; positionId: string; label: string };

/** Fill positions with qualified, available people; copy, publish and revise a venue's month. */
export function ScheduleEditor({ finishLabel = 'Preview as volunteer' }: { finishLabel?: string }) {
  const toast = useToast();
  const venues = useAsync(listVenues);
  const { venueId, month, setVenueId, setMonth } = useVenueMonth(venues.data);
  const venue = venues.data?.find((v) => v.id === venueId) ?? null;

  const [slot, setSlot] = useState<Slot | null>(null);
  const [copyResult, setCopyResult] = useState<CopyScheduleResult | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [busy, setBusy] = useState<'publish' | 'unpublish' | 'copy' | null>(null);
  const [historyFor, setHistoryFor] = useState<RosterRow | null>(null);

  const sundays = sundaysOfMonth(month);

  // Keep the cell being edited in view: the panel covers the right-hand side (or the bottom on phones).
  const openSlot = slot ? `${slot.date}|${slot.positionId}` : null;
  useEffect(() => {
    if (!openSlot) return;
    const phone = window.matchMedia('(max-width: 767px)').matches;
    document.querySelector<HTMLElement>('button[aria-expanded="true"]')?.scrollIntoView({
      block: phone ? 'start' : 'nearest',
      inline: 'center',
      behavior: 'smooth',
    });
  }, [openSlot]);

  const load = useCallback(async () => {
    if (!venueId) return null;
    const { from, to } = monthRange(month);
    const [columns, services, problems] = await Promise.all([
      listVenuePositions(venueId),
      listServices({ venueId, from, to }),
      getScheduleProblems(from, to, venueId),
    ]);
    return {
      columns,
      services,
      problems,
      rows: buildRoster(columns, services, sundaysOfMonth(month)),
    };
  }, [venueId, month]);
  const roster = useAsync(load);

  if (venues.error && !venues.data)
    return <ErrorBlock message={venues.error.message} onRetry={venues.reload} />;

  const title = monthTitle(month);
  const data = roster.data;
  const drafts = data?.services.filter((s) => s.status === 'draft').length ?? 0;
  const published = data?.services.filter((s) => s.status === 'published').length ?? 0;
  const problems = data?.problems ?? [];

  function changeVenue(id: string) {
    setSlot(null);
    setCopyResult(null);
    setVenueId(id);
  }

  function changeMonth(next: string) {
    setSlot(null);
    setCopyResult(null);
    setMonth(next);
  }

  async function publish() {
    if (!venueId) return;
    setBusy('publish');
    const { from, to } = monthRange(month);
    try {
      const n = await publishServices(venueId, from, to);
      toast.success(
        n > 0 ? `${title} published. Volunteers can see it now.` : 'Nothing to publish.',
      );
    } catch (err) {
      // The banner above the roster lists every problem; the toast says why this click did nothing.
      toast.error(err instanceof Error ? err.message : 'We couldn’t publish the schedule.');
    } finally {
      setBusy(null);
      roster.reload();
    }
  }

  async function unpublish() {
    if (!venueId) return;
    setBusy('unpublish');
    const { from, to } = monthRange(month);
    try {
      await unpublishServices(venueId, from, to);
      toast.success(`${title} unpublished. Volunteers can’t see it until you publish it again.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t unpublish the schedule.');
    } finally {
      setBusy(null);
      setConfirmUnpublish(false);
      roster.reload();
    }
  }

  async function copyFromPrevious() {
    if (!venueId) return;
    const previous = shiftMonth(month, -1);
    const sourceStart = sundaysOfMonth(previous)[0];
    const targetStart = sundays[0];
    const sourceEnd = addDays(sourceStart, (sundays.length - 1) * 7);
    setBusy('copy');
    setCopyResult(null);
    try {
      const result = await copySchedule(venueId, sourceStart, sourceEnd, targetStart);
      setCopyResult(result);
      toast.success(
        result.assignments_created > 0
          ? `Copied ${result.assignments_created} ${result.assignments_created === 1 ? 'assignment' : 'assignments'} from ${monthTitle(previous)} as drafts.`
          : 'Nothing was copied.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t copy the schedule.');
    } finally {
      setBusy(null);
      roster.reload();
    }
  }

  async function remove(assignmentId: string, name: string, label: string) {
    try {
      await removeAssignment(assignmentId);
      toast.success(`${name} removed from ${label}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t remove that person.');
    } finally {
      roster.reload();
    }
  }

  const renderCell = (row: RosterRow, cell: RosterCell) => {
    const selected = slot?.date === row.date && slot.positionId === cell.positionId;
    const open = () => setSlot({ date: row.date, positionId: cell.positionId, label: cell.label });
    return (
      <span className="flex flex-col items-start gap-1">
        {cell.people.map((p) => (
          <EditablePerson
            key={p.assignmentId}
            name={p.name}
            position={cell.label}
            onRemove={() => void remove(p.assignmentId, p.name, cell.label)}
          />
        ))}
        {cell.people.length === 0 ? (
          <button
            type="button"
            onClick={open}
            aria-label={`Choose someone for ${cell.label} on ${formatMonthDay(row.date)}`}
            aria-expanded={selected}
            className={`inline-flex min-h-11 scroll-mt-24 items-center gap-1.5 rounded-control border px-3 font-semibold text-brand transition-[background-color,border-color,transform] duration-150 hover:border-brand hover:bg-wash motion-safe:active:scale-95 ${
              selected ? 'border-2 border-brand bg-wash' : 'border-dashed border-line-strong'
            }`}
          >
            <Plus className="size-4" aria-hidden="true" />
            Choose
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            aria-label={`Add another person to ${cell.label} on ${formatMonthDay(row.date)}`}
            aria-expanded={selected}
            className={`grid size-8 scroll-mt-24 place-items-center rounded-full border text-brand transition-[background-color,border-color,transform] duration-150 hover:border-brand hover:bg-wash max-md:size-11 motion-safe:hover:scale-110 motion-safe:active:scale-90 ${
              selected ? 'border-2 border-brand bg-wash' : 'border-dashed border-line-strong'
            }`}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </span>
    );
  };

  const statusFor = (row: RosterRow) =>
    row.status === 'published' ? (
      <Chip tone="published">Published</Chip>
    ) : row.status === 'draft' ? (
      <Chip tone="draft">Draft</Chip>
    ) : (
      <span className="text-sm text-muted">Not started</span>
    );

  const previous = shiftMonth(month, -1);
  const currentRow = slot ? data?.rows.find((r) => r.date === slot.date) : undefined;
  const currentNames =
    currentRow?.cells.find((c) => c.positionId === slot?.positionId)?.people.map((p) => p.name) ??
    [];

  return (
    <div className={slot ? 'xl:pr-[24.5rem]' : ''}>
      <PageHead
        title="Schedules"
        subtitle="Select a position to choose who serves. Only qualified people are offered, and the reason is shown for anyone who can’t be added."
      >
        <Button onClick={() => void copyFromPrevious()} busy={busy === 'copy'} disabled={!venueId}>
          <Copy className="size-5" aria-hidden="true" />
          Copy from {monthTitle(previous).split(' ')[0]}
        </Button>
        {venueId && (
          <Link
            to={`/schedules?venue=${venueId}&month=${month}`}
            className={buttonClasses('secondary')}
          >
            <Eye className="size-5" aria-hidden="true" />
            {finishLabel}
          </Link>
        )}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {venues.data && (
            <SegmentedChoice
              label="Venue"
              items={venues.data.map((v) => ({ id: v.id, label: v.name }))}
              value={venueId}
              onChange={changeVenue}
            />
          )}
          <MonthNav
            title={title}
            onPrevious={() => changeMonth(shiftMonth(month, -1))}
            onNext={() => changeMonth(shiftMonth(month, 1))}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          {published > 0 && (
            <Button onClick={() => setConfirmUnpublish(true)} busy={busy === 'unpublish'}>
              Unpublish
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => void publish()}
            busy={busy === 'publish'}
            disabled={drafts === 0}
          >
            <Send className="size-5" aria-hidden="true" />
            Publish {title.split(' ')[0]}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid gap-3">
        {problems.length > 0 && (
          <Notice
            tone="warn"
            title={`${problems.length} ${problems.length === 1 ? 'assignment needs' : 'assignments need'} attention before you can publish`}
          >
            <ul className="m-0 mt-1 list-disc pl-5">
              {problems.slice(0, 3).map((p) => (
                <li key={`${p.assignment_id}-${p.problem}`}>{p.message}</li>
              ))}
              {problems.length > 3 && <li>and {problems.length - 3} more</li>}
            </ul>
          </Notice>
        )}
        {copyResult && (
          <Notice
            tone={
              copyResult.skipped.length + copyResult.days_skipped.length > 0 ? 'warn' : 'success'
            }
            title={`Copied ${copyResult.assignments_created} ${copyResult.assignments_created === 1 ? 'assignment' : 'assignments'} as drafts.`}
          >
            {copyResult.skipped.length + copyResult.days_skipped.length > 0 && (
              <>
                <p>These weren’t copied, and why:</p>
                <ul className="m-0 mt-1 list-disc pl-5">
                  {copyResult.days_skipped.map((d) => (
                    <li key={d.service_date}>
                      {formatMonthDay(d.service_date)}: {d.reason}
                    </li>
                  ))}
                  {copyResult.skipped.map((s) => (
                    <li key={`${s.service_date}-${s.volunteer}`}>
                      {s.volunteer} ({s.position}, {formatMonthDay(s.service_date)}): {s.reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Notice>
        )}
      </div>

      <Panel className="overflow-hidden" aria-label={`${venue?.name ?? ''} roster for ${title}`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          {!data ? (
            <span className="text-muted">Loading…</span>
          ) : (
            <>
              {drafts === 0 && published === 0 ? (
                <Chip tone="attention">No schedule yet</Chip>
              ) : drafts > 0 ? (
                <Chip tone="draft">{published > 0 ? `${drafts} not published` : 'Draft'}</Chip>
              ) : (
                <Chip tone="published">Published</Chip>
              )}
              <span>{sundays.length} Sundays</span>
              {problems.length === 0 ? (
                <Chip tone="published">No problems</Chip>
              ) : (
                <Chip tone="error">
                  {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
                </Chip>
              )}
              <span className="text-sm text-muted">
                Every position is optional and can have several people.
              </span>
            </>
          )}
        </div>

        {roster.error && !data ? (
          <div className="p-5">
            <ErrorBlock message={roster.error.message} onRetry={roster.reload} />
          </div>
        ) : !data || venues.loading ? (
          <div className="p-5">
            <LoadingBlock rows={5} label="Loading the schedule" />
          </div>
        ) : (
          <RosterView
            key={`${venueId}-${month}`}
            caption={`${venue?.name} roster, ${title}`}
            columns={data.columns}
            rows={data.rows}
            renderCell={renderCell}
            dateNote={(row) =>
              row.status === 'published'
                ? 'Published'
                : row.status === 'draft'
                  ? 'Draft'
                  : 'Not started'
            }
            cardBadge={statusFor}
            rowTools={(row) =>
              row.serviceId ? (
                <button
                  type="button"
                  onClick={() => setHistoryFor(row)}
                  className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-control text-sm font-semibold text-brand hover:bg-wash"
                >
                  <History className="size-4" aria-hidden="true" />
                  History
                </button>
              ) : null
            }
          />
        )}
      </Panel>

      {slot && venue && (
        <AssignmentDrawer
          key={`${slot.date}-${slot.positionId}`}
          venueId={venue.id}
          venueName={venue.name}
          date={slot.date}
          positionId={slot.positionId}
          positionLabel={slot.label}
          current={currentNames}
          onClose={() => setSlot(null)}
          onChanged={roster.reload}
        />
      )}

      <Dialog
        open={confirmUnpublish}
        alert
        onClose={() => setConfirmUnpublish(false)}
        title={`Unpublish ${title}?`}
        description="Volunteers will no longer see these Sundays. Assignments are kept, and you can publish again any time."
        footer={
          <>
            <Button onClick={() => setConfirmUnpublish(false)}>Keep published</Button>
            <Button variant="danger" busy={busy === 'unpublish'} onClick={() => void unpublish()}>
              Unpublish
            </Button>
          </>
        }
      />

      <HistoryDialog row={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

function HistoryDialog({ row, onClose }: { row: RosterRow | null; onClose: () => void }) {
  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      title={row ? `Changes for ${formatMonthDay(row.date)}` : 'Changes'}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {row?.serviceId && <HistoryList serviceId={row.serviceId} />}
    </Dialog>
  );
}

function HistoryList({ serviceId }: { serviceId: string }) {
  const load = useCallback(() => getAssignmentHistory(serviceId), [serviceId]);
  const { data, loading, error, reload } = useAsync(load);
  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data || loading) return <LoadingBlock rows={3} label="Loading history" />;
  if (data.length === 0) return <p className="text-muted">No one has been added or removed yet.</p>;
  return (
    <ul className="m-0 grid max-h-72 list-none gap-2 overflow-y-auto p-0">
      {data.map((h, i) => (
        <li key={`${h.changed_at}-${i}`} className="border-b border-line pb-2 last:border-b-0">
          <p>
            <strong>{h.volunteer_name}</strong> {h.action} as {h.position_name}
          </p>
          <p className="text-sm text-muted">
            by {h.actor_name}, {formatFullDate(h.changed_at.slice(0, 10))}
          </p>
        </li>
      ))}
    </ul>
  );
}
