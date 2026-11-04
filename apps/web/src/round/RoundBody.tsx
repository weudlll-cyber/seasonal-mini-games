/**
 * @file   apps/web/src/round/RoundBody.tsx
 * @module web/round
 * @brief  An open round's parts in the two layouts: stage, info column or info line, the dock.
 *
 * Responsibility: one arrangement for every game (T141), only what matters for the next guess
 *                 in this round (O54). A desktop: the stage on the left, for a list game the
 *                 round's guesses (./RoundLog `main`) with the action dock at its bottom, for a
 *                 board game (Seasonal Target) its board (the input's `stage` box, O51); the
 *                 info column on the right, top to bottom the special line, the game's compact
 *                 panel, then for a list game "Your guesses" (in shared mode; in individual mode
 *                 the stage already holds only the viewer's guesses, T141), for a board game
 *                 the round's guesses and the dock. A phone: the info line under the bar (its
 *                 sheet holds the game's panel), a board game's board, the round's guesses
 *                 filling the height that is left, and the dock at the bottom (./InputRow: the
 *                 game's input with the cooldown ring, or the solved notice). "All (N)" opens
 *                 the whole list with the events as a panel on demand (O48): a third column on
 *                 a desktop, a sheet on a phone that ends above the dock.
 * Depends on:     react, @smg/contracts, @smg-game/registry/web, ../live/useRound, ./FocusPanel,
 *                 ./InfoParts, ./InputRow, ./RoundLog, ./SpecialBanner, ./usePanels
 * Used by:        ./RoundScreen
 * Spec:           docs/spec/02-game-guess-the-number.md §7, §11, §12; docs/spec/03-seasonal-specials.md §6
 */
import type { GameWeb } from '@smg-game/registry/web';
import type { RoundStateView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import type { RoundLive } from '../live/useRound.js';
import { FocusPanel } from './FocusPanel.js';
import { GamePart, PhoneLine, SpecialLine } from './InfoParts.js';
import { InputRow } from './InputRow.js';
import { RoundLog } from './RoundLog.js';
import { bannerOf, eventBanner } from './SpecialBanner.js';
import type { Panels } from './usePanels.js';

export interface BodyProps {
  readonly live: RoundLive;
  readonly state: RoundStateView;
  readonly game: GameWeb | null;
  readonly viewerKey: string | null;
  readonly now: number;
  readonly panels: Panels;
  readonly phone: boolean;
  // The special's sentence, in the game's words where it has its own (T119).
  readonly rule: string;
}

// Where the game's parts go: a roster player's game (or null for a spectator), whether it is
// a board game, and what the info column's panel shows (null: a board game's spectator,
// who watches on the stage).
function partsOf(state: RoundStateView, game: GameWeb | null) {
  const playing = state.role === 'player' && game !== null ? game : null;
  const board = game?.layout === 'board';
  const watching = playing === null ? <GamePart state={state} game={game} /> : null;
  const panel =
    playing !== null ? <GamePart state={state} game={playing} /> : board ? null : watching;
  return { playing, board, watching, panel };
}

// Every part of the body once; the layouts below only place them.
function useParts(p: BodyProps) {
  const { state, panels } = p;
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const { playing, board, watching, panel } = partsOf(state, p.game);
  const log = { feed: p.live.feed, game: p.game, state, viewerKey: p.viewerKey, now: p.now };
  const more = {
    open: panels.open === 'list',
    toggle: () => {
      panels.toggle('list');
    },
    button: panels.button('list'),
  };
  const banner = p.phone
    ? bannerOf(p.live.feed, state, p.game, p.now)
    : eventBanner(p.live.feed, p.game, p.now);
  const stageBox = board ? (
    <div className="round-stage" ref={setStage}>
      {watching}
    </div>
  ) : null;
  // The board game's input waits for its stage, so the board never draws in the column.
  const dock =
    playing === null || (board && stage === null) ? null : (
      <InputRow
        state={state}
        game={playing}
        viewerKey={p.viewerKey}
        now={p.now}
        reload={p.live.reload}
        stage={board ? stage : null}
      />
    );
  const all = (
    <FocusPanel
      title="Guesses and events"
      open={more.open}
      onClose={panels.close}
      testId="list-sheet"
    >
      <RoundLog {...log} phone={p.phone} kind="all" />
    </FocusPanel>
  );
  const main = <RoundLog {...log} phone={p.phone} kind="main" banner={banner} more={more} />;
  // "Your guesses" beside a list game's stage, in shared mode only (individual: the same rows).
  const own =
    playing !== null && !board && state.secretMode === 'shared' ? (
      <section className="smg-panel round-own" aria-label="Your guesses">
        <RoundLog {...log} phone={false} kind="own" />
      </section>
    ) : null;
  return { board, panel, stageBox, dock, all, main, own };
}

export function RoundBody(p: BodyProps): ReactElement {
  const { board, panel, stageBox, dock, all, main, own } = useParts(p);
  const mainBox = (
    <section className="smg-panel round-main" aria-label="This round's guesses">
      {main}
    </section>
  );
  if (p.phone) {
    return (
      <>
        <PhoneLine state={p.state} game={p.game} panels={p.panels} rule={p.rule} />
        {stageBox}
        {mainBox}
        {dock}
        {all}
      </>
    );
  }
  return (
    <>
      {stageBox ?? (
        <section className="smg-panel round-stage round-stage--list" aria-label="This round">
          {main}
          {dock}
        </section>
      )}
      <aside className="round-column" aria-label="About this round">
        <SpecialLine state={p.state} rule={p.rule} />
        {panel === null ? null : <div className="smg-panel round-panel">{panel}</div>}
        {board ? (
          <>
            {mainBox}
            {dock}
          </>
        ) : (
          own
        )}
      </aside>
      {all}
    </>
  );
}
