import { ChevronRight, History, LogOut, Megaphone, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHead, Panel } from '../../../components/ui/Parts';
import { useSignedIn } from '../../auth';

const rows = [
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/activity', label: 'Activity log', icon: History },
  { to: '/schedules', label: 'See schedules as a volunteer', icon: User },
];

/** The rest of the administrator menu, for phones where the sidebar is hidden. */
export function AdminMorePage() {
  const { logOut, email } = useSignedIn();
  return (
    <div>
      <PageHead title="More" subtitle={`Signed in as ${email}`} />
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
