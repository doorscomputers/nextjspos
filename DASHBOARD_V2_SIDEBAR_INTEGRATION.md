# Dashboard V2 - Sidebar Navigation Integration Guide

## Overview
This guide shows how to add the Dashboard V2 Analytics page to the sidebar navigation menu.

## Step-by-Step Integration

### 1. Open the Sidebar Component
**File:** `C:\xampp\htdocs\ultimatepos-modern\src\components\Sidebar.tsx`

### 2. Locate the Navigation Items Section
Find the section where navigation items are defined (usually an array of menu items).

### 3. Add Dashboard V2 Menu Item

Add this entry to the navigation items array:

```typescript
{
  name: 'Dashboard Analytics',
  href: '/dashboard/dashboard-v2',
  icon: ChartBarIcon, // or another appropriate Heroicons icon
  permission: PERMISSIONS.DASHBOARD_VIEW,
  description: 'Multi-dimensional sales & inventory analysis',
}
```

### 4. Import Required Icon (if not already imported)

At the top of the Sidebar.tsx file, add:

```typescript
import { ChartBarIcon } from '@heroicons/react/24/outline'
```

### 5. Recommended Placement

Add the Dashboard V2 menu item in one of these locations:

**Option A - Under Main Dashboard:**
```typescript
// Navigation items
const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    name: 'Dashboard Analytics',  // <-- Add here
    href: '/dashboard/dashboard-v2',
    icon: ChartBarIcon,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  // ... rest of menu items
]
```

**Option B - In a "Reports" or "Analytics" Section:**
```typescript
{
  name: 'Reports',
  icon: DocumentChartBarIcon,
  children: [
    {
      name: 'Dashboard Analytics',  // <-- Add here
      href: '/dashboard/dashboard-v2',
      icon: ChartBarIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: 'Sales Reports',
      href: '/dashboard/reports/sales',
      // ...
    },
    // ... other report items
  ]
}
```

## Complete Example

Here's a complete example of how it might look in the Sidebar component:

```typescript
import {
  HomeIcon,
  ChartBarIcon,
  DocumentTextIcon,
  // ... other icons
} from '@heroicons/react/24/outline'
import { PERMISSIONS } from '@/lib/rbac'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    permission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    name: 'Dashboard Analytics V2',
    href: '/dashboard/dashboard-v2',
    icon: ChartBarIcon,
    permission: PERMISSIONS.DASHBOARD_VIEW,
    badge: 'New',
    badgeColor: 'blue',
  },
  // POS
  {
    name: 'Point of Sale',
    href: '/dashboard/pos',
    icon: ShoppingCartIcon,
    permission: PERMISSIONS.SELL_CREATE,
  },
  // ... rest of navigation items
]
```

## Alternative: Add as a Dashboard Submenu

If you want to create a submenu under the main Dashboard:

```typescript
{
  name: 'Dashboard',
  icon: HomeIcon,
  permission: PERMISSIONS.DASHBOARD_VIEW,
  children: [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: HomeIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
    },
    {
      name: 'Analytics (Pivot Grid)',
      href: '/dashboard/dashboard-v2',
      icon: ChartBarIcon,
      permission: PERMISSIONS.DASHBOARD_VIEW,
      badge: 'Advanced',
    },
  ]
}
```

## Styling the Menu Item (Optional)

If you want to add a badge or special styling:

```typescript
{
  name: 'Dashboard Analytics',
  href: '/dashboard/dashboard-v2',
  icon: ChartBarIcon,
  permission: PERMISSIONS.DASHBOARD_VIEW,
  badge: 'NEW',           // Add a "NEW" badge
  badgeColor: 'blue',     // Badge color
  description: 'Interactive pivot analysis'  // Tooltip or description
}
```

## Icon Recommendations

Choose one of these Heroicons for the menu item:

1. **ChartBarIcon** - Bar chart icon (recommended)
2. **PresentationChartBarIcon** - Presentation with chart
3. **TableCellsIcon** - Grid/table icon
4. **ChartPieIcon** - Pie chart icon
5. **CubeIcon** - 3D cube (for multi-dimensional analysis)
6. **ViewColumnsIcon** - Columns view

## Permission-Based Visibility

The menu item will automatically be hidden for users who don't have the `DASHBOARD_VIEW` permission, thanks to the existing Sidebar permission filtering logic.

## Testing

After adding the menu item:

1. Restart the development server: `npm run dev`
2. Login with a user who has `DASHBOARD_VIEW` permission
3. Verify the menu item appears in the sidebar
4. Click the menu item and verify it navigates to `/dashboard/dashboard-v2`
5. Verify the active state is highlighted when on the Dashboard V2 page

## Mobile Navigation

The menu item will automatically work in mobile navigation if the Sidebar component includes responsive navigation handling.

## Summary

The integration is straightforward:
1. Add the menu item to the navigation array in Sidebar.tsx
2. Import the icon (ChartBarIcon recommended)
3. Set the permission to `PERMISSIONS.DASHBOARD_VIEW`
4. Optionally add a badge or description
5. Test with appropriate user permissions

That's it! The Dashboard V2 Analytics page is now accessible from the sidebar menu.
