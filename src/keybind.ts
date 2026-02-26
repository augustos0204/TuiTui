import type { KeybindHandler, KeybindShortcut } from "./router/keybind-types"
import { dispatchKeybindCommand } from "./keybind/dispatch"

export const shortcuts: KeybindShortcut[] = [
  { key: "Ctrl+Q", label: "Quit", priority: 100 },
  { key: "Shift+F12", label: "Console", priority: 90 },
  { key: "Ctrl+L", label: "Clear logs", priority: 80 },
  { key: "PgDn", label: "Back", priority: 70 },
  { key: "PgUp", label: "Forward", priority: 70 },
  { key: "F1", label: "Shortcuts", priority: 95 },
]

export const onKeybind: KeybindHandler = (key, context) => {
  return dispatchKeybindCommand(key, context)
}
