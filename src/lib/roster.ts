import type { PublishStatus } from '../types/database.ts';

/** The pieces of a venue position and a service that the roster needs. */
export type RosterColumn = { positionId: string; label: string };

export type RosterService = {
  id: string;
  service_date: string;
  status: PublishStatus;
  assignments: {
    id: string;
    position_id: string;
    volunteer_id: string;
    volunteers: { display_name: string } | null;
  }[];
};

export type RosterPerson = { assignmentId: string; volunteerId: string; name: string };
export type RosterCell = { positionId: string; label: string; people: RosterPerson[] };
export type RosterRow = {
  date: string;
  serviceId: string | null;
  status: PublishStatus | null;
  cells: RosterCell[];
};

/**
 * One row per Sunday, one cell per position the venue uses, in the venue's column order.
 * With `sundays`, every Sunday gets a row (serviceId null when there is no schedule yet);
 * without it, only Sundays that have a schedule appear.
 */
export function buildRoster(
  columns: RosterColumn[],
  services: RosterService[],
  sundays?: string[],
): RosterRow[] {
  const byDate = new Map(services.map((s) => [s.service_date, s]));
  const dates = sundays ?? [...byDate.keys()].sort();

  return dates.map((date) => {
    const service = byDate.get(date);
    return {
      date,
      serviceId: service?.id ?? null,
      status: service?.status ?? null,
      cells: columns.map((col) => ({
        positionId: col.positionId,
        label: col.label,
        people: (service?.assignments ?? [])
          .filter((a) => a.position_id === col.positionId)
          .map((a) => ({
            assignmentId: a.id,
            volunteerId: a.volunteer_id,
            name: a.volunteers?.display_name ?? 'Unknown',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      })),
    };
  });
}

/** Does this volunteer serve in this row? */
export function isServing(row: RosterRow, volunteerId: string | null | undefined): boolean {
  return (
    !!volunteerId && row.cells.some((c) => c.people.some((p) => p.volunteerId === volunteerId))
  );
}

/** The labels of the positions a volunteer holds in this row ("Lead Guitarist"). */
export function myPositions(row: RosterRow, volunteerId: string | null | undefined): string[] {
  if (!volunteerId) return [];
  return row.cells
    .filter((c) => c.people.some((p) => p.volunteerId === volunteerId))
    .map((c) => c.label);
}
