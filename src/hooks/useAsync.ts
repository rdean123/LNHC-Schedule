import { useEffect, useState } from 'react';

type Settled<T> = { load: () => Promise<T>; nonce: number; data?: T; error?: Error };

export type AsyncState<T> = {
  /** The latest result. Kept while reloading so the screen doesn't flash empty. */
  data: T | null;
  /** True until the request for the current inputs has finished. */
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

/**
 * Load data when `load` changes. Wrap `load` in useCallback so it only changes when its inputs do.
 * Errors from our services already carry plain-language messages.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setSettled({ load, nonce, data });
      },
      (err: unknown) => {
        if (active)
          setSettled({ load, nonce, error: err instanceof Error ? err : new Error(String(err)) });
      },
    );
    return () => {
      active = false;
    };
  }, [load, nonce]);

  const current = settled && settled.load === load && settled.nonce === nonce ? settled : null;
  return {
    data: current?.data ?? settled?.data ?? null,
    loading: !current,
    error: current?.error ?? null,
    reload: () => setNonce((n) => n + 1),
  };
}
