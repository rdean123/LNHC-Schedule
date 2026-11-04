import { buildRoster } from '../../lib/roster';
import { downloadRosterPdf } from '../../lib/pdf';
import { monthRange } from '../../lib/format';
import { listVenuePositions } from '../ministries/catalogService';
import { listServices } from './scheduleService';

/** Download one venue's published month as a PDF when the roster isn't already on screen. */
export async function exportMonthPdf(
  venue: { id: string; name: string },
  month: string,
): Promise<void> {
  const { from, to } = monthRange(month);
  const [columns, services] = await Promise.all([
    listVenuePositions(venue.id),
    listServices({ venueId: venue.id, from, to, status: 'published' }),
  ]);
  await downloadRosterPdf({
    venueName: venue.name,
    month,
    columns: columns.map((c) => c.label),
    rows: buildRoster(columns, services),
  });
}
