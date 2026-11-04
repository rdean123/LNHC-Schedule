import { Calendar, History, LayoutDashboard, LogOut, Megaphone, Menu, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSignedIn } from '../../app/auth';
import { Avatar } from '../ui/Parts';
import { Brand, DemoBanner } from './Brand';

const links = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Schedules', icon: Calendar, end: false },
  { to: '/admin/volunteers', label: 'Volunteers', icon: Users, end: false },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone, end: false },
  { to: '/admin/activity', label: 'Activity log', icon: History, end: false },
];

const tabs = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/schedule', label: 'Schedules', icon: Calendar, end: false },
  { to: '/admin/volunteers', label: 'Volunteers', icon: Users, end: false },
  { to: '/admin/more', label: 'More', icon: Menu, end: false },
];

export function AdminLayout() {
  const { email, logOut } = useSignedIn();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-line bg-surface p-3 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-5 print:hidden">
        <Brand to="/admin" subtitle="Administrator" className="px-2 pt-2 text-deep" />
        <nav aria-label="Administration" className="grid gap-0.5">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-control px-3 font-semibold no-underline ${
                  isActive ? 'bg-mist text-deep' : 'text-muted hover:bg-wash hover:text-deep'
                }`
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 border-t border-line px-2 py-3 text-sm">
          <Avatar name={email} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{email}</p>
            <button
              type="button"
              onClick={() => void logOut()}
              className="flex items-center gap-1 text-brand underline underline-offset-2"
            >
              <LogOut className="size-3.5" aria-hidden="true" />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <DemoBanner />
        <header className="flex min-h-14 items-center border-b border-line bg-surface px-4 md:hidden print:hidden">
          <Brand to="/admin" subtitle="Administrator" className="text-deep" />
        </header>
        <main id="main" className="mx-auto max-w-[78rem] px-4 pb-28 pt-6 md:px-8 md:pb-16 md:pt-8">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Administration"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-flow-col auto-cols-fr border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        {tabs.map(({ to, label, icon: Icon, end }) => (
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
