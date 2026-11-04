/**
 * @file   apps/admin/src/DisplayName.tsx
 * @module admin
 * @brief  A display name in an admin table: one line, cut with an ellipsis, in full as its title.
 *
 * Responsibility: the name cell of the account, abuse and sanction tables, so a long name
 *                 never widens or wraps its row (T202); the style is ./admin.css `.admin-name`.
 * Depends on:     react
 * Used by:        ./accounts/AccountsPage, ./abuse/AbusePage, ./moderation/SanctionsPanel
 * Spec:           docs/spec/08-admin-settings.md §1
 */
import type { ReactElement } from 'react';

export function DisplayName({ name }: { readonly name: string }): ReactElement {
  return (
    <span className="admin-name" title={name}>
      {name}
    </span>
  );
}
