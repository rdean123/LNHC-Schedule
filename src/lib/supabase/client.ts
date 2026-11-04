import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

export type AppSupabaseClient = SupabaseClient<Database>;

let client: AppSupabaseClient | undefined;

/**
 * The one Supabase client for the browser. Created on first use so the legacy screens, which
 * don't use Supabase yet, keep working without these variables.
 *
 * Only the project URL and the publishable key belong here. Data is protected by row level
 * security in the database, not by hiding this key.
 */
export function getSupabase(): AppSupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env (see .env.example).',
    );
  }
  if (key.startsWith('sb_secret_') || isServiceRoleJwt(key)) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the publishable (anon) key; a secret key must never be sent to the browser.',
    );
  }

  client = createClient<Database>(url, key);
  return client;
}

function isServiceRoleJwt(key: string): boolean {
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: string }).role === 'service_role';
  } catch {
    return false;
  }
}
