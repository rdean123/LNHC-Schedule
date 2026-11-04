import { Calendar, CalendarCheck, House, LogOut, Menu, User, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useScrolled } from '../../hooks/useScrolled';
import { useSignedIn } from '../../app/auth';
import { isStaff, staffPaths } from '../../lib/roles';
import { Avatar } from '../ui/Parts';
import { Brand, DemoBanner } from './Brand';

type Item = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Extra classes that decide where on the screen the link appears. */
  show?: string;
};

/**
 * The volunteer layout. A schedule maker sees the same layout with a few extra items
 * (People, Announcements, Activity log); the editing tools appear on the screens themselves.
 */
export function VolunteerLayout() {
  const { volunteer, email, role, logOut } = useSignedIn();
  const name = volunteer?.displayName ?? email;
  const staff = isStaff(role);
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  const paths = staffPaths(role);

  const desktop: Item[] = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/schedules', label: 'Schedules', icon: Calendar },
    { to: '/availability', label: staff ? 'Availability' : 'My availability', icon: CalendarCheck },
    ...(staff
      ? [
          { to: paths.people, label: 'People', icon: Users },
          { to: '/more', label: 'More', icon: Menu },
        ]
      : []),
  ];

  const phone: Item[] = staff
    ? [
        { to: '/', label: 'Home', icon: House, end: true },
        { to: '/schedules', label: 'Schedules', icon: Calendar },
        { to: paths.people, label: 'People', icon: Users },
        { to: '/availability', label: 'Availability', icon: CalendarCheck },
        { to: '/more', label: 'More', icon: Menu },
      ]
    : [
        { to: '/', label: 'Home', icon: House, end: true },
        { to: '/schedules', label: 'Schedules', icon: Calendar },
        { to: '/availability', label: 'Availability', icon: CalendarCheck },
        { to: '/profile', label: 'Profile', icon: User },
      ];

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <DemoBanner />
      <header
        className={`sticky top-0 z-20 border-b border-line bg-surface transition-shadow duration-200 print:hidden ${
          scrolled ? 'shadow-[0_10px_24px_-16px_rgb(26_90_158/0.5)]' : ''
        }`}
      >
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-5 px-4 md:px-6">
          <Brand to="/" subtitle="Lipa New Hope Church" className="text-deep" />
          <nav aria-label="Main" className="ml-2 hidden gap-1 md:flex">
            {desktop.map(({ to, label, icon: Icon, end, show }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-control px-3 font-semibold no-underline transition-colors duration-150 ${show ?? ''} ${
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
              <span className={`sr-only ${staff ? '2xl:hidden' : 'lg:hidden'}`}>
                Your profile, {name}
              </span>
              <span className={`hidden ${staff ? '2xl:inline' : 'lg:inline'}`}>{name}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => void logOut()}
              className={`hidden min-h-9 items-center gap-2 rounded-control px-3 whitespace-nowrap text-sm font-semibold text-brand hover:bg-wash ${staff ? 'lg:flex' : 'md:flex'}`}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 pb-28 pt-6 outline-none md:px-6 md:pb-16 md:pt-8 print:p-0"
      >
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {phone.map(({ to, label, icon: Icon, end }) => (
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
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
