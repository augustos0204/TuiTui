import { useEffect, useRef, useState } from "react"
import { useClients } from "../../clients/context"
import { useAppColors } from "../../theme/context"

function truncateWithEllipsis(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value
  }

  if (maxLength <= 3) {
    return ".".repeat(Math.max(0, maxLength))
  }

  return `${value.slice(0, maxLength - 3)}...`
}

export function NotificationBar() {
  const colors = useAppColors()
  const { subscribeToIncomingNotifications } = useClients()
  const [notificationDisplay, setNotificationDisplay] = useState("")
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return subscribeToIncomingNotifications((notificationText) => {
      const targetText = truncateWithEllipsis(notificationText, 220)

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current)
      }

      setNotificationDisplay("")
      let visibleChars = 0
      revealIntervalRef.current = setInterval(() => {
        visibleChars += 1
        setNotificationDisplay(targetText.slice(0, visibleChars))
        if (visibleChars >= targetText.length) {
          if (revealIntervalRef.current) {
            clearInterval(revealIntervalRef.current)
            revealIntervalRef.current = null
          }
        }
      }, 10)

      hideTimeoutRef.current = setTimeout(() => {
        setNotificationDisplay("")
        if (revealIntervalRef.current) {
          clearInterval(revealIntervalRef.current)
          revealIntervalRef.current = null
        }
        hideTimeoutRef.current = null
      }, 3500)
    })
  }, [subscribeToIncomingNotifications])

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
      if (revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current)
      }
    }
  }, [])

  return (
    <box width="100%" height={1} paddingLeft={1} paddingRight={1} backgroundColor={colors.background}>
      <text fg={colors.accent}>{notificationDisplay}</text>
    </box>
  )
}
