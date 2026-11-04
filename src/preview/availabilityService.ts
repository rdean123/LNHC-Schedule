// PREVIEW MODE ONLY. Stands in for features/availability/availabilityService.ts.
import type * as Real from '../features/availability/availabilityService';
import { formatMonthDay, parseIso } from '../lib/format';
import { AppError } from '../lib/supabase/errors';
import { currentPreviewUserId } from './authService';
import { assignments, availability, delay, services, volunteers } from './db';

function myVolunteerId(): string {
  const v = volunteers.find((x) => x.user_id === currentPreviewUserId());
  if (!v) {
    throw new AppError(
      'Your account isn’t linked to a volunteer yet. Ask your administrator to link it.',
    );
  }
  return v.id;
}

export const getMyAvailability: typeof Real.getMyAvailability = async (from, to) => {
  await delay(80);
  const id = myVolunteerId();
  return availability
    .filter((a) => a.volunteer_id === id && a.service_date >= from && a.service_date <= to)
    .map((a) => ({ ...a }))
    .sort((a, b) => a.service_date.localeCompare(b.service_date));
};

export const setMyAvailability: typeof Real.setMyAvailability = async (date, isAvailable, note) => {
  await delay(80);
  if (parseIso(date).getUTCDay() !== 0) throw new AppError('Choose a Sunday.');
  const id = myVolunteerId();
  const publishedAssignment = assignments.some(
    (a) =>
      a.volunteer_id === id &&
      a.service_date === date &&
      services.find((s) => s.id === a.service_id)?.status === 'published',
  );
  if (!isAvailable && publishedAssignment) {
    throw new AppError(
      `You're scheduled to serve on ${formatMonthDay(date)}. Ask your administrator to take you off the schedule first.`,
    );
  }
  const existing = availability.find((a) => a.volunteer_id === id && a.service_date === date);
  const row = {
    volunteer_id: id,
    service_date: date,
    is_available: isAvailable,
    note: note?.trim() || null,
    updated_at: new Date().toISOString(),
  };
  if (existing) Object.assign(existing, row);
  else availability.push(row);
};

export const getAvailabilityForDates: typeof Real.getAvailabilityForDates = async (dates) => {
  await delay(80);
  return availability.filter((a) => dates.includes(a.service_date)).map((a) => ({ ...a }));
};
