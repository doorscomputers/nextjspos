'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ReactNode } from 'react'
import { useEffect } from 'react'
import { themes, type ThemeName } from '@/lib/themes'

// Helper function to apply theme CSS variables (for theme factory compatibility)
export function applyTheme(themeName: string) {
  if (typeof window === 'undefined') return

  const root = document.documentElement
  const themeData = themes[themeName as ThemeName]

  if (!themeData) {
    console.warn(`Theme "${themeName}" not found`)
    return
  }

  // Determine if we should use light or dark variant based on theme name
  const isDarkTheme = themeName === 'dark' || themeName === 'argon' ||
                      themeName === 'ocean' || themeName === 'midnight' ||
                      themeName === 'forest' || themeName === 'purple' ||
                      themeName === 'sunset' || themeName === 'rose-gold' ||
                      themeName === 'tech-neon' || themeName === 'elegant-gold'

  const variant = isDarkTheme ? 'dark' : 'light'
  const cssVars = themeData.cssVars[variant]

  // Apply CSS variables
  Object.entries(cssVars).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value)
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange={false}
      themes={['light', 'dark', 'argon', 'ocean', 'forest', 'purple', 'sunset', 'midnight', 'rose-gold', 'corporate', 'high-contrast', 'minimal', 'vibrant', 'retail-blue', 'restaurant-warm', 'pharmacy-medical', 'coffee-cozy', 'tech-neon', 'elegant-gold']}
    >
      <ThemeApplier />
      {children}
    </NextThemesProvider>
  )
}

function ThemeApplier() {
  useEffect(() => {
    // Apply theme CSS variables on mount and theme change
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const currentTheme = document.documentElement.className.split(' ').find((cls) =>
            Object.keys(themes).includes(cls)
          ) || 'light'

          applyTheme(currentTheme)
        }
      })
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    // Apply initial theme
    const currentTheme = document.documentElement.className.split(' ').find((cls) =>
      Object.keys(themes).includes(cls)
    ) || 'light'
    applyTheme(currentTheme)

    return () => observer.disconnect()
  }, [])

  return null
}
