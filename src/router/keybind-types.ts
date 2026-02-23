import type { NavigationApi, Route } from "./types"

export type KeyEvent = {
  name: string
  sequence?: string
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
}

export type KeybindContext = {
  route: Route
  navigation: NavigationApi
  quit: () => void
}

export type KeybindHandler = (key: KeyEvent, context: KeybindContext) => boolean | void

export type KeybindModule = {
  onKeybind: KeybindHandler
}
