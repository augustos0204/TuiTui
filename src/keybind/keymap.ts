export type Keymap = Record<string, string>

export const keymap: Keymap = {
  "shift+f12": "console.toggle",
  "ctrl+up": "console.resize.increase",
  "ctrl+down": "console.resize.decrease",
  "ctrl+q": "app.quit",
  "ctrl+l": "logs.clear",
  pagedown: "nav.back",
  pageup: "nav.forward",
}
