import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { DownloadPdfDialog } from './DownloadPdfDialog';

/** Download PDF opens a month picker (up to three months); Print uses the browser's dialog. */
export function ExportButtons({
  venue,
  month,
  disabled,
}: {
  venue: { id: string; name: string };
  month: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled}>
        <Download className="size-5" aria-hidden="true" />
        Download PDF
      </Button>
      <Button onClick={() => window.print()} disabled={disabled}>
        <Printer className="size-5" aria-hidden="true" />
        Print
      </Button>
      <DownloadPdfDialog
        open={open}
        onClose={() => setOpen(false)}
        venue={venue}
        defaultMonth={month}
      />
    </>
  );
}
