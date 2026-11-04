// PREVIEW MODE ONLY. Stands in for features/administration/inviteService.ts.
import type * as Real from '../features/administration/inviteService';
import { AppError } from '../lib/supabase/errors';
import { contacts, delay, record, volunteers } from './db';

export const inviteVolunteer: typeof Real.inviteVolunteer = async (volunteerId) => {
  await delay(200);
  const v = volunteers.find((x) => x.id === volunteerId);
  if (!v) throw new AppError('That volunteer no longer exists.');
  if (v.user_id) throw new AppError(`${v.display_name} already has an account.`);
  if (!contacts.get(volunteerId)?.email) {
    throw new AppError(`Add an email address for ${v.display_name} before inviting them.`);
  }
  record(`Added an invitation: ${v.display_name}`);
};
