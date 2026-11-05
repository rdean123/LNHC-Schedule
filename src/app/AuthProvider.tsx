import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getMyRole,
  getSession,
  onAuthChange,
  signOut,
} from '../features/authentication/authService';
import { getMyVolunteer } from '../features/volunteers/myProfileService';
import type { AppRole } from '../types/database';
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
      realRole: role ?? 'volunteer',
      volunteer,
    };
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Something went wrong while signing you in.',
    };
  }
}

const VIEW_AS_KEY = 'lnhc.viewAs';

function loadViewAs(): AppRole | null {
  try {
    const value = sessionStorage.getItem(VIEW_AS_KEY);
    return value === 'scheduler' || value === 'volunteer' ? value : null;
  } catch {
    return null;
  }
}

/** Keeps the signed-in user, their role and their volunteer record up to date. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [base, setState] = useState<AuthState>({ status: 'loading' });
  const [viewAs, setViewAsState] = useState<AppRole | null>(loadViewAs);

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

  const setViewAs = useCallback((role: AppRole | null) => {
    const next = role === 'admin' ? null : role;
    setViewAsState(next);
    try {
      if (next) sessionStorage.setItem(VIEW_AS_KEY, next);
      else sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {
      // Private windows can block storage; the choice then lasts until the page is reloaded.
    }
  }, []);

  const logOut = useCallback(async () => {
    await signOut();
    setViewAs(null);
    setState({ status: 'signedOut' });
  }, [setViewAs]);

  // Only a real administrator can preview another role; anyone else's choice is ignored.
  const state = useMemo<AuthState>(
    () =>
      base.status === 'signedIn' && base.realRole === 'admin' && viewAs
        ? { ...base, role: viewAs }
        : base,
    [base, viewAs],
  );

  const api = useMemo(() => ({ state, logOut, setViewAs }), [state, logOut, setViewAs]);
  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}
