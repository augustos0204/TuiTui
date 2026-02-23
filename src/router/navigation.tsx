import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { NavigationApi, Route } from "./types"

const NavigationContext = createContext<NavigationApi | null>(null)

type NavigationProviderProps = {
  children: ReactNode
  availableRoutes: Set<string>
}

export function NavigationProvider({ children, availableRoutes }: NavigationProviderProps) {
  const [stack, setStack] = useState<Route[]>(["home"])

  const resolveRoute = (route: Route): Route => {
    if (availableRoutes.has(route)) {
      return route
    }
    return "home"
  }

  const navigation = useMemo<NavigationApi>(() => ({
    route: stack[stack.length - 1],
    push: (route) => setStack((current) => [...current, resolveRoute(route)]),
    replace: (route) => setStack((current) => [...current.slice(0, -1), resolveRoute(route)]),
    back: () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)),
    reset: (route) => setStack([resolveRoute(route)]),
  }), [stack])

  return <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const navigation = useContext(NavigationContext)
  if (!navigation) {
    throw new Error("useNavigation must be used inside NavigationProvider")
  }
  return navigation
}
