// PREVIEW MODE ONLY. Stands in for features/announcements/announcementService.ts.
import type * as Real from '../features/announcements/announcementService';
import { AppError } from '../lib/supabase/errors';
import { currentPreviewUserId } from './authService';
import { announcements, delay, record, roles, uid } from './db';

const isStaff = () => {
  const role = roles.get(currentPreviewUserId() ?? '');
  return role === 'admin' || role === 'scheduler';
};

function check(input: Real.AnnouncementInput) {
  if (!input.title.trim()) throw new AppError('Give the announcement a title.');
  if (!input.body.trim()) throw new AppError('Write the message.');
}

export const listAnnouncements: typeof Real.listAnnouncements = async () => {
  await delay();
  return announcements
    .filter((a) => isStaff() || (a.published_at && a.published_at <= new Date().toISOString()))
    .map((a) => ({ ...a }))
    .sort(
      (a, b) =>
        Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at),
    );
};

export const createAnnouncement: typeof Real.createAnnouncement = async (input, publishNow) => {
  await delay();
  check(input);
  const now = new Date().toISOString();
  announcements.unshift({
    id: uid('ann'),
    title: input.title.trim(),
    body: input.body.trim(),
    venue_id: input.venueId ?? null,
    is_pinned: input.isPinned ?? false,
    published_at: publishNow ? now : null,
    created_by: currentPreviewUserId(),
    created_at: now,
    updated_at: now,
  });
  record(`Added an announcement: ${input.title.trim()}`);
};

export const updateAnnouncement: typeof Real.updateAnnouncement = async (id, input) => {
  await delay();
  check(input);
  const a = announcements.find((x) => x.id === id);
  if (a)
    Object.assign(a, {
      title: input.title.trim(),
      body: input.body.trim(),
      venue_id: input.venueId ?? null,
      is_pinned: input.isPinned ?? false,
    });
};

export const setAnnouncementPublished: typeof Real.setAnnouncementPublished = async (
  id,
  published,
) => {
  await delay(80);
  const a = announcements.find((x) => x.id === id);
  if (a) a.published_at = published ? new Date().toISOString() : null;
};

export const deleteAnnouncement: typeof Real.deleteAnnouncement = async (id) => {
  await delay(80);
  const i = announcements.findIndex((x) => x.id === id);
  if (i >= 0) announcements.splice(i, 1);
};
