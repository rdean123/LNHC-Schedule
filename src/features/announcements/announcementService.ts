import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError, unwrap } from '../../lib/supabase/errors';
import type { AnnouncementRow } from '../../types/database';

export type AnnouncementInput = {
  title: string;
  body: string;
  venueId?: string | null;
  isPinned?: boolean;
};

function check(input: AnnouncementInput) {
  if (!input.title.trim()) throw new AppError('Give the announcement a title.');
  if (input.title.trim().length > 120)
    throw new AppError('Shorten the title to 120 characters or fewer.');
  if (!input.body.trim()) throw new AppError('Write the message.');
  if (input.body.trim().length > 2000)
    throw new AppError('Shorten the message to 2000 characters or fewer.');
}

/** Volunteers receive only published announcements; administrators receive all. Enforced by the database. */
export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  return unwrap(
    await getSupabase()
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
    'We couldn’t load the announcements.',
  );
}

export async function createAnnouncement(
  input: AnnouncementInput,
  publishNow: boolean,
): Promise<void> {
  check(input);
  const { error } = await getSupabase()
    .from('announcements')
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      venue_id: input.venueId ?? null,
      is_pinned: input.isPinned ?? false,
      published_at: publishNow ? new Date().toISOString() : null,
    });
  if (error) throw toAppError(error, 'We couldn’t save the announcement.');
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  check(input);
  const { error } = await getSupabase()
    .from('announcements')
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      venue_id: input.venueId ?? null,
      is_pinned: input.isPinned ?? false,
    })
    .eq('id', id);
  if (error) throw toAppError(error, 'We couldn’t save the announcement.');
}

export async function setAnnouncementPublished(id: string, published: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('announcements')
    .update({ published_at: published ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw toAppError(error, 'We couldn’t update the announcement.');
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await getSupabase().from('announcements').delete().eq('id', id);
  if (error) throw toAppError(error, 'We couldn’t delete the announcement.');
}
