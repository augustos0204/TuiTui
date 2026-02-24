import type { KeyEvent } from "../router/keybind-types"

export function toKeyChord(key: KeyEvent): string {
  const base = (key.name || key.code || "").toLowerCase()
  if (!base) {
    return ""
  }

  const modifiers: string[] = []
  if (key.ctrl) modifiers.push("ctrl")
  if (key.alt || key.meta || key.option) modifiers.push("alt")
  if (key.shift) modifiers.push("shift")

  return modifiers.length > 0 ? `${modifiers.join("+")}+${base}` : base
}
