import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError, unwrap } from '../../lib/supabase/errors';
import { isSunday } from '../../lib/utils/dates';
import type { AvailabilityRow } from '../../types/database';

async function myVolunteerId(): Promise<string> {
  const { data, error } = await getSupabase().rpc('current_volunteer_id');
  if (error) throw toAppError(error, 'We couldn’t find your volunteer record.');
  if (!data) {
    throw new AppError(
      'Your account isn’t linked to a volunteer yet. Ask your administrator to link it.',
    );
  }
  return data;
}

/** The signed-in volunteer's answers between two dates (inclusive). */
export async function getMyAvailability(from: string, to: string): Promise<AvailabilityRow[]> {
  const volunteerId = await myVolunteerId();
  return unwrap(
    await getSupabase()
      .from('volunteer_availability')
      .select('*')
      .eq('volunteer_id', volunteerId)
      .gte('service_date', from)
      .lte('service_date', to)
      .order('service_date'),
    'We couldn’t load your availability.',
  );
}

export async function setMyAvailability(
  date: string,
  isAvailable: boolean,
  note?: string,
): Promise<void> {
  if (!isSunday(date)) throw new AppError('Choose a Sunday.');
  const volunteerId = await myVolunteerId();
  const { error } = await getSupabase()
    .from('volunteer_availability')
    .upsert(
      {
        volunteer_id: volunteerId,
        service_date: date,
        is_available: isAvailable,
        note: note?.trim() || null,
      },
      { onConflict: 'volunteer_id,service_date' },
    );
  if (error) throw toAppError(error, 'We couldn’t save your availability.');
}

/** Administrator view: everyone's answers for the given Sundays. */
export async function getAvailabilityForDates(dates: string[]): Promise<AvailabilityRow[]> {
  if (dates.length === 0) return [];
  return unwrap(
    await getSupabase().from('volunteer_availability').select('*').in('service_date', dates),
    'We couldn’t load availability.',
  );
}
