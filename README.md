# TuiTui

TuiTui is a Terminal User Interface (TUI) project focused on user-to-user communication, built with OpenTUI and Bun.

This repository is currently in the planning and architecture phase.

### Initial Idea

Build a terminal communication app with modular support for multiple transport providers (transporters).

Examples of future transporters:

- `whatsapp-web.js`
- raw websocket
- any other provider that follows the project contract

The interface should not depend on a specific provider. Instead, the UI talks to a shared contract.

### Goal

- Keep communication core logic decoupled from concrete implementations
- Allow provider selection at application startup
- Add new transporters without rewriting screens
- Standardize authentication, contacts, chats, and messages

### Planned Functional Scope

Each transporter should be responsible for:

- authenticating a session
- listing contacts
- listing chats
- receiving messages
- sending messages
- notifying state updates (for example: reconnect, new chats)

### Proposed Architecture (high level)

- `core`: business logic independent from providers
- `transporters`: pluggable provider modules
- `router/pages`: TUI navigation flow and screens
- `keybinds`: global and page-specific shortcuts
- `theme/components`: visual identity and reusable components

#### Expected transporter contract

A single interface across all modules, for example:

- `authenticate()`
- `listContacts()`
- `listChats()`
- `sendMessage(chatId, content)`
- `onMessage(handler)`
- `disconnect()`

> Final names may change. The key point is keeping a stable UI-facing contract.

### Conventions already adopted

#### File-based pages

- root page: `src/pages/page.tsx`
- other pages: `src/pages/<name>/page.tsx`

#### Keybinds

- global keybinds: `src/keybind.ts`
- page keybinds: `src/pages/<name>/keybind.ts`

#### Components

- reusable components: `src/components/<name>/component.tsx`

### Current status

- OpenTUI + Bun base configured
- initial red-themed palette applied
- initial home with visual identity (`TuiTui`)
- automatic page loading by convention
- global + per-page keybind structure
- transporter architecture still being defined

### Initial roadmap

1. Define a minimal transporter contract
2. Create provider registry
3. Implement a mock transporter to validate flow
4. Create startup provider selection screen
5. Integrate first real provider
6. Evolve to real chats/contacts/messages

### Run

```bash
bun install
bun run dev
```

To exit the app, press `q`.
