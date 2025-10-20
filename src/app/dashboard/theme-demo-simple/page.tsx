'use client'

import { ThemeFactorySwitcher } from "@/components/ThemeFactorySwitcher"
import { useState, useEffect } from "react"

export default function ThemeDemoSimplePage() {
  const [currentColors, setCurrentColors] = useState({
    primary: '',
    secondary: '',
    accent: '',
    background: '',
    foreground: ''
  })

  useEffect(() => {
    // Initial load
    updateColors()

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      updateColors()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-theme']
    })

    return () => observer.disconnect()
  }, [])

  const updateColors = () => {
    const root = document.documentElement
    const computedStyle = getComputedStyle(root)

    setCurrentColors({
      primary: computedStyle.getPropertyValue('--primary').trim(),
      secondary: computedStyle.getPropertyValue('--secondary').trim(),
      accent: computedStyle.getPropertyValue('--accent').trim(),
      background: computedStyle.getPropertyValue('--background').trim(),
      foreground: computedStyle.getPropertyValue('--foreground').trim()
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Theme System Demo
        </h1>
        <p className="text-muted-foreground">
          Select a theme below and watch your entire app change instantly!
        </p>
      </div>

      {/* Live Color Display */}
      <div className="bg-card border-2 border-border rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-card-foreground mb-4">
          Current Theme Colors (Live)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="bg-primary h-20 rounded-lg shadow-md" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">Primary</div>
              <div className="text-muted-foreground font-mono text-xs">
                {currentColors.primary}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="bg-secondary h-20 rounded-lg shadow-md" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">Secondary</div>
              <div className="text-muted-foreground font-mono text-xs">
                {currentColors.secondary}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="bg-accent h-20 rounded-lg shadow-md" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">Accent</div>
              <div className="text-muted-foreground font-mono text-xs">
                {currentColors.accent}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Switcher */}
      <div className="bg-card border-2 border-border rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-card-foreground mb-4">
          Choose Your Theme
        </h2>
        <ThemeFactorySwitcher variant="grid" />
      </div>

      {/* Component Examples */}
      <div className="bg-card border-2 border-border rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-card-foreground mb-6">
          Components Using Theme
        </h2>

        <div className="space-y-6">
          {/* Buttons */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Buttons</h3>
            <div className="flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                Primary Button
              </button>
              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors">
                Secondary Button
              </button>
              <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
                Accent Button
              </button>
              <button className="px-4 py-2 border-2 border-primary text-primary rounded-md hover:bg-primary hover:text-primary-foreground transition-colors">
                Outline Button
              </button>
            </div>
          </div>

          {/* Cards */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Cards</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card border-2 border-primary rounded-lg p-4 hover:shadow-lg transition-shadow">
                <h4 className="font-semibold text-primary mb-2">Primary Card</h4>
                <p className="text-muted-foreground text-sm">
                  This card uses the primary color for its border
                </p>
              </div>
              <div className="bg-card border-2 border-secondary rounded-lg p-4 hover:shadow-lg transition-shadow">
                <h4 className="font-semibold text-secondary mb-2">Secondary Card</h4>
                <p className="text-muted-foreground text-sm">
                  This card uses the secondary color for its border
                </p>
              </div>
              <div className="bg-card border-2 border-accent rounded-lg p-4 hover:shadow-lg transition-shadow">
                <h4 className="font-semibold text-accent-foreground mb-2">Accent Card</h4>
                <p className="text-muted-foreground text-sm">
                  This card uses the accent color for its border
                </p>
              </div>
            </div>
          </div>

          {/* Form Elements */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Form Elements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Input Field
                </label>
                <input
                  type="text"
                  placeholder="Type something..."
                  className="w-full px-3 py-2 bg-background border-2 border-input rounded-md text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Select Dropdown
                </label>
                <select className="w-full px-3 py-2 bg-background border-2 border-input rounded-md text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors">
                  <option>Option 1</option>
                  <option>Option 2</option>
                  <option>Option 3</option>
                </select>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Alerts</h3>
            <div className="space-y-3">
              <div className="bg-primary/10 border-l-4 border-primary p-4 rounded">
                <p className="text-primary font-medium">Primary Alert</p>
                <p className="text-sm text-foreground/80">This is a primary styled alert message</p>
              </div>
              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                <p className="text-accent-foreground font-medium">Accent Alert</p>
                <p className="text-sm text-foreground/80">This is an accent styled alert message</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-muted/30 border-2 border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-3">
          How It Works
        </h2>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span>Click any theme above to change your app's colors instantly</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span>All components automatically use the new theme colors</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span>Your theme choice is saved and persists across page refreshes</span>
          </li>
          <li className="flex items-start">
            <span className="text-primary mr-2">✓</span>
            <span>Navigate to any page in your app - the theme will be applied everywhere!</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
