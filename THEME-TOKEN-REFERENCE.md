# Theme Token Quick Reference

This guide shows the correct theme tokens to use for consistent dark/light mode support.

---

## Text Colors

### ❌ DON'T USE (Hardcoded)
```tsx
className="text-gray-900"  // Will be hard to read in dark mode
className="text-gray-500"  // May lack contrast
className="text-gray-700"  // Theme-dependent
```

### ✅ DO USE (Theme Tokens)
```tsx
className="text-foreground"          // Primary text (dark in light mode, light in dark mode)
className="text-muted-foreground"    // Secondary text (always readable)
className="text-destructive"         // Errors, warnings, required fields
className="text-primary"             // Brand color text
```

### Colored Text (When Semantic)
```tsx
// For amounts, status indicators - ALWAYS include dark variant
className="text-green-600 dark:text-green-500"    // Success/paid amounts
className="text-red-600 dark:text-red-400"        // Errors/balance due
className="text-blue-600 dark:text-blue-400"      // Info/links
className="text-yellow-600 dark:text-yellow-400"  // Warnings
className="text-orange-600 dark:text-orange-400"  // Attention
```

---

## Background Colors

### ❌ DON'T USE
```tsx
className="bg-white"       // Won't work in dark mode
className="bg-gray-50"     // Hardcoded color
className="bg-gray-100"    // No dark variant
```

### ✅ DO USE
```tsx
className="bg-background"  // Page/section background
className="bg-card"        // Card background
className="bg-muted"       // Muted sections
className="bg-primary"     // Primary brand color
```

### Colored Backgrounds (Contextual)
```tsx
// Information panels, alerts - ALWAYS include dark variant
className="bg-blue-50 dark:bg-blue-950/30"
className="bg-yellow-50 dark:bg-yellow-950/30"
className="bg-green-50 dark:bg-green-950/30"
className="bg-red-50 dark:bg-red-950/30"
```

---

## Borders

### ❌ DON'T USE
```tsx
className="border-gray-300"
className="border-gray-200"
className="border-blue-200"  // Without dark variant
```

### ✅ DO USE
```tsx
className="border-border"    // Default borders
className="border-input"     // Input field borders

// Colored borders - include dark variant
className="border-blue-200 dark:border-blue-800"
className="border-yellow-200 dark:border-yellow-800"
className="border-red-200 dark:border-red-800"
```

---

## Form Inputs

### ❌ DON'T USE
```tsx
<input className="border-gray-300 focus:ring-blue-500" />
```

### ✅ DO USE
```tsx
<input
  className="border border-input
             bg-background
             text-foreground
             rounded-lg
             focus:ring-2
             focus:ring-ring
             focus:border-transparent
             transition-colors"
/>
```

---

## Tables

### ❌ DON'T USE
```tsx
<div className="bg-white rounded-lg shadow">
  <table className="divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr className="hover:bg-gray-100">
```

### ✅ DO USE
```tsx
<div className="bg-card rounded-lg shadow border border-border">
  <table className="divide-y divide-border">
    <thead className="bg-muted/50">
      <tr className="hover:bg-muted/50 transition-colors">
```

---

## Cards

### ❌ DON'T USE
```tsx
<div className="bg-white rounded-lg border border-gray-200 p-4">
  <h3 className="text-gray-900">Title</h3>
  <p className="text-gray-600">Description</p>
</div>
```

### ✅ DO USE (With ShadCN Card)
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-muted-foreground">Description</p>
  </CardContent>
</Card>
```

---

## Buttons

### ✅ CORRECT (ShadCN Button Component)
```tsx
import { Button } from '@/components/ui/button'

<Button variant="default">Primary Action</Button>
<Button variant="outline">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Subtle</Button>
```

---

## Alert/Warning Boxes

### ❌ DON'T USE
```tsx
<div className="bg-yellow-50 border border-yellow-200 p-4">
  <p className="text-yellow-800">Warning message</p>
</div>
```

### ✅ DO USE
```tsx
<div className="bg-yellow-50 dark:bg-yellow-950/30
                border border-yellow-200 dark:border-yellow-800
                rounded-lg p-4">
  <p className="text-yellow-800 dark:text-yellow-200">
    Warning message
  </p>
</div>
```

---

## Complete Input Example

```tsx
<div>
  <label className="block text-sm font-medium text-foreground mb-2">
    Field Name <span className="text-destructive">*</span>
  </label>
  <input
    type="text"
    className="w-full px-4 py-2
               border border-input
               bg-background
               text-foreground
               rounded-lg
               focus:ring-2
               focus:ring-ring
               focus:border-transparent
               transition-colors
               placeholder:text-muted-foreground"
    placeholder="Enter value"
  />
</div>
```

---

## Complete Table Example

```tsx
<div className="bg-card rounded-lg shadow overflow-hidden border border-border">
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-border">
      <thead className="bg-muted/50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium
                         text-muted-foreground uppercase tracking-wider">
            Column Name
          </th>
        </tr>
      </thead>
      <tbody className="bg-card divide-y divide-border">
        <tr className="hover:bg-muted/50 transition-colors">
          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
            Cell Data
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

---

## Status Badges

### ✅ CORRECT (Using ShadCN Badge)
```tsx
import { Badge } from '@/components/ui/badge'

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Draft</Badge>

// Custom colored badges with dark support
<Badge className="bg-green-100 dark:bg-green-950/30
                  text-green-800 dark:text-green-200
                  border-green-200 dark:border-green-800">
  Success
</Badge>
```

---

## Hover States

### ❌ DON'T USE
```tsx
className="hover:bg-gray-100"
```

### ✅ DO USE
```tsx
className="hover:bg-muted/50 transition-colors"
className="hover:bg-accent hover:text-accent-foreground transition-colors"
```

---

## Common Patterns

### Search Input
```tsx
<div className="relative">
  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2
                                  w-5 h-5 text-muted-foreground" />
  <input
    type="text"
    placeholder="Search..."
    className="w-full pl-10 pr-4 py-2
               border border-input
               bg-background
               text-foreground
               rounded-lg
               focus:ring-2
               focus:ring-ring
               focus:border-transparent
               transition-colors"
  />
</div>
```

### Summary Cards
```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Label
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-foreground">$1,234.56</p>
    <p className="text-sm text-muted-foreground mt-1">
      Additional info
    </p>
  </CardContent>
</Card>
```

### Information Panel
```tsx
<div className="bg-blue-50 dark:bg-blue-950/30
                border border-blue-200 dark:border-blue-800
                rounded-lg p-4">
  <h3 className="font-semibold text-foreground mb-2">
    Information Title
  </h3>
  <p className="text-sm text-muted-foreground">
    Information content...
  </p>
</div>
```

---

## Testing Your Changes

### Light Mode Checklist
- [ ] All text is readable (dark text on light backgrounds)
- [ ] Borders are visible
- [ ] Hover states work
- [ ] Focus rings are visible

### Dark Mode Checklist
- [ ] All text is readable (light text on dark backgrounds)
- [ ] No gray-on-gray text
- [ ] Colored elements have appropriate contrast
- [ ] Information panels are visible but not too bright
- [ ] Tables have clear row separation

---

## Quick Fix Patterns

### Find and Replace Common Issues

| ❌ Find | ✅ Replace |
|---------|-----------|
| `text-gray-900` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-600` | `text-muted-foreground` |
| `text-gray-700` | `text-foreground` |
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50` | `bg-muted/50` |
| `border-gray-300` | `border-input` or `border-border` |
| `border-gray-200` | `border-border` |
| `hover:bg-gray-50` | `hover:bg-muted/50 transition-colors` |
| `text-red-500` | `text-destructive` or `text-red-600 dark:text-red-400` |

---

## Resources

- **ShadCN Documentation:** https://ui.shadcn.com
- **Tailwind Dark Mode:** https://tailwindcss.com/docs/dark-mode
- **Color Contrast Checker:** https://webaim.org/resources/contrastchecker/

---

**Last Updated:** 2025-10-09
