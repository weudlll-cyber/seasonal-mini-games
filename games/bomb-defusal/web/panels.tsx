/**
 * @file   games/bomb-defusal/web/panels.tsx
 * @module games/bomb-defusal/web
 * @brief  The bomb block of the game's panel, for players and spectators; the phone's line.
 *
 * Responsibility: "6 wires, cut 4 in the right order", the explosion penalty ("Wrong first
 *                 cut: +5 s"), the free hint highlighted for the whole round, and in a Leaf Fall
 *                 round the harmless wires as struck chips with their names (02c §11). A
 *                 spectator also sees the bomb's wires, since no input row shows them (02c §10),
 *                 and only the shared hint. Nothing about a secret; the platform draws the
 *                 round's list beside it. The phone's info line names the same facts in one
 *                 line (`InfoLine`, T141).
 * Depends on:     react, @smg/game-sdk (props), @smg-game/bomb-defusal (types), ./text,
 *                 ./WireChip
 * Used by:        ./index
 * Spec:           docs/spec/02c-game-bomb-defusal.md §10, §11
 */
import type { PlayerView, SpectatorView } from '@smg-game/bomb-defusal';
import type { PlayerPanelProps, SpectatorPanelProps } from '@smg/game-sdk';
import type { ReactElement } from 'react';

import { hintText, shortHint } from './text.js';
import { WireChip } from './WireChip.js';

type Bomb = Pick<SpectatorView, 'wires' | 'cuts' | 'penaltyS' | 'harmless' | 'hint'>;

const penaltyText = (s: number): string =>
  s === 0 ? 'Wrong first cut: boom, no extra wait' : `Wrong first cut: +${String(s)} s`;

function BombBlock(p: { readonly bomb: Bomb; readonly showWires: boolean }): ReactElement {
  const { bomb } = p;
  return (
    <div className="bd-bomb" data-testid="bomb-block">
      <p className="bd-bomb-title">
        {bomb.wires.length} wires, cut {bomb.cuts} in the right order
      </p>
      <p className="bd-bomb-note" data-testid="penalty">
        {penaltyText(bomb.penaltyS)}
      </p>
      {p.showWires ? (
        <ul className="bd-chips" aria-label="Wires">
          {bomb.wires.map((w) => (
            <li key={w}>
              <WireChip wire={w} harmless={bomb.harmless.includes(w)} />
            </li>
          ))}
        </ul>
      ) : null}
      {bomb.hint === null ? null : (
        <p className="bd-hint" data-testid="hint">
          {hintText(bomb.hint)}
        </p>
      )}
      {p.showWires || bomb.harmless.length === 0 ? null : (
        <ul className="bd-chips" aria-label="Harmless wires" data-testid="harmless">
          {bomb.harmless.map((w) => (
            <li key={w}>
              <WireChip wire={w} harmless />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlayerPanel(props: PlayerPanelProps): ReactElement {
  return <BombBlock bomb={props.view as PlayerView} showWires={false} />;
}

export function SpectatorPanel(props: SpectatorPanelProps): ReactElement {
  return <BombBlock bomb={props.view as SpectatorView} showWires />;
}

// The phone's info line (T141): "6 wires · cut 4 · wrong first cut +5 s", the harmless
// wires marked so far, the hint.
// The phone's line: short parts, each whole (T150); the penalty and the wires are in the sheet.
export function InfoLine(props: SpectatorPanelProps): ReactElement {
  const bomb = props.view as Bomb;
  return (
    <span className="bd-line" data-testid="bd-line">
      <strong>
        {bomb.wires.length} wires · cut {bomb.cuts}
      </strong>
      {bomb.harmless.length === 0 ? null : (
        <span className="smg-chip bd-line-chip">Harmless {bomb.harmless.length}</span>
      )}
      {bomb.hint === null ? null : (
        <span className="smg-chip smg-hint">{shortHint(bomb.hint)}</span>
      )}
    </span>
  );
}
