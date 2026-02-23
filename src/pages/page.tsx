import Logo from "../components/logo/component"
import type { PageProps } from "../router/types"
import { colors } from "../theme/colors"

export default function HomePage(_: PageProps) {
  return (
    <box
      border
      borderColor={colors.border}
      padding={1}
      flexDirection="column"
      backgroundColor={colors.background}
      justifyContent="space-evenly"
      alignItems="center"
      width="100%"
      height="100%"
    >
      <Logo />
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
      >
        <text fg={colors.text}>A future TUI to communicate with friends!</text>
        <text fg={colors.textMuted}>Press [q] to quit.</text>
      </box>
    </box>
  )
}
