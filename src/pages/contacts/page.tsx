import { useTerminalDimensions } from "@opentui/react"
import { useEffect, useMemo, useState } from "react"
import { useClients } from "../../clients/context"
import { useContactSelection } from "../../contacts/context"
import type { Contact } from "../../contacts/types"
import type { PageProps } from "../../router/types"
import { useAppColors } from "../../theme/context"
import { useContactsCommander } from "./commander"

export default function ContactsPage({ navigation }: PageProps) {
  const colors = useAppColors()
  const {
    setSelectedContact,
    contactsSearchQuery,
    setContactsSearchQuery,
    contactsFocusTarget,
    setContactsFocusTarget,
  } = useContactSelection()
  const { activeClient, activeContacts, activeChats, activeContactsLoading, openActiveConversation } = useClients()
  const { width } = useTerminalDimensions()
  const [activeTab, setActiveTab] = useState<"contacts" | "chats">("chats")
  const [isLoadingContacts, setIsLoadingContacts] = useState(true)
  const [loaderFrame, setLoaderFrame] = useState(0)

  useContactsCommander()

  const tabOptions = [
    { name: "CHATS", description: "Recent conversations", value: "chats" },
    { name: "CONTACTS", description: "Address book", value: "contacts" },
  ] as const

  const sourceItems = activeTab === "contacts" ? activeContacts : activeChats
  const tabWidth = useMemo(() => {
    const tabsCount = 2
    const availableWidth = Math.max(24, width - 8)
    return Math.max(10, Math.floor(availableWidth / tabsCount))
  }, [width])

  const formatItemDescription = (item: { id: string; status?: string } & Record<string, unknown>) => {
    if (activeTab === "chats") {
      const preview = typeof item.preview === "string" ? item.preview : "No preview"
      const isGroup = item.kind === "group"
      if (isGroup) {
        const membersCount = typeof item.membersCount === "number" ? item.membersCount : 0
        return `${membersCount} members  •  ${preview}`
      }

      const formattedId = typeof item.formattedId === "string" ? item.formattedId : item.id
      return `${formattedId}  •  ${preview}`
    }

    const formattedId = typeof item.formattedId === "string" ? item.formattedId : item.id
    return `${formattedId}  •  ${item.status ?? "unknown"}`
  }

  const filteredContacts = useMemo(() => {
    const query = contactsSearchQuery.trim().toLowerCase()
    if (!query) {
      return sourceItems
    }

    return sourceItems.filter((contact) => contact.name.toLowerCase().includes(query))
  }, [contactsSearchQuery, sourceItems])

  useEffect(() => {
    if (!isLoadingContacts) {
      return
    }

    const interval = setInterval(() => {
      setLoaderFrame((current) => (current + 1) % 4)
    }, 300)

    return () => {
      clearInterval(interval)
    }
  }, [isLoadingContacts])

  useEffect(() => {
    if (!activeClient) {
      navigation.replace("home")
      return
    }

    if (activeClient.authStatus !== "authenticated") {
      navigation.replace("auth")
    }
  }, [activeClient?.id, activeClient?.authStatus, navigation])

  useEffect(() => {
    setIsLoadingContacts(activeContactsLoading)
  }, [activeContactsLoading])

  if (!activeClient || activeClient.authStatus !== "authenticated") {
    return null
  }

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
        <text fg={colors.textMuted}>
          {isLoadingContacts ? "Loading data" : `${filteredContacts.length} ${activeTab} available`}
        </text>
        <text fg={colors.textMuted}>{`Provider: ${activeClient.name}`}</text>
      </box>

      <box
        backgroundColor={contactsFocusTarget === "tabs" ? colors.surfaceFocus : colors.surface}
        padding={1}
        width="100%"
        flexShrink={0}
      >
        <tab-select
          focused={contactsFocusTarget === "tabs"}
          showDescription={false}
          showUnderline
          wrapSelection
          tabWidth={tabWidth}
          backgroundColor={colors.surface}
          textColor={colors.accent}
          focusedBackgroundColor={colors.surface}
          focusedTextColor={colors.text}
          selectedBackgroundColor={colors.primary}
          selectedTextColor={colors.background}
          options={tabOptions as unknown as { name: string; description: string; value?: string }[]}
          onChange={(_, option) => {
            if (option?.value === "contacts" || option?.value === "chats") {
              setActiveTab(option.value)
              setContactsFocusTarget("list")
            }
          }}
        />
      </box>

      <box
        backgroundColor={contactsFocusTarget === "list" || contactsFocusTarget === "search" ? colors.surfaceFocus : colors.surface}
        padding={1}
        flexGrow={1}
        minHeight={0}
        width="100%"
      >
        {isLoadingContacts ? (
          <box flexGrow={1} width="100%" justifyContent="center" alignItems="center">
            <text fg={colors.accent}>{`Loading contacts${".".repeat(loaderFrame)}`}</text>
          </box>
        ) : (
          <>
            <input
              focused={contactsFocusTarget === "search"}
              value={contactsSearchQuery}
              placeholder="Ctrl+F to search contacts by name"
              backgroundColor={colors.background}
              textColor={colors.text}
              focusedBackgroundColor={colors.background}
              focusedTextColor={colors.text}
              placeholderColor={colors.textMuted}
              onChange={setContactsSearchQuery}
              onSubmit={() => {
                setContactsFocusTarget("list")
              }}
            />
            <select
              focused={contactsFocusTarget === "list"}
              showDescription
              backgroundColor={colors.surface}
              textColor={colors.accent}
              focusedBackgroundColor={colors.surface}
              focusedTextColor={colors.text}
              selectedBackgroundColor={colors.primary}
              selectedTextColor={colors.background}
              height="100%"
              options={filteredContacts.map((contact) => ({
                name: contact.name,
                description: formatItemDescription(contact as { id: string; status?: string } & Record<string, unknown>),
                value: contact.id,
              }))}
              onSelect={(_, option) => {
                const contact = filteredContacts.find((item) => item.id === option?.value)
                if (!contact) return

                const details = contact as { kind?: string; membersCount?: number; preview?: string; formattedId?: string }

                setSelectedContact({
                  id: contact.id,
                  name: contact.name,
                  status: contact.status ?? "unknown",
                  formattedId: details.formattedId,
                  kind: activeTab === "chats" ? (details.kind === "group" ? "group" : "chat") : "contact",
                  membersCount: details.membersCount,
                  preview: details.preview,
                } satisfies Contact)
                void openActiveConversation(contact.id)
                navigation.push("chat")
              }}
            />
          </>
        )}
      </box>
    </box>
  )
}
