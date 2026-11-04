import { LogOut } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { PageHead, Panel, PanelHead } from '../../components/ui/Parts';
import { ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import { updateMyContact } from '../../features/volunteers/volunteerService';
import { getMyContact } from '../../features/volunteers/myProfileService';
import { useAsync } from '../../hooks/useAsync';
import { useSignedIn } from '../auth';

/** Your name on the schedule, your contact details, and sign out. Email changes go through an administrator. */
export function ProfilePage() {
  const { volunteer, email, role, logOut } = useSignedIn();
  const toast = useToast();
  const myId = volunteer?.id ?? null;

  const load = useCallback(() => (myId ? getMyContact(myId) : Promise.resolve(null)), [myId]);
  const { data, loading, error, reload } = useAsync(load);

  const [fullName, setFullName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!myId) return;
    setBusy(true);
    try {
      await updateMyContact(myId, {
        fullName: fullName ?? data?.fullName ?? '',
        phone: phone ?? data?.phone ?? '',
      });
      setFullName(null);
      setPhone(null);
      reload();
      toast.success('Details saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t save your details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Profile"
        subtitle="How your name appears on the schedule, and how to reach you."
      />

      <div className="grid max-w-2xl gap-6">
        {!volunteer ? (
          <Notice tone="warn" title="Your account isn’t linked to a volunteer yet.">
            Ask your administrator to link it. Until then you can sign in but won’t appear on
            schedules.
          </Notice>
        ) : error && !data ? (
          <ErrorBlock message={error.message} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock rows={3} label="Loading your details" />
        ) : (
          <Panel>
            <PanelHead title={volunteer.displayName} />
            <form onSubmit={(e) => void save(e)} className="p-5 md:p-6" noValidate>
              <p className="mb-4 text-sm text-muted">
                This is the name your administrator uses on schedules. To change it, ask your
                administrator.
              </p>
              <Field label="Full name (optional)">
                {(c) => (
                  <TextInput
                    {...c}
                    autoComplete="name"
                    maxLength={80}
                    value={fullName ?? data?.fullName ?? ''}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Phone (optional)">
                {(c) => (
                  <TextInput
                    {...c}
                    type="tel"
                    autoComplete="tel"
                    maxLength={30}
                    value={phone ?? data?.phone ?? ''}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Email" hint="Only an administrator can change your email address.">
                {(c) => <TextInput {...c} value={data?.email ?? email} readOnly />}
              </Field>
              <Button
                type="submit"
                variant="primary"
                busy={busy}
                disabled={fullName === null && phone === null}
              >
                Save details
              </Button>
            </form>
          </Panel>
        )}

        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-6">
            <div>
              <p className="font-semibold text-deep">Signed in as {email}</p>
              <p className="text-sm text-muted">
                {role === 'admin' ? 'Administrator' : 'Volunteer'}
              </p>
            </div>
            <Button onClick={() => void logOut()}>
              <LogOut className="size-5" aria-hidden="true" />
              Log out
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
