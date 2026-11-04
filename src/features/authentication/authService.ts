import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError } from '../../lib/supabase/errors';
import { validateEmail, validatePassword } from '../../lib/validation/auth';
import type { AppRole } from '../../types/database';

export async function signIn(email: string, password: string): Promise<void> {
  const emailProblem = validateEmail(email);
  if (emailProblem) throw new AppError(emailProblem);
  if (!password) throw new AppError('Enter your password.');

  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toAppError(error, 'We couldn’t sign you in. Try again.');
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw toAppError(error, 'We couldn’t sign you out. Try again.');
}

/**
 * Sends a reset link. Resolves the same way whether or not the address has an account, so the
 * form can't be used to discover who has one.
 */
export async function requestPasswordReset(email: string, redirectTo: string): Promise<void> {
  const emailProblem = validateEmail(email);
  if (emailProblem) throw new AppError(emailProblem);

  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error && /rate limit|too many/i.test(error.message)) {
    throw new AppError('Too many requests. Wait a minute and try again.');
  }
}

/** Used after following an invite or reset link, when the person has a temporary session. */
export async function setNewPassword(password: string, confirmation: string): Promise<void> {
  const problem = validatePassword(password, confirmation);
  if (problem) throw new AppError(problem);

  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) {
    throw toAppError(error, 'We couldn’t save your password. Try the link in your email again.');
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw toAppError(error, 'We couldn’t check your sign-in.');
  return data.session;
}

export function onAuthChange(callback: (session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

/** The signed-in person's role. Row level security returns only their own row. */
export async function getMyRole(): Promise<AppRole | null> {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await getSupabase()
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) throw toAppError(error, 'We couldn’t check your permissions.');
  return data?.role ?? null;
}
