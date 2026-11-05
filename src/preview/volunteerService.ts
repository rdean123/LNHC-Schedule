// PREVIEW MODE ONLY. Stands in for features/volunteers/volunteerService.ts.
import type * as Real from '../features/volunteers/volunteerService';
import { AppError } from '../lib/supabase/errors';
import { validateEmail } from '../lib/validation/auth';
import { contacts, delay, qualifications, record, uid, volunteers } from './db';

export const listVolunteerNames: typeof Real.listVolunteerNames = async () => {
  await delay();
  return volunteers
    .map((v) => ({ id: v.id, display_name: v.display_name, is_active: v.is_active }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
};

export const listVolunteerDetails: typeof Real.listVolunteerDetails = async () => {
  await delay();
  return volunteers
    .map((v) => {
      const c = contacts.get(v.id);
      return {
        ...v,
        fullName: c?.full_name ?? null,
        email: c?.email ?? null,
        phone: c?.phone ?? null,
        positionIds: [...qualifications]
          .filter((q) => q.startsWith(`${v.id}|`))
          .map((q) => q.split('|')[1]),
      };
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
};

export const createVolunteer: typeof Real.createVolunteer = async (input) => {
  await delay();
  const name = input.displayName.trim();
  if (!name) throw new AppError('Enter the name used on the schedule, such as “Sica”.');
  if (input.email?.trim()) {
    const problem = validateEmail(input.email);
    if (problem) throw new AppError(problem);
  }
  if (volunteers.some((v) => v.is_active && v.display_name.toLowerCase() === name.toLowerCase())) {
    throw new AppError(
      'Another active volunteer already uses that name. Add a last initial to tell them apart.',
    );
  }
  if (
    input.email &&
    [...contacts.values()].some((c) => c.email?.toLowerCase() === input.email!.trim().toLowerCase())
  ) {
    throw new AppError('That email address already belongs to another volunteer.');
  }
  const now = new Date().toISOString();
  const id = uid('vol');
  volunteers.push({
    id,
    display_name: name,
    user_id: null,
    is_active: true,
    created_at: now,
    updated_at: now,
  });
  contacts.set(id, {
    full_name: input.fullName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
  });
  record(`Added a volunteer: ${name}`);
  return id;
};

export const updateVolunteer: typeof Real.updateVolunteer = async (volunteerId, input) => {
  await delay();
  const name = input.displayName.trim();
  if (!name) throw new AppError('Enter the name used on the schedule, such as “Sica”.');
  if (input.email?.trim()) {
    const problem = validateEmail(input.email);
    if (problem) throw new AppError(problem);
  }
  const v = volunteers.find((x) => x.id === volunteerId);
  if (!v) throw new AppError('We couldn’t save the name.');
  if (
    v.is_active &&
    volunteers.some(
      (o) =>
        o.id !== volunteerId && o.is_active && o.display_name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new AppError(
      'Another active volunteer already uses that name. Add a last initial to tell them apart.',
    );
  }
  const email = input.email?.trim() || null;
  if (
    email &&
    [...contacts.entries()].some(
      ([id, c]) => id !== volunteerId && c.email?.toLowerCase() === email.toLowerCase(),
    )
  ) {
    throw new AppError('That email address already belongs to another volunteer.');
  }
  v.display_name = name;
  contacts.set(volunteerId, {
    full_name: input.fullName?.trim() || null,
    email,
    phone: input.phone?.trim() || null,
  });
  record(`Changed a volunteer: ${name}`);
};

export const setVolunteerActive: typeof Real.setVolunteerActive = async (volunteerId, isActive) => {
  await delay(80);
  const v = volunteers.find((x) => x.id === volunteerId);
  if (v) {
    v.is_active = isActive;
    record(`Changed a volunteer: ${v.display_name}`);
  }
};

export const setQualifications: typeof Real.setQualifications = async (
  volunteerId,
  positionIds,
) => {
  await delay(80);
  for (const q of [...qualifications])
    if (q.startsWith(`${volunteerId}|`)) qualifications.delete(q);
  for (const p of positionIds) qualifications.add(`${volunteerId}|${p}`);
  record(
    `Changed a qualification: ${volunteers.find((v) => v.id === volunteerId)?.display_name ?? ''}`,
  );
};

export const updateMyContact: typeof Real.updateMyContact = async (volunteerId, changes) => {
  await delay(80);
  const c = contacts.get(volunteerId);
  if (!c) return;
  if (changes.fullName !== undefined) c.full_name = changes.fullName.trim() || null;
  if (changes.phone !== undefined) c.phone = changes.phone.trim() || null;
};
