/**
 * @file   apps/web/src/components/DevBadge.tsx
 * @module web
 * @brief  Fixed-position dev badge (08 §1.1): "Mini Games · dev · <port>".
 *
 * Responsibility: show the dev badge in the bottom-right corner while `import.meta.env.DEV`
 *                 is true, letting clicks pass through to controls under it;
 *                 render nothing in a production build. The port number comes from the
 *                 Vite config via `__SMG_DEV_PORT__`.
 * Depends on:     react
 * Used by:        ../App
 * Spec:           Bingo 08 §1.1
 */
import type { ReactElement } from 'react';

declare const __SMG_DEV_PORT__: number;

export function DevBadge(): ReactElement | null {
  if (!import.meta.env.DEV) return null;
  return (
    <div
      aria-label="Development build badge"
      data-testid="dev-badge"
      style={{
        position: 'fixed',
        right: '0.75rem',
        bottom: '0.75rem',
        // A label only: clicks pass through, so it never blocks a control under it.
        pointerEvents: 'none',
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        background: 'var(--color-winter)',
        color: 'var(--color-on-season)',
        borderRadius: '0.25rem',
        zIndex: 1_000,
      }}
    >
      Mini Games · dev · {__SMG_DEV_PORT__}
    </div>
  );
}
