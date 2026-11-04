import { getSupabase } from '../../lib/supabase/client';
import { unwrap } from '../../lib/supabase/errors';
import type { PositionRow, VenueRow } from '../../types/database';

export type VenuePosition = {
  positionId: string;
  /** The venue's own label when it has one (for example "Musicians"), otherwise the position name. */
  label: string;
  sortOrder: number;
};

export async function listVenues(): Promise<VenueRow[]> {
  return unwrap(
    await getSupabase().from('venues').select('*').eq('is_active', true).order('sort_order'),
    'We couldn’t load the venues.',
  );
}

export async function listPositions(): Promise<PositionRow[]> {
  return unwrap(
    await getSupabase().from('positions').select('*').eq('is_active', true).order('sort_order'),
    'We couldn’t load the positions.',
  );
}

/** The positions a venue uses, in the order of its printed schedule. */
export async function listVenuePositions(venueId: string): Promise<VenuePosition[]> {
  const rows = unwrap(
    await getSupabase()
      .from('venue_positions')
      .select('position_id, label, sort_order, positions ( name )')
      .eq('venue_id', venueId)
      .order('sort_order'),
    'We couldn’t load this venue’s positions.',
  );
  return rows.map((row) => ({
    positionId: row.position_id,
    label: row.label ?? row.positions?.name ?? 'Position',
    sortOrder: row.sort_order,
  }));
}
