import type { TextareaRenderable } from "@opentui/core"
import { useEffect, useRef, useState } from "react"
import { useContactSelection } from "../../contacts/context"
import type { PageProps } from "../../router/types"
import { colors } from "../../theme/colors"

type ChatMessage = {
  from: string
  text: string
  timestamp: number
}

const initialMessages: ChatMessage[] = []

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ChatPage({ navigation }: PageProps) {
  const { selectedContact } = useContactSelection()
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const composerRef = useRef<TextareaRenderable | null>(null)

  useEffect(() => {
    if (!selectedContact) {
      navigation.replace("contacts")
    }
  }, [navigation, selectedContact])

  if (!selectedContact) {
    return null
  }

  const handleSubmit = () => {
    const text = composerRef.current?.plainText.trim() ?? ""
    if (!text) {
      return
    }

    setMessages((currentMessages) => [...currentMessages, { from: "You", text, timestamp: Date.now() }])
    composerRef.current?.clear()
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
        <text fg={colors.textMuted}>{selectedContact.id}</text>
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
            stickyScroll
            stickyStart="bottom"
            height="100%"
            width="100%"
            overflow="scroll"
            paddingRight={1}
          >
            <box flexDirection="column" alignItems="stretch" gap={1} width="100%">
              {messages.map((message, index) => (
                <box key={index} flexDirection="column" width="100%">
                  <text fg={message.from === "You" ? colors.secondary : colors.accent}>{message.from}</text>
                  <text fg={colors.text} wrapMode="word" truncate={false}>{message.text}</text>
                  <box width="100%" justifyContent="flex-end">
                    <text fg={colors.textMuted}>{formatTimestamp(message.timestamp)}</text>
                  </box>
                </box>
              ))}
            </box>
          </scrollbox>
        </box>
      </box>

      <box
        border
        borderColor={colors.border}
        backgroundColor={colors.surface}
        padding={1}
        flexDirection="row"
        alignItems="stretch"
        gap={1}
        height={6}
        width="100%"
      >
        <box width={1} alignSelf="stretch" backgroundColor={colors.border} />
        <box flexDirection="column" flexGrow={1} gap={1}>
          <textarea
            ref={composerRef}
            focused
            width="100%"
            height={3}
            placeholder="Type your message..."
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
          <text fg={colors.textMuted}>Press ENTER to send</text>
        </box>
      </box>
    </box>
  )
}
