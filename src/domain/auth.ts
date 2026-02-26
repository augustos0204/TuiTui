export type AuthStatus = "offline" | "idle" | "pending" | "authenticated" | "expired" | "failed"

export type AuthPrompt =
  | {
      type: "qr"
      value: string
      format?: "ascii" | "data-url"
      expiresAt?: number
    }
  | {
      type: "otp"
      code: string
      label?: string
      expiresAt?: number
      inputRequired?: boolean
    }
  | {
      type: "phone_number"
      label?: string
      placeholder?: string
    }
  | {
      type: "text"
      title?: string
      fields: AuthTextField[]
    }
  | {
      type: "token"
      label?: string
      placeholder?: string
      masked?: boolean
    }

export type AuthTextField = {
  id: string
  label: string
  placeholder?: string
  required?: boolean
  secret?: boolean
}

export type AuthSubmission =
  | { type: "otp"; value: string }
  | { type: "token"; value: string }
  | { type: "phone_number"; value: string }
  | { type: "text"; values: Record<string, string> }
  | { type: "pairing_code"; value: string }

export type AuthMethod = "qr" | "otp" | "token" | "text" | "phone_number" | "pairing_code"
