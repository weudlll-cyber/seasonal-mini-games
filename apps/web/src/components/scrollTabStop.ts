/**
 * @file   apps/web/src/components/scrollTabStop.ts
 * @module web/components
 * @brief  A box that scrolls inside itself is reached by keyboard while it scrolls.
 *
 * Responsibility: a ref callback for a scrolling box: it is a tab stop while its content is
 *                 taller than it is and its style lets it scroll (large text, a long list), and
 *                 none otherwise, so a page at rest has no extra stops (axe
 *                 `scrollable-region-focusable`, journey 47). Without a ResizeObserver (jsdom)
 *                 it does nothing.
 * Used by:        ../round/RoundBody, ../round/RoundLog, ../chat/ChatRoom
 * Spec:           WCAG 2.2 SC 2.1.1
 */
export function scrollTabStop(box: HTMLElement | null): (() => void) | undefined {
  if (box === null || typeof ResizeObserver === 'undefined') return undefined;
  const update = (): void => {
    const scrolls =
      box.scrollHeight > box.clientHeight + 1 &&
      /auto|scroll/.test(getComputedStyle(box).overflowY);
    if (scrolls) box.tabIndex = 0;
    else box.removeAttribute('tabindex');
  };
  // The box's own size, and what is in it: either can start or end the scrolling.
  const sizes = new ResizeObserver(update);
  sizes.observe(box);
  const content = new MutationObserver(update);
  content.observe(box, { childList: true, subtree: true, characterData: true });
  update();
  return () => {
    sizes.disconnect();
    content.disconnect();
  };
}
