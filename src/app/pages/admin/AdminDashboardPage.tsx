import { Plus } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { buttonClasses } from '../../../components/ui/buttonStyles';
import { Chip } from '../../../components/ui/Chip';
import { PageHead, Panel, PanelHead } from '../../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../../components/ui/States';
import { AttentionPanel } from '../../../features/administration/AttentionPanel';
import { loadOverview } from '../../../features/administration/overview';
import { useAsync } from '../../../hooks/useAsync';
import { formatLongDate, formatMonthDay, monthTitle } from '../../../lib/format';
import { staffPaths } from '../../../lib/roles';
import { useSignedIn } from '../../auth';

/** What needs attention this week, and the next three Sundays at a glance. */
export function AdminDashboardPage() {
  const { role } = useSignedIn();
  const paths = staffPaths(role);
  const load = useCallback(() => loadOverview(role), [role]);
  const { data, loading, error, reload } = useAsync(load);

  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data || loading) return <LoadingBlock rows={6} label="Loading the dashboard" />;

  const { today, sundays, nextMonth, venues, upcoming, items, unanswered, invitable, link } = data;

  return (
    <div>
      <PageHead
        title="Dashboard"
        subtitle={`Today is ${formatLongDate(today)}. The next service is ${formatLongDate(sundays[0])}.`}
      >
        <Link to={paths.scheduleEditor} className={buttonClasses('primary')}>
          <Plus className="size-5" aria-hidden="true" />
          New schedule
        </Link>
      </PageHead>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <AttentionPanel items={items} id="attention" />

          <Panel aria-labelledby="next-three">
            <PanelHead id="next-three" title="Next three Sundays">
              <Link to={paths.scheduleEditor}>Open schedules</Link>
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
                        <Link to={`${paths.people}?volunteer=${v.id}`}>Invite</Link>
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
