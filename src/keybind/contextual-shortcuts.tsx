import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { KeybindShortcut } from "../router/keybind-types"

type ContextualShortcutsValue = {
  shortcuts: KeybindShortcut[]
  setShortcuts: (shortcuts: KeybindShortcut[]) => void
}

const ContextualShortcutsContext = createContext<ContextualShortcutsValue | null>(null)

type ContextualShortcutsProviderProps = {
  children: ReactNode
}

export function ContextualShortcutsProvider({ children }: ContextualShortcutsProviderProps) {
  const [shortcuts, setShortcuts] = useState<KeybindShortcut[]>([])
  const value = useMemo(() => ({ shortcuts, setShortcuts }), [shortcuts])

  return <ContextualShortcutsContext.Provider value={value}>{children}</ContextualShortcutsContext.Provider>
}

export function useContextualShortcuts() {
  const context = useContext(ContextualShortcutsContext)
  if (!context) {
    throw new Error("useContextualShortcuts must be used inside ContextualShortcutsProvider")
  }
  return context
}
