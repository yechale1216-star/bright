
"use client"

import * as React from "react"

export interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: string
  defaultTheme?: string
  enableSystem?: boolean
  storageKey?: string
}

export function ThemeProvider({ 
  children, 
  attribute = "class", 
  defaultTheme = "dark",
  enableSystem = true,
  storageKey = "theme"
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<string>(defaultTheme)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) || defaultTheme
    setTheme(savedTheme)
    setMounted(true)
  }, [defaultTheme, storageKey])

  React.useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    root.classList.remove("light", "dark")

    if (theme === "system" && enableSystem) {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }

    localStorage.setItem(storageKey, theme)
  }, [theme, mounted, enableSystem, storageKey])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

const ThemeContext = React.createContext<{
  theme: string
  setTheme: (theme: string) => void
} | undefined>(undefined)

export const useTheme = () => {
  const context = React.useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
