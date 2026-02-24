export type LogLevel = "info" | "warning" | "error"

export type LogEntry = {
  level: LogLevel
  message: string
  timestamp: number
}

export type LoggerFn = (level: LogLevel, message: string) => void
