import { getAvailabilityForDates } from '../availability/availabilityService';
import { listVenues } from '../ministries/catalogService';
import { getScheduleProblems, listServices } from '../scheduling/scheduleService';
import { listVolunteerDetails } from '../volunteers/volunteerService';
import {
  addDays,
  currentMonth,
  daysBetween,
  formatLongDate,
  monthTitle,
  nextSundays,
  shiftMonth,
  sundaysOfMonth,
  todayIso,
} from '../../lib/format';
import { staffPaths } from '../../lib/roles';
import type { AppRole } from '../../types/database';

export type AttentionItem = {
  key: string;
  title: string;
  detail: string;
  to: string;
  action: string;
  primary: boolean;
};

/**
 * What an administrator or schedule maker should look at: Sundays with no roster, drafts that
 * aren't published, assignments with problems, people who haven't set availability or been
 * invited. Links go to the editing screens for the viewer's role.
 */
export async function loadOverview(role: AppRole) {
  const paths = staffPaths(role);
  const link = (venueId: string, month: string) =>
    `${paths.scheduleEditor}?venue=${venueId}&month=${month}`;

  const today = todayIso();
  const sundays = nextSundays(today, 3);
  const nextMonth = shiftMonth(currentMonth(today), 1);
  const horizon = addDays(today, 120);

  const [venues, upcoming, problems, volunteers, answers] = await Promise.all([
    listVenues(),
    listServices({ from: sundays[0], to: horizon }),
    getScheduleProblems(today, horizon),
    listVolunteerDetails(),
    getAvailabilityForDates(sundaysOfMonth(nextMonth)),
  ]);

  const items: AttentionItem[] = [];
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

  const drafts = new Map<
    string,
    { venueId: string; venue: string; month: string; count: number }
  >();
  for (const s of upcoming.filter((x) => x.status === 'draft')) {
    const v = venues.find((x) => x.id === s.venue_id);
    if (!v) continue;
    const key = `${v.id}-${s.service_date.slice(0, 7)}`;
    const g = drafts.get(key) ?? {
      venueId: v.id,
      venue: v.name,
      month: s.service_date.slice(0, 7),
      count: 0,
    };
    g.count += 1;
    drafts.set(key, g);
  }
  for (const g of drafts.values()) {
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
  return {
    today,
    sundays,
    nextMonth,
    venues,
    upcoming,
    items,
    unanswered: active.filter((v) => !answers.some((a) => a.volunteer_id === v.id)),
    invitable: active.filter((v) => v.email && !v.user_id),
    link,
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;
