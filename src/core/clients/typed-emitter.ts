type Listener<TPayload> = (payload: TPayload) => void

export class TypedEmitter<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<Listener<TEvents[keyof TEvents]>>>()

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    const current = this.listeners.get(event) ?? new Set<Listener<TEvents[keyof TEvents]>>()
    current.add(listener as Listener<TEvents[keyof TEvents]>)
    this.listeners.set(event, current)
    return () => this.off(event, listener)
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    const current = this.listeners.get(event)
    if (!current) {
      return
    }

    current.delete(listener as Listener<TEvents[keyof TEvents]>)
    if (current.size === 0) {
      this.listeners.delete(event)
    }
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    const current = this.listeners.get(event)
    if (!current || current.size === 0) {
      return
    }

    for (const listener of current) {
      listener(payload as TEvents[keyof TEvents])
    }
  }

  removeAllListeners() {
    this.listeners.clear()
  }
}
