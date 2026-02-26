import type { KeybindShortcut } from "../router/keybind-types"

export function resolveShortcuts(
  globalShortcuts: KeybindShortcut[],
  routeShortcuts: KeybindShortcut[] | undefined,
  contextualShortcuts: KeybindShortcut[] | undefined,
) {
  const merged = [...globalShortcuts, ...(routeShortcuts ?? []), ...(contextualShortcuts ?? [])]
  return merged.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function pickShortcutsForWidth(shortcuts: KeybindShortcut[], maxWidth: number) {
  const selected: KeybindShortcut[] = []
  let consumed = 0

  for (const shortcut of shortcuts) {
    const segment = `${shortcut.key} ${shortcut.label}`
    const segmentLength = segment.length + (selected.length > 0 ? 3 : 0)
    if (consumed + segmentLength > maxWidth) {
      break
    }

    selected.push(shortcut)
    consumed += segmentLength
  }

  return {
    visible: selected,
    hiddenCount: shortcuts.length - selected.length,
  }
}
