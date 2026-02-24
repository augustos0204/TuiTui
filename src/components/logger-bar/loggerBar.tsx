import type { LogEntry } from "../../logger/types"
import { colors } from "../../theme/colors"

type LoggerBarProps = {
  logs: LogEntry[],
	height?: number
}

const levelVisuals = {
  info: { icon: "[i]", color: colors.logger.info, label: "INFO" },
  warning: { icon: "[!]", color: colors.logger.warning, label: "WARNING" },
  error: { icon: "[x]", color: colors.logger.error, label: "ERROR" },
} as const

export default function LoggerBar({ logs, height = 12 }: LoggerBarProps) {
  const entries = logs.length > 0
    ? logs
    : [{ level: "info", message: "Ready.", timestamp: Date.now() } satisfies LogEntry]

  return (
    <box
      border
      borderColor={colors.border}
      backgroundColor={colors.surface}
      height={height}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="column"
    >
      <box
				width="100%"
				flexDirection="row"
				justifyContent="space-between"
				border
				borderColor={colors.border}
				paddingBottom={1}
				paddingLeft={1}
				paddingRight={1}
			>
        <text fg={colors.text}>CONSOLE</text>
        <text fg={colors.textMuted}>{`${logs.length} logs`}</text>
      </box>
      <box
				width="100%"
				flexGrow={1}
			>
				<scrollbox
					stickyScroll
					stickyStart="bottom"
					paddingTop={1}
					height="100%"
					overflow="scroll"
				>
					{entries.map((entry, index) => {
						const visual = levelVisuals[entry.level]
						return (
							<box key={`${entry.timestamp}-${index}`} width="100%">
								<text fg={visual.color} wrapMode="word" truncate={false}>{`${visual.icon} ${visual.label}: ${entry.message}`}</text>
							</box>
						)
					})}
				</scrollbox>
			</box>
    </box>
  )
}
