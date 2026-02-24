import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { NavigationApi, Route } from "./types"

const NavigationContext = createContext<NavigationApi | null>(null)

type NavigationProviderProps = {
  children: ReactNode
  availableRoutes: Set<string>
}

export function NavigationProvider({ children, availableRoutes }: NavigationProviderProps) {
  const [state, setState] = useState<{ history: Route[], index: number }>({
    history: ["home"],
    index: 0,
  })

  const resolveRoute = (route: Route): Route => {
    if (availableRoutes.has(route)) {
      return route
    }
    return "home"
  }

  const navigation = useMemo<NavigationApi>(() => ({
    route: state.history[state.index] ?? "home",
    push: (route) => {
      const nextRoute = resolveRoute(route)
      setState((current) => ({
        history: [...current.history.slice(0, current.index + 1), nextRoute],
        index: current.index + 1,
      }))
    },
    replace: (route) => {
      const nextRoute = resolveRoute(route)
      setState((current) => ({
        history: current.history.map((entry, entryIndex) => (entryIndex === current.index ? nextRoute : entry)),
        index: current.index,
      }))
    },
    back: () => {
      setState((current) => ({
        history: current.history,
        index: current.index > 0 ? current.index - 1 : current.index,
      }))
    },
    forward: () => {
      setState((current) => ({
        history: current.history,
        index: current.index < current.history.length - 1 ? current.index + 1 : current.index,
      }))
    },
    reset: (route) => {
      setState({ history: [resolveRoute(route)], index: 0 })
    },
  }), [state])

  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const navigation = useContext(NavigationContext)
  if (!navigation) {
    throw new Error("useNavigation must be used inside NavigationProvider")
  }
  return navigation
}
