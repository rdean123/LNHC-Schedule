import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError, unwrap } from '../../lib/supabase/errors';
import type { AppRole } from '../../types/database';

/** Role of every login account (administrators only; everyone else sees just their own). */
export async function listRoles(): Promise<Record<string, AppRole>> {
  const rows = unwrap(
    await getSupabase().from('user_roles').select('user_id, role'),
    'We couldn’t load who is an administrator.',
  );
  return Object.fromEntries(rows.map((r) => [r.user_id, r.role]));
}

/**
 * Make someone an administrator or a volunteer. The database refuses to leave the church
 * without an administrator and refuses anyone who isn't one.
 */
export async function setRole(userId: string, role: AppRole): Promise<void> {
  const { data, error } = await getSupabase()
    .from('user_roles')
    .update({ role })
    .eq('user_id', userId)
    .select('user_id');
  if (error) throw toAppError(error, 'We couldn’t change that role.');
  if (!data || data.length === 0) throw new AppError('You don’t have permission to change roles.');
}
