import type { ReactNode } from "react"

export type Route = "home" | string

export type NavigationApi = {
  route: Route
  push: (route: Route) => void
  replace: (route: Route) => void
  back: () => void
  reset: (route: Route) => void
}

export type PageProps = {
  navigation: NavigationApi
}

export type PageComponent = (props: PageProps) => ReactNode

export type PageModule = {
  default: PageComponent
}
