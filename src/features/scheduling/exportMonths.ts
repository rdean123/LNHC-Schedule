import { AppError } from '../../lib/supabase/errors';
import { monthRange, monthsBetween } from '../../lib/format';
import { downloadRosterPdf, MAX_PDF_MONTHS } from '../../lib/pdf';
import type { PdfMonth } from '../../lib/pdf';
import { buildRoster } from '../../lib/roster';
import { listVenuePositions } from '../ministries/catalogService';
import { listServices } from './scheduleService';

export type ExportResult = {
  /** Months that went into the PDF. */
  included: string[];
  /** Months asked for that had nothing published, so they were left out. */
  skipped: string[];
};

/**
 * Download one venue's published months (up to three) as one PDF, a month per page.
 * Months with nothing published are left out and reported; if every month is empty, nothing is
 * downloaded and `included` is empty.
 */
export async function exportMonthsPdf(
  venue: { id: string; name: string },
  from: string,
  to: string,
): Promise<ExportResult> {
  const months = monthsBetween(from, to);
  if (months.length === 0) throw new AppError('“To” can’t be before “From”.');
  if (months.length > MAX_PDF_MONTHS) {
    throw new AppError(
      `A PDF holds up to ${MAX_PDF_MONTHS} months at a time. Choose a shorter range, or download in two parts.`,
    );
  }

  const [columns, services] = await Promise.all([
    listVenuePositions(venue.id),
    listServices({
      venueId: venue.id,
      from: monthRange(from).from,
      to: monthRange(to).to,
      status: 'published',
    }),
  ]);

  const result: ExportResult = { included: [], skipped: [] };
  const pdfMonths: PdfMonth[] = [];
  for (const month of months) {
    const inMonth = services.filter((s) => s.service_date.startsWith(month));
    if (inMonth.length === 0) {
      result.skipped.push(month);
      continue;
    }
    pdfMonths.push({ month, rows: buildRoster(columns, inMonth) });
    result.included.push(month);
  }

  if (pdfMonths.length > 0) {
    await downloadRosterPdf({
      venueName: venue.name,
      columns: columns.map((c) => c.label),
      months: pdfMonths,
    });
  }
  return result;
}
