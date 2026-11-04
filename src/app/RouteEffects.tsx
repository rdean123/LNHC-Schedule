import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * On moving to another screen: start at the top, and move keyboard and screen-reader focus to
 * the new content so people don't land mid-page or stay on the link they pressed.
 * Changing only the venue or month on a screen (the query string) does neither.
 */
export function RouteEffects() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}
