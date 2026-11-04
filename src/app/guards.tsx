import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Notice } from '../components/ui/Notice';
import { isStaff } from '../lib/roles';
import { useAuth } from './auth';

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-lg place-items-center p-6">{children}</div>
  );
}

/** Everything inside needs a signed-in user. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();

  if (state.status === 'loading') {
    return (
      <FullPage>
        <p className="text-muted" role="status">
          Loading…
        </p>
      </FullPage>
    );
  }
  if (state.status === 'error') {
    return (
      <FullPage>
        <Notice tone="error" title="We couldn’t sign you in.">
          {state.message}
        </Notice>
      </FullPage>
    );
  }
  if (state.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Administrator screens. A volunteer who opens one is sent home; the database enforces this too. */
export function RequireAdmin() {
  const { state } = useAuth();
  if (state.status === 'signedIn' && state.role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Schedule makers (and administrators) can edit schedules, people and announcements. */
export function RequireStaff() {
  const { state } = useAuth();
  if (state.status === 'signedIn' && !isStaff(state.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Administrators land on their dashboard; schedule makers and volunteers on their home. */
export function HomeRedirect({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'signedIn' && state.role === 'admin')
    return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
