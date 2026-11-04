import { useCallback } from 'react';
import { useSignedIn } from '../../app/auth';
import { useAsync } from '../../hooks/useAsync';
import { Reveal } from '../../components/ui/Reveal';
import { AttentionPanel } from './AttentionPanel';
import { loadOverview } from './overview';

/** "Needs your attention" for a schedule maker, shown on their home screen under the volunteer view. */
export function StaffAttention() {
  const { role } = useSignedIn();
  const load = useCallback(() => loadOverview(role), [role]);
  const { data } = useAsync(load);
  // Quiet while loading or if it fails: this is an extra on the home screen, not the main content.
  if (!data) return null;
  return (
    <div className="mt-6">
      <Reveal>
        <AttentionPanel items={data.items} id="staff-attention" />
      </Reveal>
    </div>
  );
}
