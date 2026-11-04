/**
 * @file   apps/admin/src/integration/ProviderForm.tsx
 * @module admin/integration
 * @brief  The form for a new identity provider or a change of one.
 *
 * Responsibility: name, issuer, the algorithms, the JWKS address or a pinned PEM public key,
 *                 the role mapping as "host role = platform role" lines, and whether it is
 *                 enabled; checked with IdentityProviderBody (new) or IdentityProviderChange
 *                 (a change) before it is sent. The server never sends a pinned key back, so
 *                 for a provider with one the key field starts empty and, left empty, keeps
 *                 the key in force (DECISIONS T175).
 * Depends on:     react, @smg/contracts (provider schemas, algorithms, roles), ../http,
 *                 ../TextInput, ./form
 * Used by:        ./ProvidersPanel
 * Spec:           docs/spec/07-integration.md §1, §4; Bingo 07 §2.1, §2.2
 */
import {
  HANDOFF_ALGS,
  IdentityProviderBody,
  IdentityProviderChange,
  MAPPED_ROLES,
  type IdentityProviderView,
} from '@smg/contracts';
import { useState, type ReactElement, type SyntheticEvent } from 'react';

import { api, failureText } from '../http.js';
import { TextInput } from '../TextInput.js';
import { Checkbox, FormEnd, issueText, TextArea } from './form.js';

const LABELS = {
  name: 'Name',
  issuer: 'Issuer',
  allowedAlgs: 'Algorithms',
  jwksUrl: 'JWKS address',
  pinnedPublicKey: 'Pinned public key',
  roleMapping: 'Role mapping',
};

// "organizers = organizer" lines → { organizers: 'organizer' }; the contract checks the roles.
export function mappingOf(text: string): Record<string, string> {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  return Object.fromEntries(
    lines.map((l) => {
      const [host = '', role = ''] = l.split('=');
      return [host.trim(), role.trim()];
    }),
  );
}

export const mappingText = (m: Readonly<Record<string, string>>): string =>
  Object.entries(m)
    .map(([host, role]) => `${host} = ${role}`)
    .join('\n');

interface Draft {
  readonly name: string;
  readonly issuer: string;
  readonly algs: readonly string[];
  readonly jwks: string;
  readonly key: string;
  readonly mapping: string;
  readonly enabled: boolean;
}

const EMPTY: Draft = {
  name: '',
  issuer: '',
  algs: ['EdDSA'],
  jwks: '',
  key: '',
  mapping: '',
  enabled: true,
};

// The form's start: the provider as it stands (its pinned key never comes back), or empty.
const draftOf = (p: IdentityProviderView | null): Draft =>
  p === null
    ? EMPTY
    : {
        name: p.name,
        issuer: p.issuer,
        algs: p.allowedAlgs,
        jwks: p.jwksUrl ?? '',
        key: '',
        mapping: mappingText(p.roleMapping),
        enabled: p.enabled,
      };

// The body to send; without `pinnedPublicKey` when the key in force stays.
function bodyOf(d: Draft, keepKey: boolean): Record<string, unknown> {
  const text = (s: string) => (s.trim() === '' ? null : s.trim());
  return {
    name: d.name,
    issuer: d.issuer.trim(),
    allowedAlgs: HANDOFF_ALGS.filter((a) => d.algs.includes(a)),
    jwksUrl: text(d.jwks),
    ...(keepKey ? {} : { pinnedPublicKey: text(d.key) }),
    roleMapping: mappingOf(d.mapping),
    enabled: d.enabled,
  };
}

function KeyFields(p: {
  readonly d: Draft;
  readonly set: (change: Partial<Draft>) => void;
  readonly hasKey: boolean;
}): ReactElement {
  return (
    <>
      <TextInput
        label="JWKS address (https, empty with a pinned key)"
        visible
        value={p.d.jwks}
        onChange={(jwks) => {
          p.set({ jwks });
        }}
        maxLength={300}
      />
      <TextArea
        label={
          p.hasKey
            ? 'Pinned public key (PEM; empty keeps the key in force, it is never shown again)'
            : 'Pinned public key (PEM; empty with a JWKS address)'
        }
        value={p.d.key}
        onChange={(key) => {
          p.set({ key });
        }}
        placeholder="-----BEGIN PUBLIC KEY-----"
      />
    </>
  );
}

function Algorithms(p: {
  readonly algs: readonly string[];
  readonly set: (change: Partial<Draft>) => void;
}): ReactElement {
  return (
    <fieldset className="smg-row">
      <legend>Algorithms</legend>
      {HANDOFF_ALGS.map((a) => (
        <Checkbox
          key={a}
          label={a}
          checked={p.algs.includes(a)}
          onChange={(on) => {
            p.set({ algs: on ? [...p.algs, a] : p.algs.filter((x) => x !== a) });
          }}
        />
      ))}
    </fieldset>
  );
}

// A body the contract refused, in the words of `issueText`.
class Refused extends Error {}

// The body checked with the contract, then sent as a new provider or a change.
async function send(provider: IdentityProviderView | null, d: Draft): Promise<unknown> {
  const body = bodyOf(d, provider?.hasPinnedKey === true && d.key.trim() === '');
  const schema = provider === null ? IdentityProviderBody : IdentityProviderChange;
  const checked = schema.safeParse(body);
  if (!checked.success) throw new Refused(issueText(checked.error.issues, LABELS));
  if (provider === null) return api('/admin/identity-providers', { method: 'POST', body });
  return api(`/admin/identity-providers/${provider.id}`, { method: 'PUT', body });
}

export function ProviderForm(p: {
  readonly provider: IdentityProviderView | null;
  readonly done: () => void;
  readonly cancel: () => void;
}): ReactElement {
  const [d, setDraft] = useState(() => draftOf(p.provider));
  const [problem, setProblem] = useState<string | null>(null);
  const set = (change: Partial<Draft>): void => {
    setDraft((old) => ({ ...old, ...change }));
  };
  // The change handler of one field.
  const on =
    <K extends keyof Draft>(k: K) =>
    (value: Draft[K]): void => {
      set({ [k]: value });
    };
  const save = (e: SyntheticEvent): void => {
    e.preventDefault();
    send(p.provider, d)
      .then(p.done)
      .catch((error: unknown) => {
        setProblem(
          error instanceof Refused ? error.message : failureText(error, 'Saving the provider'),
        );
      });
  };
  return (
    <form className="smg-panel smg-panel--inset smg-stack" onSubmit={save}>
      <h3>{p.provider === null ? 'New identity provider' : `Change ${p.provider.name}`}</h3>
      <TextInput label="Name" visible value={d.name} onChange={on('name')} />
      <TextInput
        label="Issuer (the token's iss)"
        visible
        value={d.issuer}
        onChange={on('issuer')}
        maxLength={300}
      />
      <Algorithms algs={d.algs} set={set} />
      <KeyFields d={d} set={set} hasKey={p.provider?.hasPinnedKey === true} />
      <TextArea
        label={`Role mapping, one "host role = platform role" a line (${MAPPED_ROLES.join(', ')})`}
        value={d.mapping}
        onChange={on('mapping')}
        placeholder="organizers = organizer"
      />
      <Checkbox label="Enabled" checked={d.enabled} onChange={on('enabled')} />
      <FormEnd saveLabel="Save provider" problem={problem} cancel={p.cancel} />
    </form>
  );
}
