import { PageHead, Panel } from '../../../components/ui/Parts';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../../components/ui/States';
import { getActivityLog } from '../../../features/administration/activityService';
import { useAsync } from '../../../hooks/useAsync';
import { CHURCH_TIME_ZONE } from '../../../lib/format';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: CHURCH_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

/** Who changed what, newest first. Read-only. */
export function ActivityPage() {
  const { data, error, reload } = useAsync(getActivityLog);

  return (
    <div>
      <PageHead
        title="Activity log"
        subtitle="The latest changes to schedules, volunteers and roles."
      />
      {error && !data ? (
        <ErrorBlock message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingBlock rows={6} />
      ) : data.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing has changed yet">
            Changes appear here as soon as someone edits a schedule or a volunteer.
          </EmptyState>
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul className="m-0 list-none p-0">
            {data.map((e) => (
              <li
                key={e.id}
                className="grid gap-x-4 gap-y-0.5 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr_9rem]"
              >
                <span className="text-sm text-muted">{when(e.when)}</span>
                <span>{e.summary}</span>
                <span className="text-sm text-muted sm:text-right">{e.actorName}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
