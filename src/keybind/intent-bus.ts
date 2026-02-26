import type { KeyEvent } from "../router/keybind-types"
import type { Route } from "../router/types"

type KeybindIntent = {
  route: Route
  commandId: string
  key: KeyEvent
}

type IntentListener = (intent: KeybindIntent) => void

const listeners = new Set<IntentListener>()

export function emitKeybindIntent(intent: KeybindIntent) {
  for (const listener of listeners) {
    listener(intent)
  }
}

export function onKeybindIntent(listener: IntentListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
