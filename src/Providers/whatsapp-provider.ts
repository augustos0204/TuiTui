import { resolve } from "node:path"
import { rm } from "node:fs/promises"
import type { AuthMethod, AuthSubmission } from "../domain/auth"
import type { Contact } from "../domain/contact"
import type { Conversation } from "../domain/conversation"
import type { ChatMessage, MessageAttachment, MessageBadge, MessageContentType, OutboundMessagePayload } from "../domain/message"
import type { ProviderAdapter, ProviderCapabilities, ProviderContext } from "../domain/provider-contracts"

const WHATSAPP_AUTH_DATA_PATH = resolve(process.cwd(), "wwebjs_auth")

function sessionDirForClient(clientId: string) {
  return resolve(WHATSAPP_AUTH_DATA_PATH, `session-${clientId}`)
}

type WhatsAppModule = {
  Client: new (options: Record<string, unknown>) => WhatsAppClientLike
  LocalAuth?: new (options?: Record<string, unknown>) => unknown
  MessageMedia?: {
    new (mimetype: string, data: string, filename?: string, filesize?: number): unknown
    fromFilePath?: (filePath: string) => unknown
  }
}

type WhatsAppClientLike = {
  on: (event: string, listener: (...args: unknown[]) => void) => void
  initialize: () => Promise<void>
  destroy?: () => Promise<void>
  logout?: () => Promise<void>
  requestPairingCode?: (phoneNumber: string, showNotification?: boolean, intervalMs?: number) => Promise<string>
  getChats?: () => Promise<unknown[]>
  getContacts?: () => Promise<unknown[]>
  getFormattedNumber?: (number: string) => Promise<string>
  getContactById?: (contactId: string) => Promise<unknown>
  getChatById?: (chatId: string) => Promise<unknown>
  getMessageById?: (messageId: string) => Promise<unknown>
  sendMessage?: (chatId: string, content: unknown, options?: Record<string, unknown>) => Promise<unknown>
}

type WhatsAppSession = {
  client: WhatsAppClientLike | null
  phoneNumber: string | null
  pairingCode: string | null
  initialized: boolean
  ready: boolean
  readyWaiters: Array<() => void>
}

type ChatLike = {
  id?: { _serialized?: string; user?: string }
  name?: string
  isGroup?: boolean
  participants?: unknown[]
  groupMetadata?: { participants?: unknown[] }
  fetchMessages?: (options?: { limit?: number }) => Promise<unknown[]>
  lastMessage?: { body?: string }
}

type ContactLike = {
  id?: { _serialized?: string; user?: string }
  name?: string
  pushname?: string
  shortName?: string
  number?: string
}

type MentionIdLike = string | { _serialized?: string; user?: string }

type MessageLike = {
  id?: { id?: string; _serialized?: string }
  from?: string
  author?: string
  body?: string
  type?: string
  timestamp?: number
  ack?: number
  fromMe?: boolean
  notifyName?: string
  _data?: { notifyName?: string; type?: string }
  mentionedIds?: MentionIdLike[]
  latestEditSenderTimestampMs?: number
  latestEditMsgKey?: unknown
  hasQuotedMsg?: boolean
  getQuotedMessage?: () => Promise<unknown>
}

type SentMessageLike = {
  hasMedia?: boolean
  type?: string
  id?: { id?: string; _serialized?: string }
}

type EditableMessageLike = {
  id?: { id?: string; _serialized?: string }
  edit?: (content: string) => Promise<unknown>
  delete?: (everyone?: boolean) => Promise<unknown>
  reply?: (content: unknown, chatId?: string, options?: Record<string, unknown>) => Promise<unknown>
}

function resolveSenderFromMessage(message: MessageLike): string {
  if (message.fromMe) {
    return "self"
  }

  return message._data?.notifyName ?? message.notifyName ?? message.author ?? message.from ?? "peer"
}

function resolveSenderName(message: MessageLike): string {
  if (message.fromMe) {
    return "You"
  }

  const name = message._data?.notifyName ?? message.notifyName
  if (name && name.trim()) {
    return name.trim()
  }

  const sender = message.author ?? message.from ?? "peer"
  return sender.replace(/@.+$/, "").replace(/^\+/, "").trim() || "Member"
}

function createMessageId() {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function resolveMessageId(message: MessageLike | SentMessageLike | null | undefined) {
  return message?.id?._serialized ?? message?.id?.id ?? createMessageId()
}

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "")
}

function toChatId(contactId: string) {
  if (contactId.includes("@")) {
    return contactId
  }

  return `${normalizePhoneNumber(contactId)}@c.us`
}

function ackToStatus(ack?: number): ChatMessage["status"] {
  if (ack === 3) return "read"
  if (ack === 2) return "delivered"
  if (ack === 1) return "sent"
  return "pending"
}

function mapWhatsAppType(rawType?: string): MessageContentType {
  switch (rawType) {
    case "chat":
      return "text"
    case "image":
      return "image"
    case "video":
    case "gif":
      return "video"
    case "audio":
      return "audio"
    case "ptt":
      return "voice"
    case "document":
      return "document"
    case "sticker":
      return "sticker"
    case "location":
    case "live_location":
      return "location"
    case "vcard":
    case "multi_vcard":
      return "contact"
    case "poll_creation":
      return "poll"
    case "revoked":
      return "text"
    case undefined:
    case "":
      return "text"
    default:
      return "unknown"
  }
}

function labelForContentType(contentType: MessageContentType): string {
  switch (contentType) {
    case "image":
      return "Image"
    case "video":
      return "Video"
    case "audio":
      return "Audio"
    case "voice":
      return "Voice"
    case "document":
      return "Document"
    case "sticker":
      return "Sticker"
    case "location":
      return "Location"
    case "contact":
      return "Contact"
    case "poll":
      return "Poll"
    case "unknown":
      return "Media"
    case "text":
      return "Text"
    default:
      return "Media"
  }
}

function createMessageBadges(contentType: MessageContentType): MessageBadge[] {
  if (contentType === "text") {
    return []
  }

  return [
    {
      id: `type:${contentType}`,
      label: labelForContentType(contentType),
    },
  ]
}

function isEditedMessage(message: MessageLike) {
  return typeof message.latestEditSenderTimestampMs === "number" && message.latestEditSenderTimestampMs > 0
}

function appendEditedBadge(badges: MessageBadge[], edited: boolean): MessageBadge[] {
  if (!edited) {
    return badges
  }

  if (badges.some((badge) => badge.id === "meta:edited")) {
    return badges
  }

  return [
    ...badges,
    {
      id: "meta:edited",
      label: "Edited",
    },
  ]
}

function appendDeletedBadge(badges: MessageBadge[]): MessageBadge[] {
  if (badges.some((badge) => badge.id === "meta:deleted")) {
    return badges
  }

  return [
    ...badges,
    {
      id: "meta:deleted",
      label: "DELETED",
    },
  ]
}

function isDeletedMessage(message: MessageLike) {
  return message.type === "revoked"
}

function labelForAttachment(attachment: MessageAttachment): string {
  switch (attachment.kind) {
    case "image":
      return "Image"
    case "video":
      return "Video"
    case "audio":
      return "Audio"
    case "document":
      return "Document"
    default:
      return "File"
  }
}

function badgesForAttachments(attachments: MessageAttachment[]): MessageBadge[] {
  return attachments.map((attachment) => ({
    id: `attachment:${attachment.id}`,
    label: labelForAttachment(attachment),
  }))
}

function buildInlineBadgeToken(type: "mention", id: string, label: string): string {
  const safeId = id.replace(/[\]|]/g, "")
  const safeLabel = label.replace(/[\]]/g, "")
  return `[[badge:v1|type=${type}|id=${safeId}|label=${safeLabel}]]`
}

function isMediaSendResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return false
  }

  const message = result as SentMessageLike
  if (typeof message.hasMedia === "boolean") {
    return message.hasMedia
  }

  if (typeof message.type === "string") {
    return message.type !== "chat"
  }

  return false
}

export class WhatsAppProvider implements ProviderAdapter {
  readonly id = "whatsapp"
  readonly capabilities: ProviderCapabilities = {
    authMethods: ["phone_number", "otp", "pairing_code"],
    supportsPresence: true,
    supportsHistory: true,
  }

  private sessions = new Map<string, WhatsAppSession>()
  private moduleCache: WhatsAppModule | null = null
  private mentionHandleCache = new Map<string, string>()
  private displayNameCache = new Map<string, string>()

  private toMentionHandle(name: string) {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")

    return `@${normalized || "contato"}`
  }

  private mentionIdToSerialized(mentionId: MentionIdLike) {
    if (typeof mentionId === "string") {
      return mentionId
    }

    return mentionId._serialized ?? `${mentionId.user ?? ""}@c.us`
  }

  private extractMentionIds(message: MessageLike) {
    const ids = message.mentionedIds ?? []
    return ids
      .map((mentionId) => this.mentionIdToSerialized(mentionId))
      .filter((value) => value.length > 0)
  }

  private async resolveMentionHandle(client: WhatsAppClientLike, mentionId: string) {
    const cached = this.mentionHandleCache.get(mentionId)
    if (cached) {
      return cached
    }

    const fallbackNumber = mentionId.split("@")[0]

    let baseName = fallbackNumber
    if (client.getContactById) {
      try {
        const contact = (await client.getContactById(mentionId)) as ContactLike
        baseName = contact.pushname ?? contact.name ?? contact.shortName ?? contact.number ?? fallbackNumber
      } catch {
        baseName = fallbackNumber
      }
    }

    const handle = this.toMentionHandle(baseName)
    this.mentionHandleCache.set(mentionId, handle)
    return handle
  }

  private async resolveDisplayName(
    client: WhatsAppClientLike,
    serializedId: string,
    fallback: string,
    allowLookup = true,
  ) {
    const cached = this.displayNameCache.get(serializedId)
    if (cached) {
      return cached
    }

    let resolved = fallback
    if (allowLookup && client.getContactById) {
      try {
        const contact = (await client.getContactById(serializedId)) as ContactLike
        resolved = contact.name ?? contact.pushname ?? contact.shortName ?? contact.number ?? fallback
      } catch {
        resolved = fallback
      }
    }

    const finalName = resolved.trim() || fallback
    this.displayNameCache.set(serializedId, finalName)
    return finalName
  }

  private async normalizeMessageContent(client: WhatsAppClientLike, message: MessageLike) {
    const rawContent = message.body ?? ""
    const mentionIds = this.extractMentionIds(message)
    if (mentionIds.length === 0) {
      return rawContent
    }

    let content = rawContent
    for (const mentionId of mentionIds) {
      const number = mentionId.split("@")[0]
      const handle = await this.resolveMentionHandle(client, mentionId)
      const token = buildInlineBadgeToken("mention", mentionId, handle)
      content = content.split(`@${number}`).join(token)
    }

    return content
  }

  private async resolveSenderName(client: WhatsAppClientLike, message: MessageLike) {
    if (message.fromMe) {
      return "You"
    }

    const senderId = message.author ?? message.from
    const notifyName = message._data?.notifyName ?? message.notifyName
    const normalizedNotifyName = notifyName?.trim() ?? ""

    if (!senderId) {
      return normalizedNotifyName || "Member"
    }

    const fallbackFromId = senderId.replace(/@.+$/, "").replace(/^\+/, "").trim() || "Member"
    const fallbackName = normalizedNotifyName || fallbackFromId

    const resolvedName = await this.resolveDisplayName(client, senderId, fallbackName)
    if (resolvedName.trim()) {
      return resolvedName
    }

    if (normalizedNotifyName) {
      return normalizedNotifyName
    }

    return fallbackFromId
  }

  private async resolveReplyMetadata(client: WhatsAppClientLike, message: MessageLike) {
    if (!message.hasQuotedMsg || !message.getQuotedMessage) {
      return {}
    }

    const quoted = (await message.getQuotedMessage().catch(() => null)) as MessageLike | null
    if (!quoted) {
      return {}
    }

    const replyToMessageId = resolveMessageId(quoted)
    const replyToSenderName = await this.resolveSenderName(client, quoted)
    const quotedContent = await this.normalizeMessageContent(client, quoted)

    return {
      replyToMessageId,
      replyToSenderName,
      replyPreviewText: quotedContent.trim() || "Mensagem original",
    }
  }

  private async loadModule(): Promise<WhatsAppModule> {
    if (this.moduleCache) {
      return this.moduleCache
    }

    const moduleName = "whatsapp-web.js"
    const imported = (await import(moduleName)) as unknown as Record<string, unknown>
    const normalized = ((imported.default as Record<string, unknown> | undefined) ?? imported) as unknown as WhatsAppModule
    this.moduleCache = normalized
    return normalized
  }

  private getSession(clientId: string): WhatsAppSession {
    const existing = this.sessions.get(clientId)
    if (existing) {
      return existing
    }

    const created: WhatsAppSession = {
      client: null,
      phoneNumber: null,
      pairingCode: null,
      initialized: false,
      ready: false,
      readyWaiters: [],
    }
    this.sessions.set(clientId, created)
    return created
  }

  private resolveReady(session: WhatsAppSession) {
    session.ready = true
    const waiters = [...session.readyWaiters]
    session.readyWaiters = []
    for (const resolve of waiters) {
      resolve()
    }
  }

  private async waitForReady(ctx: ProviderContext, session: WhatsAppSession, timeoutMs = 20000) {
    if (session.ready) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WhatsApp client is not ready yet"))
      }, timeoutMs)

      session.readyWaiters.push(() => {
        clearTimeout(timeout)
        resolve()
      })
    }).catch((error) => {
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message: error instanceof Error ? error.message : "WhatsApp not ready",
      })
      throw error
    })
  }

  private async findMessageById(client: WhatsAppClientLike, chatId: string, messageId: string): Promise<EditableMessageLike | null> {
    if (client.getMessageById) {
      const direct = (await client.getMessageById(messageId).catch(() => null)) as EditableMessageLike | null
      if (direct) {
        return direct
      }
    }

    if (!client.getChatById) {
      return null
    }

    const chat = (await client.getChatById(chatId).catch(() => null)) as ChatLike | null
    if (!chat?.fetchMessages) {
      return null
    }

    const recentMessages = (await chat.fetchMessages({ limit: 200 }).catch(() => [])) as EditableMessageLike[]
    const matched = recentMessages.find((message) => {
      const serialized = message.id?._serialized
      const rawId = message.id?.id
      return serialized === messageId || rawId === messageId
    })

    return matched ?? null
  }

  private async resolveQuotedMessageId(client: WhatsAppClientLike, chatId: string, quotedMessageId?: string) {
    if (!quotedMessageId) {
      return undefined
    }

    if (quotedMessageId.includes("_") && quotedMessageId.includes("@")) {
      const foundSerialized = await this.findMessageById(client, chatId, quotedMessageId)
      if (!foundSerialized) {
        throw new Error("Mensagem de resposta não encontrada")
      }

      return quotedMessageId
    }

    const matchedMessage = await this.findMessageById(client, chatId, quotedMessageId)
    if (!matchedMessage?.id?._serialized) {
      throw new Error("Mensagem de resposta não encontrada")
    }

    return matchedMessage.id._serialized
  }

  private registerEvents(ctx: ProviderContext, client: WhatsAppClientLike, session: WhatsAppSession) {
    client.on("ready", () => {
      this.resolveReady(session)
      ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "authenticated" })
      ctx.emitter.emit("auth:completed", { clientId: ctx.clientId })
    })

    client.on("authenticated", () => {
      ctx.emitter.emit("auth:waiting", {
        clientId: ctx.clientId,
        message: "Authenticated. Preparing WhatsApp data",
      })
    })

    client.on("auth_failure", (message) => {
      session.ready = false
      ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "failed" })
      ctx.emitter.emit("auth:error", {
        clientId: ctx.clientId,
        message: typeof message === "string" ? message : "Authentication failed",
      })
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message: typeof message === "string" ? message : "Authentication failed",
      })
    })

    client.on("disconnected", (reason) => {
      session.ready = false
      const message = `WhatsApp disconnected: ${typeof reason === "string" ? reason : "unknown reason"}`
      ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "failed" })
      ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message })
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message,
      })
    })

    client.on("change_state", (state) => {
      const stateValue = typeof state === "string" ? state : "UNKNOWN"
      if (stateValue === "UNPAIRED" || stateValue === "UNPAIRED_IDLE") {
        session.ready = false
        ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "pending" })
        if (!session.phoneNumber) {
          ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
          ctx.emitter.emit("auth:prompt", {
            clientId: ctx.clientId,
            prompt: {
              type: "phone_number",
              label: "WhatsApp phone",
              placeholder: "5511999999999",
            },
          })
        }
      }
    })

    client.on("error", (error) => {
      session.ready = false
      const message = error instanceof Error ? error.message : String(error)
      ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "failed" })
      ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message })
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message,
      })
    })

    client.on("code", (code) => {
      session.ready = false
      const pairingCode = typeof code === "string" ? code : ""
      session.pairingCode = pairingCode
      ctx.emitter.emit("auth:waiting", {
        clientId: ctx.clientId,
        message: "Pairing code received. Enter it on WhatsApp mobile",
      })
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "pending" })
      ctx.emitter.emit("auth:prompt", {
        clientId: ctx.clientId,
        prompt: {
          type: "otp",
          code: pairingCode,
          label: "WhatsApp pairing code",
          inputRequired: false,
        },
      })
    })

    client.on("message", (rawMessage) => {
      void (async () => {
        const message = rawMessage as MessageLike
        if (message.fromMe) {
          return
        }

        const contactId = message.from ?? "unknown"
        const content = await this.normalizeMessageContent(client, message)
        const senderName = await this.resolveSenderName(client, message)
        const replyMetadata = await this.resolveReplyMetadata(client, message)
        const contentType = mapWhatsAppType(message.type ?? message._data?.type)
        const deleted = isDeletedMessage(message)
        const resolvedContent = deleted ? (content.trim() || "Mensagem deletada") : content
        const editedBadges = appendEditedBadge(createMessageBadges(contentType), isEditedMessage(message))
        const badges = deleted ? appendDeletedBadge(editedBadges) : editedBadges

        const chatMessage: ChatMessage = {
          id: resolveMessageId(message),
          clientId: ctx.clientId,
          contactId,
          from: resolveSenderFromMessage(message),
          senderId: message.author ?? message.from,
          senderName,
          ...replyMetadata,
          content: resolvedContent,
          contentType,
          badges,
          timestamp: typeof message.timestamp === "number" ? message.timestamp * 1000 : Date.now(),
          status: ackToStatus(message.ack),
        }

        ctx.emitter.emit("message:received", {
          clientId: ctx.clientId,
          contactId,
          message: chatMessage,
        })
      })()
    })

    const handleRevokedMessage = (rawMessage: unknown) => {
      const message = rawMessage as MessageLike
      const contactId = message.from ?? "unknown"
      const content = (message.body?.trim() ?? "") || "Mensagem deletada"
      const contentType = mapWhatsAppType(message.type ?? message._data?.type)
      const badges = appendDeletedBadge(createMessageBadges(contentType))

      const chatMessage: ChatMessage = {
        id: resolveMessageId(message),
        clientId: ctx.clientId,
        contactId,
        from: resolveSenderFromMessage(message),
        senderId: message.author ?? message.from,
        senderName: resolveSenderName(message),
        content,
        contentType,
        badges,
        timestamp: typeof message.timestamp === "number" ? message.timestamp * 1000 : Date.now(),
        status: ackToStatus(message.ack),
      }

      ctx.emitter.emit("message:received", {
        clientId: ctx.clientId,
        contactId,
        message: chatMessage,
      })
    }

    client.on("message_revoke_everyone", (currentMessage, revokedMessage) => {
      handleRevokedMessage((revokedMessage as unknown) ?? (currentMessage as unknown))
    })

    client.on("message_revoke_me", (message) => {
      handleRevokedMessage(message as unknown)
    })

    client.on("loading_screen", (percent) => {
      const progress = typeof percent === "number" ? `${percent}%` : "..."
      ctx.emitter.emit("auth:waiting", {
        clientId: ctx.clientId,
        message: `Syncing WhatsApp session ${progress}`,
      })
    })
  }

  private async ensureClient(ctx: ProviderContext): Promise<WhatsAppClientLike> {
    const session = this.getSession(ctx.clientId)
    if (session.client && session.initialized) {
      return session.client
    }

    const module = await this.loadModule()

    const options: Record<string, unknown> = {
      puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    }

    if (session.phoneNumber) {
      options.pairWithPhoneNumber = {
        phoneNumber: session.phoneNumber,
        showNotification: true,
        intervalMs: 180000,
      }
    }

    if (module.LocalAuth) {
      options.authStrategy = new module.LocalAuth({
        clientId: ctx.clientId
      })
    }

    const client = new module.Client(options)
    session.ready = false
    session.readyWaiters = []
    this.registerEvents(ctx, client, session)
    await client.initialize()

    session.client = client
    session.initialized = true
    return client
  }

  private async clearStoredSession(clientId: string) {
    const sessionDir = sessionDirForClient(clientId)
    try {
      await rm(sessionDir, { recursive: true, force: true })
    } catch {
      return
    }
  }

  async connect(ctx: ProviderContext) {
    const session = this.getSession(ctx.clientId)

    if (session.client?.destroy) {
      await session.client.destroy()
    }

    session.client = null
    session.initialized = false
    session.ready = false
    session.readyWaiters = []
    session.phoneNumber = null
    session.pairingCode = null

    await this.clearStoredSession(ctx.clientId)

    ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "pending" })
    ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: null })
    ctx.emitter.emit("auth:prompt", {
      clientId: ctx.clientId,
      prompt: {
        type: "phone_number",
        label: "WhatsApp phone",
        placeholder: "5511999999999",
      },
    })
  }

  async disconnect(ctx: ProviderContext) {
    const session = this.getSession(ctx.clientId)
    if (session.client?.destroy) {
      await session.client.destroy()
    }

    session.client = null
    session.initialized = false
    session.ready = false
    session.readyWaiters = []
  }

  async listContacts(ctx: ProviderContext) {
    try {
      const session = this.getSession(ctx.clientId)
      const client = await this.ensureClient(ctx)
      await this.waitForReady(ctx, session)
      const contacts = (await client.getContacts?.()) ?? []

      const mappedContacts = await Promise.all(
        contacts
          .map((contact) => contact as ContactLike)
          .slice(0, 300)
          .map(async (contact) => {
            const id = contact.id?._serialized ?? `${contact.number ?? contact.id?.user ?? "unknown"}@c.us`
            const fallbackName = contact.name ?? contact.pushname ?? contact.shortName ?? contact.number ?? contact.id?.user ?? "Unknown"
            const resolvedName = await this.resolveDisplayName(client, id, fallbackName, false)
            let formattedId: string | undefined
            if (client.getFormattedNumber) {
              try {
                formattedId = await client.getFormattedNumber(id)
              } catch {
                formattedId = contact.number ?? contact.id?.user
              }
            }

            return {
              id,
              name: resolvedName,
              status: "available",
              formattedId,
              kind: "contact" as const,
            } satisfies Contact
          }),
      )

      return mappedContacts
    } catch (error) {
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message: error instanceof Error ? error.message : "Failed to load WhatsApp contacts",
      })
      return []
    }
  }

  async listChats(ctx: ProviderContext) {
    try {
      const session = this.getSession(ctx.clientId)
      const client = await this.ensureClient(ctx)
      await this.waitForReady(ctx, session)
      const chats = (await client.getChats?.()) ?? []

      const mappedChats = await Promise.all(
        chats
          .map((chat) => chat as ChatLike)
          .slice(0, 200)
          .map(async (chat) => {
            const id = chat.id?._serialized ?? chat.id?.user ?? "unknown@c.us"
            const isGroup = chat.isGroup === true || id.endsWith("@g.us")
            const fallbackName = chat.name ?? chat.id?.user ?? "Unknown"
            const resolvedName = isGroup ? fallbackName : await this.resolveDisplayName(client, id, fallbackName, false)
            let formattedId: string | undefined
            if (!isGroup && client.getFormattedNumber) {
              try {
                formattedId = await client.getFormattedNumber(id)
              } catch {
                formattedId = chat.id?.user
              }
            }

            const membersCount = isGroup
              ? chat.groupMetadata?.participants?.length ?? chat.participants?.length
              : undefined

            return {
              id,
              name: resolvedName,
              status: "active",
              preview: chat.lastMessage?.body ?? "No messages yet",
              formattedId,
              kind: isGroup ? "group" : "direct",
              membersCount,
            } satisfies Conversation
          }),
      )

      return mappedChats
    } catch (error) {
      ctx.emitter.emit("client:error", {
        clientId: ctx.clientId,
        providerId: ctx.providerId,
        message: error instanceof Error ? error.message : "Failed to load WhatsApp chats",
      })
      return []
    }
  }

  async loadHistory(ctx: ProviderContext, contactId: string) {
    const session = this.getSession(ctx.clientId)
    const client = await this.ensureClient(ctx)
    await this.waitForReady(ctx, session)
    const chatId = toChatId(contactId)
    const chat = (await client.getChatById?.(chatId)) as ChatLike | undefined
    const rawMessages = (await chat?.fetchMessages?.({ limit: 60 })) ?? []

      const mappedMessages = await Promise.all(rawMessages.map(async (rawMessage) => {
      const message = rawMessage as MessageLike
      const content = await this.normalizeMessageContent(client, message)
      const senderName = await this.resolveSenderName(client, message)
      const replyMetadata = await this.resolveReplyMetadata(client, message)
      const contentType = mapWhatsAppType(message.type ?? message._data?.type)
      const deleted = isDeletedMessage(message)
      const resolvedContent = deleted ? (content.trim() || "Mensagem deletada") : content
      const editedBadges = appendEditedBadge(createMessageBadges(contentType), isEditedMessage(message))
      const badges = deleted ? appendDeletedBadge(editedBadges) : editedBadges
      const mapped: ChatMessage = {
        id: resolveMessageId(message),
        clientId: ctx.clientId,
        contactId: chatId,
        from: resolveSenderFromMessage(message),
        senderId: message.author ?? message.from,
        senderName,
        ...replyMetadata,
        content: resolvedContent,
        contentType,
        badges,
        timestamp: typeof message.timestamp === "number" ? message.timestamp * 1000 : Date.now(),
        status: ackToStatus(message.ack),
      }
      return mapped
    }))

    return mappedMessages
  }

  async sendMessage(ctx: ProviderContext, contactId: string, payload: OutboundMessagePayload) {
    const session = this.getSession(ctx.clientId)
    const client = await this.ensureClient(ctx)
    await this.waitForReady(ctx, session)
    const chatId = toChatId(contactId)
    const text = payload.text?.trim() ?? ""
    const attachments = payload.attachments ?? []
    const quotedMessageId = await this.resolveQuotedMessageId(client, chatId, payload.replyToMessageId)
    const quotedTarget = quotedMessageId
      ? await this.findMessageById(client, chatId, quotedMessageId)
      : null

    if (payload.replyToMessageId && !quotedTarget) {
      throw new Error("Mensagem de resposta não encontrada")
    }
    let textSentWithMedia = false
    let sentMessage: SentMessageLike | null = null

    if (attachments.length > 0) {
      const module = await this.loadModule()
      if (!module.MessageMedia || !client.sendMessage) {
        throw new Error("WhatsApp media upload is unavailable")
      }
      const messageMedia = module.MessageMedia

      const mediaPayloads = attachments
        .map((attachment) => {
          if (attachment.dataBase64 && attachment.dataBase64.length > 0) {
            return {
              attachment,
              media: new messageMedia(
                attachment.mimeType,
                attachment.dataBase64,
                attachment.fileName,
                attachment.sizeBytes,
              ),
            }
          }

          if (attachment.filePath && messageMedia.fromFilePath) {
            return {
              attachment,
              media: messageMedia.fromFilePath(attachment.filePath),
            }
          }

          return null
        })
        .filter((item): item is { attachment: MessageAttachment; media: unknown } => item !== null)

      for (let index = 0; index < mediaPayloads.length; index += 1) {
        const mediaPayload = mediaPayloads[index]
        if (!client.sendMessage) {
          continue
        }

        const shouldUseCaption = text.length > 0 && index === 0
        if (shouldUseCaption) {
          try {
            const sendResult = quotedTarget?.reply
              ? await quotedTarget.reply(text, chatId, { media: mediaPayload.media, quotedMessageId })
              : await client.sendMessage(chatId, text, {
                media: mediaPayload.media,
                quotedMessageId,
                ignoreQuoteErrors: false,
              })
            const mediaWasSent = isMediaSendResult(sendResult)
            if (!mediaWasSent) {
              const mediaResult = await client.sendMessage(chatId, mediaPayload.media, { quotedMessageId })
              sentMessage = (mediaResult ?? null) as SentMessageLike | null
            } else {
              sentMessage = (sendResult ?? null) as SentMessageLike | null
            }
            textSentWithMedia = mediaWasSent
            continue
          } catch {
            const mediaResult = await client.sendMessage(chatId, mediaPayload.media, { quotedMessageId })
            sentMessage = (mediaResult ?? null) as SentMessageLike | null
            continue
          }
        }

        const mediaResult = await client.sendMessage(chatId, mediaPayload.media, { quotedMessageId })
        sentMessage = (mediaResult ?? null) as SentMessageLike | null
      }
    }

    if (text.length > 0 && !textSentWithMedia) {
      if (quotedTarget?.reply) {
        const replyResult = await quotedTarget.reply(text, chatId, { quotedMessageId })
        sentMessage = (replyResult ?? null) as SentMessageLike | null
      } else {
        const textResult = await client.sendMessage?.(chatId, text, {
          quotedMessageId,
          ignoreQuoteErrors: quotedMessageId ? false : undefined,
        })
        sentMessage = (textResult ?? null) as SentMessageLike | null
      }
    }

    const attachmentBadges = badgesForAttachments(attachments)
    const firstAttachmentKind = attachments.length > 0 ? attachments[0].kind : undefined
    const contentType: MessageContentType = firstAttachmentKind ?? "text"

    return {
      id: resolveMessageId(sentMessage),
      clientId: ctx.clientId,
      contactId: chatId,
      from: "self",
      senderName: "You",
      replyToMessageId: payload.replyToMessageId,
      replyToSenderName: payload.replyToSenderName,
      replyPreviewText: payload.replyPreviewText,
      content: text,
      contentType,
      badges: attachmentBadges,
      attachments,
      timestamp: Date.now(),
      status: "sent",
    } satisfies ChatMessage
  }

  async editMessage(ctx: ProviderContext, contactId: string, messageId: string, nextContent: string) {
    const session = this.getSession(ctx.clientId)
    const client = await this.ensureClient(ctx)
    await this.waitForReady(ctx, session)

    const editable = await this.findMessageById(client, toChatId(contactId), messageId)
    if (!editable?.edit) {
      return false
    }

    const result = await editable.edit(nextContent).catch(() => null)
    return result !== null
  }

  async deleteMessage(ctx: ProviderContext, contactId: string, messageId: string) {
    const session = this.getSession(ctx.clientId)
    const client = await this.ensureClient(ctx)
    await this.waitForReady(ctx, session)

    const deletable = await this.findMessageById(client, toChatId(contactId), messageId)
    if (!deletable?.delete) {
      return false
    }

    await deletable.delete(true).catch(() => {
      return deletable.delete?.(false)
    })
    return true
  }

  async startAuth(ctx: ProviderContext, method?: AuthMethod) {
    const session = this.getSession(ctx.clientId)

    if (!method || method === "phone_number") {
      ctx.emitter.emit("auth:prompt", {
        clientId: ctx.clientId,
        prompt: {
          type: "phone_number",
          label: "WhatsApp phone",
          placeholder: "5511999999999",
        },
      })
      return
    }

    if ((method === "otp" || method === "pairing_code") && !session.phoneNumber) {
      ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message: "Phone number required first" })
      return
    }

    if (method === "otp" || method === "pairing_code") {
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "pending" })

      try {
        await this.ensureClient(ctx)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize WhatsApp client"
        ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "failed" })
        ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message })
        ctx.emitter.emit("client:error", {
          clientId: ctx.clientId,
          providerId: ctx.providerId,
          message,
        })
        throw error
      }
    }
  }

  async submitAuth(ctx: ProviderContext, payload: AuthSubmission) {
    const session = this.getSession(ctx.clientId)

    if (payload.type === "phone_number") {
      const normalized = normalizePhoneNumber(payload.value)
      if (normalized.length < 10) {
        ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "failed" })
        ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message: "Invalid phone number" })
        return
      }

      session.phoneNumber = normalized
      session.pairingCode = null
      ctx.emitter.emit("auth:status", { clientId: ctx.clientId, status: "pending" })
      ctx.emitter.emit("auth:waiting", { clientId: ctx.clientId, message: "Initializing WhatsApp pairing" })

      await this.startAuth(ctx, "pairing_code")
      return
    }

    if (payload.type === "otp" || payload.type === "pairing_code") {
      ctx.emitter.emit("auth:error", {
        clientId: ctx.clientId,
        message: "Pairing code is display-only. Enter it on WhatsApp mobile.",
      })
      return
    }

    ctx.emitter.emit("auth:error", { clientId: ctx.clientId, message: "Unsupported auth payload for WhatsApp" })
  }

  async logout(ctx: ProviderContext) {
    const session = this.getSession(ctx.clientId)
    if (session.client?.logout) {
      await session.client.logout()
    }

    session.phoneNumber = null
    session.pairingCode = null
    ctx.emitter.emit("auth:logout", { clientId: ctx.clientId })
  }
}
