import { randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import type { MessageAttachment, MessageAttachmentKind } from "../../domain/message"

const textDecoder = new TextDecoder()

type CommandResult = {
  code: number
  stdout: Uint8Array
  stderr: Uint8Array
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    const stdoutChunks: Uint8Array[] = []
    const stderrChunks: Uint8Array[] = []

    child.stdout.on("data", (chunk: Uint8Array) => stdoutChunks.push(chunk))
    child.stderr.on("data", (chunk: Uint8Array) => stderrChunks.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      resolvePromise({
        code: code ?? 1,
        stdout: concatBytes(stdoutChunks),
        stderr: concatBytes(stderrChunks),
      })
    })
  })
}

async function commandExists(command: string) {
  const result = await runCommand("which", [command]).catch(() => ({ code: 1, stdout: new Uint8Array(0), stderr: new Uint8Array(0) }))
  return result.code === 0
}

function fileExtensionForMime(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png"
    case "image/jpeg":
      return "jpg"
    case "image/webp":
      return "webp"
    case "video/mp4":
      return "mp4"
    default:
      return "bin"
  }
}

function attachmentKindForMime(mimeType: string): MessageAttachmentKind {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("video/")) return "video"
  if (mimeType.startsWith("audio/")) return "audio"
  if (mimeType.includes("pdf") || mimeType.includes("officedocument") || mimeType.startsWith("application/")) {
    return "document"
  }
  return "unknown"
}

async function persistClipboardBytes(bytes: Uint8Array, mimeType: string): Promise<MessageAttachment> {
  const extension = fileExtensionForMime(mimeType)
  const id = randomUUID()
  const fileName = `clipboard-${id}.${extension}`
  const dataBase64 = Buffer.from(bytes).toString("base64")

  return {
    id,
    kind: attachmentKindForMime(mimeType),
    fileName,
    mimeType,
    sizeBytes: bytes.byteLength,
    dataBase64,
  }
}

async function readWaylandClipboardImage(): Promise<MessageAttachment | null> {
  if (!process.env.WAYLAND_DISPLAY || !(await commandExists("wl-paste"))) {
    return null
  }

  const types = await runCommand("wl-paste", ["--list-types"])
  if (types.code !== 0) {
    return null
  }

  const typeText = textDecoder.decode(types.stdout)
  const preferredMime = ["image/png", "image/jpeg", "image/webp"].find((mime) => typeText.includes(mime))
  if (!preferredMime) {
    return null
  }

  const imageData = await runCommand("wl-paste", ["--no-newline", "--type", preferredMime])
  if (imageData.code !== 0 || imageData.stdout.byteLength === 0) {
    return null
  }

  return persistClipboardBytes(imageData.stdout, preferredMime)
}

async function readX11ClipboardImage(): Promise<MessageAttachment | null> {
  if (!process.env.DISPLAY || !(await commandExists("xclip"))) {
    return null
  }

  const targets = await runCommand("xclip", ["-selection", "clipboard", "-t", "TARGETS", "-o"])
  if (targets.code !== 0) {
    return null
  }

  const targetText = textDecoder.decode(targets.stdout)
  const preferredMime = ["image/png", "image/jpeg", "image/webp"].find((mime) => targetText.includes(mime))
  if (!preferredMime) {
    return null
  }

  const imageData = await runCommand("xclip", ["-selection", "clipboard", "-t", preferredMime, "-o"])
  if (imageData.code !== 0 || imageData.stdout.byteLength === 0) {
    return null
  }

  return persistClipboardBytes(imageData.stdout, preferredMime)
}

export async function readClipboardFile() {
  const wayland = await readWaylandClipboardImage()
  if (wayland) {
    return wayland
  }

  const x11 = await readX11ClipboardImage()
  if (x11) {
    return x11
  }

  return null
}
