// @vitest-environment jsdom
/**
 * @file   apps/web/src/match/fieldState.test.tsx
 * @module web/match
 * @brief  The host form's fields as a game words them now, and unchanged without its word.
 *
 * Responsibility: without a game's word every field is its definition's, editable (the guess
 *                 games); with it a field shows the value it follows, off, with its own help
 *                 line (Mind Games' join time following the total, 02e §3; DECISIONS T335).
 * Depends on:     vitest, @testing-library/react, @smg/game-sdk (definitions), ./roundFields
 * Spec:           docs/spec/02e-game-mind-games.md §3; docs/spec/08-admin-settings.md §1
 */
import { PLATFORM_ROUND_SETTINGS, type SettingDef } from '@smg/game-sdk';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { HostFields } from './roundFields.js';

afterEach(() => {
  cleanup();
});

const countdown = PLATFORM_ROUND_SETTINGS.find((d) => d.key === 'round.countdownS') as SettingDef;

function fields(
  fieldState?: (key: string) => { value: number; disabled: boolean; help: string } | null,
) {
  render(
    <HostFields
      fields={[countdown]}
      season={null}
      values={{ 'round.countdownS': 10 }}
      set={() => undefined}
      fieldState={fieldState}
    />,
  );
  return screen.getByLabelText<HTMLInputElement>(countdown.label);
}

describe('the host form fields (T335)', () => {
  it("are the definitions' own without a game's word", () => {
    const box = fields();
    expect([box.value, box.disabled]).toEqual(['10', false]);
    expect(screen.getByText(countdown.help)).toBeTruthy();
  });

  it('show the value a game says they follow, off, with its help line', () => {
    const box = fields(() => ({ value: 30, disabled: true, help: 'Follows the total.' }));
    expect([box.value, box.disabled]).toEqual(['30', true]);
    expect(screen.getByText('Follows the total.')).toBeTruthy();
  });
});
