import { createContext, useContext } from 'react';
import type { MyVolunteer } from '../features/volunteers/myProfileService';
import type { AppRole } from '../types/database';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'error'; message: string }
  | {
      status: 'signedIn';
      userId: string;
      email: string;
      /** The role the screens are showing. Equals realRole unless an administrator is previewing. */
      role: AppRole;
      /** The role the account really holds. The database always enforces this one. */
      realRole: AppRole;
      /** The volunteer record linked to this account, if any (an administrator may not serve). */
      volunteer: MyVolunteer | null;
    };

export type AuthApi = {
  state: AuthState;
  logOut: () => Promise<void>;
  /** Administrators only: preview the app as another role. Pass null to return to your own. */
  setViewAs: (role: AppRole | null) => void;
};

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const api = useContext(AuthContext);
  if (!api) throw new Error('useAuth must be used inside <AuthProvider>.');
  return api;
}

/** For screens inside the signed-in area, where a session is guaranteed by the route guard. */
export function useSignedIn() {
  const { state, logOut, setViewAs } = useAuth();
  if (state.status !== 'signedIn') throw new Error('This screen needs a signed-in user.');
  return { ...state, logOut, setViewAs };
}
