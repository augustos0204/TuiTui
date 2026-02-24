import { useContactSelection } from "../../contacts/context"
import type { Contact } from "../../contacts/types"
import type { PageProps } from "../../router/types"
import { colors } from "../../theme/colors"

const mockContacts: Contact[] = [
  { id: "+55 11 98765-4321", name: "Ana Costa", status: "Online" },
  { id: "+55 21 99876-1002", name: "Bruno Lima", status: "Away" },
  { id: "+55 31 97744-5566", name: "Carla Souza", status: "Offline" },
  { id: "+55 41 98812-9034", name: "Diego Rocha", status: "Online" },
  { id: "+55 51 99123-7610", name: "Elisa Nunes", status: "Busy" },
]

export default function ContactsPage({ navigation }: PageProps) {
  const { setSelectedContact } = useContactSelection()

  return (
    <box
      flexDirection="column"
      backgroundColor={colors.background}
      width="100%"
      height="100%"
      gap={1}
    >
      <box backgroundColor={colors.surface} padding={1} width="100%" flexShrink={0} minHeight={4}>
        <text fg={colors.text}>Contacts</text>
        <text fg={colors.textMuted}>{`${mockContacts.length} contacts available`}</text>
      </box>

      <box backgroundColor={colors.surface} padding={1} flexGrow={1} minHeight={0} width="100%">
        <select
          focused
          showDescription
          backgroundColor={colors.surface}
          textColor={colors.accent}
          focusedBackgroundColor={colors.surface}
          focusedTextColor={colors.text}
          selectedBackgroundColor={colors.primary}
          selectedTextColor={colors.background}
          height="100%"
          options={mockContacts.map((contact) => ({
            name: contact.name,
            description: `ID: ${contact.id}  •  ${contact.status}`,
            value: contact.id,
          }))}
          onSelect={(_, option) => {
            const contact = mockContacts.find((item) => item.id === option?.value)
            if (!contact) return

            setSelectedContact(contact)
            navigation.push("chat")
          }}
        />
      </box>

      <box backgroundColor={colors.surface} padding={1} width="100%" flexShrink={0} minHeight={4}>
        <text fg={colors.textMuted}>Use arrows and ENTER to open a conversation.</text>
        <text fg={colors.textMuted}>Use PageDown to go back.</text>
      </box>
    </box>
  )
}
