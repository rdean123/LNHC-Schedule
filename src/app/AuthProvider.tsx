import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getMyRole,
  getSession,
  onAuthChange,
  signOut,
} from '../features/authentication/authService';
import { getMyVolunteer } from '../features/volunteers/myProfileService';
import { AuthContext } from './auth';
import type { AuthState } from './auth';

async function resolveAuthState(): Promise<AuthState> {
  try {
    const session = await getSession();
    if (!session) return { status: 'signedOut' };
    const [role, volunteer] = await Promise.all([getMyRole(), getMyVolunteer()]);
    return {
      status: 'signedIn',
      userId: session.user.id,
      email: session.user.email ?? '',
      role: role ?? 'volunteer',
      volunteer,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Something went wrong while signing you in.',
    };
  }
}

/** Keeps the signed-in user, their role and their volunteer record up to date. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void resolveAuthState().then((next) => {
        if (active) setState(next);
      });
    };
    refresh();
    const unsubscribe = onAuthChange(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const logOut = useCallback(async () => {
    await signOut();
    setState({ status: 'signedOut' });
  }, []);

  const api = useMemo(() => ({ state, logOut }), [state, logOut]);
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
