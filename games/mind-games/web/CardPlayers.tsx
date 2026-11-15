/**
 * @file   games/mind-games/web/CardPlayers.tsx
 * @module games/mind-games/web
 * @brief  The players of one result card: a line of names and "+N more" for the whole list.
 *
 * Responsibility: under a result card's tag (owner design of 2026-11-15, task MG-N7): one
 *                 centred line of at most three names joined by " · ", the viewer first as
 *                 "You" in bold with their "+N", then " +N more", a small button that opens
 *                 every name with its points as a list over the card (a popover, never a
 *                 scrollbar in the card itself, T356). On a phone the line is only the button
 *                 "+N", N every player of the option (./result.css). The list is always in the
 *                 page, hidden while closed, so a reader and the tests find every player; Escape
 *                 or the button closes it and the focus stays on the button.
 * Depends on:     react, @smg-game/mind-games (names, views)
 * Used by:        ./ResultPanel
 * Spec:           docs/spec/02e-game-mind-games.md §9
 */
import { CHOICE_NAMES, type Choice, type ResultView } from '@smg-game/mind-games';
import { useId, useState, type ReactElement } from 'react';

type Player = ResultView['players'][number];

// The names the line shows before "+N more".
const SHOWN = 3;

// The option's players, the viewer first, so "You" is always on the line.
const ownFirst = (players: readonly Player[], viewerKey: string | null): readonly Player[] => [
  ...players.filter((x) => x.playerKey === viewerKey),
  ...players.filter((x) => x.playerKey !== viewerKey),
];

function Name(p: {
  readonly x: Player;
  readonly names: Readonly<Record<string, string>>;
  readonly viewerKey: string | null;
  readonly points: boolean;
}): ReactElement {
  const own = p.x.playerKey === p.viewerKey;
  const points = p.x.points > 0 && (own || p.points) ? ` +${String(p.x.points)}` : '';
  if (own) return <strong data-own="true">You{points}</strong>;
  return (
    <span>
      {p.names[p.x.playerKey] ?? p.x.playerKey}
      {points}
    </span>
  );
}

// "+N more" (on a phone "+N", every player): opens and closes the whole list.
function MoreButton(p: {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly listId: string;
  readonly label: string;
  readonly rest: number;
  readonly all: number;
}): ReactElement {
  return (
    <button
      type="button"
      className="mg-names-more"
      aria-expanded={p.open}
      aria-controls={p.listId}
      aria-label={p.label}
      onClick={p.toggle}
    >
      <span className="mg-more-wide">+{Math.max(0, p.rest)} more</span>
      <span className="mg-more-phone">+{p.all}</span>
    </button>
  );
}

export function CardPlayers(p: {
  readonly r: ResultView;
  readonly c: Choice;
  readonly names: Readonly<Record<string, string>>;
  readonly viewerKey: string | null;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const players = ownFirst(
    p.r.players.filter((x) => x.choice === p.c),
    p.viewerKey,
  );
  const rest = players.length - SHOWN;
  const name = { names: p.names, viewerKey: p.viewerKey };
  return (
    <div
      className="mg-card-players"
      data-rest={rest > 0}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <p className="mg-names">
        {players.slice(0, SHOWN).map((x, i) => (
          <span key={x.playerKey}>
            {i === 0 ? null : ' · '}
            <Name x={x} {...name} points={false} />
          </span>
        ))}
      </p>
      {players.length === 0 ? null : (
        <MoreButton
          open={open}
          toggle={() => {
            setOpen(!open);
          }}
          listId={listId}
          label={`Every player who chose ${CHOICE_NAMES[p.c]} (${String(players.length)})`}
          rest={rest}
          all={players.length}
        />
      )}
      <ul
        id={listId}
        className="mg-option-players"
        aria-label={`Chose ${CHOICE_NAMES[p.c]}`}
        hidden={!open}
      >
        {players.map((x) => (
          <li key={x.playerKey} data-own={x.playerKey === p.viewerKey}>
            <Name x={x} {...name} points />
          </li>
        ))}
      </ul>
    </div>
  );
}
