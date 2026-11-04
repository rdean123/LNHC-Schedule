import { Plus } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { buttonClasses } from '../../../components/ui/buttonStyles';
import { Chip } from '../../../components/ui/Chip';
import { Notice } from '../../../components/ui/Notice';
import { PageHead, Panel, PanelHead } from '../../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../../components/ui/States';
import { getAvailabilityForDates } from '../../../features/availability/availabilityService';
import { listVenues } from '../../../features/ministries/catalogService';
import { getScheduleProblems, listServices } from '../../../features/scheduling/scheduleService';
import { listVolunteerDetails } from '../../../features/volunteers/volunteerService';
import { useAsync } from '../../../hooks/useAsync';
import {
  addDays,
  currentMonth,
  daysBetween,
  formatLongDate,
  formatMonthDay,
  monthTitle,
  nextSundays,
  shiftMonth,
  sundaysOfMonth,
  todayIso,
} from '../../../lib/format';

type Item = {
  key: string;
  title: string;
  detail: string;
  to: string;
  action: string;
  primary: boolean;
};

const link = (venueId: string, month: string) => `/admin/schedule?venue=${venueId}&month=${month}`;

/** What needs attention this week, and the next three Sundays at a glance. */
export function AdminDashboardPage() {
  const load = useCallback(async () => {
    const today = todayIso();
    const sundays = nextSundays(today, 3);
    const nextMonth = shiftMonth(currentMonth(today), 1);
    const nextMonthSundays = sundaysOfMonth(nextMonth);
    const horizon = addDays(today, 120);

    const [venues, upcoming, problems, volunteers, answers] = await Promise.all([
      listVenues(),
      listServices({ from: sundays[0], to: horizon }),
      getScheduleProblems(today, horizon),
      listVolunteerDetails(),
      getAvailabilityForDates(nextMonthSundays),
    ]);

    const items: Item[] = [];
    for (const v of venues) {
      const missing = sundays.find(
        (d) => !upcoming.some((s) => s.venue_id === v.id && s.service_date === d),
      );
      if (missing) {
        const days = daysBetween(today, missing);
        items.push({
          key: `none-${v.id}`,
          title: `${v.name} · ${formatLongDate(missing)}`,
          detail: `No roster yet. ${days === 0 ? 'Service is today.' : `Service is in ${days} ${days === 1 ? 'day' : 'days'}.`}`,
          to: link(v.id, missing.slice(0, 7)),
          action: 'Create roster',
          primary: true,
        });
      }
    }
    const draftGroups = new Map<
      string,
      { venueId: string; venue: string; month: string; count: number }
    >();
    for (const s of upcoming.filter((x) => x.status === 'draft')) {
      const v = venues.find((x) => x.id === s.venue_id);
      if (!v) continue;
      const key = `${v.id}-${s.service_date.slice(0, 7)}`;
      const g = draftGroups.get(key) ?? {
        venueId: v.id,
        venue: v.name,
        month: s.service_date.slice(0, 7),
        count: 0,
      };
      g.count += 1;
      draftGroups.set(key, g);
    }
    for (const g of draftGroups.values()) {
      items.push({
        key: `draft-${g.venueId}-${g.month}`,
        title: `${g.venue} · ${monthTitle(g.month)}`,
        detail: `Draft with ${g.count} ${g.count === 1 ? 'Sunday' : 'Sundays'}. Not visible to volunteers yet.`,
        to: link(g.venueId, g.month),
        action: 'Review and publish',
        primary: false,
      });
    }
    if (problems.length > 0) {
      const p = problems[0];
      items.push({
        key: 'problems',
        title: `${problems.length} ${problems.length === 1 ? 'assignment needs' : 'assignments need'} attention`,
        detail: p.message,
        to: link(p.venue_id, p.service_date.slice(0, 7)),
        action: 'Review',
        primary: false,
      });
    }

    const active = volunteers.filter((v) => v.is_active);
    const unanswered = active.filter((v) => !answers.some((a) => a.volunteer_id === v.id));
    const invitable = active.filter((v) => v.email && !v.user_id);
    return { today, sundays, nextMonth, venues, upcoming, items, unanswered, invitable };
  }, []);
  const { data, loading, error, reload } = useAsync(load);

  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data || loading) return <LoadingBlock rows={6} label="Loading the dashboard" />;

  const { today, sundays, nextMonth, venues, upcoming, items, unanswered, invitable } = data;

  return (
    <div>
      <PageHead
        title="Dashboard"
        subtitle={`Today is ${formatLongDate(today)}. The next service is ${formatLongDate(sundays[0])}.`}
      >
        <Link to="/admin/schedule" className={buttonClasses('primary')}>
          <Plus className="size-5" aria-hidden="true" />
          New schedule
        </Link>
      </PageHead>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Panel aria-labelledby="attention">
            <PanelHead id="attention" title="Needs your attention">
              {items.length > 0 && (
                <Chip tone="attention">
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </Chip>
              )}
            </PanelHead>
            {items.length === 0 ? (
              <div className="p-5">
                <Notice tone="success" title="Everything is in order.">
                  Every upcoming Sunday has a roster, nothing is waiting to be published, and no
                  assignment has a problem.
                </Notice>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="grid items-center gap-x-4 gap-y-3 border-b border-line px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_auto] md:px-6"
                  >
                    <div>
                      <p className="font-bold text-deep">{item.title}</p>
                      <p className="text-muted">{item.detail}</p>
                    </div>
                    <Link
                      to={item.to}
                      className={buttonClasses(
                        item.primary ? 'primary' : 'secondary',
                        'sm',
                        'max-sm:w-full',
                      )}
                    >
                      {item.action}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel aria-labelledby="next-three">
            <PanelHead id="next-three" title="Next three Sundays">
              <Link to="/admin/schedule">Open schedules</Link>
            </PanelHead>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Roster status for the next three Sundays, by venue
                </caption>
                <thead>
                  <tr className="bg-wash text-sm text-deep">
                    <th scope="col" className="px-4 py-3">
                      Sunday
                    </th>
                    {venues.map((v) => (
                      <th key={v.id} scope="col" className="px-4 py-3">
                        {v.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sundays.map((d) => (
                    <tr key={d} className="border-t border-line">
                      <th
                        scope="row"
                        className="whitespace-nowrap px-4 py-3.5 font-display text-lg font-semibold text-deep"
                      >
                        {formatMonthDay(d).replace(/^\w+ /, (m) => m.slice(0, 3) + ' ')}
                      </th>
                      {venues.map((v) => {
                        const s = upcoming.find((x) => x.venue_id === v.id && x.service_date === d);
                        return (
                          <td key={v.id} className="px-4 py-3.5">
                            <Link to={link(v.id, d.slice(0, 7))} className="no-underline">
                              {s?.status === 'published' ? (
                                <Chip tone="published">Published</Chip>
                              ) : s ? (
                                <Chip tone="draft">Draft</Chip>
                              ) : (
                                <Chip tone="attention">No roster</Chip>
                              )}
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Panel>
            <div className="p-5 md:p-6">
              <h2 className="text-2xl">{monthTitle(nextMonth).split(' ')[0]} availability</h2>
              {unanswered.length === 0 ? (
                <p className="mt-2 text-muted">Everyone has answered.</p>
              ) : (
                <>
                  <p className="mb-3 mt-2 text-muted">
                    {unanswered.length}{' '}
                    {unanswered.length === 1 ? 'volunteer hasn’t' : 'volunteers haven’t'} answered
                    yet.
                  </p>
                  <ul className="m-0 list-none p-0">
                    {unanswered.slice(0, 5).map((v) => (
                      <li
                        key={v.id}
                        className="flex justify-between gap-3 border-b border-line py-2 last:border-b-0"
                      >
                        <span>{v.display_name}</span>
                        <span className="text-muted">No answer</span>
                      </li>
                    ))}
                  </ul>
                  {unanswered.length > 5 && (
                    <p className="mt-2 text-sm text-muted">and {unanswered.length - 5} more</p>
                  )}
                </>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="p-5 md:p-6">
              <h2 className="text-2xl">Not invited yet</h2>
              {invitable.length === 0 ? (
                <p className="mt-2 text-muted">Everyone with an email address has an account.</p>
              ) : (
                <>
                  <p className="mb-3 mt-2 text-muted">
                    {invitable.length}{' '}
                    {invitable.length === 1 ? 'volunteer has' : 'volunteers have'} an email but no
                    account.
                  </p>
                  <ul className="m-0 list-none p-0">
                    {invitable.slice(0, 5).map((v) => (
                      <li
                        key={v.id}
                        className="flex justify-between gap-3 border-b border-line py-2 last:border-b-0"
                      >
                        <span>{v.display_name}</span>
                        <Link to={`/admin/volunteers?volunteer=${v.id}`}>Invite</Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
