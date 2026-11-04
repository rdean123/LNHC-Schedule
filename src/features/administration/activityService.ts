import { getSupabase } from '../../lib/supabase/client';
import { unwrap } from '../../lib/supabase/errors';

export type ActivityEntry = {
  id: number;
  when: string;
  actorName: string;
  /** A sentence such as "Added a volunteer: Dan". */
  summary: string;
};

const labels: Record<string, string> = {
  volunteers: 'volunteer',
  volunteer_contacts: 'contact details',
  volunteer_qualifications: 'qualification',
  user_roles: 'role',
  venues: 'venue',
  positions: 'position',
  venue_positions: 'venue position',
  services: 'schedule',
  assignments: 'assignment',
  announcements: 'announcement',
};

const verbs: Record<string, string> = { INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Removed' };

/** One readable line for a change, using whatever identifies the record. */
export function describeChange(
  table: string,
  action: string,
  oldData: unknown,
  newData: unknown,
): string {
  const data = (newData ?? oldData ?? {}) as Record<string, unknown>;
  const detail = [data.display_name, data.name, data.title, data.service_date, data.role]
    .find((v) => typeof v === 'string' && v)
    ?.toString();
  const noun = labels[table] ?? table;
  return `${verbs[action] ?? action} ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}${detail ? `: ${detail}` : ''}`;
}

/** The latest changes, newest first. Administrators only (enforced by the database). */
export async function getActivityLog(limit = 100): Promise<ActivityEntry[]> {
  const supabase = getSupabase();
  const logs = unwrap(
    await supabase
      .from('audit_logs')
      .select('id, actor_id, action, table_name, old_data, new_data, created_at')
      .order('id', { ascending: false })
      .limit(limit),
    'We couldn’t load the activity log.',
  );
  const people = unwrap(
    await supabase.from('volunteers').select('user_id, display_name').not('user_id', 'is', null),
    'We couldn’t load the activity log.',
  );
  const names = new Map(people.map((p) => [p.user_id, p.display_name]));

  return logs.map((l) => ({
    id: l.id,
    when: l.created_at,
    actorName: (l.actor_id && names.get(l.actor_id)) || 'An administrator',
    summary: describeChange(l.table_name, l.action, l.old_data, l.new_data),
  }));
}
