// PREVIEW MODE ONLY. Stands in for features/volunteers/myProfileService.ts.
import type * as Real from '../features/volunteers/myProfileService';
import { currentPreviewUserId } from './authService';
import { contacts, delay, volunteers } from './db';

export const getMyVolunteer: typeof Real.getMyVolunteer = async () => {
  await delay(60);
  const v = volunteers.find((x) => x.user_id === currentPreviewUserId());
  return v ? { id: v.id, displayName: v.display_name } : null;
};

export const getMyContact: typeof Real.getMyContact = async (volunteerId) => {
  await delay(60);
  const c = contacts.get(volunteerId);
  return { fullName: c?.full_name ?? null, email: c?.email ?? null, phone: c?.phone ?? null };
};
