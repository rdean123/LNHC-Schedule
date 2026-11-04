import { CalendarCheck, Calendar, House, LogOut, User } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSignedIn } from '../../app/auth';
import { Avatar } from '../ui/Parts';
import { Brand, DemoBanner } from './Brand';

const links = [
  { to: '/', label: 'Home', short: 'Home', icon: House, end: true },
  { to: '/schedules', label: 'Schedules', short: 'Schedules', icon: Calendar, end: false },
  {
    to: '/availability',
    label: 'My availability',
    short: 'Availability',
    icon: CalendarCheck,
    end: false,
  },
];

export function VolunteerLayout() {
  const { volunteer, email, role, logOut } = useSignedIn();
  const name = volunteer?.displayName ?? email;

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <DemoBanner />
      <header className="sticky top-0 z-20 border-b border-line bg-surface print:hidden">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4 md:px-6">
          <Brand to="/" subtitle="Lipa New Hope Church" className="text-deep" />
          <nav aria-label="Main" className="ml-4 hidden gap-1 md:flex">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-11 items-center gap-2 rounded-control px-3 font-semibold no-underline ${
                    isActive
                      ? 'bg-wash text-deep shadow-[inset_0_-3px_0_var(--color-brand)]'
                      : 'text-muted hover:bg-wash hover:text-deep'
                  }`
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {role === 'admin' && (
              <NavLink
                to="/admin"
                className="hidden min-h-11 items-center rounded-control px-3 font-semibold text-brand no-underline hover:bg-wash md:flex"
              >
                Administration
              </NavLink>
            )}
            <NavLink to="/profile" className="flex items-center gap-2 text-ink no-underline">
              <Avatar name={name} />
              <span className="sr-only md:hidden">Your profile, {name}</span>
              <span className="hidden md:inline">{name}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => void logOut()}
              className="hidden min-h-9 items-center gap-2 rounded-control px-3 text-sm font-semibold text-brand hover:bg-wash md:flex"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-16 md:pt-8 print:p-0"
      >
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {[
          ...links,
          { to: '/profile', label: 'Profile', short: 'Profile', icon: User, end: false },
        ].map(({ to, short, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `grid min-h-14 justify-items-center gap-0.5 px-1 py-2 text-xs font-semibold no-underline ${
                isActive ? 'text-deep shadow-[inset_0_3px_0_var(--color-brand)]' : 'text-muted'
              }`
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {short}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
