import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Chip } from '../../components/ui/Chip';
import { MonthNav, PageHead, Panel, SegmentedChoice } from '../../components/ui/Parts';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { listVenuePositions, listVenues } from '../../features/ministries/catalogService';
import { ExportButtons } from '../../features/scheduling/ExportButtons';
import { RosterView, ViewCell } from '../../features/scheduling/RosterView';
import { listServices } from '../../features/scheduling/scheduleService';
import { useAsync } from '../../hooks/useAsync';
import { useVenueMonth } from '../../hooks/useVenueMonth';
import { monthRange, monthTitle, shiftMonth } from '../../lib/format';
import { VENUE_NOTES } from '../../lib/pdf';
import { buildRoster, isServing } from '../../lib/roster';
import { useSignedIn } from '../auth';
import { buttonClasses } from '../../components/ui/buttonStyles';

/** Published rosters for every venue, with the signed-in volunteer's Sundays highlighted. */
export function SchedulesPage() {
  const { volunteer } = useSignedIn();
  const myId = volunteer?.id ?? null;

  const venues = useAsync(listVenues);
  const { venueId, month, setVenueId, setMonth } = useVenueMonth(venues.data);
  const venue = venues.data?.find((v) => v.id === venueId) ?? null;

  const load = useCallback(async () => {
    if (!venueId) return null;
    const { from, to } = monthRange(month);
    const [columns, services] = await Promise.all([
      listVenuePositions(venueId),
      listServices({ venueId, from, to, status: 'published' }),
    ]);
    return { columns, rows: buildRoster(columns, services) };
  }, [venueId, month]);
  const roster = useAsync(load);

  if (venues.error && !venues.data)
    return <ErrorBlock message={venues.error.message} onRetry={venues.reload} />;

  const title = monthTitle(month);
  const note = venue ? VENUE_NOTES[venue.name] : undefined;
  const hasRows = (roster.data?.rows.length ?? 0) > 0;

  return (
    <div>
      <PageHead
        title="Schedules"
        subtitle="Published rosters for every venue. Your Sundays are highlighted."
      >
        {venue && roster.data && (
          <ExportButtons
            venueName={venue.name}
            month={month}
            columns={roster.data.columns.map((c) => c.label)}
            rows={roster.data.rows}
            disabled={!hasRows}
          />
        )}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        {venues.data && (
          <SegmentedChoice
            label="Venue"
            items={venues.data.map((v) => ({ id: v.id, label: v.name }))}
            value={venueId}
            onChange={setVenueId}
          />
        )}
        <MonthNav
          title={title}
          onPrevious={() => setMonth(shiftMonth(month, -1))}
          onNext={() => setMonth(shiftMonth(month, 1))}
        />
      </div>

      <Panel className="overflow-hidden print:border-0">
        <div className="hidden print:block print:p-4">
          <p className="font-display text-xl font-semibold">
            Lipa New Hope Church Ministries International
          </p>
          <p className="text-sm">
            {venue?.name} · {title}
          </p>
        </div>

        {roster.error && !roster.data ? (
          <div className="p-5">
            <ErrorBlock message={roster.error.message} onRetry={roster.reload} />
          </div>
        ) : !roster.data || venues.loading ? (
          <div className="p-5">
            <LoadingBlock rows={5} label="Loading the schedule" />
          </div>
        ) : !hasRows ? (
          <EmptyState title={`No ${venue?.name ?? ''} schedule for ${title} yet`}>
            When your administrator publishes it, it appears here and your Sundays are highlighted.
          </EmptyState>
        ) : (
          <>
            <RosterView
              caption={`${venue?.name} schedule, ${title}`}
              columns={roster.data.columns}
              rows={roster.data.rows}
              hideEmptyOnPhone
              highlightRow={(row) => isServing(row, myId)}
              dateNote={(row) => (isServing(row, myId) ? 'You’re serving' : 'Sunday')}
              cardBadge={(row) =>
                isServing(row, myId) ? (
                  <Chip tone="you" icon={false}>
                    You’re serving
                  </Chip>
                ) : null
              }
              renderCell={(_row, cell) => <ViewCell cell={cell} myId={myId} />}
            />
            {note && (
              <p className="px-4 pb-5 pt-2 text-center font-semibold italic text-deep print:text-black">
                {note}
              </p>
            )}
          </>
        )}
      </Panel>

      <p className="mt-4 text-sm text-muted print:hidden">
        Not seeing a Sunday you expect? It may not be published yet.{' '}
        <Link to="/availability" className={buttonClasses('quiet', 'sm')}>
          Set your availability
        </Link>
      </p>
    </div>
  );
}
