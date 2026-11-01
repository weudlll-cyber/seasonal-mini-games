// @vitest-environment jsdom
/**
 * @file   apps/web/src/round/roundChat.test.tsx
 * @module web/round
 * @brief  The match chat in the round view (T101): nothing without a chat; a button that opens
 *         and closes it on a phone.
 *
 * Responsibility: without a chat the round view gets no chat section; with one, the section is
 *                 headed "Chat", holds the chat mounted, and its button says "Chat" or "Close
 *                 chat" with `aria-expanded` following it; Escape closes it too.
 * Depends on:     vitest, @testing-library/react, ./RoundChat
 * Spec:           docs/spec/07-integration.md §2; docs/spec/02-game-guess-the-number.md §12
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RoundChat } from './RoundChat.js';

afterEach(() => {
  cleanup();
});

describe('the round view chat', () => {
  it('is left out without a chat', () => {
    const { container } = render(<RoundChat chat={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps the chat mounted and opens and closes it with its button or Escape', () => {
    render(<RoundChat chat={<p>the room</p>} />);
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeTruthy();
    expect(screen.getByText('the room')).toBeTruthy();
    const button = screen.getByTestId('round-chat-toggle');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.textContent).toBe('Close chat');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('round-chat').dataset['open']).toBe('true');
    fireEvent.keyDown(screen.getByText('the room'), { key: 'Escape' });
    expect(button.textContent).toBe('Chat');
    expect(screen.getByText('the room')).toBeTruthy();
  });
});
