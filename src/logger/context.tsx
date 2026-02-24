import { createContext, useContext, type ReactNode } from "react"
import type { LoggerFn } from "./types"

const LoggerContext = createContext<LoggerFn | null>(null)

type LoggerProviderProps = {
  logger: LoggerFn
  children: ReactNode
}

export function LoggerProvider({ logger, children }: LoggerProviderProps) {
  return <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
}

export function useLogger(): LoggerFn {
  const logger = useContext(LoggerContext)
  if (!logger) {
    throw new Error("useLogger must be used inside LoggerProvider")
  }
  return logger
}
