/**
 * @file   apps/web/src/match/WebsiteSwitch.tsx
 * @module web/match
 * @brief  The host's "Show on the website" while the match is open (owner decision O125).
 *
 * Responsibility: in the host's controls, the match's switch for the website's list of open
 *                 sign-ups: sent with `PUT …/website`, the details reloaded after; a refusal in
 *                 plain words. Nothing for a Quick Test (never listed) or an ended match.
 * Depends on:     react, @smg/contracts (types), ../components/fields, ../shell/http, ./formHelp
 * Used by:        ./HostMenu
 * Spec:           docs/spec/07-integration.md §8
 */
import type { MatchDetailsView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { Problem, SwitchField } from '../components/fields.js';
import { api } from '../shell/http.js';
import { FORM_HELP } from './formHelp.js';

export function WebsiteSwitch(p: {
  readonly match: MatchDetailsView;
  readonly reload: () => void;
}): ReactElement | null {
  const [problem, setProblem] = useState<string | null>(null);
  const { match } = p;
  if (match.quickTest || match.status === 'closed' || match.status === 'aborted') return null;
  const change = (show: boolean): void => {
    api(`/matches/${match.code}/website`, { method: 'PUT', body: { show } })
      .then(() => {
        setProblem(null);
      })
      .catch(() => {
        setProblem('The website setting could not be changed.');
      })
      .finally(p.reload);
  };
  return (
    <>
      <SwitchField
        label="Show on the website"
        help={FORM_HELP.showOnWebsite}
        checked={match.showOnWebsite}
        testId="website-switch"
        onChange={change}
      />
      <Problem text={problem} />
    </>
  );
}
