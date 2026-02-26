import type { AuthMethod, AuthPrompt, AuthStatus, AuthSubmission } from "./auth"
import type { Contact } from "./contact"
import type { Conversation } from "./conversation"
import type { ChatMessage, OutboundMessagePayload } from "./message"

export type ProviderToClientEvents = {
  "client:connected": { clientId: string; providerId: string }
  "client:disconnected": { clientId: string; providerId: string }
  "client:error": { clientId: string; providerId: string; message: string }

  "contacts:updated": { clientId: string; contacts: Contact[] }
  "chats:updated": { clientId: string; chats: Conversation[] }
  "chat:history": { clientId: string; contactId: string; messages: ChatMessage[] }
  "message:sent": { clientId: string; contactId: string; message: ChatMessage }
  "message:received": { clientId: string; contactId: string; message: ChatMessage }
  "typing:updated": {
    clientId: string
    contactId: string
    participantId?: string
    participantName?: string
    isTyping: boolean
  }
  "presence:updated": { clientId: string; contactId: string; status: string }

  "auth:status": { clientId: string; status: AuthStatus }
  "auth:waiting": { clientId: string; message: string | null }
  "auth:prompt": { clientId: string; prompt: AuthPrompt }
  "auth:error": { clientId: string; message: string }
  "auth:completed": { clientId: string }
  "auth:logout": { clientId: string }
}

export type ClientToProviderCommands = {
  "client:connect": { clientId: string }
  "client:disconnect": { clientId: string }
  "contacts:list": { clientId: string }
  "chat:history:load": { clientId: string; contactId: string }
  "message:send": { clientId: string; contactId: string; payload: OutboundMessagePayload }
  "auth:start": { clientId: string; method?: AuthMethod }
  "auth:submit": { clientId: string; payload: AuthSubmission }
  "auth:logout": { clientId: string }
}
