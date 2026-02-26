export type Conversation = {
  id: string
  name: string
  status?: string
  preview?: string
  formattedId?: string
  kind?: "direct" | "group"
  membersCount?: number
}
