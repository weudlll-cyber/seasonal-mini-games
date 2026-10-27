/**
 * @file   apps/web/src/chat/ChatPanel.tsx
 * @module web/chat
 * @brief  The ChatPanel component boundary: which chat a screen shows, by the provider in force.
 *
 * Responsibility: 07 §2: with `none` no panel at all; with `builtin` the platform's room (the
 *                 lobby room or the match's room, ./ChatRoom); with `hostEmbed` the host's one
 *                 room in a sandboxed frame from `integrations.hostChatUrl` (the server's CSP
 *                 admits its origin as frame-src). `bare` drops the panel's frame and heading
 *                 for the round view, where the panel sits behind the "Live | Chat" switch and
 *                 fills the place of the Live list; elsewhere it is a panel of its own height.
 *                 A screen that already loaded the config passes it, else the panel loads it.
 * Depends on:     react, @smg/contracts (ChatConfigView), ./ChatRoom, ./useChat, ./chat.css
 * Used by:        ../lobby/Lobby, ../match/MatchPage
 * Spec:           docs/spec/07-integration.md §2; Bingo 07 §6
 */
import type { ChatConfigView } from '@smg/contracts';
import type { ReactElement } from 'react';

import { ChatRoom } from './ChatRoom.js';
import { useChatConfig, type ChatTarget } from './useChat.js';
import './chat.css';

interface ChatPanelProps {
  readonly target: ChatTarget;
  readonly bare?: boolean;
  readonly config?: ChatConfigView | null;
}

function Body({
  config,
  target,
}: {
  readonly config: ChatConfigView;
  readonly target: ChatTarget;
}): ReactElement | null {
  if (config.provider === 'builtin') return <ChatRoom target={target} />;
  if (config.provider !== 'hostEmbed') return null;
  if (config.hostChatUrl === null) return <p className="smg-muted">The chat is not set up yet.</p>;
  return (
    <iframe
      className="chat-frame"
      title="Chat"
      src={config.hostChatUrl}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      data-testid="chat-frame"
    />
  );
}

// Loads the config when the screen did not pass it.
function Loaded(p: ChatPanelProps): ReactElement | null {
  const config = useChatConfig();
  return <Panel {...p} config={config} />;
}

function Panel({ target, bare = false, config }: ChatPanelProps): ReactElement | null {
  if (config === undefined || config === null || config.provider === 'none') return null;
  const body = <Body config={config} target={target} />;
  if (bare) {
    return (
      <div className="chat-panel" data-testid="chat-panel">
        {body}
      </div>
    );
  }
  return (
    <section
      className="smg-panel chat-panel chat-panel--page"
      aria-labelledby="chat-title"
      data-testid="chat-panel"
    >
      <h2 id="chat-title">Chat</h2>
      {body}
    </section>
  );
}

export function ChatPanel(p: ChatPanelProps): ReactElement | null {
  return p.config === undefined ? <Loaded {...p} /> : <Panel {...p} />;
}
