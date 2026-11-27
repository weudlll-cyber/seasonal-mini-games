/**
 * @file   apps/web/src/components/ScrollBox.tsx
 * @module web/components
 * @brief  A box that scrolls inside itself, reached by keyboard while it scrolls.
 *
 * Responsibility: an element that is a Tab stop while it scrolls (the kit's `useScrollTabStop`,
 *                 axe `scrollable-region-focusable`, journey 47) and none otherwise. A component
 *                 of its own, because the hook watches the element that is there when it mounts:
 *                 a box that shows only some of the time brings its hook with it.
 * Depends on:     react, @seasonal/kit/react (useScrollTabStop)
 * Used by:        ../round/RoundBody, ../round/RoundLog
 * Spec:           WCAG 2.2 SC 2.1.1
 */
import { useScrollTabStop } from '@seasonal/kit/react';
import { createElement, useRef, type HTMLAttributes, type ReactElement } from 'react';

type Props = HTMLAttributes<HTMLElement> & {
  readonly as: 'aside' | 'div' | 'ol';
  readonly 'data-testid'?: string | undefined;
  readonly 'data-columns'?: string | undefined;
};

export function ScrollBox({ as, ...rest }: Props): ReactElement {
  const box = useRef<HTMLElement>(null);
  useScrollTabStop(box);
  return createElement(as, { ...rest, ref: box });
}
