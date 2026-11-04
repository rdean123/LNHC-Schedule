import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError, unwrap } from '../../lib/supabase/errors';
import { isSunday } from '../../lib/utils/dates';
import type {
  AssignmentHistoryEntry,
  CopyScheduleResult,
  PublishStatus,
  ScheduleProblem,
  ServiceRow,
  VolunteerSuggestion,
} from '../../types/database';

/**
 * Data access for schedules. The rules (who may be assigned, what blocks publishing) are
 * enforced by the database; these functions pass its plain-language messages through.
 * Administrator operations fail with a clear message for anyone else.
 */

export type ServiceWithAssignments = ServiceRow & {
  assignments: {
    id: string;
    position_id: string;
    volunteer_id: string;
    volunteers: { display_name: string } | null;
  }[];
};

export type ServiceFilter = {
  venueId?: string;
  /** 'YYYY-MM-DD', inclusive */
  from?: string;
  to?: string;
  status?: PublishStatus;
  /** Only services where someone whose name contains this text is assigned. */
  volunteerName?: string;
};

/** Search and filter schedules. Volunteers receive only published ones, enforced by the database. */
export async function listServices(filter: ServiceFilter = {}): Promise<ServiceWithAssignments[]> {
  const term = filter.volunteerName?.trim();
  // With a name filter, keep only services that have a matching assignment.
  const select = term
    ? '*, assignments!inner ( id, position_id, volunteer_id, volunteers!inner ( display_name ) )'
    : '*, assignments ( id, position_id, volunteer_id, volunteers ( display_name ) )';

  let query = getSupabase().from('services').select(select).order('service_date');
  if (filter.venueId) query = query.eq('venue_id', filter.venueId);
  if (filter.from) query = query.gte('service_date', filter.from);
  if (filter.to) query = query.lte('service_date', filter.to);
  if (filter.status) query = query.eq('status', filter.status);
  if (term) {
    // Escape LIKE wildcards so a search for "100%" or "a_b" matches literally.
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike('assignments.volunteers.display_name', `%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) throw toAppError(error, 'We couldn’t load the schedules.');
  return (data ?? []) as unknown as ServiceWithAssignments[];
}

/** The schedule for one venue on one Sunday, created as a draft if it doesn't exist yet. */
export async function getOrCreateService(venueId: string, date: string): Promise<ServiceRow> {
  if (!isSunday(date)) throw new AppError('Choose a Sunday.');
  const supabase = getSupabase();

  const existing = await supabase
    .from('services')
    .select('*')
    .eq('venue_id', venueId)
    .eq('service_date', date)
    .maybeSingle();
  if (existing.error) throw toAppError(existing.error, 'We couldn’t load that schedule.');
  if (existing.data) return existing.data;

  return unwrap(
    await supabase
      .from('services')
      .insert({ venue_id: venueId, service_date: date })
      .select('*')
      .single(),
    'We couldn’t create that schedule.',
  );
}

export async function assignVolunteer(
  service: Pick<ServiceRow, 'id' | 'service_date'>,
  positionId: string,
  volunteerId: string,
): Promise<void> {
  const { error } = await getSupabase().from('assignments').insert({
    service_id: service.id,
    service_date: service.service_date,
    position_id: positionId,
    volunteer_id: volunteerId,
  });
  if (error) throw toAppError(error, 'We couldn’t add that person.');
}

export async function removeAssignment(assignmentId: string): Promise<void> {
  const { error } = await getSupabase().from('assignments').delete().eq('id', assignmentId);
  if (error) throw toAppError(error, 'We couldn’t remove that person.');
}

/** Publish every draft Sunday for a venue in a date range. All or nothing: if any has a problem, none are published. */
export async function publishServices(venueId: string, from: string, to: string): Promise<number> {
  const { data, error } = await getSupabase()
    .from('services')
    .update({ status: 'published' })
    .eq('venue_id', venueId)
    .eq('status', 'draft')
    .gte('service_date', from)
    .lte('service_date', to)
    .select('id');
  if (error) throw toAppError(error, 'We couldn’t publish the schedule.');
  return data?.length ?? 0;
}

/** Hide published Sundays from volunteers again. Assignments are kept. */
export async function unpublishServices(
  venueId: string,
  from: string,
  to: string,
): Promise<number> {
  const { data, error } = await getSupabase()
    .from('services')
    .update({ status: 'draft' })
    .eq('venue_id', venueId)
    .eq('status', 'published')
    .gte('service_date', from)
    .lte('service_date', to)
    .select('id');
  if (error) throw toAppError(error, 'We couldn’t unpublish the schedule.');
  return data?.length ?? 0;
}

/** Problems in existing assignments (someone became unavailable, lost a qualification, was deactivated). */
export async function getScheduleProblems(
  from: string,
  to: string,
  venueId?: string,
): Promise<ScheduleProblem[]> {
  return unwrap(
    await getSupabase().rpc('schedule_problems', {
      p_from: from,
      p_to: to,
      ...(venueId && { p_venue_id: venueId }),
    }),
    'We couldn’t check the schedule for problems.',
  );
}

/**
 * Qualified volunteers for a position on a service. People who can be assigned come first,
 * longest-rested first; the rest are listed with the reason they can't be. Recommendations
 * only: the administrator decides.
 */
export async function suggestVolunteers(
  serviceId: string,
  positionId: string,
): Promise<VolunteerSuggestion[]> {
  return unwrap(
    await getSupabase().rpc('suggest_volunteers', {
      p_service_id: serviceId,
      p_position_id: positionId,
    }),
    'We couldn’t load suggestions.',
  );
}

/** Use a venue's Sundays as a template for other Sundays. Always creates drafts and reports who couldn't be placed. */
export async function copySchedule(
  venueId: string,
  sourceStart: string,
  sourceEnd: string,
  targetStart: string,
): Promise<CopyScheduleResult> {
  return unwrap(
    await getSupabase().rpc('copy_schedule', {
      p_venue_id: venueId,
      p_source_start: sourceStart,
      p_source_end: sourceEnd,
      p_target_start: targetStart,
    }),
    'We couldn’t copy the schedule.',
  );
}

export async function getAssignmentHistory(serviceId: string): Promise<AssignmentHistoryEntry[]> {
  return unwrap(
    await getSupabase().rpc('assignment_history', { p_service_id: serviceId }),
    'We couldn’t load the history.',
  );
}
