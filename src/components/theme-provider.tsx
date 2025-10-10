'use client'

import * as React from 'react'
import { ThemeName, SidebarStyle, themes } from '@/lib/themes'

type Theme = 'light' | 'dark' | ThemeName

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeName
  defaultMode?: 'light' | 'dark'
  defaultSidebarStyle?: SidebarStyle
  storageKey?: string
}

interface ThemeProviderState {
  theme: ThemeName
  mode: 'light' | 'dark'
  sidebarStyle: SidebarStyle
  setTheme: (theme: ThemeName) => void
  setMode: (mode: 'light' | 'dark') => void
  setSidebarStyle: (style: SidebarStyle) => void
  toggleMode: () => void
}

const initialState: ThemeProviderState = {
  theme: 'light',
  mode: 'light',
  sidebarStyle: 'default',
  setTheme: () => null,
  setMode: () => null,
  setSidebarStyle: () => null,
  toggleMode: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  defaultMode = 'light',
  defaultSidebarStyle = 'default',
  storageKey = 'ultimatepos-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<ThemeName>(defaultTheme)
  const [mode, setModeState] = React.useState<'light' | 'dark'>(defaultMode)
  const [sidebarStyle, setSidebarStyleState] = React.useState<SidebarStyle>(defaultSidebarStyle)

  // Load theme from localStorage and server on mount
  React.useEffect(() => {
    // First load from localStorage for instant UI
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const { theme: storedTheme, mode: storedMode, sidebarStyle: storedSidebar } = JSON.parse(stored)
        if (storedTheme) setThemeState(storedTheme)
        if (storedMode) setModeState(storedMode)
        if (storedSidebar) setSidebarStyleState(storedSidebar)
      } catch (e) {
        // Invalid stored data, use defaults
      }
    }

    // Then sync with server preferences (if user is logged in)
    loadPreferencesFromServer()
      .then((prefs) => {
        if (prefs) {
          setThemeState(prefs.theme as ThemeName)
          setModeState(prefs.mode)
          setSidebarStyleState(prefs.sidebarStyle as SidebarStyle)
        }
      })
      .catch(() => {
        // User not logged in or error - use localStorage values
      })
  }, [storageKey])

  // Apply CSS variables when theme or mode changes
  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(mode)

    const themeConfig = themes[theme]
    if (themeConfig) {
      const cssVars = themeConfig.cssVars[mode]
      Object.entries(cssVars).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value)
      })
    }

    // Save to localStorage immediately
    localStorage.setItem(
      storageKey,
      JSON.stringify({ theme, mode, sidebarStyle })
    )

    // Debounce server save to avoid too many API calls
    const timeoutId = setTimeout(() => {
      savePreferencesToServer({ theme, mode, sidebarStyle })
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [theme, mode, sidebarStyle, storageKey])

  const setTheme = React.useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme)
  }, [])

  const setMode = React.useCallback((newMode: 'light' | 'dark') => {
    setModeState(newMode)
  }, [])

  const setSidebarStyle = React.useCallback((newStyle: SidebarStyle) => {
    setSidebarStyleState(newStyle)
  }, [])

  const toggleMode = React.useCallback(() => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const value = React.useMemo(
    () => ({
      theme,
      mode,
      sidebarStyle,
      setTheme,
      setMode,
      setSidebarStyle,
      toggleMode,
    }),
    [theme, mode, sidebarStyle, setTheme, setMode, setSidebarStyle, toggleMode]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}

// Helper function to load preferences from server
async function loadPreferencesFromServer(): Promise<{
  theme: string
  mode: 'light' | 'dark'
  sidebarStyle: string
} | null> {
  try {
    const response = await fetch('/api/user/preferences')
    if (!response.ok) return null
    return await response.json()
  } catch (error) {
    console.debug('Failed to load preferences from server:', error)
    return null
  }
}

// Helper function to save preferences to server
async function savePreferencesToServer(preferences: {
  theme: ThemeName
  mode: 'light' | 'dark'
  sidebarStyle: SidebarStyle
}) {
  try {
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    })
  } catch (error) {
    // Silently fail - localStorage will still work
    console.debug('Failed to save preferences to server:', error)
  }
}
