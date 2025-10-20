# Theme Factory Integration Guide

## Overview

Your UltimatePOS Modern application has been enhanced with the professional **Theme Factory** theming system. This integration provides:

✨ **10 Professional Themes** - From calm maritime to vibrant tech aesthetics
🎨 **Enhanced Design System** - Professional color palettes with perfect contrast
🔧 **Utility Classes** - Ready-to-use CSS classes for rapid development
♿ **Accessibility** - WCAG-compliant color combinations
📱 **Responsive** - Mobile-first design patterns

---

## 🚀 Quick Start

### 1. Import Theme Factory Styles

Add to your `app/layout.tsx`:

```tsx
import '../styles/theme-factory.css'
```

### 2. Use Theme Factory Utility Classes

```tsx
export default function MyComponent() {
  return (
    <div className="tf-card">
      <h2 className="tf-heading-2">Ocean Depths Theme</h2>
      <p className="tf-body">Professional and calming maritime design.</p>
      <button className="tf-btn tf-btn-primary">Get Started</button>
    </div>
  )
}
```

### 3. Apply Theme Factory Presets

Use the `themeFactoryPresets` for consistent theming:

```tsx
import { themeFactoryPresets } from '@/lib/theme-factory-presets'

// Access theme colors
const oceanTheme = themeFactoryPresets.oceanDepths
console.log(oceanTheme.colors.primary) // #1a2332
```

---

## 🎨 Available Themes

### 1. **Ocean Depths** (Default)
Professional and calming maritime theme
- Primary: `#1a2332` (Deep navy)
- Secondary: `#2d8b8b` (Teal)
- Accent: `#a8dadc` (Light cyan)

### 2. **Sunset Boulevard**
Warm and vibrant sunset colors
- Primary: `#e76f51` (Coral)
- Secondary: `#f4a261` (Peach)
- Accent: `#e9c46a` (Golden)

### 3. **Forest Canopy**
Natural and grounded earth tones
- Primary: `#2d4a2b` (Forest green)
- Secondary: `#7d8471` (Sage)
- Accent: `#a4ac86` (Olive)

### 4. **Modern Minimalist**
Clean and contemporary grayscale
- Primary: `#36454f` (Charcoal)
- Secondary: `#708090` (Slate)
- Accent: `#d3d3d3` (Light gray)

### 5. **Golden Hour**
Rich and warm autumnal palette
- Primary: `#f4a900` (Gold)
- Secondary: `#c1666b` (Rose)
- Accent: `#d4b896` (Tan)

### 6. **Arctic Frost**
Cool and crisp winter-inspired theme
- Primary: `#4a6fa5` (Steel blue)
- Secondary: `#d4e4f7` (Ice blue)
- Accent: `#c0c0c0` (Silver)

### 7. **Desert Rose**
Soft and sophisticated dusty tones
- Primary: `#d4a5a5` (Dusty rose)
- Secondary: `#b87d6d` (Terracotta)
- Accent: `#e8d5c4` (Sand)

### 8. **Tech Innovation**
Bold and modern tech aesthetic
- Primary: `#0066ff` (Electric blue)
- Secondary: `#00ffff` (Cyan)
- Accent: `#1e1e1e` (Carbon)

### 9. **Botanical Garden**
Fresh and organic garden colors
- Primary: `#4a7c59` (Garden green)
- Secondary: `#f9a620` (Marigold)
- Accent: `#b7472a` (Terracotta)

### 10. **Midnight Galaxy**
Dramatic and cosmic deep tones
- Primary: `#2b1e3e` (Deep purple)
- Secondary: `#4a4e8f` (Royal purple)
- Accent: `#a490c2` (Lavender)

---

## 📚 Component Examples

### Buttons

```tsx
{/* Primary Button */}
<button className="tf-btn tf-btn-primary">
  Save Changes
</button>

{/* Secondary Button */}
<button className="tf-btn tf-btn-secondary">
  Cancel
</button>

{/* Outline Button */}
<button className="tf-btn tf-btn-outline">
  Learn More
</button>

{/* Ghost Button */}
<button className="tf-btn tf-btn-ghost">
  Skip
</button>

{/* Button Sizes */}
<button className="tf-btn tf-btn-primary tf-btn-sm">Small</button>
<button className="tf-btn tf-btn-primary">Default</button>
<button className="tf-btn tf-btn-primary tf-btn-lg">Large</button>
```

### Cards

```tsx
{/* Hover Card */}
<div className="tf-card">
  <h3 className="tf-heading-3">Product Card</h3>
  <p className="tf-body">Description goes here</p>
</div>

{/* Flat Card */}
<div className="tf-card-flat">
  <h3>No Border Card</h3>
</div>

{/* Elevated Card */}
<div className="tf-card-elevated tf-hover-lift">
  <h3>Premium Card</h3>
</div>
```

### Forms

```tsx
<form className="tf-flex tf-flex-col tf-gap-md">
  <div>
    <label className="tf-font-heading tf-text-primary">Email</label>
    <input
      type="email"
      className="tf-input"
      placeholder="Enter your email"
    />
  </div>

  <div>
    <label className="tf-font-heading tf-text-primary">Country</label>
    <select className="tf-select">
      <option>Philippines</option>
      <option>United States</option>
    </select>
  </div>

  <div>
    <label className="tf-font-heading tf-text-primary">Message</label>
    <textarea className="tf-textarea" placeholder="Your message"></textarea>
  </div>

  <button type="submit" className="tf-btn tf-btn-primary">Submit</button>
</form>
```

### Typography

```tsx
<div>
  <h1 className="tf-heading-1">Main Heading</h1>
  <h2 className="tf-heading-2">Section Heading</h2>
  <h3 className="tf-heading-3">Subsection Heading</h3>

  <p className="tf-body-lg">Large body text for emphasis.</p>
  <p className="tf-body">Normal body text for content.</p>
  <p className="tf-body-sm">Small text for captions.</p>

  <a href="#" className="tf-link">Text Link</a>
</div>
```

### Badges

```tsx
<span className="tf-badge tf-badge-primary">New</span>
<span className="tf-badge tf-badge-secondary">Sale</span>
<span className="tf-badge tf-badge-accent">Featured</span>
<span className="tf-badge tf-badge-outline">Coming Soon</span>
```

### Layouts

```tsx
{/* Container */}
<div className="tf-container">
  <h1 className="tf-heading-1">Welcome</h1>
</div>

{/* Grid Layouts */}
<div className="tf-grid-3">
  <div className="tf-card">Card 1</div>
  <div className="tf-card">Card 2</div>
  <div className="tf-card">Card 3</div>
</div>

{/* Flex Layouts */}
<div className="tf-flex tf-flex-between">
  <h2>Title</h2>
  <button className="tf-btn tf-btn-primary">Action</button>
</div>
```

---

## 🎯 Integration with Existing Theme System

### Option 1: Use Alongside Existing Themes

Keep your current theme system and add Theme Factory as enhancement:

```tsx
import { useTheme } from '@/components/theme-provider'
import { themeFactoryPresets } from '@/lib/theme-factory-presets'

export function MyComponent() {
  const { theme } = useTheme()
  const tfTheme = themeFactoryPresets.oceanDepths

  return (
    <div
      className="tf-card"
      style={{
        // Mix Theme Factory with your existing theme
        borderColor: theme === 'dark' ? '#333' : tfTheme.colors.accent
      }}
    >
      <h2 className="tf-heading-2">Hybrid Theming</h2>
    </div>
  )
}
```

### Option 2: Convert Existing Themes

Convert your existing theme colors to Theme Factory format:

```tsx
// src/lib/themes.ts
import { hexToHSL } from '@/lib/theme-factory-presets'

export const themes = {
  ocean: {
    // ... existing config
    tfColors: {
      primary: '#1a2332',
      secondary: '#2d8b8b',
      accent: '#a8dadc',
      background: '#f1faee',
      text: '#1a2332',
      textSecondary: '#2d8b8b',
    }
  }
}
```

---

## 🛠️ Customization

### Create Custom Theme

Add your own theme to `theme-factory-presets.ts`:

```typescript
export const themeFactoryPresets = {
  // ... existing themes
  myCustomTheme: {
    name: 'My Custom Theme',
    slug: 'my-custom-theme',
    description: 'A theme I created for my brand',
    colors: {
      primary: '#your-primary-color',
      secondary: '#your-secondary-color',
      accent: '#your-accent-color',
      background: '#ffffff',
      text: '#333333',
      textSecondary: '#666666',
    },
    fonts: {
      heading: '"Your Heading Font", sans-serif',
      body: '"Your Body Font", sans-serif',
    },
  },
}
```

### Override CSS Variables

```css
/* Override specific theme variables */
:root {
  --tf-color-primary: #your-custom-color;
  --tf-radius-md: 1rem; /* Make all borders more rounded */
  --tf-duration-normal: 200ms; /* Faster transitions */
}
```

### Create Custom Utility Classes

```css
/* Add to theme-factory.css */
.tf-btn-danger {
  background-color: #dc2626;
  color: white;
}

.tf-btn-danger:hover {
  background-color: #b91c1c;
}
```

---

## ✨ Best Practices

### 1. Consistent Class Naming

Always prefix Theme Factory classes with `tf-`:

```tsx
✅ <div className="tf-card tf-hover-lift">
❌ <div className="card hover-lift">
```

### 2. Combine with Tailwind

Use Theme Factory for theming, Tailwind for layout:

```tsx
<div className="flex items-center gap-4 p-4 tf-card">
  <div className="tf-badge tf-badge-primary">New</div>
  <h3 className="text-xl font-bold tf-text-primary">Product Title</h3>
</div>
```

### 3. Use Semantic Color Names

```tsx
✅ className="tf-bg-primary"
❌ style={{ backgroundColor: '#1a2332' }}
```

### 4. Leverage Hover Effects

```tsx
<div className="tf-card tf-hover-lift tf-transition">
  Interactive card with smooth animation
</div>
```

---

## 📱 Responsive Design

All Theme Factory components are mobile-first:

```tsx
{/* Automatically responsive grid */}
<div className="tf-grid-3">
  {/* Becomes 1 column on mobile, 2 on tablet, 3 on desktop */}
  <div className="tf-card">Item 1</div>
  <div className="tf-card">Item 2</div>
  <div className="tf-card">Item 3</div>
</div>

{/* Responsive typography */}
<h1 className="tf-heading-1">
  {/* Scales from 2rem to 3rem based on screen size */}
  Automatically Responsive
</h1>
```

---

## ♿ Accessibility

Theme Factory includes accessibility features:

```tsx
{/* Focus indicators */}
<button className="tf-btn tf-btn-primary tf-focus-ring">
  Accessible Button
</button>

{/* Screen reader only text */}
<span className="tf-sr-only">Loading...</span>

{/* Proper contrast ratios in all themes */}
```

---

## 🎨 Theme Switcher Component

Create a theme switcher for your users:

```tsx
'use client'

import { useState } from 'react'
import { themeFactoryPresets, themeFactoryList } from '@/lib/theme-factory-presets'

export function ThemeFactorySwitcher() {
  const [currentTheme, setCurrentTheme] = useState('oceanDepths')

  const applyTheme = (themeSlug: string) => {
    const theme = themeFactoryPresets[themeSlug]
    if (!theme) return

    // Apply CSS variables
    document.documentElement.style.setProperty('--tf-color-primary', theme.colors.primary)
    document.documentElement.style.setProperty('--tf-color-secondary', theme.colors.secondary)
    document.documentElement.style.setProperty('--tf-color-accent', theme.colors.accent)
    document.documentElement.style.setProperty('--tf-color-background', theme.colors.background)
    document.documentElement.style.setProperty('--tf-color-text', theme.colors.text)
    document.documentElement.style.setProperty('--tf-color-text-secondary', theme.colors.textSecondary)

    setCurrentTheme(themeSlug)
    localStorage.setItem('tf-theme', themeSlug)
  }

  return (
    <div className="tf-grid-3">
      {themeFactoryList.map((theme) => (
        <button
          key={theme.slug}
          onClick={() => applyTheme(theme.slug)}
          className={`tf-card tf-hover-lift ${currentTheme === theme.slug ? 'tf-border-primary' : ''}`}
        >
          <div className="tf-flex tf-gap-sm mb-2">
            {Object.values(theme.colors).slice(0, 4).map((color, idx) => (
              <div
                key={idx}
                style={{
                  width: '1.5rem',
                  height: '1.5rem',
                  backgroundColor: color,
                  borderRadius: 'var(--tf-radius-sm)'
                }}
              />
            ))}
          </div>
          <h3 className="tf-font-heading font-bold">{theme.name}</h3>
          <p className="tf-body-sm">{theme.description}</p>
        </button>
      ))}
    </div>
  )
}
```

---

## 📦 Files Added

1. **`src/lib/theme-factory-presets.ts`** - 10 professional theme definitions
2. **`src/styles/theme-factory.css`** - Complete utility class system
3. **`THEME_FACTORY_INTEGRATION.md`** - This guide

---

## 🚀 Next Steps

1. ✅ Import `theme-factory.css` in your layout
2. ✅ Try the example components above
3. ✅ Create a theme switcher component
4. ✅ Customize themes to match your brand
5. ✅ Explore all 10 professional themes

---

## 💡 Pro Tips

1. **Mix and Match**: Combine Theme Factory with your existing dark mode system
2. **Custom Themes**: Create industry-specific themes (retail, restaurant, medical)
3. **Print Styles**: Theme Factory includes print-optimized styles
4. **Performance**: Use CSS variables for instant theme switching
5. **Brand Consistency**: Apply your company colors to Theme Factory presets

---

## 🤝 Support

For questions or issues:
- Check this guide for examples
- Review `theme-factory.css` for all available classes
- Explore `theme-factory-presets.ts` for theme structures

---

**Made with ❤️ using Theme Factory**

Transform your UltimatePOS Modern application with professional theming! 🎨✨
