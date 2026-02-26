export type Contact = {
  id: string
  name: string
  status: string
  formattedId?: string
  kind?: "contact" | "chat" | "group"
  membersCount?: number
  preview?: string
}
