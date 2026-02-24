import type { NavigationApi, Route } from "./types"
import type { LoggerFn } from "../logger/types"

export type KeyEvent = {
  name: string
  code?: string
  raw?: string
  sequence?: string
  ctrl?: boolean
  alt?: boolean
  meta?: boolean
  option?: boolean
  shift?: boolean
}

export type KeybindContext = {
  route: Route
  navigation: NavigationApi
  quit: () => void
  logger: LoggerFn
  toggleConsole: () => void
  resizeConsoleIncrease: () => void
  resizeConsoleDecrease: () => void
	clearLogs: () => void
}

export type KeybindHandler = (key: KeyEvent, context: KeybindContext) => boolean | void

export type KeybindModule = {
  onKeybind: KeybindHandler
}
