import { createContext, useContext, useState, type ReactNode } from "react"
import type { Contact } from "./types"

type ContactContextValue = {
  selectedContact: Contact | null
  setSelectedContact: (contact: Contact | null) => void
}

const ContactContext = createContext<ContactContextValue | null>(null)

type ContactProviderProps = {
  children: ReactNode
}

export function ContactProvider({ children }: ContactProviderProps) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  return (
    <ContactContext.Provider value={{ selectedContact, setSelectedContact }}>
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
