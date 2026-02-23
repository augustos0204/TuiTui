import { createCliRenderer } from "@opentui/core"
import { createRoot, useKeyboard } from "@opentui/react"
import { onKeybind as onGlobalKeybind } from "./keybind"
import { loadPageKeybinds } from "./router/load-keybinds"
import type { KeyEvent } from "./router/keybind-types"
import { loadPages } from "./router/load-pages"
import { NavigationProvider, useNavigation } from "./router/navigation"
import { colors } from "./theme/colors"

const pages = await loadPages()
const pageKeybinds = await loadPageKeybinds()
const availableRoutes = new Set(Object.keys(pages))

if (!pages.home) {
  throw new Error("Missing root page: src/pages/page.tsx")
}

type AppProps = {
  onQuit: () => void
}

function KeyboardDispatcher({ onQuit }: AppProps) {
  const navigation = useNavigation()

  useKeyboard((key) => {
    const event = key as KeyEvent
    const context = {
      route: navigation.route,
      navigation,
      quit: onQuit,
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

function App({ onQuit }: AppProps) {
  return (
    <NavigationProvider availableRoutes={availableRoutes}>
      <KeyboardDispatcher onQuit={onQuit} />
      <ScreenHost />
    </NavigationProvider>
  )
}

const renderer = await createCliRenderer({ backgroundColor: colors.background })
const root = createRoot(renderer)

root.render(<App onQuit={() => {
  root.unmount()
  renderer.destroy()
}} />)
