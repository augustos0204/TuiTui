import type { TextareaRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useClients } from "../../clients/context"
import type { AuthTextField } from "../../domain/auth"
import type { PageProps } from "../../router/types"
import { useAppColors } from "../../theme/context"
import Logo from "../../components/logo/AsciiLogo"

const OTP_LENGTH = 8
const PHONE_MAX_LENGTH = 15

const fallbackFields: AuthTextField[] = [
  { id: "client_id", label: "Client ID", required: true, placeholder: "Enter client id" },
  { id: "client_secret", label: "Client Secret", required: true, placeholder: "Enter client secret", secret: true },
]

export default function AuthPage({ navigation }: PageProps) {
  const colors = useAppColors()
  const tokenRef = useRef<TextareaRenderable | null>(null)
  const { activeClient, activeAuthErrorMessage, submitActiveAuth } = useClients()

  const [singleValue, setSingleValue] = useState("")
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  const [focusIndex, setFocusIndex] = useState(0)
  const [lastSubmission, setLastSubmission] = useState("Awaiting credentials")
  const [loaderFrame, setLoaderFrame] = useState(0)

  const prompt = activeClient?.authPrompt ?? null
  const waitingMessage = activeClient?.authWaitingMessage ?? null
  const textFields = useMemo(() => (prompt?.type === "text" ? prompt.fields : fallbackFields), [prompt])

  const sanitizeOtp = (raw: string) => raw.replace(/\D/g, "").slice(0, OTP_LENGTH)
  const sanitizePhone = (raw: string) => raw.replace(/\D/g, "").slice(0, PHONE_MAX_LENGTH)

  useEffect(() => {
    if (!activeClient) {
      navigation.replace("home")
      return
    }

    if (activeClient.authStatus === "authenticated") {
      navigation.replace("contacts")
    }
  }, [activeClient, navigation])

  useEffect(() => {
    if (!waitingMessage) {
      setLoaderFrame(0)
      return
    }

    const interval = setInterval(() => {
      setLoaderFrame((current) => (current + 1) % 4)
    }, 350)

    return () => clearInterval(interval)
  }, [waitingMessage])

  useEffect(() => {
    setSingleValue("")
    if (prompt?.type === "text") {
      setTextValues((current) => {
        const next: Record<string, string> = {}
        for (const field of textFields) {
          next[field.id] = current[field.id] ?? ""
        }
        return next
      })
      setFocusIndex(0)
    }
  }, [prompt, textFields])

  useKeyboard((key) => {
    if (prompt?.type !== "text" || key.name !== "tab") {
      return
    }

    setFocusIndex((current) => {
      if (textFields.length === 0) return 0
      if (key.shift) {
        return (current - 1 + textFields.length) % textFields.length
      }
      return (current + 1) % textFields.length
    })
  })

  if (!activeClient) {
    return null
  }

  const otpPrompt = prompt?.type === "otp" ? prompt : null
  const otpInputRequired = otpPrompt?.inputRequired ?? true
  const otpDigits = sanitizeOtp(singleValue)
  const otpDisplayValue = `${otpDigits.slice(0, 4).padEnd(4, "_")}-${otpDigits.slice(4, 8).padEnd(4, "_")}`
  const otpCodeDisplay = otpPrompt?.code
    ? `${otpPrompt.code.slice(0, 4)}-${otpPrompt.code.slice(4, 8)}`
    : otpDisplayValue

  const submitSingle = () => {
    if (!prompt) {
      setLastSubmission("Waiting provider prompt")
      return
    }

    if (prompt.type === "phone_number") {
      const normalized = sanitizePhone(singleValue)
      if (normalized.length < 10) {
        setLastSubmission("Phone number looks too short")
        return
      }

      void submitActiveAuth({ type: "phone_number", value: normalized })
      setLastSubmission("Phone login submitted")
      return
    }

    if (prompt.type === "otp") {
      if (!otpInputRequired) {
        setLastSubmission("Waiting authentication confirmation")
        return
      }

      const normalized = sanitizeOtp(singleValue)
      if (normalized.length !== OTP_LENGTH) {
        setLastSubmission(`OTP must be ${OTP_LENGTH} digits`)
        return
      }

      void submitActiveAuth({ type: "otp", value: normalized })
      setLastSubmission("OTP submitted")
      return
    }

    if (prompt.type === "token") {
      const normalized = (prompt.masked ? tokenRef.current?.plainText : singleValue)?.trim() ?? ""
      if (!normalized) {
        setLastSubmission("Token is required")
        return
      }

      void submitActiveAuth({ type: "token", value: normalized })
      setLastSubmission("Token submitted")
      return
    }
  }

  const submitText = () => {
    for (const field of textFields) {
      if (field.required && !(textValues[field.id] ?? "").trim()) {
        setLastSubmission(`${field.label} is required`)
        return
      }
    }

    void submitActiveAuth({ type: "text", values: textValues })
    setLastSubmission("Credentials submitted")
  }

  const title = prompt?.type === "phone_number"
    ? (prompt.label ?? "Phone Login")
    : prompt?.type === "otp"
      ? (prompt.label ?? "OTP Authentication")
      : prompt?.type === "token"
        ? (prompt.label ?? "Token Authentication")
        : prompt?.type === "text"
          ? (prompt.title ?? "Text Authentication")
          : prompt?.type === "qr"
            ? "QR Authentication"
            : "Authentication"

  return (
    <box
      border
      borderColor={colors.border}
      padding={1}
      flexDirection="column"
      backgroundColor={colors.background}
      justifyContent="space-evenly"
      alignItems="center"
      width="100%"
      height="100%"
    >
      <Logo transitionIn="TuiTui" transitionOut={activeClient.name} />

      <box
        flexDirection="column"
        width="100%"
        maxWidth={72}
        alignItems="center"
        justifyContent="center"
        gap={1}
      >
        <text fg={colors.text}>{title}</text>
        <text fg={colors.textMuted}>{`Provider: ${activeClient.name}`}</text>
        {waitingMessage && <text fg={colors.accent}>{`${waitingMessage}${".".repeat(loaderFrame)}`}</text>}

        {prompt?.type === "qr" && (
          <box width="100%" flexDirection="column" gap={1}>
            <text fg={colors.textMuted}>Scan the QR code using your mobile app.</text>
            <box border borderColor={colors.border} backgroundColor={colors.surface} padding={1}>
              <text fg={colors.accent} wrapMode="word" truncate={false}>{prompt.value}</text>
            </box>
          </box>
        )}

        {prompt?.type === "phone_number" && (
          <input
            focused
            value={singleValue}
            width={20}
            maxLength={PHONE_MAX_LENGTH}
            placeholder={prompt.placeholder ?? "5511999999999"}
            backgroundColor={colors.background}
            textColor={colors.text}
            focusedBackgroundColor={colors.background}
            focusedTextColor={colors.text}
            placeholderColor={colors.textMuted}
            onChange={(nextValue) => setSingleValue(sanitizePhone(nextValue))}
            onInput={(nextValue) => setSingleValue(sanitizePhone(nextValue))}
            onSubmit={submitSingle}
          />
        )}

        {prompt?.type === "otp" && (
          <>
            <input
              key={otpCodeDisplay}
              value={otpCodeDisplay}
              width={12}
              backgroundColor={colors.background}
              textColor={colors.accent}
              focusedBackgroundColor={colors.background}
              focusedTextColor={colors.accent}
              placeholderColor={colors.textMuted}
            />
            {otpInputRequired ? (
              <input
                focused
                value={singleValue}
                maxLength={OTP_LENGTH}
                placeholder=""
                position="absolute"
                left={-9999}
                top={-9999}
                width={1}
                backgroundColor={colors.background}
                textColor={colors.background}
                focusedBackgroundColor={colors.background}
                focusedTextColor={colors.background}
                placeholderColor={colors.background}
                onChange={(nextValue) => setSingleValue(sanitizeOtp(nextValue))}
                onInput={(nextValue) => setSingleValue(sanitizeOtp(nextValue))}
                onSubmit={submitSingle}
              />
            ) : (
              <text fg={colors.textMuted}>Use this code in your mobile app to finish login.</text>
            )}
          </>
        )}

        {prompt?.type === "token" && (
          prompt.masked ? (
            <textarea
              ref={tokenRef}
              focused
              width="100%"
              height={4}
              placeholder={prompt.placeholder ?? "Paste token and press ENTER"}
              backgroundColor={colors.background}
              textColor={colors.text}
              focusedBackgroundColor={colors.background}
              focusedTextColor={colors.text}
              placeholderColor={colors.textMuted}
              keyBindings={[
                { name: "return", action: "submit" },
                { name: "linefeed", action: "submit" },
              ]}
              onSubmit={submitSingle}
            />
          ) : (
            <input
              focused
              value={singleValue}
              placeholder={prompt.placeholder ?? "Enter token"}
              backgroundColor={colors.background}
              textColor={colors.text}
              focusedBackgroundColor={colors.background}
              focusedTextColor={colors.text}
              placeholderColor={colors.textMuted}
              onChange={setSingleValue}
              onInput={setSingleValue}
              onSubmit={submitSingle}
            />
          )
        )}

        {prompt?.type === "text" && (
          <box flexDirection="column" width="100%" gap={1}>
            {textFields.map((field, index) => (
              <box key={field.id} flexDirection="column" gap={1}>
                <text fg={colors.textMuted}>{field.label}</text>
                <input
                  focused={index === focusIndex}
                  value={textValues[field.id] ?? ""}
                  placeholder={field.placeholder ?? ""}
                  backgroundColor={colors.background}
                  textColor={colors.text}
                  focusedBackgroundColor={colors.background}
                  focusedTextColor={colors.text}
                  placeholderColor={colors.textMuted}
                  onChange={(nextValue) => setTextValues((current) => ({ ...current, [field.id]: nextValue }))}
                  onSubmit={submitText}
                />
              </box>
            ))}
            <text fg={colors.textMuted}>Press TAB to switch field and ENTER to submit.</text>
          </box>
        )}

        {!prompt && <text fg={colors.textMuted}>Waiting provider authentication prompt...</text>}

        <text fg={activeAuthErrorMessage ? colors.logger.error : colors.textMuted}>
          {activeAuthErrorMessage ?? lastSubmission}
        </text>
      </box>
    </box>
  )
}
