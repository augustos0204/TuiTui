import { createContext, useContext, useState, type ReactNode } from "react"
import type { Contact } from "./types"

export type ContactsFocusTarget = "tabs" | "search" | "list"

type ContactContextValue = {
  selectedContact: Contact | null
  setSelectedContact: (contact: Contact | null) => void
  contactsSearchQuery: string
  setContactsSearchQuery: (value: string) => void
  contactsFocusTarget: ContactsFocusTarget
  setContactsFocusTarget: (target: ContactsFocusTarget) => void
  cycleContactsFocus: (reverse?: boolean) => void
  focusContactsSearch: () => void
  clearContactsSearch: () => void
}

const ContactContext = createContext<ContactContextValue | null>(null)

type ContactProviderProps = {
  children: ReactNode
}

export function ContactProvider({ children }: ContactProviderProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactsSearchQuery, setContactsSearchQuery] = useState("")
  const [contactsFocusTarget, setContactsFocusTarget] = useState<ContactsFocusTarget>("list")

  const cycleContactsFocus = (reverse = false) => {
    setContactsFocusTarget((current) => {
      if (current === "search") {
        return "list"
      }

      if (reverse) {
        return current === "tabs" ? "list" : "tabs"
      }

      return current === "tabs" ? "list" : "tabs"
    })
  }

  const focusContactsSearch = () => {
    setContactsFocusTarget("search")
  }

  const clearContactsSearch = () => {
    setContactsSearchQuery("")
    setContactsFocusTarget("list")
  }

  return (
    <ContactContext.Provider
      value={{
        selectedContact,
        setSelectedContact,
        contactsSearchQuery,
        setContactsSearchQuery,
        contactsFocusTarget,
        setContactsFocusTarget,
        cycleContactsFocus,
        focusContactsSearch,
        clearContactsSearch,
      }}
    >
      {children}
    </ContactContext.Provider>
  )
}

export function useContactSelection() {
  const context = useContext(ContactContext)
  if (!context) {
    throw new Error("useContactSelection must be used inside ContactProvider")
  }
  return context
}
