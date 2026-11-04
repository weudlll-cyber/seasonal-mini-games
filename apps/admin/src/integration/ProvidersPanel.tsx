/**
 * @file   apps/admin/src/integration/ProvidersPanel.tsx
 * @module admin/integration
 * @brief  The identity providers of the JWT handoff: list, add, change, disable, remove.
 *
 * Responsibility: the providers (`GET /admin/identity-providers`) with their issuer, key
 *                 source (a pinned key is named, never shown), algorithms, role mapping and
 *                 state; New and Change open ./ProviderForm; Disable (through the confirm
 *                 dialog) and Enable send the provider as it stands with only `enabled`
 *                 changed, its pinned key kept (DECISIONS T175); Remove through the confirm
 *                 dialog. A write that needs a fresh two-factor check gets it from ../StepUp.
 * Depends on:     react, @smg/contracts (provider view), ../ConfirmDialog (type), ../http,
 *                 ./form, ./ProviderForm, ./useListed
 * Used by:        ./IntegrationPage
 * Spec:           docs/spec/07-integration.md §1; Bingo 07 §2.1; Bingo 11 §1
 */
import type { IdentityProviderView } from '@smg/contracts';
import { useState, type ReactElement } from 'react';

import type { ConfirmRequest } from '../ConfirmDialog.js';
import { api } from '../http.js';
import { NewOrForm, Table } from './form.js';
import { mappingText, ProviderForm } from './ProviderForm.js';
import { useListed } from './useListed.js';

const at = (p: IdentityProviderView) => `/admin/identity-providers/${p.id}`;

// The provider with `enabled` turned over; without `pinnedPublicKey`, so a pinned key stays.
export function switched(p: IdentityProviderView): Record<string, unknown> {
  return {
    name: p.name,
    issuer: p.issuer,
    allowedAlgs: p.allowedAlgs,
    jwksUrl: p.jwksUrl,
    ...(p.hasPinnedKey ? {} : { pinnedPublicKey: null }),
    roleMapping: p.roleMapping,
    enabled: !p.enabled,
  };
}

const disableRequest = (p: IdentityProviderView): ConfirmRequest => ({
  title: `Disable ${p.name}`,
  effect: `Sign-ins handed off by ${p.issuer} are refused until it is enabled again; accounts and their links stay.`,
  confirmLabel: 'Disable',
  danger: true,
  action: () => api(at(p), { method: 'PUT', body: switched(p) }),
});

const removeRequest = (p: IdentityProviderView): ConfirmRequest => ({
  title: `Remove ${p.name}`,
  effect: `The provider and every account link to it are deleted; the accounts stay but can no longer sign in through ${p.issuer}.`,
  confirmLabel: 'Remove',
  danger: true,
  action: () => api(at(p), { method: 'DELETE' }),
});

const HEAD = ['Name', 'Issuer', 'Key', 'Algorithms', 'Role mapping', 'State', 'Actions'];

function Row(p: {
  readonly provider: IdentityProviderView;
  readonly edit: (v: IdentityProviderView) => void;
  readonly open: (r: ConfirmRequest) => void;
  readonly enable: (v: IdentityProviderView) => void;
}): ReactElement {
  const v = p.provider;
  return (
    <tr data-testid={`provider-${v.issuer}`}>
      <td>{v.name}</td>
      <td className="admin-diff">{v.issuer}</td>
      <td className="admin-diff">{v.hasPinnedKey ? 'pinned key' : (v.jwksUrl ?? '')}</td>
      <td>{v.allowedAlgs.join(', ')}</td>
      <td className="admin-diff">{mappingText(v.roleMapping) || 'none'}</td>
      <td>{v.enabled ? 'enabled' : 'disabled'}</td>
      <td className="smg-row">
        <button
          type="button"
          className="smg-btn"
          onClick={() => {
            p.edit(v);
          }}
        >
          Change
        </button>
        <button
          type="button"
          className="smg-btn"
          onClick={() => {
            if (v.enabled) p.open(disableRequest(v));
            else p.enable(v);
          }}
        >
          {v.enabled ? 'Disable' : 'Enable'}
        </button>
        <button
          type="button"
          className="smg-btn smg-btn--danger"
          onClick={() => {
            p.open(removeRequest(v));
          }}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export function ProvidersPanel(): ReactElement {
  const list = useListed<{ providers: IdentityProviderView[] }>('/admin/identity-providers');
  const providers = list.data?.providers ?? null;
  // null: no form; 'new': the form for a new provider; otherwise the provider being changed.
  const [editing, setEditing] = useState<IdentityProviderView | 'new' | null>(null);
  const enable = (v: IdentityProviderView): void => {
    list.put(at(v), switched(v), 'Enabling');
  };
  const form =
    editing === null ? null : (
      <ProviderForm
        key={editing === 'new' ? 'new' : editing.id}
        provider={editing === 'new' ? null : editing}
        done={() => {
          setEditing(null);
          void list.load();
        }}
        cancel={() => {
          setEditing(null);
        }}
      />
    );
  return (
    <section className="smg-panel smg-stack" aria-label="Identity providers">
      <h2>Identity providers</h2>
      <p className="smg-muted">
        Hosts that sign their users in here with a JWT handoff (audience seasonal-mini-games). A
        mapping never grants an admin role.
      </p>
      {list.problem === null ? null : <p role="alert">{list.problem}</p>}
      {providers === null ? <p className="smg-muted">Loading…</p> : null}
      {providers?.length === 0 ? <p>No identity provider yet.</p> : null}
      {providers === null || providers.length === 0 ? null : (
        <Table head={HEAD}>
          {providers.map((v) => (
            <Row key={v.id} provider={v} edit={setEditing} open={list.open} enable={enable} />
          ))}
        </Table>
      )}
      <NewOrForm
        label="New identity provider"
        form={form}
        start={() => {
          setEditing('new');
        }}
      />
      {list.dialog}
    </section>
  );
}
