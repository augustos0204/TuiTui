import type { AuthMethod, AuthSubmission } from "./auth"
import type { Contact } from "./contact"
import type { Conversation } from "./conversation"
import type { ProviderToClientEvents } from "./events"
import type { ChatMessage, OutboundMessagePayload } from "./message"
import type { TypedEmitter } from "../core/clients/typed-emitter"

export type ProviderCapabilities = {
  authMethods: AuthMethod[]
  supportsPresence?: boolean
  supportsHistory?: boolean
}

export type ProviderContext = {
  clientId: string
  providerId: string
  emitter: TypedEmitter<ProviderToClientEvents>
}

export interface ProviderAdapter {
  readonly id: string
  readonly capabilities: ProviderCapabilities

  connect(ctx: ProviderContext): Promise<void>
  disconnect(ctx: ProviderContext): Promise<void>

  listContacts(ctx: ProviderContext): Promise<Contact[]>
  listChats(ctx: ProviderContext): Promise<Conversation[]>
  loadHistory(ctx: ProviderContext, contactId: string): Promise<ChatMessage[]>
  sendMessage(ctx: ProviderContext, contactId: string, payload: OutboundMessagePayload): Promise<ChatMessage>
  editMessage?(ctx: ProviderContext, contactId: string, messageId: string, nextContent: string): Promise<boolean>
  deleteMessage?(ctx: ProviderContext, contactId: string, messageId: string): Promise<boolean>

  startAuth(ctx: ProviderContext, method?: AuthMethod): Promise<void>
  submitAuth(ctx: ProviderContext, payload: AuthSubmission): Promise<void>
  logout?(ctx: ProviderContext): Promise<void>
}
