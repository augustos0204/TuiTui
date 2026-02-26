import { useEffect } from "react"
import { onKeybindIntent } from "../../keybind/intent-bus"
import { useContactSelection } from "../../contacts/context"

export const CONTACTS_COMMANDS = {
  focusSearch: "contacts.search.focus",
  focusNext: "contacts.focus.next",
  focusPrev: "contacts.focus.prev",
  clearSearch: "contacts.search.clear",
} as const

export function useContactsCommander() {
  const { cycleContactsFocus, focusContactsSearch, clearContactsSearch } = useContactSelection()

  useEffect(() => {
    return onKeybindIntent((intent) => {
      if (intent.route !== "contacts") {
        return
      }

      if (intent.commandId === CONTACTS_COMMANDS.focusSearch) {
        focusContactsSearch()
        return
      }

      if (intent.commandId === CONTACTS_COMMANDS.focusNext) {
        cycleContactsFocus(false)
        return
      }

      if (intent.commandId === CONTACTS_COMMANDS.focusPrev) {
        cycleContactsFocus(true)
        return
      }

      if (intent.commandId === CONTACTS_COMMANDS.clearSearch) {
        clearContactsSearch()
      }
    })
  }, [clearContactsSearch, cycleContactsFocus, focusContactsSearch])
}
