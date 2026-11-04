import type { PostgrestError } from '@supabase/supabase-js';

/** An error whose message is safe and clear enough to show to the person using the app. */
export class AppError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

type ErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

// Constraint names come from the migrations. Each message says what happened and what to do.
const constraintMessages: Record<string, string> = {
  volunteers_active_display_name_key:
    'Another active volunteer already uses that name. Add a last initial to tell them apart.',
  volunteer_contacts_email_key: 'That email address already belongs to another volunteer.',
  one_assignment_per_person_per_sunday:
    'That person is already serving on that Sunday. Each person can have one assignment per Sunday, across all venues.',
  services_venue_id_service_date_key: 'That venue already has a schedule for that Sunday.',
  availability_is_sunday: 'Choose a Sunday.',
  services_is_sunday: 'Choose a Sunday.',
};

/** Turn a Supabase or network error into an AppError with plain-language wording. */
export function toAppError(error: ErrorLike, fallback: string): AppError {
  if (!error) return new AppError(fallback);
  const message = error.message ?? '';
  const code = error.code;

  for (const [constraint, text] of Object.entries(constraintMessages)) {
    if (message.includes(constraint)) return new AppError(text, code);
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new AppError(
      'Can’t reach the server. Check your internet connection and try again.',
      code,
    );
  }
  if (/jwt expired|invalid jwt/i.test(message) || code === 'PGRST301') {
    return new AppError('Your session has expired. Sign in again.', code);
  }
  if (/invalid login credentials/i.test(message)) {
    return new AppError('That email and password don’t match. Check them and try again.', code);
  }

  switch (code) {
    case '42501':
      return new AppError('You don’t have permission to do that.', code);
    case '23503':
      return new AppError(
        'That is still in use, for example by a volunteer who has been scheduled. Deactivate it instead of deleting it.',
        code,
      );
    case '23505':
      return new AppError('That already exists.', code);
    case '23514':
      return new AppError('One of the values isn’t allowed. Check what you entered.', code);
    case 'P0001':
      // Raised on purpose by our own database rules, already written for people.
      return new AppError(message || fallback, code);
    default:
      return new AppError(fallback, code);
  }
}

/** Return the data from a Supabase response or throw a friendly AppError. */
export function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  fallback: string,
): NonNullable<T> {
  if (result.error) throw toAppError(result.error, fallback);
  if (result.data === null || result.data === undefined) throw new AppError(fallback);
  return result.data;
}
