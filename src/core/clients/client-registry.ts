import { Client } from "./client"

export class ClientRegistry {
  private clients = new Map<string, Client>()
  private activeClientId: string | null = null

  register(client: Client) {
    this.clients.set(client.id, client)
    if (!this.activeClientId) {
      this.activeClientId = client.id
    }
  }

  get(clientId: string) {
    return this.clients.get(clientId) ?? null
  }

  remove(clientId: string) {
    const client = this.clients.get(clientId)
    if (!client) {
      return
    }

    client.destroy()
    this.clients.delete(clientId)

    if (this.activeClientId === clientId) {
      const nextClient = this.clients.keys().next()
      this.activeClientId = nextClient.done ? null : nextClient.value
    }
  }

  list() {
    return Array.from(this.clients.values())
  }

  setActive(clientId: string) {
    if (!this.clients.has(clientId)) {
      return false
    }

    this.activeClientId = clientId
    return true
  }

  getActive() {
    if (!this.activeClientId) {
      return null
    }
    return this.clients.get(this.activeClientId) ?? null
  }

  clear() {
    for (const client of this.clients.values()) {
      client.destroy()
    }
    this.clients.clear()
    this.activeClientId = null
  }
}
