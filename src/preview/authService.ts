// PREVIEW MODE ONLY. Stands in for features/authentication/authService.ts.
import type { Session } from '@supabase/supabase-js';
import type * as Real from '../features/authentication/authService';
import { AppError } from '../lib/supabase/errors';
import { validateEmail, validatePassword } from '../lib/validation/auth';
import type { AppRole } from '../types/database';
import { ADMIN_USER_ID, RDEN_USER_ID, SCHEDULER_USER_ID, delay, roles } from './db';

const KEY = 'lnhc-preview-user';
const accounts: Record<string, { id: string; email: string }> = {
  admin: { id: ADMIN_USER_ID, email: 'admin@lnhc.example' },
  rden: { id: RDEN_USER_ID, email: 'rden@lnhc.example' },
  scheduler: { id: SCHEDULER_USER_ID, email: 'scheduler@lnhc.example' },
};

const listeners = new Set<(session: Session | null) => void>();

/** `?as=admin`, `?as=scheduler` or `?as=rden` signs in directly (handy for demos and automated checks). */
function readInitial(): string | null {
  try {
    const asParam = new URLSearchParams(window.location.search).get('as');
    if (asParam && asParam in accounts) sessionStorage.setItem(KEY, asParam);
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
let current: string | null = readInitial();

export const currentPreviewUserId = () => (current ? accounts[current].id : null);

function sessionFor(key: string | null): Session | null {
  if (!key) return null;
  const a = accounts[key];
  return {
    user: { id: a.id, email: a.email },
    access_token: 'preview',
    refresh_token: 'preview',
  } as unknown as Session;
}

function notify() {
  const session = sessionFor(current);
  listeners.forEach((l) => l(session));
}

export const signIn: typeof Real.signIn = async (email, password) => {
  await delay();
  const problem = validateEmail(email);
  if (problem) throw new AppError(problem);
  if (!password) throw new AppError('Enter your password.');
  const found = Object.entries(accounts).find(([, a]) => a.email === email.trim().toLowerCase());
  if (!found) throw new AppError('That email and password don’t match. Check them and try again.');
  current = found[0];
  try {
    sessionStorage.setItem(KEY, current);
  } catch {
    /* preview only */
  }
  notify();
};

export const signOut: typeof Real.signOut = async () => {
  await delay(60);
  current = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* preview only */
  }
  notify();
};

export const requestPasswordReset: typeof Real.requestPasswordReset = async (email) => {
  await delay();
  const problem = validateEmail(email);
  if (problem) throw new AppError(problem);
};

export const setNewPassword: typeof Real.setNewPassword = async (password, confirmation) => {
  await delay();
  const problem = validatePassword(password, confirmation);
  if (problem) throw new AppError(problem);
};

export const getSession: typeof Real.getSession = async () => sessionFor(current);

export const onAuthChange: typeof Real.onAuthChange = (callback) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const getMyRole: typeof Real.getMyRole = async () => {
  const id = currentPreviewUserId();
  return id ? ((roles.get(id) ?? 'volunteer') as AppRole) : null;
};
