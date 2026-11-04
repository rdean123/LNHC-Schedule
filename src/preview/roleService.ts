// PREVIEW MODE ONLY. Stands in for features/administration/roleService.ts.
import type * as Real from '../features/administration/roleService';
import { AppError } from '../lib/supabase/errors';
import { delay, record, roles } from './db';

export const listRoles: typeof Real.listRoles = async () => {
  await delay(60);
  return Object.fromEntries(roles);
};

export const setRole: typeof Real.setRole = async (userId, role) => {
  await delay(80);
  const admins = [...roles].filter(([, r]) => r === 'admin').map(([id]) => id);
  if (roles.get(userId) === 'admin' && role !== 'admin' && admins.length === 1) {
    throw new AppError(
      "You can't remove the last administrator. Make someone else an administrator first.",
    );
  }
  roles.set(userId, role);
  record(`Changed a role: ${role}`);
};
