import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { useClients } from "../clients/context"
import { defaultColors, type AppColors } from "./colors"
import { loadProviderColors, resolveProviderColors } from "./dispatcher"

const ThemeContext = createContext<AppColors>(defaultColors)

type ThemeProviderProps = {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { activeClient } = useClients()
  const [resolvedColors, setResolvedColors] = useState<AppColors>(defaultColors)

  useEffect(() => {
    let cancelled = false

    setResolvedColors(defaultColors)

    void (async () => {
      const providerColors = await loadProviderColors(activeClient?.providerId ?? null)
      if (cancelled) {
        return
      }

      setResolvedColors(resolveProviderColors(providerColors))
    })()

    return () => {
      cancelled = true
    }
  }, [activeClient?.providerId])

  return <ThemeContext.Provider value={resolvedColors}>{children}</ThemeContext.Provider>
}

export function useAppColors() {
  return useContext(ThemeContext)
}
