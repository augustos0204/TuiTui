import type { KeyEvent, KeybindContext } from "../router/keybind-types"

export type KeybindCommand = (context: KeybindContext, key: KeyEvent) => void
export type KeybindCommandMap = Record<string, KeybindCommand>

export const commands: KeybindCommandMap = {
  "console.toggle": (context) => {
    context.toggleConsole()
  },
  "console.resize.increase": (context) => {
    context.resizeConsoleIncrease()
  },
  "console.resize.decrease": (context) => {
    context.resizeConsoleDecrease()
  },
  "logs.clear": (context) => {
    context.clearLogs()
  },
  "nav.back": (context) => {
    context.navigation.back()
  },
  "nav.forward": (context) => {
    context.navigation.forward()
  },
  "app.quit": (context) => {
    context.quit()
  },
}
