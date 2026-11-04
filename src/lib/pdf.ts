import { monthTitle, parseIso } from './format.ts';
import type { RosterRow } from './roster.ts';

/** Printed under a venue's table, copied from the church's existing LNHC schedule. */
export const VENUE_NOTES: Record<string, string> = {
  LNHC: 'Note: To all members: General cleaning will be conducted after the rehearsal. Thank you!',
};

export type PdfStyle = 'green' | 'blue';

/** The rows of the printed table: the day number, then each position's people joined with "/". */
export function toPdfTable(columns: string[], rows: RosterRow[]) {
  return {
    head: ['Date', ...columns],
    body: rows.map((row) => [
      String(parseIso(row.date).getUTCDate()),
      ...row.cells.map((c) => c.people.map((p) => p.name).join('/')),
    ]),
  };
}

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch('/lnhc-logo.png')).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null; // a missing logo should not stop the schedule downloading
  }
}

/**
 * Download the month's roster as a PDF in the layout the congregation already knows: the
 * church name, a month heading, a gridded table with a green header, green cells for empty
 * positions, and the venue's note. "blue" swaps the green for the app's light blue.
 */
export async function downloadRosterPdf(options: {
  venueName: string;
  month: string;
  columns: string[];
  rows: RosterRow[];
  style?: PdfStyle;
}) {
  const { venueName, month, columns, rows, style = 'green' } = options;
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const head: [number, number, number] = style === 'green' ? [146, 208, 80] : [211, 232, 248];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  const logo = await loadLogo();
  if (logo) doc.addImage(logo, 'PNG', 40, 28, 54, 54);
  doc.setFont('helvetica', 'bold').setFontSize(18);
  doc.text('Lipa New Hope Church Ministries International', logo ? 106 : 40, 52);
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.text('Religious Organization', logo ? 106 : 40, 70);
  doc.setLineWidth(0.5).line(40, 92, pageWidth - 40, 92);
  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text(`${venueName}  ·  ${monthTitle(month).toUpperCase()}`, pageWidth / 2, 114, {
    align: 'center',
  });

  const table = toPdfTable(columns, rows);
  autoTable(doc, {
    startY: 126,
    head: [table.head],
    body: table.body,
    theme: 'grid',
    margin: { left: 40, right: 40 },
    styles: {
      font: 'helvetica',
      fontSize: 10,
      halign: 'center',
      valign: 'middle',
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: 0,
      cellPadding: 6,
    },
    headStyles: { fillColor: head, textColor: 0, fontStyle: 'bold' },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0 && data.cell.raw === '')
        data.cell.styles.fillColor = head;
    },
  });

  const note = VENUE_NOTES[venueName];
  if (note) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFont('helvetica', 'bolditalic').setFontSize(11);
    doc.text(note, pageWidth / 2, finalY + 24, { align: 'center' });
  }

  const slug = venueName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  doc.save(`LNHC-${slug}-${month}.pdf`);
}
