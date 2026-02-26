import type { TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useClients } from "../../clients/context"
import { readClipboardFile } from "../../core/clipboard/read-clipboard-file"
import { useContactSelection } from "../../contacts/context"
import type { ChatMessage, MessageAttachment, MessageContentType } from "../../domain/message"
import { useContextualShortcuts } from "../../keybind/contextual-shortcuts"
import type { PageProps } from "../../router/types"
import type { AppColors } from "../../theme/colors"
import { useAppColors } from "../../theme/context"
import { useChatCommander } from "./commander"

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusIcon(status: ChatMessage["status"]): string {
  switch (status) {
    case "pending":
      return "○"
    case "sent":
      return "✓"
    case "delivered":
      return "✓✓"
    case "read":
      return "✓✓"
    case "failed":
      return "!"
    default:
      return "○"
  }
}

function statusColor(status: ChatMessage["status"], colors: AppColors) {
  switch (status) {
    case "failed":
      return colors.logger.error
    case "read":
      return colors.secondary
    default:
      return colors.textMuted
  }
}

function badgePalette(type: MessageContentType | undefined, colors: AppColors) {
  switch (type) {
    case "image":
      return { bg: "#3a2a10", fg: "#ffd166" }
    case "video":
      return { bg: "#2c1730", fg: "#f9a8ff" }
    case "audio":
    case "voice":
      return { bg: "#132f2b", fg: "#77e0ce" }
    case "document":
      return { bg: "#1f2d46", fg: "#a6c8ff" }
    case "sticker":
      return { bg: "#3b1f2d", fg: "#ffb3cc" }
    case "location":
      return { bg: "#2f2a10", fg: "#f8e58f" }
    case "contact":
      return { bg: "#1f3a2c", fg: "#b6f0c6" }
    case "poll":
      return { bg: "#302514", fg: "#ffcf8b" }
    case "unknown":
      return { bg: "#3a2424", fg: "#ffd6d6" }
    default:
      return { bg: colors.surfaceFocus, fg: colors.textMuted }
  }
}

type InlineBadgeToken = {
  version: "v1"
  type: "mention"
  id: string
  label: string
}

type InlineMessagePart =
  | { kind: "text"; value: string }
  | { kind: "badge"; token: InlineBadgeToken }

const INLINE_BADGE_TOKEN_REGEX = /\[\[badge:v1\|type=([^|\]]+)\|id=([^|\]]+)\|label=([^\]]+)\]\]/g

function parseInlineBadgeText(text: string): InlineMessagePart[] {
  if (!text.includes("[[badge:v1|")) {
    return [{ kind: "text", value: text }]
  }

  INLINE_BADGE_TOKEN_REGEX.lastIndex = 0
  const parts: InlineMessagePart[] = []
  let cursor = 0
  let match = INLINE_BADGE_TOKEN_REGEX.exec(text)

  while (match) {
    const [raw, type, id, label] = match
    const start = match.index
    if (start > cursor) {
      parts.push({ kind: "text", value: text.slice(cursor, start) })
    }

    if (type === "mention") {
      parts.push({
        kind: "badge",
        token: {
          version: "v1",
          type: "mention",
          id,
          label,
        },
      })
    } else {
      parts.push({ kind: "text", value: raw })
    }

    cursor = start + raw.length
    match = INLINE_BADGE_TOKEN_REGEX.exec(text)
  }

  if (cursor < text.length) {
    parts.push({ kind: "text", value: text.slice(cursor) })
  }

  return parts.length > 0 ? parts : [{ kind: "text", value: text }]
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

function mentionBadgePalette(mentionId: string) {
  const palette = [
    { bg: "#3b1f33", fg: "#ffc9e9" },
    { bg: "#1f2f46", fg: "#b7d7ff" },
    { bg: "#18352a", fg: "#baf0d1" },
    { bg: "#3a2a10", fg: "#ffe3a3" },
    { bg: "#2f2142", fg: "#d7c2ff" },
  ]

  const index = hashString(mentionId) % palette.length
  return palette[index]
}

function renderInlineContent(message: ChatMessage, colors: AppColors) {
  const lines = message.content.split("\n")

  return lines.map((line, lineIndex) => {
    const parts = parseInlineBadgeText(line)

    return (
      <box key={`${message.id}:line:${lineIndex}`} width="100%" flexDirection="row" gap={0}>
        {parts.map((part, partIndex) => {
          if (part.kind === "text") {
            if (part.value.length === 0) {
              return null
            }

            return (
              <text key={`${message.id}:text:${lineIndex}:${partIndex}`} fg={colors.text} wrapMode="word" truncate={false}>
                {part.value}
              </text>
            )
          }

          const palette = mentionBadgePalette(part.token.id)
          return (
            <box key={`${message.id}:badge:${lineIndex}:${partIndex}`} backgroundColor={palette.bg}>
              <text fg={palette.fg}>{` ${part.token.label} `}</text>
            </box>
          )
        })}
      </box>
    )
  })
}

export default function ChatPage({ navigation }: PageProps) {
  const colors = useAppColors()
  const {
    activeClient,
    getActiveMessagesForContact,
    getActiveTypingNamesForContact,
    sendActiveMessage,
    editActiveMessage,
    deleteActiveMessage,
  } = useClients()
  const { setShortcuts: setContextualShortcuts } = useContextualShortcuts()
  const { selectedContact } = useContactSelection()
  const composerRef = useRef<TextareaRenderable | null>(null)
  const editingMessageIdRef = useRef<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([])
  const [composerStatus, setComposerStatus] = useState("Press ENTER to send")
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null)

  const messages = useMemo(
    () => getActiveMessagesForContact(selectedContact?.id ?? null),
    [getActiveMessagesForContact, selectedContact?.id],
  )

  const typingNames = useMemo(
    () => getActiveTypingNamesForContact(selectedContact?.id ?? null),
    [getActiveTypingNamesForContact, selectedContact?.id],
  )

  const typingIndicatorText = useMemo(() => {
    if (typingNames.length === 0) {
      return null
    }

    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`
    }

    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing...`
    }

    const previewNames = typingNames.slice(0, 2).join(", ")
    return `${previewNames} and ${typingNames.length - 2} more are typing...`
  }, [typingNames])

  const editingMessage = useMemo(
    () => (editingMessageId ? messages.find((message) => message.id === editingMessageId) ?? null : null),
    [editingMessageId, messages],
  )

  const replyingMessage = useMemo(
    () => (replyingToMessageId ? messages.find((message) => message.id === replyingToMessageId) ?? null : null),
    [messages, replyingToMessageId],
  )

  const selectedMessage = selectedMessageIndex !== null ? messages[selectedMessageIndex] ?? null : null


  useEffect(() => {
    setSelectedMessageIndex(null)
    setEditingMessageId(null)
    setReplyingToMessageId(null)
    editingMessageIdRef.current = null
    setComposerStatus("Press ENTER to send")
  }, [selectedContact?.id])

  useEffect(() => {
    if (selectedMessageIndex === null) {
      return
    }

    if (selectedMessageIndex >= messages.length) {
      setSelectedMessageIndex(messages.length > 0 ? messages.length - 1 : null)
    }
  }, [messages.length, selectedMessageIndex])

  useEffect(() => {
    if (!activeClient) {
      navigation.replace("home")
      return
    }

    if (activeClient.authStatus !== "authenticated") {
      navigation.replace("auth")
      return
    }

    if (!selectedContact) {
      navigation.replace("contacts")
      return
    }

  }, [activeClient, navigation, selectedContact])

  useKeyboard((key) => {
    if (!(key.ctrl || key.meta) || key.name !== "v") {
      return
    }

    void (async () => {
      const clipboardAttachment = await readClipboardFile()
      if (!clipboardAttachment) {
        setComposerStatus("Clipboard has no supported file")
        return
      }

      setPendingAttachments((current) => [...current, clipboardAttachment])
      setComposerStatus(`Attached ${clipboardAttachment.fileName}`)
    })()
  })

  useKeyboard((key) => {
    if (key.name !== "return" && key.name !== "linefeed") {
      return
    }

    if (!selectedContact || activeClient?.authStatus !== "authenticated") {
      return
    }

    const text = composerRef.current?.plainText.trim() ?? ""
    if (text.length > 0 || pendingAttachments.length === 0) {
      return
    }

    if (replyingToMessageId && !replyingMessage) {
      setComposerStatus("Mensagem de resposta não encontrada")
      setReplyingToMessageId(null)
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return
    }

    void sendActiveMessage(selectedContact.id, {
      text: "",
      attachments: pendingAttachments,
      replyToMessageId: replyingToMessageId ?? undefined,
      replyToSenderName: replyingMessage?.senderName,
      replyPreviewText: replyingMessage?.content,
    })
    composerRef.current?.clear()
    setPendingAttachments([])
    setReplyingToMessageId(null)
    setComposerStatus("Press ENTER to send")
  })

  const focusPrevMessage = useCallback(() => {
    setSelectedMessageIndex((current) => {
      if (messages.length === 0) {
        setComposerStatus("No messages to select")
        return null
      }

      if (current === null) {
        return messages.length - 1
      }

      return current > 0 ? current - 1 : 0
    })
  }, [messages.length])

  const focusNextMessage = useCallback(() => {
    setSelectedMessageIndex((current) => {
      if (current === null) {
        return null
      }

      if (current >= messages.length - 1) {
        return null
      }

      return current + 1
    })
  }, [messages.length])

  const removeLastAttachment = useCallback(() => {
    if (editingMessageId) {
      setEditingMessageId(null)
      editingMessageIdRef.current = null
      composerRef.current?.clear()
      setComposerStatus("Edition cancelled")
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return
    }

    if (replyingToMessageId) {
      setReplyingToMessageId(null)
      setComposerStatus("Reply cancelled")
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return
    }

    if (selectedMessageIndex !== null) {
      setSelectedMessageIndex(null)
      setComposerStatus("Input focused")
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return
    }

    setPendingAttachments((current) => {
      if (current.length === 0) {
        setComposerStatus("No attachment to remove")
        setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
        return current
      }

      const next = current.slice(0, -1)
      setComposerStatus(next.length > 0 ? `Removed attachment. ${next.length} remaining` : "Attachment removed")
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return next
    })
  }, [editingMessageId, replyingToMessageId, selectedMessageIndex])

  const editSelectedMessageAction = useCallback(() => {
    if (!selectedMessage) {
      setComposerStatus("Select a message to edit")
      return
    }

    if (selectedMessage.from !== "self") {
      setComposerStatus("Only your messages can be edited")
      return
    }

    setEditingMessageId(selectedMessage.id)
    setReplyingToMessageId(null)
    editingMessageIdRef.current = selectedMessage.id
    setSelectedMessageIndex(null)
    composerRef.current?.clear()
    composerRef.current?.insertText(selectedMessage.content)
    setComposerStatus("Editing selected message. Type new text and press ENTER")
  }, [selectedMessage])

  const deleteSelectedMessageAction = useCallback(() => {
    if (!selectedContact || !selectedMessage) {
      setComposerStatus("Select a message to delete")
      return
    }

    if (selectedMessage.from !== "self") {
      setComposerStatus("Only your messages can be deleted")
      return
    }

    void deleteActiveMessage(selectedContact.id, selectedMessage.id).then((deleted) => {
      if (!deleted) {
        setComposerStatus("Failed to delete message")
        return
      }

      setSelectedMessageIndex((current) => {
        if (current === null) {
          return null
        }

        const nextMaxIndex = messages.length - 2
        if (nextMaxIndex < 0) {
          return null
        }

        return Math.min(current, nextMaxIndex)
      })
      if (replyingToMessageId === selectedMessage.id) {
        setReplyingToMessageId(null)
      }
      setComposerStatus("Message deleted")
    })
  }, [deleteActiveMessage, messages.length, replyingToMessageId, selectedContact, selectedMessage])

  const replySelectedMessageAction = useCallback(() => {
    if (!selectedMessage) {
      setComposerStatus("Select a message to reply")
      return
    }

    setReplyingToMessageId(selectedMessage.id)
    setSelectedMessageIndex(null)
    setComposerStatus("Replying to selected message")
  }, [selectedMessage])

  useEffect(() => {
    if (editingMessageId) {
      setContextualShortcuts([
        { key: "Enter", label: "Save edition", priority: 100 },
        { key: "Esc", label: "Cancel edition", priority: 100 },
      ])
      return
    }

    if (replyingToMessageId) {
      setContextualShortcuts([
        { key: "Enter", label: "Send reply", priority: 100 },
        { key: "Esc", label: "Cancel reply", priority: 100 },
      ])
      return
    }

    if (selectedMessageIndex === null) {
      setContextualShortcuts([])
      return
    }

    setContextualShortcuts([
      { key: "R", label: "Reply to selected", priority: 100 },
      { key: "E", label: "Edit selected message", priority: 100 },
      { key: "D", label: "Delete selected message", priority: 100 },
      { key: "Esc", label: "Back to input", priority: 95 },
    ])

    return () => {
      setContextualShortcuts([])
    }
  }, [editingMessageId, replyingToMessageId, selectedMessageIndex, setContextualShortcuts])

  useChatCommander({
    onRemoveAttachment: removeLastAttachment,
    onFocusPrevMessage: focusPrevMessage,
    onFocusNextMessage: focusNextMessage,
    onEditSelectedMessage: editSelectedMessageAction,
    onDeleteSelectedMessage: deleteSelectedMessageAction,
    onReplySelectedMessage: replySelectedMessageAction,
  })

  if (!activeClient || activeClient.authStatus !== "authenticated" || !selectedContact) {
    return null
  }

  const handleSubmit = () => {
    const text = composerRef.current?.plainText.trim() ?? ""
    const currentEditingMessageId = editingMessageIdRef.current

    if (currentEditingMessageId) {
      if (!selectedContact || text.length === 0) {
        setComposerStatus("Type the updated text and press ENTER")
        return
      }

      void editActiveMessage(selectedContact.id, currentEditingMessageId, text).then((edited) => {
        if (!edited) {
          setComposerStatus("Failed to edit message")
          return
        }

        composerRef.current?.clear()
        setEditingMessageId(null)
        editingMessageIdRef.current = null
        setComposerStatus("Message edited")
      })
      return
    }

    if (!text && pendingAttachments.length === 0) {
      return
    }

    if (replyingToMessageId && !replyingMessage) {
      setComposerStatus("Mensagem de resposta não encontrada")
      setReplyingToMessageId(null)
      setTimeout(() => setComposerStatus("Press ENTER to send"), 3000)
      return
    }

    void sendActiveMessage(selectedContact.id, {
      text,
      attachments: pendingAttachments,
      replyToMessageId: replyingToMessageId ?? undefined,
      replyToSenderName: replyingMessage?.senderName,
      replyPreviewText: replyingMessage?.content,
    })
    composerRef.current?.clear()
    setPendingAttachments([])
    setReplyingToMessageId(null)
    setComposerStatus("Press ENTER to send")
  }

  return (
    <box
      flexDirection="column"
      alignItems="stretch"
      backgroundColor={colors.background}
      width="100%"
      height="100%"
      gap={1}
    >
      <box
        padding={1}
        flexDirection="column"
        width="100%"
				backgroundColor={colors.surface}
        flexShrink={0}
        minHeight={4}
      >
        <text fg={colors.text}>{selectedContact.name}</text>
        <text fg={colors.textMuted}>
          {selectedContact.kind === "group"
            ? `${selectedContact.membersCount ?? 0} members`
            : selectedContact.formattedId ?? selectedContact.id}
        </text>
        {typingIndicatorText ? <text fg={colors.secondary}>{typingIndicatorText}</text> : null}
      </box>

      <box
        flexDirection="column"
        alignItems="flex-start"
        flexGrow={1}
        minHeight={0}
        width="100%"
      >
        <box flexGrow={1} width="100%">
          <scrollbox
            stickyScroll={selectedMessageIndex === null}
            stickyStart={selectedMessageIndex === null ? "bottom" : "top"}
            height="100%"
            width="100%"
            overflow="scroll"
            paddingRight={1}
          >
            <box flexDirection="column" alignItems="stretch" gap={1} width="100%" paddingLeft={1} paddingRight={1}>
              {messages.map((message, messageIndex) => (
                <box
                  key={message.id}
                  flexDirection="column"
                  width="100%"
                  backgroundColor={selectedMessageIndex === messageIndex || editingMessageId === message.id ? colors.surfaceFocus : undefined}
                  paddingLeft={selectedMessageIndex === messageIndex ? 1 : 0}
                  paddingRight={selectedMessageIndex === messageIndex ? 1 : 0}
                >
                  <box width="100%" flexDirection="row" gap={1}>
                    <text fg={message.from === "self" ? colors.secondary : colors.accent}>
                      {message.senderName ?? (message.from === "self" ? "You" : selectedContact.name)}
                    </text>
                    {editingMessageId === message.id ? (
                      <box backgroundColor={colors.secondary}>
                        <text fg={colors.background}>{" EDITING "}</text>
                      </box>
                    ) : null}
                  </box>
                  {message.replyToMessageId || message.replyPreviewText ? (
                    <box width="100%" backgroundColor={colors.surface} paddingLeft={1} paddingRight={1}>
                      <text fg={colors.textMuted}>
                        {`Reply to ${message.replyToSenderName ?? "message"}: ${(message.replyPreviewText?.trim() || "Mensagem original").slice(0, 56)}${(message.replyPreviewText?.trim().length ?? 0) > 56 ? "..." : ""}`}
                      </text>
                    </box>
                  ) : null}
                  {message.content.trim().length > 0 ? renderInlineContent(message, colors) : null}
                  {message.badges && message.badges.length > 0 ? (
                    <box width="100%" flexDirection="row" gap={1}>
                      {message.badges.map((badge) => {
                        const palette = badgePalette(message.contentType, colors)
                        return (
                          <box key={`${message.id}:${badge.id}`} backgroundColor={palette.bg}>
                            <text fg={palette.fg}>{` ${badge.label.toUpperCase()} `}</text>
                          </box>
                        )
                      })}
                    </box>
                  ) : null}
                  <box width="100%" flexDirection="row" gap={1}>
                    <text fg={statusColor(message.status, colors)}>{statusIcon(message.status)}</text>
                    <text fg={colors.textMuted}>{`• ${formatTimestamp(message.timestamp)}`}</text>
                  </box>
                </box>
              ))}
            </box>
          </scrollbox>
        </box>
      </box>
      <box
        padding={1}
        flexDirection="row"
        alignItems="stretch"
        gap={1}
        height={8}
        width="100%"
      >
        <box width={1} alignSelf="stretch" backgroundColor={colors.border} />
        <box flexDirection="column" flexGrow={1} gap={1} backgroundColor={colors.surface} padding={1}>
          {editingMessage ? (
            <box width="100%" backgroundColor={colors.surfaceFocus} paddingLeft={1} paddingRight={1}>
              <text fg={colors.secondary}>
                {`EDITING: ${(editingMessage.content || "(media message)").slice(0, 56)}${(editingMessage.content || "").length > 56 ? "..." : ""}`}
              </text>
            </box>
          ) : null}
          {replyingMessage ? (
            <box width="100%" backgroundColor={colors.surfaceFocus} paddingLeft={1} paddingRight={1}>
              <text fg={colors.accent}>
                {`REPLYING TO ${replyingMessage.senderName ?? "Unknown"}: ${(replyingMessage.content || "(media message)").slice(0, 56)}${(replyingMessage.content || "").length > 56 ? "..." : ""}`}
              </text>
            </box>
          ) : null}
          {pendingAttachments.length > 0 ? (
            <box width="100%" flexDirection="row" gap={1}>
              {pendingAttachments.map((attachment) => (
                <box key={attachment.id} backgroundColor={colors.surfaceFocus}>
                  <text fg={colors.accent}>{` FILE ${attachment.fileName} `}</text>
                </box>
              ))}
            </box>
          ) : null}
          <textarea
            ref={composerRef}
            focused={selectedMessageIndex === null}
            width="100%"
            height={3}
            placeholder={editingMessageId ? "Type updated message..." : "Type your message..."}
            backgroundColor={colors.background}
            textColor={colors.text}
            focusedBackgroundColor={colors.background}
            focusedTextColor={colors.text}
            placeholderColor={colors.textMuted}
            keyBindings={[
              { name: "return", action: "submit" },
              { name: "linefeed", action: "submit" },
            ]}
              onSubmit={handleSubmit}
          />
          <text fg={colors.textMuted}>{`${composerStatus} - CTRL+V to attach from clipboard`}</text>
        </box>
      </box>
    </box>
  )
}
