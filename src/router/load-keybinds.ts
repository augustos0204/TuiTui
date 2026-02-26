import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { KeybindHandler, KeybindModule, KeybindShortcut } from "./keybind-types"
import type { Route } from "./types"

const KEYBIND_FILE = "keybind.ts"

async function walkKeybindFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkKeybindFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name === KEYBIND_FILE) {
      files.push(fullPath)
    }
  }

  return files
}

function routeFromKeybindFile(pagesDir: string, absoluteFilePath: string): Route {
  const relativePath = path.relative(pagesDir, absoluteFilePath).split(path.sep).join("/")

  if (relativePath === KEYBIND_FILE) {
    return "home"
  }

  return relativePath.replace(/\/keybind\.ts$/, "")
}

export type LoadedPageKeybinds = {
  handlers: Record<Route, KeybindHandler>
  shortcuts: Record<Route, KeybindShortcut[]>
}

export async function loadPageKeybinds(): Promise<LoadedPageKeybinds> {
  const currentFile = fileURLToPath(import.meta.url)
  const pagesDir = path.resolve(path.dirname(currentFile), "../pages")
  const files = await walkKeybindFiles(pagesDir)

  const entries = await Promise.all(files.map(async (filePath) => {
    const moduleUrl = pathToFileURL(filePath).href
    const module = (await import(moduleUrl)) as Partial<KeybindModule>
    const route = routeFromKeybindFile(pagesDir, filePath)

    if (typeof module.onKeybind !== "function") {
      throw new Error(`Keybind file must export onKeybind function: ${filePath}`)
    }

    return {
      route,
      handler: module.onKeybind,
      shortcuts: module.shortcuts ?? [],
    }
  }))

  return {
    handlers: Object.fromEntries(entries.map((entry) => [entry.route, entry.handler])),
    shortcuts: Object.fromEntries(entries.map((entry) => [entry.route, entry.shortcuts])),
  }
}
