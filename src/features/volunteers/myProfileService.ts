import { getSupabase } from '../../lib/supabase/client';
import { toAppError, unwrap } from '../../lib/supabase/errors';

export type MyVolunteer = { id: string; displayName: string };
export type MyContact = { fullName: string | null; email: string | null; phone: string | null };

/** The volunteer record linked to the signed-in account, or null (for example an administrator who doesn't serve). */
export async function getMyVolunteer(): Promise<MyVolunteer | null> {
  const supabase = getSupabase();
  const { data: id, error } = await supabase.rpc('current_volunteer_id');
  if (error) throw toAppError(error, 'We couldn’t find your volunteer record.');
  if (!id) return null;
  const row = unwrap(
    await supabase.from('volunteers').select('id, display_name').eq('id', id).single(),
    'We couldn’t load your volunteer record.',
  );
  return { id: row.id, displayName: row.display_name };
}

/** The signed-in volunteer's own contact details. Row level security allows only their own. */
export async function getMyContact(volunteerId: string): Promise<MyContact> {
  const { data, error } = await getSupabase()
    .from('volunteer_contacts')
    .select('full_name, email, phone')
    .eq('volunteer_id', volunteerId)
    .maybeSingle();
  if (error) throw toAppError(error, 'We couldn’t load your details.');
  return {
    fullName: data?.full_name ?? null,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
  };
}
