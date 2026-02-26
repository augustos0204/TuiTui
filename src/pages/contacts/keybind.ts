import { createScopedDispatcher } from "../../keybind/dispatch"
import type { KeybindCommandMap } from "../../keybind/commands"
import type { Keymap } from "../../keybind/keymap"
import type { KeybindHandler, KeybindShortcut } from "../../router/keybind-types"
import { CONTACTS_COMMANDS } from "./commander"

const keymap: Keymap = {
  "ctrl+d": "contacts.logout",
  "ctrl+f": CONTACTS_COMMANDS.focusSearch,
  tab: CONTACTS_COMMANDS.focusNext,
  "shift+tab": CONTACTS_COMMANDS.focusPrev,
  escape: CONTACTS_COMMANDS.clearSearch,
}

const commands: KeybindCommandMap = {
  "contacts.logout": (context) => {
    context.logoutActiveClient()
    context.navigation.replace("home")
  },
  [CONTACTS_COMMANDS.focusSearch]: () => {
    return
  },
  [CONTACTS_COMMANDS.focusNext]: () => {
    return
  },
  [CONTACTS_COMMANDS.focusPrev]: () => {
    return
  },
  [CONTACTS_COMMANDS.clearSearch]: () => {
    return
  },
}

export const shortcuts: KeybindShortcut[] = [
  { key: "Ctrl+D", label: "Logout provider", priority: 100 },
  { key: "Ctrl+F", label: "Focus search", priority: 95 },
  { key: "Tab", label: "Tabs/List focus", priority: 90 },
  { key: "Esc", label: "Clear search", priority: 85 },
]

export const onKeybind: KeybindHandler = createScopedDispatcher({
  keymap,
  commands,
  scope: "contacts",
})
