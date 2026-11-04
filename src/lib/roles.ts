import type { AppRole } from '../types/database.ts';

/** Administrators and schedule makers can edit schedules, people and announcements. */
export const isStaff = (role: AppRole | null | undefined): boolean =>
  role === 'admin' || role === 'scheduler';

/** Only administrators can change who holds which role. */
export const canChangeRoles = (role: AppRole | null | undefined): boolean => role === 'admin';

export const roleLabel = (role: AppRole): string =>
  role === 'admin' ? 'Administrator' : role === 'scheduler' ? 'Schedule maker' : 'Volunteer';

/**
 * Where the editing screens live. Administrators have their own sidebar layout; schedule makers
 * use the volunteer layout with edit tools added, so the same tools sit at different addresses.
 */
export function staffPaths(role: AppRole | null | undefined) {
  const admin = role === 'admin';
  return {
    scheduleEditor: admin ? '/admin/schedule' : '/schedules/edit',
    people: admin ? '/admin/volunteers' : '/people',
    announcements: admin ? '/admin/announcements' : '/announcements',
    activity: admin ? '/admin/activity' : '/activity',
  };
}
