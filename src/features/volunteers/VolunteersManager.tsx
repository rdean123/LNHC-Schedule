import { Ban, Check, Pencil, Plus, Search, Send } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Dialog } from '../../components/ui/Dialog';
import { Field, TextInput, inputClasses } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { Avatar, PageHead, Panel } from '../../components/ui/Parts';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui/States';
import { useToast } from '../../components/ui/toastContext';
import { getAvailabilityForDates } from '../../features/availability/availabilityService';
import { inviteVolunteer } from '../../features/administration/inviteService';
import { listRoles, setRole } from '../../features/administration/roleService';
import { listPositions, listVenues } from '../../features/ministries/catalogService';
import { listServices } from '../../features/scheduling/scheduleService';
import {
  createVolunteer,
  listVolunteerDetails,
  setQualifications,
  setVolunteerActive,
  updateVolunteer,
} from '../../features/volunteers/volunteerService';
import type { VolunteerDetails } from '../../features/volunteers/volunteerService';
import { useAsync } from '../../hooks/useAsync';
import {
  addDays,
  currentMonth,
  formatLongDate,
  formatShortDate,
  monthTitle,
  shiftMonth,
  sundaysOfMonth,
  todayIso,
} from '../../lib/format';
import { canChangeRoles, roleLabel } from '../../lib/roles';
import type { AppRole, PositionRow } from '../../types/database';
import { useSignedIn } from '../../app/auth';

/** People who serve: add them, choose what each can do, see availability and history, and invite them. */
export function VolunteersManager() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const [volunteers, positions, roles] = await Promise.all([
      listVolunteerDetails(),
      listPositions(),
      listRoles(),
    ]);
    return { volunteers, positions, roles };
  }, []);
  const { data, loading, error, reload } = useAsync(load);

  if (error && !data) return <ErrorBlock message={error.message} onRetry={reload} />;
  if (!data) return <LoadingBlock rows={6} label="Loading volunteers" />;

  const needle = query.trim().toLowerCase();
  const list = data.volunteers.filter(
    (v) => !needle || v.display_name.toLowerCase().includes(needle),
  );
  const selected =
    data.volunteers.find((v) => v.id === params.get('volunteer')) ??
    list[0] ??
    data.volunteers[0] ??
    null;
  const positionName = (id: string) => data.positions.find((p) => p.id === id)?.name ?? '';

  return (
    <div>
      <PageHead
        title="Volunteers"
        subtitle="Add people, choose what each can do, and see their availability and history."
      >
        <Button variant="primary" onClick={() => setAdding(true)}>
          <Plus className="size-5" aria-hidden="true" />
          Add volunteer
        </Button>
      </PageHead>

      {data.volunteers.length === 0 ? (
        <Panel>
          <EmptyState
            title="No volunteers yet"
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus className="size-5" aria-hidden="true" />
                Add your first volunteer
              </Button>
            }
          >
            Add the people who serve, then choose which positions each can do. Only qualified people
            are offered when you schedule.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[21rem_minmax(0,1fr)]">
          <Panel className="overflow-hidden" aria-label="Volunteer list">
            <div className="relative border-b border-line p-3">
              <label htmlFor="volunteer-search" className="sr-only">
                Search volunteers by name
              </label>
              <Search
                className="pointer-events-none absolute left-6 top-1/2 size-5 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                id="volunteer-search"
                type="search"
                placeholder="Search by name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputClasses} pl-10`}
              />
            </div>
            <ul className="m-0 max-h-[32rem] list-none overflow-y-auto p-0">
              {list.length === 0 && <li className="p-4 text-muted">No one matches “{query}”.</li>}
              {list.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    aria-current={selected?.id === v.id}
                    onClick={() => setParams({ volunteer: v.id }, { replace: true })}
                    className={`grid min-h-16 w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line px-4 py-3 text-left hover:bg-wash ${
                      selected?.id === v.id ? 'bg-wash' : ''
                    }`}
                  >
                    <Avatar name={v.display_name} />
                    <span className="min-w-0">
                      <span
                        className={`block font-bold ${selected?.id === v.id ? 'text-deep' : 'text-ink'}`}
                      >
                        {v.display_name}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {v.positionIds.length
                          ? v.positionIds.map(positionName).join(', ')
                          : 'No positions yet'}
                      </span>
                    </span>
                    {v.is_active ? (
                      <Chip tone="published" icon={false}>
                        Active
                      </Chip>
                    ) : (
                      <Chip tone="draft" icon={false}>
                        Inactive
                      </Chip>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {selected && (
            <VolunteerPanel
              key={selected.id}
              volunteer={selected}
              positions={data.positions}
              role={selected.user_id ? data.roles[selected.user_id] : undefined}
              onChanged={reload}
              refreshing={loading}
            />
          )}
        </div>
      )}

      <AddVolunteerDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(id, name) => {
          setAdding(false);
          setParams({ volunteer: id }, { replace: true });
          toast.success(`${name} added. Now choose what they can do.`);
          reload();
        }}
      />
    </div>
  );
}

function VolunteerPanel({
  volunteer,
  positions,
  role,
  onChanged,
  refreshing,
}: {
  volunteer: VolunteerDetails;
  positions: PositionRow[];
  role: AppRole | undefined;
  onChanged: () => void;
  refreshing: boolean;
}) {
  const toast = useToast();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(volunteer.positionIds));
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState(false);
  const { role: myRole } = useSignedIn();
  const mayChangeRoles = canChangeRoles(myRole);
  const [confirm, setConfirm] = useState<'deactivate' | null>(null);
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null);
  const [working, setWorking] = useState(false);

  const saved = new Set(volunteer.positionIds);
  const dirty = chosen.size !== saved.size || [...chosen].some((p) => !saved.has(p));

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveQualifications() {
    setSaving(true);
    try {
      await setQualifications(volunteer.id, [...chosen]);
      toast.success(`Saved what ${volunteer.display_name} can do.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t save that.');
    } finally {
      setSaving(false);
    }
  }

  async function invite() {
    setInviting(true);
    try {
      await inviteVolunteer(volunteer.id);
      toast.success(`Invitation sent to ${volunteer.email}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t send the invitation.');
    } finally {
      setInviting(false);
    }
  }

  async function toggleActive() {
    setWorking(true);
    try {
      await setVolunteerActive(volunteer.id, !volunteer.is_active);
      toast.success(
        volunteer.is_active
          ? `${volunteer.display_name} deactivated.`
          : `${volunteer.display_name} is active again.`,
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t update that volunteer.');
    } finally {
      setWorking(false);
      setConfirm(null);
    }
  }

  async function changeRole() {
    if (!volunteer.user_id || !pendingRole) return;
    setWorking(true);
    try {
      await setRole(volunteer.user_id, pendingRole);
      toast.success(
        `${volunteer.display_name} is now ${pendingRole === 'admin' ? 'an' : 'a'} ${roleLabel(pendingRole).toLowerCase()}.`,
      );
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'We couldn’t change that role.');
    } finally {
      setWorking(false);
      setPendingRole(null);
    }
  }

  return (
    <Panel aria-labelledby="volunteer-name" aria-busy={refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <Avatar name={volunteer.display_name} large />
          <div>
            <h2 id="volunteer-name" className="text-2xl">
              {volunteer.display_name}
            </h2>
            <p className="text-sm text-muted">
              {volunteer.email ?? 'No email yet'} ·{' '}
              {volunteer.user_id ? (role ? roleLabel(role) : 'Has an account') : 'No account yet'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!volunteer.user_id && volunteer.email && volunteer.is_active && (
            <Button size="sm" onClick={() => void invite()} busy={inviting}>
              <Send className="size-4" aria-hidden="true" />
              Send invitation
            </Button>
          )}
          {volunteer.user_id && mayChangeRoles && (
            <div className="flex items-center gap-2">
              <label htmlFor="role-select" className="text-sm font-semibold text-deep">
                Role
              </label>
              <select
                id="role-select"
                value={role ?? 'volunteer'}
                onChange={(e) => {
                  const next = e.target.value as AppRole;
                  if (next !== role) setPendingRole(next);
                }}
                className="min-h-9 rounded-control border border-line-strong bg-surface px-2 text-sm font-semibold text-ink"
              >
                <option value="volunteer">Volunteer</option>
                <option value="scheduler">Schedule maker</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit details
          </Button>
          <Button
            size="sm"
            variant={volunteer.is_active ? 'danger' : 'secondary'}
            onClick={() => (volunteer.is_active ? setConfirm('deactivate') : void toggleActive())}
          >
            {volunteer.is_active ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      </div>

      {!volunteer.is_active && (
        <div className="px-5 pt-4 md:px-6">
          <Notice tone="warn" title="Inactive volunteers can’t be scheduled.">
            Their past schedules keep their name.
          </Notice>
        </div>
      )}
      {!volunteer.user_id && !volunteer.email && volunteer.is_active && (
        <div className="px-5 pt-4 md:px-6">
          <Notice tone="info">
            Add an email address to invite {volunteer.display_name} to sign in. Without an account
            they can still be scheduled.
          </Notice>
        </div>
      )}

      <section className="border-b border-line px-5 py-5 md:px-6" aria-labelledby="quals">
        <h3 id="quals" className="text-xl">
          What {volunteer.display_name} can do
        </h3>
        <p className="mb-3 mt-1 text-sm text-muted">
          Only people qualified for a position are offered when you schedule it.
        </p>
        <div role="group" aria-label="Qualifications" className="flex flex-wrap gap-2">
          {positions.map((p) => {
            const on = chosen.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.id)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-[0.9375rem] font-semibold transition-[background-color,border-color,color,transform] duration-150 motion-safe:active:scale-95 ${
                  on
                    ? 'border-brand bg-wash text-brand-hover'
                    : 'border-line-strong bg-surface text-ink hover:bg-wash'
                }`}
              >
                {on && <Check className="pop size-4" aria-hidden="true" />}
                {p.name}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveQualifications()}
            busy={saving}
            disabled={!dirty}
          >
            Save
          </Button>
          {dirty && <span className="text-sm text-muted">You have unsaved changes.</span>}
        </div>
      </section>

      <div className="grid gap-0 md:grid-cols-2">
        <AvailabilityList volunteerId={volunteer.id} />
        <RecentlyServed volunteer={volunteer} positions={positions} />
      </div>

      {editing && (
        <EditVolunteerDialog
          // Remount per volunteer so the form always starts from the saved values.
          key={volunteer.id}
          volunteer={volunteer}
          open
          onClose={() => setEditing(false)}
          onSaved={onChanged}
        />
      )}
      <Dialog
        open={confirm === 'deactivate'}
        alert
        onClose={() => setConfirm(null)}
        title={`Deactivate ${volunteer.display_name}?`}
        description="They won’t be offered for new schedules, and past schedules keep their name. You can reactivate them any time."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Keep active</Button>
            <Button variant="danger" busy={working} onClick={() => void toggleActive()}>
              Deactivate
            </Button>
          </>
        }
      />
      <Dialog
        open={pendingRole !== null}
        alert
        onClose={() => setPendingRole(null)}
        title={
          pendingRole
            ? `Make ${volunteer.display_name} ${pendingRole === 'admin' ? 'an' : 'a'} ${roleLabel(pendingRole).toLowerCase()}?`
            : ''
        }
        description={
          pendingRole === 'admin'
            ? 'Administrators can do everything a schedule maker can, and they are the only ones who can change roles.'
            : pendingRole === 'scheduler'
              ? 'Schedule makers can build and publish schedules, manage volunteers and post announcements. They can’t change roles.'
              : 'They will no longer be able to edit schedules, volunteers or announcements.'
        }
        footer={
          <>
            <Button onClick={() => setPendingRole(null)}>Cancel</Button>
            <Button variant="primary" busy={working} onClick={() => void changeRole()}>
              Change role
            </Button>
          </>
        }
      />
    </Panel>
  );
}

function AvailabilityList({ volunteerId }: { volunteerId: string }) {
  const [month, setMonth] = useState(() => shiftMonth(currentMonth(), 1));
  const load = useCallback(async () => {
    const sundays = sundaysOfMonth(month);
    const rows = await getAvailabilityForDates(sundays);
    return sundays.map((d) => ({
      date: d,
      answer: rows.find((r) => r.volunteer_id === volunteerId && r.service_date === d),
    }));
  }, [month, volunteerId]);
  const { data, error, reload } = useAsync(load);

  return (
    <section className="border-b border-line px-5 py-5 md:border-r md:px-6" aria-labelledby="avail">
      <div className="flex items-center justify-between gap-2">
        <h3 id="avail" className="text-xl">
          {monthTitle(month).split(' ')[0]} availability
        </h3>
        <span className="flex gap-1">
          <Button
            size="sm"
            variant="quiet"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            ‹
          </Button>
          <Button
            size="sm"
            variant="quiet"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            ›
          </Button>
        </span>
      </div>
      {error && !data ? (
        <ErrorBlock message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingBlock rows={3} />
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {data.map(({ date, answer }) => (
            <li
              key={date}
              className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 border-b border-line py-2 last:border-b-0"
            >
              <span>{formatShortDate(date)}</span>
              <span className="truncate text-sm text-muted">{answer?.note ?? ''}</span>
              {!answer ? (
                <span className="text-sm text-muted">No answer</span>
              ) : answer.is_available ? (
                <Chip tone="published">Yes</Chip>
              ) : (
                <Chip tone="draft">
                  <Ban className="hidden" aria-hidden="true" />
                  Away
                </Chip>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentlyServed({
  volunteer,
  positions,
}: {
  volunteer: VolunteerDetails;
  positions: PositionRow[];
}) {
  const load = useCallback(async () => {
    const today = todayIso();
    const [venues, services] = await Promise.all([
      listVenues(),
      listServices({
        volunteerName: volunteer.display_name,
        from: addDays(today, -120),
        to: addDays(today, 90),
      }),
    ]);
    const mine = services.flatMap((s) =>
      s.assignments
        .filter((a) => a.volunteer_id === volunteer.id)
        .map((a) => ({
          date: s.service_date,
          venue: venues.find((v) => v.id === s.venue_id)?.name ?? '',
          position: positions.find((p) => p.id === a.position_id)?.name ?? '',
        })),
    );
    return mine.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [volunteer.id, volunteer.display_name, positions]);
  const { data, error, reload } = useAsync(load);

  return (
    <section className="border-b border-line px-5 py-5 md:px-6" aria-labelledby="served">
      <h3 id="served" className="text-xl">
        Recently and soon serving
      </h3>
      <p className="mb-2 mt-1 text-sm text-muted">Helps you share the load fairly.</p>
      {error && !data ? (
        <ErrorBlock message={error.message} onRetry={reload} />
      ) : !data ? (
        <LoadingBlock rows={3} />
      ) : data.length === 0 ? (
        <p className="text-muted">Not on any schedule yet.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {data.map((h) => (
            <li
              key={`${h.date}-${h.venue}`}
              className="grid grid-cols-[5rem_1fr_auto] gap-3 border-b border-line py-2 last:border-b-0"
            >
              <span>{formatShortDate(h.date)}</span>
              <span>{h.position}</span>
              <span className="text-muted" title={formatLongDate(h.date)}>
                {h.venue}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EditVolunteerDialog({
  volunteer,
  open,
  onClose,
  onSaved,
}: {
  volunteer: VolunteerDetails;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(volunteer.display_name);
  const [fullName, setFullName] = useState(volunteer.fullName ?? '');
  const [email, setEmail] = useState(volunteer.email ?? '');
  const [phone, setPhone] = useState(volunteer.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateVolunteer(volunteer.id, { displayName, fullName, email, phone });
      toast.success(`Saved ${displayName.trim()}’s details.`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t save those details.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${volunteer.display_name}`}
      description={
        volunteer.user_id
          ? 'This changes the details on file. The email they sign in with belongs to their account and stays the same.'
          : 'Change the name on the schedule or their contact details.'
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Name on the schedule" error={error}>
          {(c) => (
            <TextInput
              {...c}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          )}
        </Field>
        <Field label="Full name (optional)">
          {(c) => (
            <TextInput
              {...c}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
            />
          )}
        </Field>
        <Field label="Email (optional)" hint="Needed to send an invitation.">
          {(c) => (
            <TextInput
              {...c}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Phone (optional)">
          {(c) => (
            <TextInput
              {...c}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          )}
        </Field>
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" busy={busy}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function AddVolunteerDialog({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: (id: string, name: string) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setDisplayName('');
    setFullName('');
    setEmail('');
    setPhone('');
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await createVolunteer({ displayName, fullName, email, phone });
      const name = displayName.trim();
      reset();
      onAdded(id, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We couldn’t add that volunteer.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add a volunteer"
      description="Use the name that appears on the schedule, such as “Sica”. Add an email to invite them to sign in."
    >
      <form onSubmit={(e) => void submit(e)} noValidate>
        <Field label="Name on the schedule" error={error}>
          {(c) => (
            <TextInput
              {...c}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              autoFocus
            />
          )}
        </Field>
        <Field label="Full name (optional)">
          {(c) => (
            <TextInput
              {...c}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={80}
            />
          )}
        </Field>
        <Field label="Email (optional)" hint="Needed to send an invitation.">
          {(c) => (
            <TextInput
              {...c}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Phone (optional)">
          {(c) => (
            <TextInput
              {...c}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
            />
          )}
        </Field>
        <div className="mt-2 flex flex-wrap justify-end gap-3">
          <Button
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Add volunteer
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
