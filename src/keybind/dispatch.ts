import type { KeyEvent, KeybindContext } from "../router/keybind-types"
import { toKeyChord } from "./chord"
import { commands, type KeybindCommandMap } from "./commands"
import { emitKeybindIntent } from "./intent-bus"
import { keymap, type Keymap } from "./keymap"

type DispatchConfig = {
  keymap: Keymap
  commands: KeybindCommandMap
  scope?: string
}

function dispatchFromConfig(key: KeyEvent, context: KeybindContext, config: DispatchConfig): boolean {
  const chord = toKeyChord(key)
  if (!chord) {
    return false
  }

  const commandId = config.keymap[chord]
  if (!commandId) {
    return false
  }

  emitKeybindIntent({
    route: context.route,
    commandId,
    key,
  })

  const command = config.commands[commandId]
  if (!command) {
    return true
  }

  command(context, key)
  return true
}

export function dispatchKeybindCommand(key: KeyEvent, context: KeybindContext): boolean {
  return dispatchFromConfig(key, context, {
    keymap,
    commands,
    scope: "global",
  })
}

export function createScopedDispatcher(config: DispatchConfig) {
  return (key: KeyEvent, context: KeybindContext): boolean => dispatchFromConfig(key, context, config)
}
