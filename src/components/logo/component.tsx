import { useEffect, useRef, useState } from "react"
import { useTimeline } from "@opentui/react"
import { colors } from "../../theme/colors"

const FROM_TEXT = "Hello World"
const TO_TEXT = "TuiTui"

function buildTransitionText(progress: number): string {
  if (progress <= 0.5) {
    const hideProgress = progress / 0.5
    const visibleChars = Math.ceil(FROM_TEXT.length * (1 - hideProgress))
    return FROM_TEXT.slice(0, Math.max(0, visibleChars))
  }

  const showProgress = (progress - 0.5) / 0.5
  const visibleChars = Math.ceil(TO_TEXT.length * showProgress)
  return TO_TEXT.slice(0, Math.min(TO_TEXT.length, visibleChars))
}

export default function Logo() {
  const [text, setText] = useState(FROM_TEXT)
  const timelineStarted = useRef(false)
  const timeline = useTimeline({ duration: 1400, autoplay: false, loop: false })

  useEffect(() => {
    if (timelineStarted.current) {
      return
    }

    timelineStarted.current = true
    const state = { progress: 0 }

    timeline.add(state, {
      progress: 1,
      duration: 1400,
      ease: "inOutQuad",
      onUpdate: (animation) => {
        const progress = animation.targets[0].progress as number
        setText(buildTransitionText(progress))
      },
      onComplete: () => {
        setText(TO_TEXT)
      },
    })

    timeline.play()
  }, [timeline])

  return (
    <box marginBottom={1}>
      <ascii-font text={text} font="block" color={colors.primary} />
    </box>
  )
}
