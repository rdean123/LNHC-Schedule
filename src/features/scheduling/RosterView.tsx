import type { ReactNode } from 'react';
import { Chip } from '../../components/ui/Chip';
import { PersonPill } from '../../components/ui/Parts';
import { formatLongDate, formatShortDate } from '../../lib/format';
import type { RosterCell, RosterColumn, RosterRow } from '../../lib/roster';

type Props = {
  caption: string;
  columns: RosterColumn[];
  rows: RosterRow[];
  /** What goes in one position's cell. */
  renderCell: (row: RosterRow, cell: RosterCell) => ReactNode;
  /** Highlight a row (for example the Sundays the signed-in volunteer serves). */
  highlightRow?: (row: RosterRow) => boolean;
  /** A small line under the date. */
  dateNote?: (row: RosterRow) => ReactNode;
  /** Shown on the right of each phone card's header. */
  cardBadge?: (row: RosterRow) => ReactNode;
  /** On phones, leave out positions that are empty (volunteer view). */
  hideEmptyOnPhone?: boolean;
  /** Extra controls under the date (for example "History"). */
  rowTools?: (row: RosterRow) => ReactNode;
};

/**
 * One roster, two renderings of the same data: a table with a sticky date column on wide
 * screens, and one card per Sunday on phones.
 */
export function RosterView({
  caption,
  columns,
  rows,
  renderCell,
  highlightRow,
  dateNote,
  cardBadge,
  hideEmptyOnPhone,
  rowTools,
}: Props) {
  return (
    <>
      <div
        className="hidden overflow-x-auto md:block print:block"
        role="region"
        aria-label={caption}
        tabIndex={0}
      >
        <table className="w-full border-separate border-spacing-0 text-[0.9375rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 whitespace-nowrap border-b border-line bg-wash p-3 text-left text-sm font-bold text-deep"
              >
                Sunday
              </th>
              {columns.map((c) => (
                <th
                  key={c.positionId}
                  scope="col"
                  className="sticky top-0 z-10 whitespace-nowrap border-b border-line bg-wash p-3 text-left text-sm font-bold text-deep"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const hl = highlightRow?.(row) ?? false;
              const bg = hl ? 'bg-mist' : 'bg-surface';
              return (
                <tr key={row.date}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-line p-3 text-left align-top font-bold text-deep ${bg}`}
                  >
                    {formatShortDate(row.date)}
                    {dateNote && (
                      <span className="block text-sm font-normal text-muted">{dateNote(row)}</span>
                    )}
                    {rowTools?.(row)}
                  </th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.positionId}
                      className={`min-w-28 border-b border-line p-3 align-top ${bg}`}
                    >
                      {renderCell(row, cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 md:hidden print:hidden">
        {rows.map((row) => {
          const hl = highlightRow?.(row) ?? false;
          const cells = hideEmptyOnPhone ? row.cells.filter((c) => c.people.length > 0) : row.cells;
          return (
            <article
              key={row.date}
              className="overflow-hidden rounded-panel border border-line bg-surface"
            >
              <header
                className={`flex items-center justify-between gap-2 px-4 py-3 font-display text-lg font-semibold text-deep ${
                  hl ? 'bg-mist' : 'bg-wash'
                }`}
              >
                <h3 className="text-lg">{formatLongDate(row.date)}</h3>
                {cardBadge?.(row)}
              </header>
              <dl className="m-0 px-4 py-1">
                {cells.map((cell) => (
                  <div
                    key={cell.positionId}
                    className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-line py-2 last:border-b-0"
                  >
                    <dt className="pt-1 text-sm text-muted">{cell.label}</dt>
                    <dd className="m-0 font-semibold">{renderCell(row, cell)}</dd>
                  </div>
                ))}
                {cells.length === 0 && <p className="py-3 text-muted">No one is assigned yet.</p>}
              </dl>
              {rowTools && <div className="border-t border-line px-4 py-2">{rowTools(row)}</div>}
            </article>
          );
        })}
      </div>
    </>
  );
}

/** A read-only cell: people stacked, with "You" marked, or a dash. */
export function ViewCell({ cell, myId }: { cell: RosterCell; myId: string | null | undefined }) {
  if (cell.people.length === 0) {
    return (
      <span className="text-muted" aria-label="No one assigned">
        —
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1">
      {cell.people.map((p) =>
        p.volunteerId === myId ? (
          <span key={p.assignmentId} className="flex items-center gap-2">
            {p.name}
            <Chip tone="you" icon={false}>
              You
            </Chip>
          </span>
        ) : (
          <span key={p.assignmentId}>{p.name}</span>
        ),
      )}
    </span>
  );
}

/** Used by the editor: a person with a remove button. */
export function EditablePerson({
  name,
  position,
  onRemove,
}: {
  name: string;
  position: string;
  onRemove: () => void;
}) {
  return (
    <PersonPill name={name} onRemove={onRemove} removeLabel={`Remove ${name} from ${position}`} />
  );
}
