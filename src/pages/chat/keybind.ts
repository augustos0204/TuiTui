import { createScopedDispatcher } from "../../keybind/dispatch"
import type { KeybindCommandMap } from "../../keybind/commands"
import type { Keymap } from "../../keybind/keymap"
import type { KeybindHandler, KeybindShortcut } from "../../router/keybind-types"
import { CHAT_COMMANDS } from "./commander"

const keymap: Keymap = {
  escape: CHAT_COMMANDS.removeAttachment,
  up: CHAT_COMMANDS.focusPrevMessage,
  down: CHAT_COMMANDS.focusNextMessage,
  e: CHAT_COMMANDS.editSelectedMessage,
  d: CHAT_COMMANDS.deleteSelectedMessage,
  r: CHAT_COMMANDS.replySelectedMessage,
}

const commands: KeybindCommandMap = {
  [CHAT_COMMANDS.removeAttachment]: () => {
    return
  },
  [CHAT_COMMANDS.focusPrevMessage]: () => {
    return
  },
  [CHAT_COMMANDS.focusNextMessage]: () => {
    return
  },
  [CHAT_COMMANDS.editSelectedMessage]: () => {
    return
  },
  [CHAT_COMMANDS.deleteSelectedMessage]: () => {
    return
  },
  [CHAT_COMMANDS.replySelectedMessage]: () => {
    return
  },
}

export const shortcuts: KeybindShortcut[] = [
  { key: "Up", label: "Focus previous message", priority: 90 },
  { key: "Down", label: "Focus next message / input", priority: 90 },
  { key: "E", label: "Edit selected message", priority: 85 },
  { key: "D", label: "Delete selected message", priority: 85 },
  { key: "R", label: "Reply to selected", priority: 85 },
  { key: "Esc", label: "Back to input / remove attachment", priority: 80 },
]

export const onKeybind: KeybindHandler = createScopedDispatcher({
  keymap,
  commands,
  scope: "chat",
})
