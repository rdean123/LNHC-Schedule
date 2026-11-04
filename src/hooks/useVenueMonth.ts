import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { currentMonth, isValidMonth } from '../lib/format';

/**
 * The venue and month being viewed, kept in the address (?venue=…&month=2026-11) so a link
 * or a refresh lands in the same place. Falls back to the first venue and the current month.
 */
export function useVenueMonth(venues: { id: string }[] | null) {
  const [params, setParams] = useSearchParams();
  const [defaultMonth] = useState(() => currentMonth());

  const monthParam = params.get('month');
  const month = isValidMonth(monthParam) ? monthParam : defaultMonth;
  const venueParam = params.get('venue');
  const venueId = venues
    ? (venues.find((v) => v.id === venueParam)?.id ?? venues[0]?.id ?? null)
    : null;

  const update = (changes: { venue?: string; month?: string }) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (changes.venue) next.set('venue', changes.venue);
        if (changes.month) next.set('month', changes.month);
        return next;
      },
      { replace: true },
    );

  return {
    venueId,
    month,
    setVenueId: (venue: string) => update({ venue }),
    setMonth: (m: string) => update({ month: m }),
  };
}
