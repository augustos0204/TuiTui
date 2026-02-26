import type { KeybindShortcut } from "../../router/keybind-types"
import { useAppColors } from "../../theme/context"

type ShortcutsOverlayProps = {
  shortcuts: KeybindShortcut[]
}

export function ShortcutsOverlay({ shortcuts }: ShortcutsOverlayProps) {
  const colors = useAppColors()
  return (
    <box position="absolute" left={0} top={0} width="100%" height="100%" backgroundColor="#000000AA">
      <box width="100%" height="100%" justifyContent="center" alignItems="center">
        <box
          border
          borderStyle="double"
          borderColor={colors.primary}
          backgroundColor={colors.surface}
          width="80%"
          maxWidth={80}
          maxHeight={20}
          padding={1}
          flexDirection="column"
          gap={1}
        >
          <text fg={colors.text}>Shortcuts</text>
          <scrollbox height="100%" overflow="scroll">
            <box flexDirection="column" gap={1}>
              {shortcuts.map((shortcut, index) => (
                <box key={`${shortcut.key}-${shortcut.label}-${index}`} flexDirection="row" justifyContent="space-between">
                  <text fg={colors.accent}>{shortcut.key}</text>
                  <text fg={colors.textMuted}>{shortcut.label}</text>
                </box>
              ))}
            </box>
          </scrollbox>
          <text fg={colors.textMuted}>Press F1 to close</text>
        </box>
      </box>
    </box>
  )
}
