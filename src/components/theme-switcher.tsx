'use client'

import * as React from 'react'
import { CheckIcon, MoonIcon, SunIcon, SwatchIcon } from '@heroicons/react/24/outline'
import { useTheme } from '@/components/theme-provider'
import { themes, sidebarStyles, ThemeName, SidebarStyle } from '@/lib/themes'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

export function ThemeSwitcher() {
  const { theme, mode, sidebarStyle, setTheme, setMode, setSidebarStyle, toggleMode } = useTheme()

  const themeEntries = Object.entries(themes) as [ThemeName, typeof themes[ThemeName]][]
  const sidebarStyleEntries = Object.entries(sidebarStyles) as [SidebarStyle, typeof sidebarStyles[SidebarStyle]][]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <SwatchIcon className="h-5 w-5" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Light/Dark Mode Toggle */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Mode
        </DropdownMenuLabel>
        <div className="flex gap-2 p-2">
          <Button
            variant={mode === 'light' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setMode('light')}
          >
            <SunIcon className="h-4 w-4 mr-2" />
            Light
          </Button>
          <Button
            variant={mode === 'dark' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setMode('dark')}
          >
            <MoonIcon className="h-4 w-4 mr-2" />
            Dark
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Theme Selector */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-primary" />
              Color Theme
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="max-h-96 overflow-y-auto">
              {themeEntries.map(([themeName, themeConfig]) => (
                <DropdownMenuItem
                  key={themeName}
                  onClick={() => setTheme(themeName)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ThemePreview themeName={themeName} currentMode={mode} />
                    {themeConfig.label}
                  </span>
                  {theme === themeName && <CheckIcon className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        {/* Sidebar Style Selector */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="3" width="7" height="18" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
              Sidebar Style
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {sidebarStyleEntries.map(([styleName, styleConfig]) => (
                <DropdownMenuItem
                  key={styleName}
                  onClick={() => setSidebarStyle(styleName)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <span>{styleConfig.label}</span>
                  {sidebarStyle === styleName && <CheckIcon className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Theme preview component showing color swatches
function ThemePreview({ themeName, currentMode }: { themeName: ThemeName; currentMode: 'light' | 'dark' }) {
  const themeConfig = themes[themeName]
  const cssVars = themeConfig.cssVars[currentMode]

  // Extract HSL values for primary, secondary, accent colors
  const primary = `hsl(${cssVars.primary})`
  const secondary = `hsl(${cssVars.secondary})`
  const accent = `hsl(${cssVars.accent})`

  return (
    <div className="flex gap-1">
      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: primary }} />
      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: secondary }} />
      <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: accent }} />
    </div>
  )
}
