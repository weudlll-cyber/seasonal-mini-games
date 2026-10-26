// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/forms.test.tsx
 * @module web/match
 * @brief  Every field of the Quick Test and of the host's round form has a one-line help.
 *
 * Responsibility: the Quick Test offers Seed, Secret, Season, What others see, Bots,
 *                 Cooldown, Lowest number, Highest number, Show range and Fast specials, each
 *                 with a help line under it that its control names in aria-describedby (so it
 *                 is visible without hover); the host form's setting fields do the same with
 *                 the same words as the Quick Test for the same setting.
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk, @smg-game/registry/web,
 *                 ./roundFields, ../shell/QuickTest
 * Spec:           docs/spec/08-admin-settings.md §3; docs/spec/11-roadmap.md (Quick Test)
 */
import { GAME_SCREENS } from '@smg-game/registry/web';
import { PLATFORM_ROUND_SETTINGS } from '@smg/game-sdk';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { QuickTest } from '../shell/QuickTest.js';
import { Field } from './roundFields.js';

afterEach(() => {
  cleanup();
});

// Each field's label and the help line its control points to.
function helpByLabel(): Map<string, string> {
  const out = new Map<string, string>();
  for (const field of document.querySelectorAll('.smg-field')) {
    const label = field.querySelector('label > span')?.textContent ?? '';
    const control = field.querySelector('input, select');
    const helpId = control?.getAttribute('aria-describedby') ?? '';
    out.set(label, document.getElementById(helpId)?.textContent ?? '');
  }
  return out;
}

describe('the forms', () => {
  it('give every Quick Test field a help line under it', () => {
    render(<QuickTest />);
    const help = helpByLabel();
    expect([...help.keys()]).toEqual([
      'Seed',
      'Secret',
      'Season',
      'What others see of a guess',
      'Bots',
      'Cooldown',
      'Lowest number',
      'Highest number',
      'Show range',
      'Fast specials',
    ]);
    for (const [label, text] of help) expect(text, label).not.toBe('');
  });

  it('word a setting the same in the host form as in the Quick Test', () => {
    render(<QuickTest />);
    const quick = helpByLabel();
    cleanup();
    const defs = [
      ...PLATFORM_ROUND_SETTINGS,
      ...(GAME_SCREENS['guess-the-number']?.settings ?? []),
    ];
    const host = defs.filter((d) => d.hostChooses);
    render(
      <>
        {host.map((d) => (
          <Field key={d.key} def={d} value={d.default} set={() => undefined} />
        ))}
      </>,
    );
    const form = helpByLabel();
    for (const [label, text] of form) expect(text, label).not.toBe('');
    for (const label of ['Secret', 'Cooldown', 'Lowest number', 'Show range']) {
      expect(form.get(label), label).toBe(quick.get(label));
    }
    expect(screen.getByLabelText('Lowest number').getAttribute('min')).toBe('-1000000');
  });
});
