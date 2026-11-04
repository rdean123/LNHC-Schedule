import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/toastContext';
import { downloadRosterPdf } from '../../lib/pdf';
import type { RosterRow } from '../../lib/roster';

/** Download the month as a PDF in the church's familiar layout, or print it. */
export function ExportButtons({
  venueName,
  month,
  columns,
  rows,
  disabled,
}: {
  venueName: string;
  month: string;
  columns: string[];
  rows: RosterRow[];
  disabled?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadRosterPdf({ venueName, month, columns, rows });
    } catch {
      toast.error('We couldn’t create the PDF. Try Print and choose “Save as PDF” instead.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => void download()} busy={busy} disabled={disabled}>
        <Download className="size-5" aria-hidden="true" />
        Download PDF
      </Button>
      <Button onClick={() => window.print()} disabled={disabled}>
        <Printer className="size-5" aria-hidden="true" />
        Print
      </Button>
    </>
  );
}
