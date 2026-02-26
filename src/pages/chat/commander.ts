import { useEffect } from "react"
import { onKeybindIntent } from "../../keybind/intent-bus"

export const CHAT_COMMANDS = {
  removeAttachment: "chat.attachment.remove",
  focusPrevMessage: "chat.message.focus.prev",
  focusNextMessage: "chat.message.focus.next",
  editSelectedMessage: "chat.message.edit",
  deleteSelectedMessage: "chat.message.delete",
  replySelectedMessage: "chat.message.reply",
} as const

type ChatCommanderHandlers = {
  onRemoveAttachment: () => void
  onFocusPrevMessage: () => void
  onFocusNextMessage: () => void
  onEditSelectedMessage: () => void
  onDeleteSelectedMessage: () => void
  onReplySelectedMessage: () => void
}

export function useChatCommander(handlers: ChatCommanderHandlers) {
  useEffect(() => {
    return onKeybindIntent((intent) => {
      if (intent.route !== "chat") {
        return
      }

      if (intent.commandId === CHAT_COMMANDS.removeAttachment) {
        handlers.onRemoveAttachment()
        return
      }

      if (intent.commandId === CHAT_COMMANDS.focusPrevMessage) {
        handlers.onFocusPrevMessage()
        return
      }

      if (intent.commandId === CHAT_COMMANDS.focusNextMessage) {
        handlers.onFocusNextMessage()
        return
      }

      if (intent.commandId === CHAT_COMMANDS.editSelectedMessage) {
        handlers.onEditSelectedMessage()
        return
      }

      if (intent.commandId === CHAT_COMMANDS.deleteSelectedMessage) {
        handlers.onDeleteSelectedMessage()
        return
      }

      if (intent.commandId === CHAT_COMMANDS.replySelectedMessage) {
        handlers.onReplySelectedMessage()
      }
    })
  }, [handlers])
}
