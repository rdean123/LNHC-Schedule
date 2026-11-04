import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabase } from '../../lib/supabase/client';
import { AppError, toAppError } from '../../lib/supabase/errors';

/**
 * Ask the server to email an invitation to a volunteer. This runs in a Supabase Edge Function
 * because sending an invite needs a secret key that must never be in the browser.
 */
export async function inviteVolunteer(volunteerId: string): Promise<void> {
  const { error } = await getSupabase().functions.invoke('invite-volunteer', {
    body: { volunteer_id: volunteerId, redirect_to: `${window.location.origin}/accept-invite` },
  });
  if (!error) return;

  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    const message = (body as { error?: unknown } | null)?.error;
    if (typeof message === 'string') throw new AppError(message);
  }
  throw toAppError(error, 'We couldn’t send the invitation. Try again.');
}
