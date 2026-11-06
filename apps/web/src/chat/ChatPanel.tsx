/**
 * @file   apps/web/src/chat/ChatPanel.tsx
 * @module web/chat
 * @brief  The ChatPanel component boundary: which chat a screen shows, by the provider in force.
 *
 * Responsibility: 07 §2: with `none` no panel at all; with `builtin` the platform's room (the
 *                 lobby room or the match's room, ./ChatRoom); with `hostEmbed` the host's one
 *                 room in a sandboxed frame titled "Chat" from the host chat's address (the
 *                 server's CSP admits it as frame-src; in website mode by default the
 *                 website's `/embed/chat?room=mini-games`, O66) with `theme=light|dark`
 *                 following the game's theme (a change reloads the frame); behind the round
 *                 bar's Chat button the frame is told whether it is in sight and its unread
 *                 count goes to the badge (./useHostChatFrame, DECISIONS T237). The frame's
 *                 request carries this site's origin as its referrer (`strict-origin`; the
 *                 page itself sends none), which the embed needs in Firefox to know its
 *                 parent (T242). In website mode a visitor who is not signed in also gets
 *                 "Log in": the website's sign-in for this page (../account/SignIn,
 *                 DECISIONS T238); the frame shows the website's own guest view. `bare` drops
 *                 the panel's frame and heading
 *                 where the screen gives the chat its own place and heading: the round view's
 *                 right column (../round/RoundChat) and the match's waiting area; elsewhere
 *                 (the lobby) it is a panel of its own height.
 *                 A screen that already loaded the config passes it, else the panel loads it.
 * Depends on:     react, @smg/contracts (ChatConfigView), ../account/SignIn, ../shell/session,
 *                 ../shell/theme, ./ChatRoom, ./useChat, ./useHostChatFrame, ./chat.css
 * Used by:        ../lobby/Lobby, ../match/MatchPage
 * Spec:           docs/spec/07-integration.md §2; Bingo 07 §6; Seasonal Entertainment docs/EMBED.md
 */
import type { ChatConfigView } from '@smg/contracts';
import { useRef, type ReactElement } from 'react';

import { SignInLink } from '../account/SignIn.js';
import { useSession } from '../shell/session.js';
import { useShownTheme } from '../shell/theme.js';
import { ChatRoom } from './ChatRoom.js';
import { useChatConfig, type ChatTarget } from './useChat.js';
import { useHostChatFrame } from './useHostChatFrame.js';
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
  return <HostChat url={config.hostChatUrl} />;
}

// The host chat's address with the game's theme; a path (the website's own room) stays one.
function withTheme(url: string, theme: string): string {
  const at = new URL(url, window.location.origin);
  at.searchParams.set('theme', theme);
  return url.startsWith('/') ? `${at.pathname}${at.search}` : at.href;
}

function HostChat({ url }: { readonly url: string }): ReactElement {
  const theme = useShownTheme();
  const session = useSession().session;
  const guest = session?.authMode === 'website' && session.account === null;
  const frame = useRef<HTMLIFrameElement>(null);
  useHostChatFrame(frame, url);
  return (
    <>
      {guest ? (
        <p className="chat-log-in">
          <SignInLink testId="chat-log-in">Log in</SignInLink> with your Seasonal Entertainment
          account.
        </p>
      ) : null}
      <iframe
        ref={frame}
        className="chat-frame"
        title="Chat"
        src={withTheme(url, theme)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        referrerPolicy="strict-origin"
        data-testid="chat-frame"
      />
    </>
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
