import type { KeybindHandler } from "./router/keybind-types"

export const onKeybind: KeybindHandler = (key, context) => {
  if (key.name === "q") {
    context.quit()
    return true
  }
}
