/**
 * @file   apps/admin/src/integration/useListed.ts
 * @module admin/integration
 * @brief  The list a panel of the Integration area shows, with its confirm dialog and writes.
 *
 * Responsibility: load the list from its route on mount and after every confirmed action;
 *                 give the page's one confirm dialog (../ConfirmDialog `useConfirm`); `put`
 *                 sends a change that needs no confirmation (Enable) and loads the list
 *                 again, or keeps the refusal in plain words as `problem`.
 * Depends on:     react, ../ConfirmDialog, ../http
 * Used by:        ./ProvidersPanel, ./OriginsPanel, ./WebhooksPanel
 * Spec:           Bingo 11 §1
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { useConfirm, type ConfirmRequest } from '../ConfirmDialog.js';
import { api, failureText } from '../http.js';

interface Listed<T> {
  readonly data: T | null;
  readonly load: () => Promise<void>;
  readonly dialog: ReactElement | null;
  readonly open: (r: ConfirmRequest) => void;
  readonly problem: string | null;
  readonly put: (path: string, body: unknown, what: string) => void;
}

export function useListed<T>(path: string): Listed<T> {
  const [data, setData] = useState<T | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = useCallback(async () => {
    setData(await api<T>(path));
  }, [path]);
  const [dialog, open] = useConfirm(() => void load());
  useEffect(() => {
    void load();
  }, [load]);
  const put = (to: string, body: unknown, what: string): void => {
    setProblem(null);
    api(to, { method: 'PUT', body })
      .then(load)
      .catch((e: unknown) => {
        setProblem(failureText(e, what));
      });
  };
  return { data, load, dialog, open, problem, put };
}
