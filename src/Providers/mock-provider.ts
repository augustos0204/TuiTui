import type { AuthMethod, AuthSubmission } from "../domain/auth"
import type { Contact } from "../domain/contact"
import type { Conversation } from "../domain/conversation"
import type { ChatMessage, OutboundMessagePayload } from "../domain/message"
import type { ProviderAdapter, ProviderCapabilities, ProviderContext } from "../domain/provider-contracts"

const mockContacts: Contact[] = [
  { id: "+55 11 98765-4321", name: "Ana Costa", status: "online", formattedId: "+55 11 98765-4321", kind: "contact" },
  { id: "+55 21 99876-1002", name: "Bruno Lima", status: "away", formattedId: "+55 21 99876-1002", kind: "contact" },
]

const mockChats: Conversation[] = [
  { id: "+55 11 98765-4321", name: "Ana Costa", status: "active", preview: "Hello from mock provider", formattedId: "+55 11 98765-4321", kind: "direct" },
  { id: "120363022222222@g.us", name: "Family Group", status: "active", preview: "Dinner at 8pm", kind: "group", membersCount: 5 },
]

function createMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function labelsForAttachments(payload: OutboundMessagePayload) {
  const attachments = payload.attachments ?? []
  return attachments.map((attachment) => ({
    id: `attachment:${attachment.id}`,
    label: attachment.kind === "unknown" ? "File" : attachment.kind[0].toUpperCase() + attachment.kind.slice(1),
  }))
}

export class MockProvider implements ProviderAdapter {
  readonly id = "mock"
  readonly capabilities: ProviderCapabilities = {
    authMethods: [],
    supportsPresence: true,
    supportsHistory: true,
  }

  async connect(ctx: ProviderContext) {
    ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "authenticated" })
    ctx.emitter.emit("auth:completed", { clientId: ctx.clientId })
  }

  async disconnect(_ctx: ProviderContext) {
    return
  }

  async listContacts(_ctx: ProviderContext) {
    return mockContacts
  }

  async listChats(_ctx: ProviderContext) {
    return mockChats
  }

  async loadHistory(ctx: ProviderContext, contactId: string) {
    const messages: ChatMessage[] = [
      {
        id: createMessageId(),
        clientId: ctx.clientId,
        contactId,
        from: "peer",
        senderId: "+55 11 98765-4321",
        senderName: "Ana Costa",
        content: "Hello from mock provider",
        contentType: "text",
        badges: [],
        timestamp: Date.now() - 1000 * 60,
        status: "read",
      },
    ]

    return messages
  }

  async sendMessage(ctx: ProviderContext, contactId: string, payload: OutboundMessagePayload) {
    const content = payload.text?.trim() ?? ""
    const attachmentBadges = labelsForAttachments(payload)
    const contentType = payload.attachments && payload.attachments.length > 0
      ? payload.attachments[0].kind
      : "text"

    const message: ChatMessage = {
      id: createMessageId(),
      clientId: ctx.clientId,
      contactId,
      from: "self",
      senderName: "You",
      replyToMessageId: payload.replyToMessageId,
      replyToSenderName: payload.replyToSenderName,
      replyPreviewText: payload.replyPreviewText,
      content,
      contentType,
      badges: attachmentBadges,
      attachments: payload.attachments ?? [],
      timestamp: Date.now(),
      status: "sent",
    }

    ctx.emitter.emit("typing:updated", {
      clientId: ctx.clientId,
      contactId,
      participantId: "+55 11 98765-4321",
      participantName: "Ana Costa",
      isTyping: true,
    })

    setTimeout(() => {
      ctx.emitter.emit("typing:updated", {
        clientId: ctx.clientId,
        contactId,
        participantId: "+55 11 98765-4321",
        participantName: "Ana Costa",
        isTyping: false,
      })

      ctx.emitter.emit("message:received", {
        clientId: ctx.clientId,
        contactId,
          message: {
            id: createMessageId(),
            clientId: ctx.clientId,
            contactId,
            from: "peer",
            senderId: "+55 11 98765-4321",
            senderName: "Ana Costa",
            content: payload.attachments?.length ? "Received your attachment" : "Mock reply received",
            contentType: "text",
            badges: [],
            timestamp: Date.now(),
            status: "delivered",
          },
      })
    }, 400)

    return message
  }

  async startAuth(ctx: ProviderContext, method?: AuthMethod) {
    void ctx
    void method
  }

  async submitAuth(ctx: ProviderContext, payload: AuthSubmission) {
    void payload
    ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "authenticated" })
    ctx.emitter.emit("auth:completed", { clientId: ctx.clientId })
  }

  async logout(ctx: ProviderContext) {
    ctx.emitter.emit("auth:logout", { clientId: ctx.clientId })
  }

  async editMessage(_ctx: ProviderContext, _contactId: string, _messageId: string, _nextContent: string) {
    return true
  }

  async deleteMessage(_ctx: ProviderContext, _contactId: string, _messageId: string) {
    return true
  }
}
