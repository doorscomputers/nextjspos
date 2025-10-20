'use client'

import { useState, useEffect } from 'react'
import { themeFactoryPresets, themeFactoryList } from '@/lib/theme-factory-presets'
import { applyTheme } from '@/components/ThemeProvider'
import { CheckIcon } from '@heroicons/react/24/outline'

interface ThemeFactorySwitcherProps {
  variant?: 'dropdown' | 'grid' | 'list'
  showDescription?: boolean
}

export function ThemeFactorySwitcher({
  variant = 'grid',
  showDescription = true
}: ThemeFactorySwitcherProps) {
  const [currentThemeKey, setCurrentThemeKey] = useState('oceanDepths')
  const [isOpen, setIsOpen] = useState(false)

  // Only read the current theme from localStorage, don't apply it
  useEffect(() => {
    const saved = localStorage.getItem('tf-theme')
    if (saved && themeFactoryPresets[saved]) {
      setCurrentThemeKey(saved)
    }
  }, [])

  const handleThemeClick = (themeKey: string) => {
    console.log('Theme clicked:', themeKey)

    // Apply the theme (using the KEY, not slug)
    applyTheme(themeKey)

    // Save to localStorage (save the KEY)
    localStorage.setItem('tf-theme', themeKey)

    // Update local state
    setCurrentThemeKey(themeKey)
    setIsOpen(false)
  }

  const currentThemeData = themeFactoryPresets[currentThemeKey] || themeFactoryPresets.oceanDepths

  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
        >
          {currentThemeData?.name || 'Ocean Depths'} ▾
        </button>

        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 border-2 border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
              {themeFactoryList.map((theme) => (
                <button
                  key={theme.key}
                  onClick={() => handleThemeClick(theme.key)}
                  className={`w-full text-left p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    currentThemeKey === theme.key ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {theme.name}
                      </div>
                      {showDescription && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {theme.description}
                        </div>
                      )}
                      <div className="flex gap-1 mt-2">
                        {Object.values(theme.colors).slice(0, 4).map((color, idx) => (
                          <div
                            key={idx}
                            style={{ backgroundColor: color }}
                            className="w-4 h-4 rounded"
                          />
                        ))}
                      </div>
                    </div>
                    {currentThemeKey === theme.key && (
                      <CheckIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 ml-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <div className="space-y-3">
        {themeFactoryList.map((theme) => (
          <button
            key={theme.key}
            onClick={() => handleThemeClick(theme.key)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              currentThemeKey === theme.key
                ? 'border-primary bg-accent'
                : 'border-border hover:border-primary'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-card-foreground">
                  {theme.name}
                </div>
                {showDescription && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {theme.description}
                  </div>
                )}
              </div>
              {currentThemeKey === theme.key && (
                <CheckIcon className="h-5 w-5 text-primary ml-2" />
              )}
            </div>
          </button>
        ))}
      </div>
    )
  }

  // Grid variant (default)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {themeFactoryList.map((theme) => (
        <button
          key={theme.key}
          onClick={() => handleThemeClick(theme.key)}
          className={`text-left p-6 rounded-xl border-2 transition-all hover:shadow-lg hover:-translate-y-1 ${
            currentThemeKey === theme.key
              ? 'border-primary shadow-md bg-accent'
              : 'border-border'
          }`}
        >
          {/* Color Swatches */}
          <div className="flex gap-2 mb-4">
            {Object.values(theme.colors).slice(0, 4).map((color, idx) => (
              <div
                key={idx}
                style={{ backgroundColor: color }}
                className="w-8 h-8 rounded-lg shadow-sm"
              />
            ))}
          </div>

          {/* Theme Name */}
          <div className="font-bold text-lg text-card-foreground mb-2 flex items-center justify-between">
            {theme.name}
            {currentThemeKey === theme.key && (
              <CheckIcon className="h-5 w-5 text-primary" />
            )}
          </div>

          {/* Description */}
          {showDescription && (
            <div className="text-sm text-muted-foreground">
              {theme.description}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
