/**
 * @file   apps/web/src/round/InfoParts.tsx
 * @module web/round
 * @brief  The round's info parts: the game's panel, the desktop's special line, the phone's line.
 *
 * Responsibility: the game's panel (`GamePart`: a roster player's range, digits, wires or
 *                 legend with the hint and what has fallen, or the spectator's); on a desktop
 *                 the special line at the top of the info column, the special's name and its
 *                 one plain sentence cut to one line, the whole sentence on a click (T141); on
 *                 a phone the info line under the bar, one line of at most 48 px from the game
 *                 (`game.Line`), a button that opens the game's panel as a sheet over the rows
 *                 between the bar and the action dock, which it never covers (O48), the special's
 *                 sentence at its top (the desktop's special line).
 * Depends on:     react, @smg/contracts, @smg-game/registry/web (types), ../live/socket,
 *                 ../season/season, ./FocusPanel, ./RoundSide (colours), ./usePanels
 * Used by:        ./RoundBody
 * Spec:           docs/spec/02-game-guess-the-number.md §12; docs/spec/03-seasonal-specials.md §6
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import { serverNow } from '../live/socket.js';
import { SPECIALS } from '../season/season.js';
import { FocusPanel } from './FocusPanel.js';
import { colorsOf } from './RoundSide.js';
import type { Panels } from './usePanels.js';

// The game's panel: a roster player's (it only shows; guesses go through the dock), or the
// spectator's.
export function GamePart(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
}): ReactElement {
  const { state, game } = p;
  if (game === null || state.game === null) {
    return <p className="smg-muted">The round starts soon.</p>;
  }
  const shared = {
    view: state.game,
    names: state.names,
    colors: colorsOf(state),
    season: state.season,
    specialOn: state.specialOn,
  };
  if (state.role !== 'player') return <game.Spectator {...shared} />;
  return (
    <game.Player
      {...shared}
      act={() => Promise.resolve({ ok: false })}
      canAct={false}
      frostDelayMs={state.frostDelayMs}
      now={serverNow}
      waitS={null}
    />
  );
}

// The desktop's special line: one line, the whole sentence on a click; none without a special.
export function SpecialLine(p: {
  readonly state: RoundStateView;
  readonly rule: string;
}): ReactElement | null {
  const [open, setOpen] = useState(false);
  if (!p.state.specialOn) return null;
  return (
    <button
      type="button"
      className="round-special-line"
      aria-expanded={open}
      data-testid="special-line"
      onClick={() => {
        setOpen((was) => !was);
      }}
    >
      <strong>{SPECIALS[p.state.season].name}:</strong> {p.rule}
    </button>
  );
}

// The phone's info line and the game's panel behind it as a sheet.
export function PhoneLine(p: {
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly panels: Panels;
  readonly rule: string;
}): ReactElement {
  const { state, game, panels } = p;
  const line =
    game === null || state.game === null ? null : (
      <game.Line
        view={state.game}
        names={state.names}
        colors={colorsOf(state)}
        season={state.season}
        specialOn={state.specialOn}
      />
    );
  return (
    <>
      <button
        ref={panels.button('game')}
        type="button"
        className="smg-panel round-line"
        aria-expanded={panels.open === 'game'}
        data-testid="info-line"
        onClick={() => {
          panels.toggle('game');
        }}
      >
        <span className="round-line-body">{line}</span>
        <span className="round-line-more">
          <span aria-hidden="true">›</span>
          <span className="smg-visually-hidden">Details</span>
        </span>
      </button>
      <FocusPanel
        title="This round"
        open={panels.open === 'game'}
        onClose={panels.close}
        testId="game-sheet"
      >
        {state.specialOn ? (
          <p className="round-sheet-special">
            <strong>{SPECIALS[state.season].name}:</strong> {p.rule}
          </p>
        ) : null}
        <GamePart state={state} game={game} />
      </FocusPanel>
    </>
  );
}
