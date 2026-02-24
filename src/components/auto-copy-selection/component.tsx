import { useRenderer } from "@opentui/react"
import { useEffect, useRef } from "react"

const SELECTION_POLL_MS = 60
const COPY_DEBOUNCE_MS = 120

export default function AutoCopySelection() {
  const renderer = useRenderer()
  const lastCopiedRef = useRef("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!renderer.isOsc52Supported()) {
      return
    }

    const poll = setInterval(() => {
      const selectedText = renderer.getSelection()?.getSelectedText().trim() ?? ""
      if (!selectedText || selectedText === lastCopiedRef.current) {
        return
      }

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        const copied = renderer.copyToClipboardOSC52(selectedText)
        if (copied) {
          lastCopiedRef.current = selectedText
        }
      }, COPY_DEBOUNCE_MS)
    }, SELECTION_POLL_MS)

    return () => {
      clearInterval(poll)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [renderer])

  return null
}
