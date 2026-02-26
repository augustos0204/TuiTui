export type AppColors = {
  primary: string
  secondary: string
  background: string
  surface: string
  surfaceFocus: string
  border: string
  text: string
  textMuted: string
  accent: string
  logger: {
    info: string
    warning: string
    error: string
  }
}

export const defaultColors: AppColors = {
  primary: "#ff3b30",
  secondary: "#ff7a70",
  background: "#0f0606",
  surface: "#1a0d0d",
  surfaceFocus: "#2a1515",
  border: "#5c1f1f",
  text: "#fff2f2",
  textMuted: "#c4a3a3",
  accent: "#ffd6d6",
  logger: {
    info: "#fff2f2",
    warning: "#ffd166",
    error: "#ff6b6b",
  },
}

export const colors: AppColors = defaultColors
