import { useEffect, useRef, useState } from "react"
import { useTimeline } from "@opentui/react"
import { useAppColors } from "../../theme/context"

type LogoProps = {
  transitionIn?: string
  transitionOut?: string
}

function buildTransitionText(progress: number, transitionIn: string, transitionOut: string): string {
  if (progress <= 0.5) {
    const hideProgress = progress / 0.5
    const visibleChars = Math.ceil(transitionIn.length * (1 - hideProgress))
    return transitionIn.slice(0, Math.max(0, visibleChars))
  }

  const showProgress = (progress - 0.5) / 0.5
  const visibleChars = Math.ceil(transitionOut.length * showProgress)
  return transitionOut.slice(0, Math.min(transitionOut.length, visibleChars))
}

export default function Logo({
  transitionIn = "Hello World",
  transitionOut = "TuiTui",
}: LogoProps) {
  const colors = useAppColors()
  const [text, setText] = useState(transitionIn)
  const timelineStarted = useRef(false)
  const timeline = useTimeline({ duration: 1400, autoplay: false, loop: false })

  useEffect(() => {
    setText(transitionIn)
    timelineStarted.current = false
  }, [transitionIn, transitionOut])

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
        setText(buildTransitionText(progress, transitionIn, transitionOut))
      },
      onComplete: () => {
        setText(transitionOut)
      },
    })

    timeline.play()
  }, [timeline, transitionIn, transitionOut])

  return (
    <box marginBottom={1}>
      <ascii-font text={text} font="block" color={colors.primary} />
    </box>
  )
}
