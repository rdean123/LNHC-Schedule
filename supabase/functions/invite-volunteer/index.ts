// Edge Function: invite-volunteer
//
// An administrator invites a volunteer by email. This has to run server-side because sending an
// invite needs the service-role key, which must never reach the browser.
//
// Request:  POST { "volunteer_id": "<uuid>", "redirect_to": "https://.../accept-invite" }
// Response: 200 { "ok": true } or { "error": "<plain-language message>" }
//
// Safety: the caller must be signed in AND be an administrator or schedule maker (checked with the
// caller's own token through the is_staff() database function). The volunteer's email comes from the
// database, never from the request, so a request can't invite an arbitrary address.
//
// NOT YET DEPLOYED OR TESTED against a live project. SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173').split(',');

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin !== null && allowedOrigins.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function reply(status: number, body: Record<string, unknown>, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' }, origin);

  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply(401, { error: 'Sign in first.' }, origin);

  let body: { volunteer_id?: unknown; redirect_to?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'The request was not valid JSON.' }, origin);
  }
  const volunteerId = typeof body.volunteer_id === 'string' ? body.volunteer_id : '';
  const redirectTo = typeof body.redirect_to === 'string' ? body.redirect_to : undefined;
  if (!/^[0-9a-f-]{36}$/i.test(volunteerId)) {
    return reply(400, { error: 'Choose a volunteer to invite.' }, origin);
  }
  if (redirectTo !== undefined) {
    let host: string;
    try {
      host = new URL(redirectTo).origin;
    } catch {
      return reply(400, { error: 'The redirect address is not valid.' }, origin);
    }
    if (!allowedOrigins.includes(host)) {
      return reply(400, { error: 'That redirect address is not allowed.' }, origin);
    }
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await asCaller.auth.getUser();
  if (userError || !userData.user)
    return reply(401, { error: 'Your session has expired. Sign in again.' }, origin);

  const { data: isStaff, error: roleError } = await asCaller.rpc('is_staff');
  if (roleError)
    return reply(500, { error: 'Could not check your permissions. Try again.' }, origin);
  if (isStaff !== true)
    return reply(
      403,
      { error: 'Only administrators and schedule makers can invite volunteers.' },
      origin,
    );

  // Read through the caller's token so row level security still applies.
  const { data: volunteer, error: volunteerError } = await asCaller
    .from('volunteers')
    .select('id, display_name, user_id, volunteer_contacts ( email )')
    .eq('id', volunteerId)
    .maybeSingle();
  if (volunteerError)
    return reply(500, { error: 'Could not load that volunteer. Try again.' }, origin);
  if (!volunteer) return reply(404, { error: 'That volunteer no longer exists.' }, origin);
  if (volunteer.user_id)
    return reply(409, { error: `${volunteer.display_name} already has an account.` }, origin);

  const contact = Array.isArray(volunteer.volunteer_contacts)
    ? volunteer.volunteer_contacts[0]
    : volunteer.volunteer_contacts;
  const email = contact?.email;
  if (!email) {
    return reply(
      422,
      { error: `Add an email address for ${volunteer.display_name} before inviting them.` },
      origin,
    );
  }

  const asServer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: invited, error: inviteError } = await asServer.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (inviteError || !invited.user) {
    console.error('invite failed', inviteError?.message);
    return reply(
      502,
      { error: 'The invitation could not be sent. Check the email address and try again.' },
      origin,
    );
  }

  // The on_auth_user_created trigger already links by email; this makes the link explicit.
  const { error: linkError } = await asServer
    .from('volunteers')
    .update({ user_id: invited.user.id })
    .eq('id', volunteerId)
    .is('user_id', null);
  if (linkError) {
    console.error('link failed', linkError.message);
    return reply(
      500,
      {
        error:
          'The invitation was sent but the account could not be linked. Tell an administrator.',
      },
      origin,
    );
  }

  return reply(200, { ok: true }, origin);
});
