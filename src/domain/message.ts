export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed"

export type MessageContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "poll"
  | "unknown"

export type MessageBadge = {
  id: string
  label: string
}

export type MessageAttachmentKind = "image" | "video" | "audio" | "document" | "unknown"

export type MessageAttachment = {
  id: string
  kind: MessageAttachmentKind
  fileName: string
  mimeType: string
  sizeBytes: number
  dataBase64?: string
  filePath?: string
}

export type OutboundMessagePayload = {
  text?: string
  attachments?: MessageAttachment[]
  replyToMessageId?: string
  replyToSenderName?: string
  replyPreviewText?: string
}

export type ChatMessage = {
  id: string
  clientId: string
  contactId: string
  from: "self" | "peer" | string
  senderId?: string
  senderName?: string
  replyToMessageId?: string
  replyToSenderName?: string
  replyPreviewText?: string
  content: string
  contentType?: MessageContentType
  badges?: MessageBadge[]
  attachments?: MessageAttachment[]
  timestamp: number
  status?: MessageStatus
}
