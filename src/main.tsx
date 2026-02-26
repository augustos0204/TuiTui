import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"
import AutoCopySelection from "./components/auto-copy-selection/component"
import LoggerBar from "./components/logger-bar"
import { NotificationBar } from "./components/NotificationBar"
import { ShortcutsOverlay } from "./components/ShortcutsOverlay"
import { ClientsProvider, useClients } from "./clients/context"
import { ContactProvider } from "./contacts/context"
import { onKeybind as onGlobalKeybind, shortcuts as globalShortcuts } from "./keybind"
import { ContextualShortcutsProvider, useContextualShortcuts } from "./keybind/contextual-shortcuts"
import { resolveShortcuts } from "./keybind/shortcuts"
import { LoggerProvider } from "./logger/context"
import type { LogEntry, LoggerFn } from "./logger/types"
import { loadPageKeybinds } from "./router/load-keybinds"
import type { KeyEvent, KeybindContext } from "./router/keybind-types"
import { loadPages } from "./router/load-pages"
import { NavigationProvider, useNavigation } from "./router/navigation"
import { defaultColors } from "./theme/colors"
import { useCallback, useEffect, useRef, useState } from "react"
import { FooterBar } from "./components/FooterBar"
import { ThemeProvider, useAppColors } from "./theme/context"

const pages = await loadPages()
const loadedPageKeybinds = await loadPageKeybinds()
const pageKeybinds = loadedPageKeybinds.handlers
const pageShortcutMap = loadedPageKeybinds.shortcuts
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
  toggleShortcutsOverlay: () => void
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
  toggleShortcutsOverlay,
}: KeyboardDispatcherProps) {
  const navigation = useNavigation()
  const { logoutActiveClient, shutdownAllClients } = useClients()
  const isQuittingRef = useRef(false)
  const logger = useCallback<LoggerFn>((level, message) => {
    main.logger(level, message)
  }, [main])

  useKeyboard((key) => {
    const quit = () => {
      if (isQuittingRef.current) {
        return
      }

      isQuittingRef.current = true
      void shutdownAllClients().finally(() => {
        onQuit()
      })
    }

    const event = key as KeyEvent
    const context: KeybindContext = {
      route: navigation.route,
      navigation,
      quit,
      logger,
      toggleConsole,
      resizeConsoleIncrease,
      resizeConsoleDecrease,
			clearLogs,
      logoutActiveClient: () => {
        void logoutActiveClient()
      },
      toggleShortcutsOverlay,
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

function FooterHost({ isShortcutsOverlayOpen }: { isShortcutsOverlayOpen: boolean }) {
  const navigation = useNavigation()
  const { shortcuts: contextualShortcuts } = useContextualShortcuts()
  const shortcuts = resolveShortcuts(globalShortcuts, pageShortcutMap[navigation.route], contextualShortcuts)

  return (
    <>
      <FooterBar />
      {isShortcutsOverlayOpen && <ShortcutsOverlay shortcuts={shortcuts} />}
    </>
  )
}


function ScreenHost() {
  const navigation = useNavigation()
  const ActivePage = pages[navigation.route] ?? pages.home

  return <ActivePage navigation={navigation} />
}

function AppShell({
  onQuit,
  main,
}: AppProps) {
  const colors = useAppColors()
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [consoleHeight, setConsoleHeight] = useState(12)
  const [isShortcutsOverlayOpen, setIsShortcutsOverlayOpen] = useState(false)
  const toggleConsole = () => {
    setIsConsoleOpen((current) => !current)
  }
  const resizeConsoleIncrease = () => {
    setConsoleHeight((current) => Math.min(24, current + 1))
  }
  const resizeConsoleDecrease = () => {
    setConsoleHeight((current) => Math.max(6, current - 1))
  }
  const toggleShortcutsOverlay = () => {
    setIsShortcutsOverlayOpen((current) => !current)
  }

	const clearLogs = () => setLogEntries([{ level: "info", message: "Logs cleared.", timestamp: Date.now() }]);

  useEffect(() => main.subscribe((entry) => {
    setLogEntries((current) => [...current, entry].slice(-200))
  }), [main])
  useEffect(() => {
    main.boot()
  }, [main])

  return (
    <ContactProvider>
      <ContextualShortcutsProvider>
        <AutoCopySelection />
        <KeyboardDispatcher
          onQuit={onQuit}
          main={main}
          toggleConsole={toggleConsole}
          resizeConsoleIncrease={resizeConsoleIncrease}
          resizeConsoleDecrease={resizeConsoleDecrease}
          clearLogs={clearLogs}
          toggleShortcutsOverlay={toggleShortcutsOverlay}
        />
        <box flexDirection="column" width="100%" height="100%" backgroundColor={colors.background}>
          <NotificationBar />
          <box flexGrow={1} width="100%">
            <ScreenHost />
          </box>
          {isConsoleOpen && <LoggerBar logs={logEntries} height={consoleHeight} />}
          <FooterHost isShortcutsOverlayOpen={isShortcutsOverlayOpen} />
        </box>
      </ContextualShortcutsProvider>
    </ContactProvider>
  )
}

function App({ onQuit, main }: AppProps) {
  const logger = useCallback<LoggerFn>((level, message) => {
    main.logger(level, message)
  }, [main])

  return (
    <NavigationProvider availableRoutes={availableRoutes}>
      <LoggerProvider logger={logger}>
        <ClientsProvider>
          <ThemeProvider>
            <AppShell onQuit={onQuit} main={main} />
          </ThemeProvider>
        </ClientsProvider>
      </LoggerProvider>
    </NavigationProvider>
  )
}

const renderer = await createCliRenderer({ backgroundColor: defaultColors.background })
const root = createRoot(renderer)
const main = new Main()

root.render(<App onQuit={() => {
  root.unmount()
  renderer.destroy()
}} main={main} />)
