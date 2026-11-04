// PREVIEW MODE ONLY. Stands in for features/scheduling/scheduleService.ts, imitating the
// database rules in supabase/migrations/20261104120600_scheduling_rules.sql.
import type * as Real from '../features/scheduling/scheduleService';
import { formatMonthDay, parseIso } from '../lib/format';
import { AppError } from '../lib/supabase/errors';
import type { ScheduleProblem, ServiceRow, VolunteerSuggestion } from '../types/database';
import { currentPreviewUserId } from './authService';
import {
  assignments,
  availability,
  delay,
  history,
  qualifications,
  record,
  roles,
  services,
  uid,
  venues,
  venuePositionsData,
  volunteers,
  positions,
} from './db';

const isStaff = () => {
  const role = roles.get(currentPreviewUserId() ?? '');
  return role === 'admin' || role === 'scheduler';
};
const nameOf = (id: string) => volunteers.find((v) => v.id === id)?.display_name ?? 'Unknown';
const positionName = (id: string) => positions.find((p) => p.id === id)?.name ?? 'Unknown';
const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? 'Unknown';
const isSundayDate = (iso: string) => parseIso(iso).getUTCDay() === 0;

function requireAdmin() {
  if (!isStaff()) throw new AppError('Only administrators and schedule makers can do that.');
}

function awayOn(volunteerId: string, date: string) {
  return availability.some(
    (a) => a.volunteer_id === volunteerId && a.service_date === date && !a.is_available,
  );
}

function addHistory(
  action: 'added' | 'removed',
  serviceId: string,
  volunteerId: string,
  positionId: string,
) {
  history.unshift({
    changed_at: new Date().toISOString(),
    action,
    actor_name: 'An administrator',
    volunteer_name: nameOf(volunteerId),
    position_name: positionName(positionId),
    service_id: serviceId,
  });
}

/** Same checks and wording as the database's assignments_validate trigger. */
function checkAssign(service: ServiceRow, positionId: string, volunteerId: string) {
  const vol = volunteers.find((v) => v.id === volunteerId)!;
  const pos = positionName(positionId);
  if (
    !venuePositionsData.some(
      (vp) => vp.venue_id === service.venue_id && vp.position_id === positionId,
    )
  ) {
    throw new AppError(
      `${pos} isn't a position at ${venueName(service.venue_id)}. Choose a position this venue uses.`,
    );
  }
  if (!vol.is_active)
    throw new AppError(
      `${vol.display_name} is no longer an active volunteer. Choose someone else.`,
    );
  if (!qualifications.has(`${volunteerId}|${positionId}`)) {
    throw new AppError(
      `${vol.display_name} isn't qualified for ${pos}. Add it to their qualifications first.`,
    );
  }
  if (awayOn(volunteerId, service.service_date)) {
    throw new AppError(
      `${vol.display_name} is marked Away on ${formatMonthDay(service.service_date)}. Choose someone else, or ask them to change their availability.`,
    );
  }
  if (
    assignments.some(
      (a) => a.volunteer_id === volunteerId && a.service_date === service.service_date,
    )
  ) {
    throw new AppError(
      'That person is already serving on that Sunday. Each person can have one assignment per Sunday, across all venues.',
    );
  }
}

function problemsFor(from: string, to: string, venueId?: string): ScheduleProblem[] {
  const out: ScheduleProblem[] = [];
  for (const a of assignments) {
    const s = services.find((x) => x.id === a.service_id)!;
    if (s.service_date < from || s.service_date > to) continue;
    if (venueId && s.venue_id !== venueId) continue;
    const vol = volunteers.find((v) => v.id === a.volunteer_id)!;
    const pos = positionName(a.position_id);
    const where = `${venueName(s.venue_id)}, ${formatMonthDay(s.service_date)}`;
    const base = {
      service_id: s.id,
      assignment_id: a.id,
      venue_id: s.venue_id,
      service_date: s.service_date,
      volunteer_id: a.volunteer_id,
      position_id: a.position_id,
    };
    if (!vol.is_active)
      out.push({
        ...base,
        problem: 'inactive',
        message: `${vol.display_name} is no longer an active volunteer (${pos} at ${where}).`,
      });
    if (!qualifications.has(`${a.volunteer_id}|${a.position_id}`))
      out.push({
        ...base,
        problem: 'not_qualified',
        message: `${vol.display_name} isn't qualified for ${pos} (${where}).`,
      });
    if (awayOn(a.volunteer_id, s.service_date))
      out.push({
        ...base,
        problem: 'away',
        message: `${vol.display_name} is marked Away on ${formatMonthDay(s.service_date)} but is scheduled as ${pos} at ${venueName(s.venue_id)}.`,
      });
  }
  return out;
}

export const listServices: typeof Real.listServices = async (filter = {}) => {
  await delay();
  const term = filter.volunteerName?.trim().toLowerCase();
  return services
    .filter((s) => isStaff() || s.status === 'published')
    .filter((s) => !filter.venueId || s.venue_id === filter.venueId)
    .filter((s) => !filter.from || s.service_date >= filter.from)
    .filter((s) => !filter.to || s.service_date <= filter.to)
    .filter((s) => !filter.status || s.status === filter.status)
    .map((s) => ({
      ...s,
      assignments: assignments
        .filter((a) => a.service_id === s.id)
        .map((a) => ({
          id: a.id,
          position_id: a.position_id,
          volunteer_id: a.volunteer_id,
          volunteers: { display_name: nameOf(a.volunteer_id) },
        })),
    }))
    .filter(
      (s) =>
        !term || s.assignments.some((a) => a.volunteers?.display_name.toLowerCase().includes(term)),
    )
    .sort((a, b) => a.service_date.localeCompare(b.service_date));
};

export const getOrCreateService: typeof Real.getOrCreateService = async (venueId, date) => {
  await delay(60);
  requireAdmin();
  if (!isSundayDate(date)) throw new AppError('Choose a Sunday.');
  const existing = services.find((s) => s.venue_id === venueId && s.service_date === date);
  if (existing) return { ...existing };
  const created: ServiceRow = {
    id: uid('svc'),
    venue_id: venueId,
    service_date: date,
    status: 'draft',
    published_at: null,
    published_by: null,
    note: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  services.push(created);
  record(`Added a schedule: ${date}`);
  return { ...created };
};

export const assignVolunteer: typeof Real.assignVolunteer = async (
  service,
  positionId,
  volunteerId,
) => {
  await delay(80);
  requireAdmin();
  const s = services.find((x) => x.id === service.id)!;
  checkAssign(s, positionId, volunteerId);
  assignments.push({
    id: uid('asg'),
    service_id: s.id,
    service_date: s.service_date,
    position_id: positionId,
    volunteer_id: volunteerId,
    created_at: new Date().toISOString(),
    created_by: currentPreviewUserId(),
  });
  addHistory('added', s.id, volunteerId, positionId);
  record(
    `Added an assignment: ${nameOf(volunteerId)} (${positionName(positionId)}, ${s.service_date})`,
  );
};

export const removeAssignment: typeof Real.removeAssignment = async (assignmentId) => {
  await delay(80);
  requireAdmin();
  const index = assignments.findIndex((a) => a.id === assignmentId);
  if (index < 0) return;
  const [a] = assignments.splice(index, 1);
  addHistory('removed', a.service_id, a.volunteer_id, a.position_id);
  record(
    `Removed an assignment: ${nameOf(a.volunteer_id)} (${positionName(a.position_id)}, ${a.service_date})`,
  );
};

function inRange(s: ServiceRow, venueId: string, from: string, to: string) {
  return s.venue_id === venueId && s.service_date >= from && s.service_date <= to;
}

export const publishServices: typeof Real.publishServices = async (venueId, from, to) => {
  await delay();
  requireAdmin();
  const drafts = services
    .filter((s) => s.status === 'draft' && inRange(s, venueId, from, to))
    .sort((a, b) => a.service_date.localeCompare(b.service_date));
  for (const s of drafts) {
    const problems = problemsFor(s.service_date, s.service_date, s.venue_id);
    if (problems.length > 0) {
      const n = problems.length;
      throw new AppError(
        `Fix ${n === 1 ? '1 problem' : `${n} problems`} before publishing ${venueName(s.venue_id)} for ${formatMonthDay(s.service_date)}: ${problems[0].message}`,
      );
    }
  }
  for (const s of drafts) {
    s.status = 'published';
    s.published_at = new Date().toISOString();
    s.published_by = currentPreviewUserId();
  }
  if (drafts.length) record(`Changed a schedule: published ${drafts.length}`);
  return drafts.length;
};

export const unpublishServices: typeof Real.unpublishServices = async (venueId, from, to) => {
  await delay();
  requireAdmin();
  const live = services.filter((s) => s.status === 'published' && inRange(s, venueId, from, to));
  for (const s of live) {
    s.status = 'draft';
    s.published_at = null;
    s.published_by = null;
  }
  if (live.length) record(`Changed a schedule: unpublished ${live.length}`);
  return live.length;
};

export const getScheduleProblems: typeof Real.getScheduleProblems = async (from, to, venueId) => {
  await delay(80);
  return isStaff() ? problemsFor(from, to, venueId) : [];
};

export const suggestVolunteers: typeof Real.suggestVolunteers = async (serviceId, positionId) => {
  await delay(80);
  const s = services.find((x) => x.id === serviceId);
  if (!isStaff() || !s) return [];
  if (!venuePositionsData.some((vp) => vp.venue_id === s.venue_id && vp.position_id === positionId))
    return [];

  const rows: VolunteerSuggestion[] = volunteers
    .filter((v) => v.is_active && qualifications.has(`${v.id}|${positionId}`))
    .map((v) => {
      const existing = assignments.find(
        (a) => a.volunteer_id === v.id && a.service_date === s.service_date,
      );
      const existingService = existing && services.find((x) => x.id === existing.service_id);
      const av = availability.find(
        (a) => a.volunteer_id === v.id && a.service_date === s.service_date,
      );
      const served = assignments
        .filter((a) => a.volunteer_id === v.id && a.service_date < s.service_date)
        .map((a) => a.service_date)
        .sort();
      const cutoff = new Date(parseIso(s.service_date).getTime() - 56 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const recent = served.filter((d) => d >= cutoff).length;
      const when = formatMonthDay(s.service_date);

      let status: VolunteerSuggestion['status'] = av ? 'available' : 'no_answer';
      let reason = av ? 'Available.' : `Hasn't answered for ${when}.`;
      if (av && !av.is_available) {
        status = 'away';
        reason = `Marked Away on ${when}.`;
      }
      if (existing && existingService) {
        status = 'already_assigned';
        reason =
          existingService.venue_id === s.venue_id
            ? `Already serving as ${positionName(existing.position_id)} at ${venueName(s.venue_id)} on ${when}. Each person has one position per Sunday.`
            : `Serving at ${venueName(existingService.venue_id)} (${positionName(existing.position_id)}) that Sunday. One person can't serve at two venues on the same day.`;
      }
      return {
        volunteer_id: v.id,
        display_name: v.display_name,
        can_assign: status === 'available' || status === 'no_answer',
        status,
        reason,
        last_served: served.length ? served[served.length - 1] : null,
        times_served_8_weeks: recent,
      };
    });

  return rows.sort(
    (a, b) =>
      Number(b.can_assign) - Number(a.can_assign) ||
      (a.last_served ?? '').localeCompare(b.last_served ?? '') ||
      a.times_served_8_weeks - b.times_served_8_weeks ||
      a.display_name.localeCompare(b.display_name),
  );
};

export const copySchedule: typeof Real.copySchedule = async (
  venueId,
  sourceStart,
  sourceEnd,
  targetStart,
) => {
  await delay();
  requireAdmin();
  const offset = Math.round(
    (parseIso(targetStart).getTime() - parseIso(sourceStart).getTime()) / 86_400_000,
  );
  if (sourceEnd < sourceStart)
    throw new AppError('The end of the range to copy is before its start.');
  if (offset === 0) throw new AppError('Choose a different Sunday or month to copy into.');
  if (offset % 7 !== 0)
    throw new AppError('Both start dates must be Sundays so the weeks line up.');

  const result = {
    services_created: 0,
    assignments_created: 0,
    skipped: [] as { service_date: string; volunteer: string; position: string; reason: string }[],
    days_skipped: [] as { service_date: string; reason: string }[],
  };
  const sources = services
    .filter((s) => inRange(s, venueId, sourceStart, sourceEnd))
    .sort((a, b) => a.service_date.localeCompare(b.service_date));

  for (const src of sources) {
    const date = new Date(parseIso(src.service_date).getTime() + offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    let target = services.find((s) => s.venue_id === venueId && s.service_date === date);
    if (!target) {
      target = {
        id: uid('svc'),
        venue_id: venueId,
        service_date: date,
        status: 'draft',
        published_at: null,
        published_by: null,
        note: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      services.push(target);
      result.services_created++;
    } else if (assignments.some((a) => a.service_id === target!.id)) {
      result.days_skipped.push({
        service_date: date,
        reason: 'It already has assignments, so nothing was copied onto it.',
      });
      continue;
    }
    for (const a of assignments.filter((x) => x.service_id === src.id)) {
      try {
        checkAssign(target, a.position_id, a.volunteer_id);
        assignments.push({
          ...a,
          id: uid('asg'),
          service_id: target.id,
          service_date: date,
          created_at: new Date().toISOString(),
        });
        addHistory('added', target.id, a.volunteer_id, a.position_id);
        result.assignments_created++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        result.skipped.push({
          service_date: date,
          volunteer: nameOf(a.volunteer_id),
          position: positionName(a.position_id),
          reason: message.startsWith('That person is already serving')
            ? `${nameOf(a.volunteer_id)} is already serving on ${formatMonthDay(date)}.`
            : message,
        });
      }
    }
  }
  record(`Added a schedule: copied ${result.services_created} Sundays`);
  return result;
};

export const getAssignmentHistory: typeof Real.getAssignmentHistory = async (serviceId) => {
  await delay(80);
  if (!isStaff()) return [];
  return history
    .filter((h) => h.service_id === serviceId)
    .map((h) => ({
      changed_at: h.changed_at,
      action: h.action,
      actor_name: h.actor_name,
      volunteer_name: h.volunteer_name,
      position_name: h.position_name,
    }));
};
