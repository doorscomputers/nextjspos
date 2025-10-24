'use client'

import * as React from 'react'
import { MoonIcon, SunIcon, SwatchIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { themes, type ThemeName } from '@/lib/themes'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.theme-switcher-container')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
      >
        <SunIcon className="h-5 w-5" />
      </Button>
    )
  }

  const popularThemes: ThemeName[] = ['light', 'dark', 'argon', 'ocean', 'purple', 'forest']

  return (
    <div className="relative theme-switcher-container">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => setIsOpen(!isOpen)}
      >
        {theme === 'dark' ? (
          <MoonIcon className="h-5 w-5" />
        ) : theme === 'light' ? (
          <SunIcon className="h-5 w-5" />
        ) : (
          <SwatchIcon className="h-5 w-5" />
        )}
        <span className="sr-only">Change theme</span>
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 border-2 border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Choose Theme</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Select your preferred theme</p>
            </div>

            <div className="p-2">
              {/* Quick toggle for light/dark */}
              <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">Quick Toggle</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setTheme('light')
                      setIsOpen(false)
                    }}
                    className={`flex items-center gap-2 p-2 rounded-md transition-all ${
                      theme === 'light'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <SunIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Light</span>
                    {theme === 'light' && <CheckIcon className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />}
                  </button>
                  <button
                    onClick={() => {
                      setTheme('dark')
                      setIsOpen(false)
                    }}
                    className={`flex items-center gap-2 p-2 rounded-md transition-all ${
                      theme === 'dark'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <MoonIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Dark</span>
                    {theme === 'dark' && <CheckIcon className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400" />}
                  </button>
                </div>
              </div>

              {/* Popular Themes */}
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">Popular Themes</div>
              <div className="space-y-1">
                {popularThemes.map((themeName) => {
                  const themeData = themes[themeName]
                  return (
                    <button
                      key={themeName}
                      onClick={() => {
                        setTheme(themeName)
                        setIsOpen(false)
                      }}
                      className={`w-full text-left p-3 rounded-md transition-all ${
                        theme === themeName
                          ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {themeData.label}
                          </div>
                          {themeData.metadata && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              {themeData.metadata.description}
                            </div>
                          )}
                        </div>
                        {theme === themeName && (
                          <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Link to theme settings */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <a
                  href="/dashboard/settings/themes"
                  className="block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-2"
                  onClick={() => setIsOpen(false)}
                >
                  View all themes →
                </a>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
