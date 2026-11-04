// PREVIEW MODE ONLY. Stands in for features/ministries/catalogService.ts.
import type * as Real from '../features/ministries/catalogService';
import { delay, positions, venuePositionsData, venues } from './db';

export const listVenues: typeof Real.listVenues = async () => {
  await delay();
  return venues.filter((v) => v.is_active).map((v) => ({ ...v }));
};

export const listPositions: typeof Real.listPositions = async () => {
  await delay();
  return positions.filter((p) => p.is_active).map((p) => ({ ...p }));
};

export const listVenuePositions: typeof Real.listVenuePositions = async (venueId) => {
  await delay();
  return venuePositionsData
    .filter((vp) => vp.venue_id === venueId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((vp) => ({
      positionId: vp.position_id,
      label: vp.label ?? positions.find((p) => p.id === vp.position_id)?.name ?? 'Position',
      sortOrder: vp.sort_order,
    }));
};
