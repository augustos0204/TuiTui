import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"
import AutoCopySelection from "./components/auto-copy-selection/component"
import LoggerBar from "./components/logger-bar"
import { ContactProvider } from "./contacts/context"
import { onKeybind as onGlobalKeybind } from "./keybind"
import { LoggerProvider } from "./logger/context"
import type { LogEntry, LoggerFn } from "./logger/types"
import { loadPageKeybinds } from "./router/load-keybinds"
import type { KeyEvent, KeybindContext } from "./router/keybind-types"
import { loadPages } from "./router/load-pages"
import { NavigationProvider, useNavigation } from "./router/navigation"
import { colors } from "./theme/colors"
import { useEffect, useState } from "react"

const pages = await loadPages()
const pageKeybinds = await loadPageKeybinds()
const availableRoutes = new Set(Object.keys(pages))

if (!pages.home) {
  throw new Error("Missing root page: src/pages/page.tsx")
}

type AppProps = {
  onQuit: () => void
  main: Main
}

type KeyboardDispatcherProps = {
  onQuit: () => void
  main: Main
  toggleConsole: () => void
  resizeConsoleIncrease: () => void
  resizeConsoleDecrease: () => void
	clearLogs: () => void
}

class Main {
  private listeners = new Set<(entry: LogEntry) => void>()

  logger(level: LogEntry["level"], message: string) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
    }

    for (const listener of this.listeners) {
      listener(entry)
    }
  }

  subscribe(listener: (entry: LogEntry) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  boot() {
    this.logger("info", "TuiTui initialized.")
  }
}

function KeyboardDispatcher({
  onQuit,
  main,
  toggleConsole,
  resizeConsoleIncrease,
  resizeConsoleDecrease,
	clearLogs,
}: KeyboardDispatcherProps) {
  const navigation = useNavigation()
  const logger: LoggerFn = (level, message) => main.logger(level, message)

  useKeyboard((key) => {
    const event = key as KeyEvent
    const context: KeybindContext = {
      route: navigation.route,
      navigation,
      quit: onQuit,
      logger,
      toggleConsole,
      resizeConsoleIncrease,
      resizeConsoleDecrease,
			clearLogs,
    }

    if (onGlobalKeybind(event, context) === true) {
      return
    }

    const pageKeybind = pageKeybinds[navigation.route]
    if (!pageKeybind) {
      return
    }

    pageKeybind(event, context)
  })

  return null
}


function ScreenHost() {
  const navigation = useNavigation()
  const activePage = pages[navigation.route] ?? pages.home

  return activePage({ navigation })
}

function App({ onQuit, main }: AppProps) {
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(12)
  const logger: LoggerFn = (level, message) => main.logger(level, message)
  const toggleConsole = () => {
    setIsConsoleOpen((current) => !current)
  }
  const resizeConsoleIncrease = () => {
    setConsoleHeight((current) => Math.min(24, current + 1))
  }
  const resizeConsoleDecrease = () => {
    setConsoleHeight((current) => Math.max(6, current - 1))
  }

	const clearLogs = () => setLogEntries([{ level: "info", message: "Logs cleared.", timestamp: Date.now() }]);

  useEffect(() => main.subscribe((entry) => {
    setLogEntries((current) => [...current, entry].slice(-200))
  }), [main])
  useEffect(() => {
    main.boot()
  }, [main])

  return (
    <NavigationProvider availableRoutes={availableRoutes}>
      <LoggerProvider logger={logger}>
        <ContactProvider>
          <AutoCopySelection />
          <KeyboardDispatcher
            onQuit={onQuit}
            main={main}
            toggleConsole={toggleConsole}
            resizeConsoleIncrease={resizeConsoleIncrease}
            resizeConsoleDecrease={resizeConsoleDecrease}
            clearLogs={clearLogs}
          />
          <box flexDirection="column" width="100%" height="100%" backgroundColor={colors.background}>
            <box flexGrow={1} width="100%">
              <ScreenHost />
            </box>
            {isConsoleOpen && <LoggerBar logs={logEntries} height={consoleHeight} />}
          </box>
        </ContactProvider>
      </LoggerProvider>
    </NavigationProvider>
  )
}

const renderer = await createCliRenderer({ backgroundColor: colors.background })
const root = createRoot(renderer)
const main = new Main()

root.render(<App onQuit={() => {
  root.unmount()
  renderer.destroy()
}} main={main} />)
