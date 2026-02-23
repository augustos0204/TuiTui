import { readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import type { PageComponent, PageModule, Route } from "./types"

const PAGE_FILE = "page.tsx"

async function walkPageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkPageFiles(fullPath)))
      continue
    }

    if (entry.isFile() && entry.name === PAGE_FILE) {
      files.push(fullPath)
    }
  }

  return files
}

function routeFromPageFile(pagesDir: string, absoluteFilePath: string): Route {
  const relativePath = path.relative(pagesDir, absoluteFilePath).split(path.sep).join("/")

  if (relativePath === PAGE_FILE) {
    return "home"
  }

  return relativePath.replace(/\/page\.tsx$/, "")
}

export async function loadPages(): Promise<Record<Route, PageComponent>> {
  const currentFile = fileURLToPath(import.meta.url)
  const pagesDir = path.resolve(path.dirname(currentFile), "../pages")
  const files = await walkPageFiles(pagesDir)
  const pageEntries = await Promise.all(files.map(async (filePath) => {
    const moduleUrl = pathToFileURL(filePath).href
    const module = (await import(moduleUrl)) as PageModule
    const route = routeFromPageFile(pagesDir, filePath)

    if (typeof module.default !== "function") {
      throw new Error(`Page file must export default component: ${filePath}`)
    }

    return [route, module.default] as const
  }))

  return Object.fromEntries(pageEntries)
}
