import type { KeybindHandler } from "./router/keybind-types"
import { dispatchKeybindCommand } from "./keybind/dispatch"

export const onKeybind: KeybindHandler = (key, context) => {
  return dispatchKeybindCommand(key, context)
}
