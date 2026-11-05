import { Download } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { inputClasses } from '../../components/ui/Field';
import { Notice } from '../../components/ui/Notice';
import { useToast } from '../../components/ui/toastContext';
import { monthOptions, monthsBetween, monthTitle } from '../../lib/format';
import { MAX_PDF_MONTHS } from '../../lib/pdf';
import { exportMonthsPdf } from './exportMonths';

type Props = {
  open: boolean;
  onClose: () => void;
  venue: { id: string; name: string };
  /** The month to start with (the one on screen). */
  defaultMonth: string;
};

/** Choose which months to put in the PDF: up to three, in one table. */
export function DownloadPdfDialog({ open, onClose, venue, defaultMonth }: Props) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Download PDF"
      description={`Choose the months to put in the PDF for ${venue.name}. A PDF holds up to ${MAX_PDF_MONTHS} months, together in one table.`}
    >
      <PdfForm venue={venue} defaultMonth={defaultMonth} onClose={onClose} />
    </Dialog>
  );
}

function PdfForm({ venue, defaultMonth, onClose }: Omit<Props, 'open'>) {
  const toast = useToast();
  const fromId = useId();
  const toId = useId();
  const [from, setFrom] = useState(defaultMonth);
  const [to, setTo] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const options = monthOptions(defaultMonth);
  const months = monthsBetween(from, to);
  const tooMany = months.length > MAX_PDF_MONTHS;
  const rangeError = tooMany
    ? `That is ${months.length} months. A PDF holds up to ${MAX_PDF_MONTHS}, so choose a shorter range or download in two parts.`
    : null;

  // Keep the range sensible: "To" never sits before "From".
  const changeFrom = (value: string) => {
    setFrom(value);
    if (to < value) setTo(value);
    setProblem(null);
  };
  const changeTo = (value: string) => {
    setTo(value);
    if (value < from) setFrom(value);
    setProblem(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (tooMany) return;
    setBusy(true);
    setProblem(null);
    try {
      const { included, skipped } = await exportMonthsPdf(venue, from, to);
      if (included.length === 0) {
        setProblem(
          `Nothing is published for ${months.map(monthTitle).join(' or ')} yet, so there is nothing to download.`,
        );
        return;
      }
      toast.success(
        skipped.length > 0
          ? `PDF downloaded for ${included.map(monthTitle).join(' and ')}. ${skipped.map(monthTitle).join(' and ')} ${skipped.length === 1 ? 'was' : 'were'} left out because nothing is published for ${skipped.length === 1 ? 'it' : 'them'}.`
          : `PDF downloaded for ${included.map(monthTitle).join(' and ')}.`,
      );
      onClose();
    } catch (err) {
      setProblem(
        err instanceof Error
          ? err.message
          : 'We couldn’t create the PDF. Try Print and choose “Save as PDF” instead.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1">
          <label htmlFor={fromId} className="font-semibold text-deep">
            From
          </label>
          <select
            id={fromId}
            className={inputClasses}
            value={from}
            onChange={(e) => changeFrom(e.target.value)}
          >
            {options.map((m) => (
              <option key={m} value={m}>
                {monthTitle(m)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor={toId} className="font-semibold text-deep">
            To
          </label>
          <select
            id={toId}
            className={inputClasses}
            value={to}
            onChange={(e) => changeTo(e.target.value)}
          >
            {options.map((m) => (
              <option key={m} value={m}>
                {monthTitle(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-3 text-muted" aria-live="polite">
        {tooMany
          ? ' '
          : months.length === 1
            ? `1 month: ${monthTitle(months[0])}`
            : `${months.length} months: ${monthTitle(months[0])} to ${monthTitle(months[months.length - 1])}`}
      </p>

      {(rangeError || problem) && (
        <div className="mt-3">
          <Notice tone={rangeError ? 'error' : 'warn'} title={rangeError ?? problem ?? ''} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" busy={busy} disabled={tooMany}>
          <Download className="size-5" aria-hidden="true" />
          Download PDF
        </Button>
      </div>
    </form>
  );
}
