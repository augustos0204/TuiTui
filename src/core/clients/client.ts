import type { AuthMethod, AuthSubmission } from "../../domain/auth"
import type { Conversation } from "../../domain/conversation"
import type { ProviderToClientEvents } from "../../domain/events"
import type { OutboundMessagePayload } from "../../domain/message"
import type { ProviderAdapter, ProviderContext } from "../../domain/provider-contracts"
import { TypedEmitter } from "./typed-emitter"

type ClientConfig = {
  clientId: string
  adapter: ProviderAdapter
}

export class Client {
  readonly id: string
  readonly providerId: string
  readonly adapter: ProviderAdapter
  readonly emitter: TypedEmitter<ProviderToClientEvents>

  private readonly context: ProviderContext

  constructor(config: ClientConfig) {
    this.id = config.clientId
    this.adapter = config.adapter
    this.providerId = config.adapter.id
    this.emitter = new TypedEmitter<ProviderToClientEvents>()
    this.context = {
      clientId: this.id,
      providerId: this.providerId,
      emitter: this.emitter,
    }
  }

  async connect() {
    try {
      await this.adapter.connect(this.context)
      this.emitter.emit("client:connected", { clientId: this.id, providerId: this.providerId })
    } catch (error) {
      this.emitter.emit("client:error", {
        clientId: this.id,
        providerId: this.providerId,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async disconnect() {
    try {
      await this.adapter.disconnect(this.context)
    } finally {
      this.emitter.emit("client:disconnected", { clientId: this.id, providerId: this.providerId })
    }
  }

  async listContacts() {
    const contacts = await this.adapter.listContacts(this.context)
    this.emitter.emit("contacts:updated", { clientId: this.id, contacts })
    return contacts
  }

  async listChats(): Promise<Conversation[]> {
    const chats = await this.adapter.listChats(this.context)
    this.emitter.emit("chats:updated", { clientId: this.id, chats })
    return chats
  }

  async loadHistory(contactId: string) {
    const messages = await this.adapter.loadHistory(this.context, contactId)
    this.emitter.emit("chat:history", { clientId: this.id, contactId, messages })
    return messages
  }

  async sendMessage(contactId: string, payload: OutboundMessagePayload) {
    const message = await this.adapter.sendMessage(this.context, contactId, payload)
    this.emitter.emit("message:sent", { clientId: this.id, contactId, message })
    return message
  }

  async editMessage(contactId: string, messageId: string, nextContent: string) {
    if (!this.adapter.editMessage) {
      return false
    }

    return this.adapter.editMessage(this.context, contactId, messageId, nextContent)
  }

  async deleteMessage(contactId: string, messageId: string) {
    if (!this.adapter.deleteMessage) {
      return false
    }

    return this.adapter.deleteMessage(this.context, contactId, messageId)
  }

  async startAuth(method?: AuthMethod) {
    await this.adapter.startAuth(this.context, method)
  }

  async submitAuth(payload: AuthSubmission) {
    await this.adapter.submitAuth(this.context, payload)
  }

  async logout() {
    if (this.adapter.logout) {
      await this.adapter.logout(this.context)
    }
    this.emitter.emit("auth:logout", { clientId: this.id })
  }

  destroy() {
    this.emitter.removeAllListeners()
  }
}
