# Clients + Providers Architecture Plan

## Goal

Build a modular event-driven chat architecture where:

- each client has its own `EventEmitter` instance;
- contacts listing, history loading, message send/receive run through events;
- providers are independent modules under `src/Providers/`;
- authentication is generic (QR, OTP/pairing code, token) with a single auth UI.

## Core Principles

- Event-driven: UI reacts to emitted events.
- Provider-agnostic UI: screens do not know provider internals.
- Per-client isolation: one emitter per client session.
- Stable contracts: all providers implement the same interfaces.

## Suggested Folder Layout

```txt
src/
  domain/
    contact.ts
    message.ts
    auth.ts
    events.ts
    provider-contracts.ts

  core/
    clients/
      TypedEmitter.ts
      Client.ts
      ClientRegistry.ts
      ClientSessionStore.ts
      AuthStore.ts

  Providers/
    MockProvider/
      index.ts
      provider.ts
      auth.ts
      mock-data.ts
    WhatsAppProvider/
      index.ts
      provider.ts
      auth.ts
    JwtProvider/
      index.ts
      provider.ts
      auth.ts

  app/
    providers/
      ClientsProvider.tsx
      ContactsProvider.tsx
      ChatProvider.tsx
      AuthProvider.tsx
    hooks/
      useClient.ts
      useContacts.ts
      useChat.ts
      useAuth.ts

  pages/
    auth/page.tsx
    contacts/page.tsx
    chat/page.tsx
```

## Domain Models

```ts
// src/domain/contact.ts
export type Contact = {
  id: string
  name: string
  status?: string
}

// src/domain/message.ts
export type ChatMessage = {
  id: string
  clientId: string
  contactId: string
  from: "self" | "peer" | string
  content: string
  timestamp: number
  status?: "pending" | "sent" | "delivered" | "read" | "failed"
}
```

## Auth Model

```ts
// src/domain/auth.ts
export type AuthStatus = "idle" | "pending" | "authenticated" | "expired" | "failed"

export type AuthPrompt =
  | { type: "qr"; value: string; format?: "ascii" | "data-url"; expiresAt?: number }
  | { type: "otp"; code: string; label?: string; expiresAt?: number }
  | { type: "token"; label?: string; placeholder?: string; masked?: boolean }

export type AuthSubmission =
  | { type: "otp"; value: string }
  | { type: "token"; value: string }
  | { type: "pairing_code"; value: string }
```

## Standard Event Map

```ts
// src/domain/events.ts
import type { AuthPrompt, AuthStatus } from "./auth"
import type { Contact } from "./contact"
import type { ChatMessage } from "./message"

export type ClientEvents = {
  "client:connected": { clientId: string; providerId: string }
  "client:disconnected": { clientId: string; providerId: string }
  "client:error": { clientId: string; providerId: string; message: string }

  "contacts:updated": { clientId: string; contacts: Contact[] }
  "chat:history": { clientId: string; contactId: string; messages: ChatMessage[] }
  "message:sent": { clientId: string; contactId: string; message: ChatMessage }
  "message:received": { clientId: string; contactId: string; message: ChatMessage }
  "presence:updated": { clientId: string; contactId: string; status: string }

  "auth:status": { clientId: string; status: AuthStatus }
  "auth:prompt": { clientId: string; prompt: AuthPrompt }
  "auth:error": { clientId: string; message: string }
  "auth:completed": { clientId: string }
  "auth:logout": { clientId: string }
}
```

## Provider Contract

```ts
// src/domain/provider-contracts.ts
import type { AuthSubmission } from "./auth"
import type { Contact } from "./contact"
import type { ChatMessage } from "./message"
import type { TypedEmitter } from "../core/clients/TypedEmitter"
import type { ClientEvents } from "./events"

export type ProviderCapabilities = {
  authMethods: Array<"qr" | "otp" | "token" | "pairing_code">
  supportsPresence?: boolean
  supportsHistory?: boolean
}

export type ProviderContext = {
  clientId: string
  providerId: string
  emitter: TypedEmitter<ClientEvents>
}

export interface ProviderAdapter {
  readonly id: string
  readonly capabilities: ProviderCapabilities

  connect(ctx: ProviderContext): Promise<void>
  disconnect(ctx: ProviderContext): Promise<void>

  listContacts(ctx: ProviderContext): Promise<Contact[]>
  loadHistory(ctx: ProviderContext, contactId: string): Promise<ChatMessage[]>
  sendMessage(ctx: ProviderContext, contactId: string, content: string): Promise<ChatMessage>

  startAuth(ctx: ProviderContext, method?: ProviderCapabilities["authMethods"][number]): Promise<void>
  submitAuth(ctx: ProviderContext, payload: AuthSubmission): Promise<void>
  logout?(ctx: ProviderContext): Promise<void>
}
```

## Typed Emitter

```ts
// src/core/clients/TypedEmitter.ts
import { EventEmitter } from "events"

export class TypedEmitter<TEvents extends Record<string, unknown>> {
  private readonly emitter = new EventEmitter()

  on<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void) {
    this.emitter.on(String(event), listener as (...args: unknown[]) => void)
    return () => this.off(event, listener)
  }

  off<K extends keyof TEvents>(event: K, listener: (payload: TEvents[K]) => void) {
    this.emitter.off(String(event), listener as (...args: unknown[]) => void)
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    this.emitter.emit(String(event), payload)
  }
}
```

## Client Runtime

Each client runtime instance should own:

- `clientId`
- `providerId`
- `provider adapter`
- `TypedEmitter<ClientEvents>`
- local connection/auth state

Public methods should delegate to provider adapters and publish events through the emitter.

## Auth UI (Single Screen)

Create one `auth/page.tsx` that renders based on `auth:prompt`:

- `type = qr` -> show QR (ASCII or rendered image)
- `type = otp` -> show OTP/pairing code and timer
- `type = token` -> show input field

Navigation policy:

1. provider emits `auth:status = pending` and `auth:prompt`
2. app routes to `auth`
3. user submits via `submitAuth(...)`
4. provider emits `auth:completed`
5. app routes to `contacts`

## Event Flows

### Contacts List

1. UI calls `client.listContacts()`
2. provider emits `contacts:updated`
3. contacts screen updates from event payload

### Open Conversation

1. user selects contact
2. app stores selected contact
3. UI calls `client.loadHistory(contactId)`
4. provider emits `chat:history`

### Send and Receive

1. UI calls `client.sendMessage(contactId, content)`
2. provider emits `message:sent`
3. when remote message arrives, provider emits `message:received`

### Auth Required

1. provider emits `auth:status` pending + `auth:prompt`
2. app opens auth page
3. user submits challenge value
4. provider emits completion or error events

## Provider Module Rules

Each provider under `src/Providers/<Name>/` should:

- expose `id`, `capabilities`, and adapter implementation;
- translate provider-specific auth (WhatsApp QR, pairing code, JWT token, etc.) into standard auth events;
- never leak provider-specific payloads to UI.

## Persistence

- `ClientSessionStore`: selected client metadata, last selected contact, UI context.
- `AuthStore`: tokens/sessions by `{ providerId, clientId }` key.

Prefer encrypted persistence when possible.

## Implementation Roadmap

1. Create domain contracts (`auth`, `events`, `provider-contracts`).
2. Implement `TypedEmitter`, client runtime, and registry.
3. Build `MockProvider` as reference implementation.
4. Add `AuthProvider` and `auth/page.tsx`.
5. Migrate contacts/chat screens to client runtime events.
6. Add persistence stores.
7. Integrate real providers (WhatsApp/JWT/etc.) using same contract.

## Acceptance Criteria

- UI can switch providers without page-level code changes.
- Multiple clients can run without cross-event leakage.
- Auth flow works for QR, OTP, and token using one auth page.
- Contacts/history/send/receive are fully event-driven.
- `MockProvider` can simulate full end-to-end flow.
