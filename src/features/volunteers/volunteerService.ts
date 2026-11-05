import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError, unwrap } from '../../lib/supabase/errors';
import { validateEmail } from '../../lib/validation/auth';
import type { VolunteerRow } from '../../types/database';

export type VolunteerDetails = VolunteerRow & {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  positionIds: string[];
};

export type NewVolunteer = {
  displayName: string;
  fullName?: string;
  email?: string;
  phone?: string;
};

/** Names for rosters. Includes inactive people so past schedules still show who served. */
export async function listVolunteerNames(): Promise<
  Pick<VolunteerRow, 'id' | 'display_name' | 'is_active'>[]
> {
  return unwrap(
    await getSupabase()
      .from('volunteers')
      .select('id, display_name, is_active')
      .order('display_name'),
    'We couldn’t load the volunteers.',
  );
}

/**
 * Administrator view with contact details and qualifications. Row level security hides
 * other people's contact details from everyone who isn't an administrator.
 */
export async function listVolunteerDetails(): Promise<VolunteerDetails[]> {
  const supabase = getSupabase();
  const volunteers = unwrap(
    await supabase
      .from('volunteers')
      .select('*, volunteer_contacts ( full_name, email, phone )')
      .order('display_name'),
    'We couldn’t load the volunteers.',
  );
  const quals = unwrap(
    await supabase.from('volunteer_qualifications').select('volunteer_id, position_id'),
    'We couldn’t load what each volunteer can do.',
  );
  const byVolunteer = new Map<string, string[]>();
  for (const q of quals) {
    byVolunteer.set(q.volunteer_id, [...(byVolunteer.get(q.volunteer_id) ?? []), q.position_id]);
  }

  return volunteers.map(({ volunteer_contacts, ...v }) => ({
    ...v,
    fullName: volunteer_contacts?.full_name ?? null,
    email: volunteer_contacts?.email ?? null,
    phone: volunteer_contacts?.phone ?? null,
    positionIds: byVolunteer.get(v.id) ?? [],
  }));
}

export async function createVolunteer(input: NewVolunteer): Promise<string> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new AppError('Enter the name used on the schedule, such as “Sica”.');
  if (input.email?.trim()) {
    const problem = validateEmail(input.email);
    if (problem) throw new AppError(problem);
  }

  const supabase = getSupabase();
  const created = unwrap(
    await supabase.from('volunteers').insert({ display_name: displayName }).select('id').single(),
    'We couldn’t add that volunteer.',
  );

  const { error } = await supabase.from('volunteer_contacts').insert({
    volunteer_id: created.id,
    full_name: input.fullName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  });
  if (error) {
    // Don't leave a half-created volunteer behind.
    await supabase.from('volunteers').delete().eq('id', created.id);
    throw toAppError(error, 'We couldn’t save the contact details, so nothing was added.');
  }
  return created.id;
}

/**
 * Change a volunteer's name on the schedule and their contact details. This does not change the
 * email they sign in with: that belongs to their account, not to this record.
 */
export async function updateVolunteer(volunteerId: string, input: NewVolunteer): Promise<void> {
  const displayName = input.displayName.trim();
  if (!displayName) throw new AppError('Enter the name used on the schedule, such as “Sica”.');
  if (input.email?.trim()) {
    const problem = validateEmail(input.email);
    if (problem) throw new AppError(problem);
  }

  const supabase = getSupabase();
  const { error: nameError } = await supabase
    .from('volunteers')
    .update({ display_name: displayName })
    .eq('id', volunteerId);
  if (nameError) throw toAppError(nameError, 'We couldn’t save the name.');

  const { error } = await supabase.from('volunteer_contacts').upsert({
    volunteer_id: volunteerId,
    full_name: input.fullName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  });
  if (error) throw toAppError(error, 'We saved the name but couldn’t save the contact details.');
}

/** Deactivate instead of deleting, so past schedules keep their names. */
export async function setVolunteerActive(volunteerId: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('volunteers')
    .update({ is_active: isActive })
    .eq('id', volunteerId);
  if (error) throw toAppError(error, 'We couldn’t update that volunteer.');
}

/** Replace the set of positions a volunteer is qualified for. */
export async function setQualifications(volunteerId: string, positionIds: string[]): Promise<void> {
  const supabase = getSupabase();
  const current = unwrap(
    await supabase
      .from('volunteer_qualifications')
      .select('position_id')
      .eq('volunteer_id', volunteerId),
    'We couldn’t load what this volunteer can do.',
  ).map((r) => r.position_id);

  const wanted = new Set(positionIds);
  const toAdd = positionIds.filter((p) => !current.includes(p));
  const toRemove = current.filter((p) => !wanted.has(p));

  if (toAdd.length) {
    const { error } = await supabase
      .from('volunteer_qualifications')
      .insert(toAdd.map((position_id) => ({ volunteer_id: volunteerId, position_id })));
    if (error) throw toAppError(error, 'We couldn’t save what this volunteer can do.');
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from('volunteer_qualifications')
      .delete()
      .eq('volunteer_id', volunteerId)
      .in('position_id', toRemove);
    if (error) throw toAppError(error, 'We couldn’t save what this volunteer can do.');
  }
}

/** A volunteer updating their own phone or name. Only an administrator can change an email. */
export async function updateMyContact(
  volunteerId: string,
  changes: { fullName?: string; phone?: string },
): Promise<void> {
  const { error } = await getSupabase()
    .from('volunteer_contacts')
    .update({
      ...(changes.fullName !== undefined && { full_name: changes.fullName.trim() || null }),
      ...(changes.phone !== undefined && { phone: changes.phone.trim() || null }),
    })
    .eq('volunteer_id', volunteerId);
  if (error) throw toAppError(error, 'We couldn’t save your details.');
}
