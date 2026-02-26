import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { MockProvider, WhatsAppProvider } from "../Providers"
import { Client, ClientRegistry } from "../core/clients"
import type { AuthPrompt, AuthStatus, AuthSubmission } from "../domain/auth"
import type { Contact } from "../domain/contact"
import type { Conversation } from "../domain/conversation"
import type { ChatMessage, MessageAttachment, OutboundMessagePayload } from "../domain/message"

type ClientView = {
  id: string
  name: string
  providerId: string
  authStatus: AuthStatus
  authPrompt: AuthPrompt | null
  authWaitingMessage: string | null
}

type ClientsContextValue = {
  clients: ClientView[]
  activeClientId: string | null
  activeClient: ClientView | null
  activeContacts: Contact[]
  activeChats: Conversation[]
  activeContactsLoading: boolean
  activeAuthErrorMessage: string | null
  getActiveMessagesForContact: (contactId: string | null) => ChatMessage[]
  getActiveTypingNamesForContact: (contactId: string | null) => string[]
  subscribeToIncomingNotifications: (listener: (notificationText: string) => void) => () => void
  editActiveMessage: (contactId: string, messageId: string, nextContent: string) => Promise<boolean>
  deleteActiveMessage: (contactId: string, messageId: string) => Promise<boolean>
  openClient: (clientId: string) => Promise<string>
  submitActiveAuth: (payload: AuthSubmission) => Promise<void>
  logoutActiveClient: () => Promise<boolean>
  shutdownAllClients: () => Promise<void>
  openActiveConversation: (contactId: string) => Promise<void>
  sendActiveMessage: (contactId: string, payload: OutboundMessagePayload) => Promise<void>
}

const ClientsContext = createContext<ClientsContextValue | null>(null)

type ClientsProviderProps = {
  children: ReactNode
}

function routeForPrompt(prompt: AuthPrompt | null): string {
  if (!prompt) {
    return "auth"
  }

  return "auth"
}

export function ClientsProvider({ children }: ClientsProviderProps) {
  const registryRef = useRef(new ClientRegistry())
  const clientStatesRef = useRef<Map<string, ClientView>>(new Map())
  const [clients, setClients] = useState<ClientView[]>([])
  const [activeClientId, setActiveClientId] = useState<string | null>(null)
  const [contactsByClient, setContactsByClient] = useState<Record<string, Contact[]>>({})
  const [chatsByClient, setChatsByClient] = useState<Record<string, Conversation[]>>({})
  const [contactsLoadingByClient, setContactsLoadingByClient] = useState<Record<string, boolean>>({})
  const [chatsLoadingByClient, setChatsLoadingByClient] = useState<Record<string, boolean>>({})
  const [authErrorByClient, setAuthErrorByClient] = useState<Record<string, string | null>>({})
  const [messagesByClientAndContact, setMessagesByClientAndContact] = useState<Record<string, ChatMessage[]>>({})
  const [typingByClientAndContact, setTypingByClientAndContact] = useState<Record<string, Record<string, string>>>({})
  const incomingNotificationListenersRef = useRef(new Set<(notificationText: string) => void>())

  const setMessagesForConversation = (clientId: string, contactId: string, updater: (current: ChatMessage[]) => ChatMessage[]) => {
    const conversationKey = `${clientId}:${contactId}`
    setMessagesByClientAndContact((current) => {
      const currentMessages = current[conversationKey] ?? []
      return {
        ...current,
        [conversationKey]: updater(currentMessages),
      }
    })
  }

  const appendUniqueMessage = (messages: ChatMessage[], nextMessage: ChatMessage) => {
    if (messages.some((message) => message.id === nextMessage.id)) {
      return messages.map((message) => {
        if (message.id !== nextMessage.id) {
          return message
        }

        const nextBadges = nextMessage.badges ?? []
        const currentBadges = message.badges ?? []
        const mergedBadges = Array.from(new Map([...currentBadges, ...nextBadges].map((badge) => [badge.id, badge])).values())
        const nextIsDeleted = mergedBadges.some((badge) => badge.id === "meta:deleted")
        const resolvedContent = nextIsDeleted
          ? (message.content.trim() || nextMessage.content.trim() || "Mensagem deletada")
          : nextMessage.content

        return {
          ...message,
          ...nextMessage,
          content: resolvedContent,
          badges: mergedBadges,
        }
      })
    }
    return [...messages, nextMessage]
  }

  const setClientStateById = (clientId: string, fallback: ClientView, updater: (current: ClientView) => ClientView) => {
    const current = clientStatesRef.current.get(clientId) ?? fallback
    const next = updater(current)
    clientStatesRef.current.set(clientId, next)
    setClients(Array.from(clientStatesRef.current.values()))
  }

  const formatErrorMessage = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message
    }
    return fallback
  }

  const buildAttachmentBadges = (attachments: MessageAttachment[]) => {
    return attachments.map((attachment) => ({
      id: `attachment:${attachment.id}`,
      label: attachment.kind === "unknown" ? "File" : `${attachment.kind.charAt(0).toUpperCase()}${attachment.kind.slice(1)}`,
    }))
  }

  useEffect(() => {
    const definitions = [
      {
        client: new Client({ clientId: "mock-client-1", adapter: new MockProvider() }),
        name: "Mock Provider",
      },
      {
        client: new Client({ clientId: "whatsapp-client-1", adapter: new WhatsAppProvider() }),
        name: "WhatsApp",
      },
    ]

    const unsubscribers: Array<() => void> = []

    for (const definition of definitions) {
      const initialState: ClientView = {
        id: definition.client.id,
        name: definition.name,
        providerId: definition.client.providerId,
        authStatus: "offline",
        authPrompt: null,
        authWaitingMessage: null,
      }

      unsubscribers.push(
        definition.client.emitter.on("auth:waiting", ({ message }) => {
          setClientStateById(definition.client.id, initialState, (current) => ({ ...current, authWaitingMessage: message }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("auth:status", ({ status }) => {
          setClientStateById(definition.client.id, initialState, (current) => ({ ...current, authStatus: status }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("auth:prompt", ({ prompt }) => {
          setClientStateById(definition.client.id, initialState, (current) => ({ ...current, authPrompt: prompt }))
          setAuthErrorByClient((current) => ({ ...current, [definition.client.id]: null }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("auth:completed", () => {
          setClientStateById(definition.client.id, initialState, (current) => ({ ...current, authStatus: "authenticated", authWaitingMessage: null }))
          setAuthErrorByClient((current) => ({ ...current, [definition.client.id]: null }))
          setContactsLoadingByClient((current) => ({ ...current, [definition.client.id]: true }))
          setChatsLoadingByClient((current) => ({ ...current, [definition.client.id]: true }))
          void definition.client
            .listContacts()
            .catch((error) => {
              setAuthErrorByClient((current) => ({
                ...current,
                [definition.client.id]: formatErrorMessage(error, "Failed to load contacts"),
              }))
            })
            .finally(() => {
              setContactsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
            })
          void definition.client
            .listChats()
            .catch((error) => {
              setAuthErrorByClient((current) => ({
                ...current,
                [definition.client.id]: formatErrorMessage(error, "Failed to load chats"),
              }))
            })
            .finally(() => {
              setChatsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
            })
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("auth:logout", () => {
          setClientStateById(definition.client.id, initialState, (current) => ({ ...current, authStatus: "idle", authPrompt: null, authWaitingMessage: null }))
          setAuthErrorByClient((current) => ({ ...current, [definition.client.id]: null }))
          setContactsByClient((current) => ({ ...current, [definition.client.id]: [] }))
          setChatsByClient((current) => ({ ...current, [definition.client.id]: [] }))
          setContactsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
          setChatsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("client:error", ({ message }) => {
          setClientStateById(definition.client.id, initialState, (current) => ({
            ...current,
            authStatus: current.authStatus === "authenticated" ? "authenticated" : "failed",
            authWaitingMessage: null,
          }))
          setAuthErrorByClient((current) => ({
            ...current,
            [definition.client.id]: message,
          }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("auth:error", ({ message }) => {
          setAuthErrorByClient((current) => ({ ...current, [definition.client.id]: message }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("contacts:updated", ({ contacts }) => {
          setContactsByClient((current) => ({
            ...current,
            [definition.client.id]: contacts,
          }))
          setContactsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("chats:updated", ({ chats }) => {
          setChatsByClient((current) => ({
            ...current,
            [definition.client.id]: chats,
          }))
          setChatsLoadingByClient((current) => ({ ...current, [definition.client.id]: false }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("chat:history", ({ contactId, messages }) => {
          const conversationKey = `${definition.client.id}:${contactId}`
          setMessagesByClientAndContact((current) => ({
            ...current,
            [conversationKey]: messages,
          }))
          setTypingByClientAndContact((current) => ({
            ...current,
            [conversationKey]: {},
          }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("message:sent", ({ contactId, message }) => {
          setMessagesForConversation(definition.client.id, contactId, (current) => appendUniqueMessage(current, message))
          const conversationKey = `${definition.client.id}:${contactId}`
          setTypingByClientAndContact((current) => ({
            ...current,
            [conversationKey]: {},
          }))
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("message:received", ({ contactId, message }) => {
          setMessagesForConversation(definition.client.id, contactId, (current) => appendUniqueMessage(current, message))
          const senderName = message.senderName?.trim() || "Unknown"
          const scope = contactId.endsWith("@g.us") ? " (grupo)" : ""
          const content = message.content.trim() || "Mensagem sem texto"
          const notificationText = `${senderName}${scope}: ${content}`
          for (const listener of incomingNotificationListenersRef.current) {
            listener(notificationText)
          }
          const conversationKey = `${definition.client.id}:${contactId}`
          const senderKey = message.senderId ?? message.from
          if (!senderKey) {
            return
          }

          setTypingByClientAndContact((current) => {
            const currentConversation = current[conversationKey] ?? {}
            if (!(senderKey in currentConversation)) {
              return current
            }

            const nextConversation = { ...currentConversation }
            delete nextConversation[senderKey]
            return {
              ...current,
              [conversationKey]: nextConversation,
            }
          })
        }),
      )
      unsubscribers.push(
        definition.client.emitter.on("typing:updated", ({ contactId, participantId, participantName, isTyping }) => {
          const conversationKey = `${definition.client.id}:${contactId}`
          const key = participantId ?? participantName ?? "unknown"
          const displayName = participantName?.trim() || "Someone"

          setTypingByClientAndContact((current) => {
            const currentConversation = current[conversationKey] ?? {}

            if (isTyping) {
              return {
                ...current,
                [conversationKey]: {
                  ...currentConversation,
                  [key]: displayName,
                },
              }
            }

            if (!(key in currentConversation)) {
              return current
            }

            const nextConversation = { ...currentConversation }
            delete nextConversation[key]
            return {
              ...current,
              [conversationKey]: nextConversation,
            }
          })
        }),
      )

      registryRef.current.register(definition.client)
      clientStatesRef.current.set(definition.client.id, initialState)
    }

    setClients(Array.from(clientStatesRef.current.values()))

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }

      for (const definition of definitions) {
        void definition.client.disconnect()
      }
      registryRef.current.clear()
      clientStatesRef.current.clear()
      setClients([])
      setActiveClientId(null)
      setContactsByClient({})
      setChatsByClient({})
      setContactsLoadingByClient({})
      setChatsLoadingByClient({})
      setAuthErrorByClient({})
      setMessagesByClientAndContact({})
      setTypingByClientAndContact({})
      incomingNotificationListenersRef.current.clear()
    }
  }, [])

  const value = useMemo<ClientsContextValue>(() => {
    const activeClient = activeClientId
      ? clients.find((client) => client.id === activeClientId) ?? null
      : null
    const activeContacts = activeClient ? contactsByClient[activeClient.id] ?? [] : []
    const activeChats = activeClient ? chatsByClient[activeClient.id] ?? [] : []
    const activeContactsLoading = activeClient ? contactsLoadingByClient[activeClient.id] ?? false : false
    const activeChatsLoading = activeClient ? chatsLoadingByClient[activeClient.id] ?? false : false
    const activeAuthErrorMessage = activeClient ? authErrorByClient[activeClient.id] ?? null : null

    return {
      clients,
      activeClientId,
      activeClient,
      activeContacts,
      activeChats,
      activeContactsLoading: activeContactsLoading || activeChatsLoading,
      activeAuthErrorMessage,
      getActiveMessagesForContact: (contactId) => {
        if (!activeClient || !contactId) {
          return []
        }

        return messagesByClientAndContact[`${activeClient.id}:${contactId}`] ?? []
      },
      getActiveTypingNamesForContact: (contactId) => {
        if (!activeClient || !contactId) {
          return []
        }

        const namesByParticipant = typingByClientAndContact[`${activeClient.id}:${contactId}`] ?? {}
        return Object.values(namesByParticipant)
      },
      subscribeToIncomingNotifications: (listener) => {
        incomingNotificationListenersRef.current.add(listener)
        return () => {
          incomingNotificationListenersRef.current.delete(listener)
        }
      },
      editActiveMessage: async (contactId, messageId, nextContent) => {
        const active = registryRef.current.getActive()
        if (!active) {
          return false
        }

        const normalizedContent = nextContent.trim()
        if (!normalizedContent) {
          return false
        }

        const editedOnProvider = await active.editMessage(contactId, messageId, normalizedContent)
        if (!editedOnProvider) {
          return false
        }

        setMessagesForConversation(active.id, contactId, (current) => current.map((message) => {
          if (message.id !== messageId) {
            return message
          }

          const currentBadges = message.badges ?? []
          const nextBadges = currentBadges.some((badge) => badge.id === "meta:edited")
            ? currentBadges
            : [...currentBadges, { id: "meta:edited", label: "Edited" }]

          return {
            ...message,
            content: normalizedContent,
            timestamp: Date.now(),
            badges: nextBadges,
          }
        }))

        return true
      },
      deleteActiveMessage: async (contactId, messageId) => {
        const active = registryRef.current.getActive()
        if (!active) {
          return false
        }

        const deletedOnProvider = await active.deleteMessage(contactId, messageId)
        if (!deletedOnProvider) {
          return false
        }

        let updated = false
        setMessagesForConversation(active.id, contactId, (current) => current.map((message) => {
          if (message.id !== messageId) {
            return message
          }

          updated = true
          const badges = message.badges ?? []
          const withDeletedBadge = badges.some((badge) => badge.id === "meta:deleted")
            ? badges
            : [...badges, { id: "meta:deleted", label: "DELETED" }]

          return {
            ...message,
            content: message.content.trim() || "Mensagem deletada",
            badges: withDeletedBadge,
            timestamp: Date.now(),
          }
        }))
        return updated
      },
      openClient: async (clientId) => {
        const client = registryRef.current.get(clientId)
        const state = clientStatesRef.current.get(clientId)
        if (!client || !state) {
          return "home"
        }

        setActiveClientId(clientId)
        registryRef.current.setActive(clientId)

        if (state.authStatus === "offline") {
          try {
            await client.connect()
          } catch {
            setClientStateById(clientId, state, (current) => ({ ...current, authStatus: "failed" }))
            return "home"
          }
        }

        const connectedState = clientStatesRef.current.get(clientId) ?? state

        if (connectedState.authStatus === "authenticated") {
          if (!(contactsByClient[clientId]?.length > 0) && !contactsLoadingByClient[clientId]) {
            setContactsLoadingByClient((current) => ({ ...current, [clientId]: true }))
            void client
              .listContacts()
              .catch((error) => {
                setAuthErrorByClient((current) => ({
                  ...current,
                  [clientId]: formatErrorMessage(error, "Failed to load contacts"),
                }))
              })
              .finally(() => {
                setContactsLoadingByClient((current) => ({ ...current, [clientId]: false }))
              })
          }
          if (!(chatsByClient[clientId]?.length > 0) && !chatsLoadingByClient[clientId]) {
            setChatsLoadingByClient((current) => ({ ...current, [clientId]: true }))
            void client
              .listChats()
              .catch((error) => {
                setAuthErrorByClient((current) => ({
                  ...current,
                  [clientId]: formatErrorMessage(error, "Failed to load chats"),
                }))
              })
              .finally(() => {
                setChatsLoadingByClient((current) => ({ ...current, [clientId]: false }))
              })
          }
          return "contacts"
        }

        if (connectedState.authPrompt) {
          return routeForPrompt(connectedState.authPrompt)
        }

        try {
          await client.startAuth()
        } catch {
          setClientStateById(clientId, state, (current) => ({ ...current, authStatus: "failed" }))
          return "home"
        }

        const nextState = clientStatesRef.current.get(clientId) ?? state
        return routeForPrompt(nextState.authPrompt)
      },
      submitActiveAuth: async (payload) => {
        const active = registryRef.current.getActive()
        if (!active) {
          return
        }

        try {
          await active.submitAuth(payload)
        } catch {
          const current = clientStatesRef.current.get(active.id)
          if (current) {
            setClientStateById(active.id, current, (state) => ({ ...state, authStatus: "failed" }))
          }
        }
      },
      logoutActiveClient: async () => {
        const active = registryRef.current.getActive()
        if (!active) {
          return false
        }

        await active.logout()
        return true
      },
      shutdownAllClients: async () => {
        const allClients = registryRef.current.list()
        await Promise.allSettled(allClients.map(async (client) => {
          await client.disconnect()
        }))
      },
      openActiveConversation: async (contactId) => {
        const active = registryRef.current.getActive()
        if (!active) {
          return
        }

        try {
          await active.loadHistory(contactId)
        } catch (error) {
          setAuthErrorByClient((current) => ({
            ...current,
            [active.id]: formatErrorMessage(error, "Failed to load chat history"),
          }))
        }
      },
      sendActiveMessage: async (contactId, payload) => {
        const active = registryRef.current.getActive()
        if (!active) {
          return
        }

        try {
          await active.sendMessage(contactId, payload)
        } catch {
          const failedContent = payload.text?.trim() ?? ""
          const failedAttachments = payload.attachments ?? []
          const failedMessage: ChatMessage = {
            id: `failed-${Date.now()}`,
            clientId: active.id,
            contactId,
            from: "self",
            senderName: "You",
            replyToMessageId: payload.replyToMessageId,
            replyToSenderName: payload.replyToSenderName,
            replyPreviewText: payload.replyPreviewText,
            content: failedContent,
            contentType: failedAttachments.length > 0 ? failedAttachments[0].kind : "text",
            badges: buildAttachmentBadges(failedAttachments),
            attachments: failedAttachments,
            timestamp: Date.now(),
            status: "failed",
          }
          setMessagesForConversation(active.id, contactId, (current) => appendUniqueMessage(current, failedMessage))
        }
      },
    }
  }, [
    activeClientId,
    clients,
    contactsByClient,
    chatsByClient,
    contactsLoadingByClient,
    chatsLoadingByClient,
    authErrorByClient,
    messagesByClientAndContact,
    typingByClientAndContact,
  ])

  return <ClientsContext.Provider value={value}>{children}</ClientsContext.Provider>
}

export function useClients() {
  const context = useContext(ClientsContext)
  if (!context) {
    throw new Error("useClients must be used inside ClientsProvider")
  }
  return context
}
