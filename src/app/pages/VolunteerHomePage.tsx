import { CalendarCheck, Calendar, Download } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/buttonStyles';
import { Chip } from '../../components/ui/Chip';
import { CrossMotif } from '../../components/ui/CrossMotif';
import { skyBackground } from '../../components/ui/skyBackground';
import { Panel, PanelHead } from '../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import { listAnnouncements } from '../../features/announcements/announcementService';
import { getMyAvailability } from '../../features/availability/availabilityService';
import { listVenuePositions } from '../../features/ministries/catalogService';
import { listVenues } from '../../features/ministries/catalogService';
import { exportMonthPdf } from '../../features/scheduling/exportMonth';
import { listServices } from '../../features/scheduling/scheduleService';
import { useAsync } from '../../hooks/useAsync';
import {
  addDays,
  currentMonth,
  formatLongDate,
  formatShortDate,
  monthRange,
  monthTitle,
  nextSundays,
  relativeDays,
  shiftMonth,
  sundaysOfMonth,
  todayIso,
} from '../../lib/format';
import { buildRoster, isServing, myPositions } from '../../lib/roster';
import type { RosterRow } from '../../lib/roster';
import { useSignedIn } from '../auth';

type Serving = { date: string; venueId: string; venueName: string; row: RosterRow };

export function VolunteerHomePage() {
  const { volunteer } = useSignedIn();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const myId = volunteer?.id ?? null;

  const load = useCallback(async () => {
    const today = todayIso();
    const nextMonth = shiftMonth(currentMonth(today), 1);
    const { from, to } = monthRange(nextMonth);
    const [venues, services, announcements, answers] = await Promise.all([
      listVenues(),
      listServices({ status: 'published', from: today, to: addDays(today, 150) }),
      listAnnouncements(),
      myId ? getMyAvailability(from, to) : Promise.resolve([]),
    ]);
    const columnsByVenue = new Map(
      await Promise.all(venues.map(async (v) => [v.id, await listVenuePositions(v.id)] as const)),
    );

    const serving: Serving[] = [];
    for (const s of services) {
      const venue = venues.find((v) => v.id === s.venue_id);
      if (!venue) continue;
      const [row] = buildRoster(columnsByVenue.get(venue.id) ?? [], [s]);
      if (isServing(row, myId))
        serving.push({ date: s.service_date, venueId: venue.id, venueName: venue.name, row });
    }
    serving.sort((a, b) => a.date.localeCompare(b.date));

    const publishedDates = new Set(services.map((s) => s.service_date));
    const unanswered = sundaysOfMonth(nextMonth).filter(
      (d) => !answers.some((a) => a.service_date === d),
    ).length;
    return {
      today,
      nextMonth,
      serving,
      publishedDates,
      announcements: announcements.slice(0, 3),
      unanswered,
    };
  }, [myId]);

  const { data, loading, error, reload } = useAsync(load);

  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data || loading) return <LoadingBlock rows={6} label="Loading your schedule" />;

  const { today, nextMonth, serving, publishedDates, announcements, unanswered } = data;
  const next = serving[0];
  const upcomingSundays = nextSundays(today, 5);
  const monthOfNext = next?.date.slice(0, 7);

  async function download() {
    if (!next) return;
    setDownloading(true);
    try {
      await exportMonthPdf({ id: next.venueId, name: next.venueName }, next.date.slice(0, 7));
    } catch {
      toast.error(
        'We couldn’t create the PDF. Open the schedule and use Print, then “Save as PDF”.',
      );
    } finally {
      setDownloading(false);
    }
  }

  const others = next
    ? next.row.cells
        .map((c) => ({
          label: c.label,
          names: c.people.filter((p) => p.volunteerId !== myId).map((p) => p.name),
        }))
        .filter((c) => c.names.length > 0)
    : [];

  return (
    <div>
      <section
        aria-labelledby="next-heading"
        className="relative overflow-hidden rounded-hero p-5 md:p-8"
        style={skyBackground}
      >
        <CrossMotif className="right-10 top-7" />
        {next ? (
          <>
            <p>
              Hi {volunteer?.displayName}, you’re serving {relativeDays(today, next.date)}.
            </p>
            <h1
              id="next-heading"
              className="mt-2 font-display text-[clamp(2.25rem,1.4rem+3.4vw,3.75rem)] font-medium leading-none tracking-tight text-deep"
            >
              {formatLongDate(next.date)}
            </h1>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {myPositions(next.row, myId).join(' and ')}
            </p>
            <p className="mt-1 text-muted">{next.venueName}</p>

            {others.length > 0 && (
              <div className="mt-6 border-t border-deep/25 pt-4">
                <h2 className="sr-only">Serving with you</h2>
                <dl className="m-0 flex flex-wrap gap-x-6 gap-y-3">
                  {others.map((o) => (
                    <div key={o.label}>
                      <dt className="text-[0.8125rem] text-muted">{o.label}</dt>
                      <dd className="m-0">{o.names.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to={`/schedules?venue=${next.venueId}&month=${monthOfNext}`}
                className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}
              >
                <Calendar className="size-5" aria-hidden="true" />
                See the full schedule
              </Link>
              <Button
                className="w-full sm:w-auto"
                onClick={() => void download()}
                busy={downloading}
              >
                <Download className="size-5" aria-hidden="true" />
                Download PDF
              </Button>
              <Link
                to={`/availability?month=${monthOfNext}`}
                className={buttonClasses('secondary', 'md', 'w-full sm:w-auto')}
              >
                I can’t make it
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1
              id="next-heading"
              className="font-display text-[clamp(2rem,1.4rem+2.4vw,3rem)] font-medium leading-tight text-deep"
            >
              {volunteer
                ? 'You’re not on a schedule yet'
                : 'Your account isn’t linked to a volunteer yet'}
            </h1>
            <p className="mt-3 max-w-[48ch] text-ink">
              {volunteer
                ? 'When your administrator publishes a schedule you’re on, your Sunday and who you serve with appear here.'
                : 'Ask your administrator to link your account to your volunteer record.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/schedules" className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}>
                <Calendar className="size-5" aria-hidden="true" />
                See schedules
              </Link>
              <Link
                to="/availability"
                className={buttonClasses('secondary', 'md', 'w-full sm:w-auto')}
              >
                Set availability
              </Link>
            </div>
          </>
        )}
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="upcoming-heading">
          <PanelHead id="upcoming-heading" title="Your upcoming Sundays">
            <Link to="/schedules">All schedules</Link>
          </PanelHead>
          <ul className="m-0 list-none p-0">
            {upcomingSundays.map((date) => {
              const mine = serving.find((s) => s.date === date);
              return (
                <li
                  key={date}
                  className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0 sm:grid-cols-[5.5rem_1fr_auto] md:px-6"
                >
                  <span className="font-display text-lg font-semibold text-deep">
                    {formatShortDate(date)}
                    <small className="block font-sans text-[0.8125rem] font-normal text-muted">
                      Sunday
                    </small>
                  </span>
                  {mine ? (
                    <>
                      <span>
                        <strong>{myPositions(mine.row, myId).join(' and ')}</strong> ·{' '}
                        {mine.venueName}
                      </span>
                      <span className="col-start-2 sm:col-start-auto">
                        <Chip tone="published">Published</Chip>
                      </span>
                    </>
                  ) : publishedDates.has(date) ? (
                    <>
                      <span className="text-muted">Not scheduled this Sunday</span>
                      <span className="col-start-2 sm:col-start-auto">
                        <Chip tone="draft" icon={false}>
                          Free
                        </Chip>
                      </span>
                    </>
                  ) : (
                    <span className="col-span-1 text-muted sm:col-span-2">
                      No schedule published yet
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          <Panel aria-labelledby="avail-heading">
            <div className="p-5 md:p-6">
              <h2 id="avail-heading" className="text-2xl">
                {unanswered > 0
                  ? `Set your ${monthTitle(nextMonth).split(' ')[0]} availability`
                  : 'Your availability is up to date'}
              </h2>
              <p className="mb-4 mt-2 text-muted">
                {unanswered > 0
                  ? `${unanswered} ${unanswered === 1 ? 'Sunday still needs' : 'Sundays still need'} an answer. Your administrator plans around the Sundays you mark.`
                  : `You’ve answered every Sunday in ${monthTitle(nextMonth)}. You can still change an answer.`}
              </p>
              <Link
                to={`/availability?month=${nextMonth}`}
                className={buttonClasses(unanswered > 0 ? 'primary' : 'secondary', 'md', 'w-full')}
              >
                <CalendarCheck className="size-5" aria-hidden="true" />
                {unanswered > 0 ? 'Set availability' : 'Review availability'}
              </Link>
            </div>
          </Panel>

          {announcements.length > 0 && (
            <Panel aria-labelledby="news-heading">
              <div className="p-5 md:p-6">
                <h2 id="news-heading" className="text-2xl">
                  From the church
                </h2>
                <ul className="m-0 mt-3 grid list-none gap-4 p-0">
                  {announcements.map((a) => (
                    <li key={a.id}>
                      <p className="font-semibold">{a.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{a.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
