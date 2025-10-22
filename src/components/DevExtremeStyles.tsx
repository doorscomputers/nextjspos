"use client"

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

/**
 * DevExtremeStyles Component
 *
 * Dynamically loads DevExtreme CSS based on the current theme (light/dark).
 * This ensures DevExtreme components match the application's theme.
 *
 * Usage: Place in root layout to apply globally
 */
export function DevExtremeStyles() {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // Determine current theme (handle system preference)
    const currentTheme = theme === 'system' ? systemTheme : theme

    // Remove existing DevExtreme stylesheets
    const existingLinks = document.querySelectorAll('link[data-devextreme-theme]')
    existingLinks.forEach(link => link.remove())

    // Create and append new stylesheet link
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.setAttribute('data-devextreme-theme', 'true')

    // Use local DevExtreme CSS files from node_modules
    if (currentTheme === 'dark') {
      // Import dark theme dynamically
      import('devextreme/dist/css/dx.dark.css')
        .catch(err => {
          console.warn('DevExtreme dark theme not available, falling back to light theme', err)
          import('devextreme/dist/css/dx.light.css')
        })
    } else {
      // Import light theme
      import('devextreme/dist/css/dx.light.css')
    }

    return () => {
      // Cleanup on unmount
      link.remove()
    }
  }, [theme, systemTheme, mounted])

  return null // This component doesn't render anything
}
