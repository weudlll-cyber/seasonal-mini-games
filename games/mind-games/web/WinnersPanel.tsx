/**
 * @file   games/mind-games/web/WinnersPanel.tsx
 * @module games/mind-games/web
 * @brief  Every winner of the round as a chip, in a panel of their own above the cards.
 *
 * Responsibility: the owner's decision of 2026-11-15 (MG-N8, O99: the cards show no names, the
 *                 winners are listed above them): the title with the points ("36 winners · +1
 *                 each", ../src/words `winnersTitle`), then one chip per winner, the viewer's
 *                 "You" first, each name whole in its tooltip and accessible name and cut with an
 *                 ellipsis at 220 px (150 px on a phone). The chips take at most four rows (three
 *                 on a phone, two in a desktop window under 760 px high, T359); the rest become an
 *                 outline chip "+N more", which opens every winner as a list over the page
 *                 (Escape or the chip closes it; the list stays in the page while hidden). Without
 *                 a winner the panel says "Nobody wins this round." in neutral colours.
 * Depends on:     react, @smg-game/mind-games (views, words)
 * Used by:        ./ResultPanel
 * Spec:           docs/spec/02e-game-mind-games.md §9
 */
import { winnersTitle, type ResultView } from '@smg-game/mind-games';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from 'react';

type Names = Readonly<Record<string, string>>;

// The chip rows the window allows: the platform's phone rule (narrow or upright), a short
// desktop window, else four.
export function chipRows(width: number, height: number): number {
  if (width < 900 || width < height) return 3;
  return height < 760 ? 2 : 4;
}

// Items whose middles lie this close share a row (the chips are centred in their row, and
// "+N more" is taller).
const ROW_SLACK = 4;

// The middle of each row, from the items' middles.
function rowMiddles(tops: readonly number[]): readonly number[] {
  const rows: number[] = [];
  for (const t of [...tops].sort((a, b) => a - b)) {
    const last = rows.at(-1);
    if (last === undefined || t - last > ROW_SLACK) rows.push(t);
  }
  return rows;
}

// How many chips show so that they and "+N more" stay within the rows; again on a resize.
function useChipsFit(count: number) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(count);
  const [size, setSize] = useState(0);
  // Start again from every chip whenever the window or the chips' width changes, so a fit
  // measured in the middle of a change never sticks.
  useEffect(() => {
    let width = -1;
    const again = (): void => {
      setShown(count);
      setSize((n) => n + 1);
    };
    const onWidth = (): void => {
      const now = box.current?.clientWidth ?? 0;
      if (now !== width) {
        width = now;
        again();
      }
    };
    again();
    window.addEventListener('resize', again);
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onWidth);
    if (box.current !== null) watch?.observe(box.current);
    return () => {
      window.removeEventListener('resize', again);
      watch?.disconnect();
    };
  }, [count]);
  // After each render: while a chip (or "+N more") lies past the last row, show one fewer.
  useLayoutEffect(() => {
    const el = box.current;
    if (el === null || shown === 0) return;
    const items = Array.from(el.children) as HTMLElement[];
    const middle = (x: HTMLElement) => x.offsetTop + x.offsetHeight / 2;
    const tops = rowMiddles(items.map(middle));
    const rows = chipRows(window.innerWidth, window.innerHeight);
    if (tops.length <= rows) return;
    const limit = (tops[rows] ?? Infinity) - ROW_SLACK;
    const inside = items.filter((x) => x.dataset['chip'] !== undefined && middle(x) < limit);
    setShown(Math.max(0, Math.min(shown - 1, inside.length - 1)));
  }, [shown, size]);
  return { box, shown: Math.min(shown, count) };
}

type Winner = ResultView['players'][number];

// The chips that fit, the viewer's first, then "+N more" for the rest.
function Chips(p: {
  readonly winners: readonly Winner[];
  readonly shown: number;
  readonly box: RefObject<HTMLDivElement | null>;
  readonly nameOf: (key: string) => string;
  readonly viewerKey: string | null;
  readonly open: boolean;
  readonly toggle: () => void;
  readonly listId: string;
}): ReactElement {
  const rest = p.winners.length - p.shown;
  return (
    <div className="mg-chips" ref={p.box}>
      {p.winners.slice(0, p.shown).map((x) => (
        <span
          key={x.playerKey}
          className="mg-chip"
          data-chip=""
          data-own={x.playerKey === p.viewerKey}
          title={p.nameOf(x.playerKey)}
        >
          {p.nameOf(x.playerKey)}
        </span>
      ))}
      {rest <= 0 ? null : (
        <button
          type="button"
          className="mg-chip-more"
          aria-expanded={p.open}
          aria-controls={p.listId}
          onClick={p.toggle}
        >
          +{rest} more
        </button>
      )}
    </div>
  );
}

export function WinnersPanel(p: {
  readonly r: ResultView;
  readonly names: Names;
  readonly viewerKey: string | null;
}): ReactElement {
  const winners = [
    ...p.r.players.filter((x) => x.points > 0 && x.playerKey === p.viewerKey),
    ...p.r.players.filter((x) => x.points > 0 && x.playerKey !== p.viewerKey),
  ];
  const nameOf = (key: string) => (key === p.viewerKey ? 'You' : (p.names[key] ?? key));
  const fit = useChipsFit(winners.length);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const title = winnersTitle(p.r);
  if (title === null) {
    return (
      <section className="mg-winners" data-none="true" data-testid="winners">
        <strong>Nobody wins this round.</strong>
      </section>
    );
  }
  return (
    <section
      className="mg-winners"
      aria-label={title}
      data-testid="winners"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <strong>{title}</strong>
      <Chips
        winners={winners}
        shown={fit.shown}
        box={fit.box}
        nameOf={nameOf}
        viewerKey={p.viewerKey}
        open={open}
        toggle={() => {
          setOpen(!open);
        }}
        listId={listId}
      />
      {/* Every winner, over the page while open. */}
      <ol id={listId} className="mg-winners-all" aria-label="Every winner" hidden={!open}>
        {winners.map((x) => (
          <li key={x.playerKey}>
            {nameOf(x.playerKey)} +{x.points}
          </li>
        ))}
      </ol>
    </section>
  );
}
