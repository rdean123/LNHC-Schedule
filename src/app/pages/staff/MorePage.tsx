import { ChevronRight, History, LogOut, Megaphone, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHead, Panel } from '../../../components/ui/Parts';
import { roleLabel, staffPaths } from '../../../lib/roles';
import { useSignedIn } from '../../auth';

/** The rest of the menu for phones and narrow windows, for administrators and schedule makers. */
export function MorePage() {
  const { logOut, email, role } = useSignedIn();
  const paths = staffPaths(role);
  const rows = [
    { to: paths.announcements, label: 'Announcements', icon: Megaphone },
    { to: paths.activity, label: 'Activity log', icon: History },
    { to: '/profile', label: 'Your profile', icon: User },
  ];

  return (
    <div>
      <PageHead
        title="More"
        subtitle={`Signed in as ${email} (${roleLabel(role).toLowerCase()})`}
      />
      <Panel className="overflow-hidden">
        <ul className="m-0 list-none p-0">
          {rows.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex min-h-14 items-center gap-3 border-b border-line px-5 font-semibold text-ink no-underline hover:bg-wash"
              >
                <Icon className="size-5 text-brand" aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <ChevronRight className="size-5 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => void logOut()}
              className="flex min-h-14 w-full items-center gap-3 px-5 text-left font-semibold text-ink hover:bg-wash"
            >
              <LogOut className="size-5 text-brand" aria-hidden="true" />
              Log out
            </button>
          </li>
        </ul>
      </Panel>
    </div>
  );
}
