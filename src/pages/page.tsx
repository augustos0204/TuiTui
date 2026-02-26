import Logo from "../components/logo/AsciiLogo"
import { useClients } from "../clients/context"
import type { PageProps } from "../router/types"
import { useAppColors } from "../theme/context"

export default function HomePage({ navigation }: PageProps) {
  const colors = useAppColors()
  const { clients, openClient } = useClients()

  const options = clients.map((client) => ({
    name: client.name,
    description: `Status: ${client.authStatus}`,
    value: client.id,
  }))

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
      <Logo transitionIn="Hello World" transitionOut="TuiTui" />
      <box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        width="100%"
        maxWidth={72}
      >
        <box
          title=" NAVIGATE WITH ARROW KEYS "
          titleAlignment="center"
          border
          borderStyle="double"
          borderColor={colors.primary}
          focusedBorderColor={colors.secondary}
          backgroundColor={colors.surface}
          width="100%"
          height={10}
          marginTop={1}
          marginBottom={1}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          flexDirection="column"
          gap={1}
        >
          <select
            focused
            showDescription
            backgroundColor={colors.surface}
            textColor={colors.accent}
            focusedBackgroundColor={colors.surface}
            focusedTextColor={colors.text}
            selectedBackgroundColor={colors.primary}
            selectedTextColor={colors.background}
            height={"100%"}
            options={options}
            onSelect={async (_, option) => {
              if (typeof option?.value !== "string") {
                return
              }

              const route = await openClient(option.value)
              navigation.push(route)
            }}
          />
        </box>
				<text fg={colors.text}>A future TUI to communicate with friends!</text>
        <text fg={colors.textMuted}>Use ENTER or click to open a destination.</text>
      </box>
    </box>
  )
}
