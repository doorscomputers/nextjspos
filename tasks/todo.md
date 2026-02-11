# Package Template Toggle Active Feature

## Problem
The Package Templates page had a disabled field showing Active/Inactive status, but unlike the Products page, it did not have a clickable toggle switch to easily enable/disable packages.

## Solution
Add a clickable toggle switch to the Package Templates page status column, similar to the Products page implementation.

## Tasks
- [x] Check for existing toggle API endpoint for package templates
- [x] Add toggle active function to Package Templates page
- [x] Update Status column to include Switch component with toggle functionality

## Review

### Changes Made

**File**: `src/app/dashboard/package-templates/page.tsx`

**1. Added `toggleTemplateActive` function** (lines 441-465):
```javascript
const toggleTemplateActive = async (templateId: number, currentStatus: boolean) => {
  try {
    const response = await fetch(`/api/package-templates/${templateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !currentStatus })
    })

    const data = await response.json()

    if (response.ok) {
      toast.success(`Package ${!currentStatus ? 'activated' : 'deactivated'}`)
      // Update local state
      setTemplates(templates.map(t =>
        t.id === templateId ? { ...t, isActive: !currentStatus } : t
      ))
    } else {
      toast.error(data.error || 'Failed to toggle status')
    }
  } catch (error) {
    console.error('Error toggling template status:', error)
    toast.error('Failed to toggle status')
  }
}
```

**2. Updated Status column cell render** (lines 800-821):
- Changed from simple text span to match Products page styling
- Added Badge component with proper emerald/slate colors for active/inactive states
- Added Switch component that appears when user has PACKAGE_TEMPLATE_EDIT permission
- Switch uses emerald green color when checked (`data-[state=checked]:bg-emerald-600`)
- Increased column width from 100 to 150 to accommodate the switch

### No API Changes Required
The existing PUT endpoint at `/api/package-templates/[id]/route.ts` already supports updating the `isActive` field, so no backend changes were needed.

### Impact
- Minimal frontend changes (1 function added, 1 column updated)
- Uses existing API endpoint
- Consistent with Products page toggle behavior
- Respects RBAC permissions (only shows toggle if user has PACKAGE_TEMPLATE_EDIT permission)
