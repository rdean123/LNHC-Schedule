import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Chip } from '../../../components/ui/Chip';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, TextArea, TextInput } from '../../../components/ui/Field';
import { PageHead, Panel } from '../../../components/ui/Parts';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../../components/ui/States';
import { useToast } from '../../../components/ui/toastContext';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  setAnnouncementPublished,
  updateAnnouncement,
} from '../../../features/announcements/announcementService';
import { useAsync } from '../../../hooks/useAsync';
import { formatFullDate } from '../../../lib/format';
import type { AnnouncementRow } from '../../../types/database';

type Editing = { id: string | null; title: string; body: string; pinned: boolean };

/** Messages volunteers see on their home screen under "From the church". */
export function AdminAnnouncementsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(listAnnouncements);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<AnnouncementRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>, success: string) => {
      try {
        await action();
        toast.success(success);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      } finally {
        reload();
      }
    },
    [toast, reload],
  );

  async function save(e: FormEvent, publishNow: boolean) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    try {
      const input = { title: editing.title, body: editing.body, isPinned: editing.pinned };
      if (editing.id) await updateAnnouncement(editing.id, input);
      else await createAnnouncement(input, publishNow);
      toast.success(
        editing.id
          ? 'Announcement saved.'
          : publishNow
            ? 'Announcement published.'
            : 'Draft saved.',
      );
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'We couldn’t save the announcement.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Announcements"
        subtitle="Short messages for volunteers. Published ones appear on their home screen."
      >
        <Button
          variant="primary"
          onClick={() => {
            setFormError(null);
            setEditing({ id: null, title: '', body: '', pinned: false });
          }}
        >
          <Plus className="size-5" aria-hidden="true" />
          New announcement
        </Button>
      </PageHead>

      {error && !data ? (
        <ErrorBlock message={error.message} onRetry={reload} />
      ) : !data || (loading && !data) ? (
        <LoadingBlock rows={3} />
      ) : data.length === 0 ? (
        <Panel>
          <EmptyState title="No announcements yet">
            Share a reminder, a theme or a rehearsal change. Volunteers see published announcements
            on their home screen.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {data.map((a) => (
            <li key={a.id}>
              <Panel className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl">{a.title}</h2>
                      {a.published_at ? (
                        <Chip tone="published">Published</Chip>
                      ) : (
                        <Chip tone="draft">Draft</Chip>
                      )}
                      {a.is_pinned && <Chip tone="info">Pinned</Chip>}
                    </div>
                    <p className="mt-2 max-w-[68ch]">{a.body}</p>
                    <p className="mt-1 text-sm text-muted">
                      {a.published_at
                        ? `Published ${formatFullDate(a.published_at.slice(0, 10))}`
                        : 'Not visible to volunteers'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void run(
                          () => setAnnouncementPublished(a.id, !a.published_at),
                          a.published_at ? 'Announcement unpublished.' : 'Announcement published.',
                        )
                      }
                    >
                      {a.published_at ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setFormError(null);
                        setEditing({ id: a.id, title: a.title, body: a.body, pinned: a.is_pinned });
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setRemoving(a)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit announcement' : 'New announcement'}
      >
        {editing && (
          <form onSubmit={(e) => void save(e, true)} noValidate>
            <Field label="Title" error={formError}>
              {(c) => (
                <TextInput
                  {...c}
                  maxLength={120}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  autoFocus
                />
              )}
            </Field>
            <Field label="Message">
              {(c) => (
                <TextArea
                  {...c}
                  maxLength={2000}
                  value={editing.body}
                  onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                />
              )}
            </Field>
            <label className="mb-5 flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-5"
                checked={editing.pinned}
                onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
              />
              Pin to the top
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              {!editing.id && (
                <Button busy={busy} onClick={(e) => void save(e as unknown as FormEvent, false)}>
                  Save as draft
                </Button>
              )}
              <Button type="submit" variant="primary" busy={busy}>
                {editing.id ? 'Save changes' : 'Publish'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={removing !== null}
        alert
        onClose={() => setRemoving(null)}
        title="Delete this announcement?"
        description={
          removing
            ? `“${removing.title}” will be removed for everyone. This can’t be undone.`
            : undefined
        }
        footer={
          <>
            <Button onClick={() => setRemoving(null)}>Keep it</Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = removing;
                setRemoving(null);
                if (target) void run(() => deleteAnnouncement(target.id), 'Announcement deleted.');
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </div>
  );
}
