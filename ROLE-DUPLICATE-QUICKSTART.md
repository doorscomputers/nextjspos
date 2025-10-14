# Role Duplication - Quick Start Guide

## What You'll See

### Before (Existing Roles Table)
```
┌──────────────────────┬────────┬─────────────┬───────┬──────────────────────┐
│ Role Name            │ Type   │ Permissions │ Users │ Actions              │
├──────────────────────┼────────┼─────────────┼───────┼──────────────────────┤
│ All Branch Admin     │ Custom │ 74          │ 1     │ Edit  Duplicate  Del │
│ Warehouse Manager    │ Custom │ 59          │ 1     │ Edit  Duplicate  Del │
│ Regular Cashier      │ System │ 6           │ 1     │ [disabled] Duplicate │
│ Main Branch Manager  │ Custom │ 52          │ 5     │ Edit  Duplicate  [dis]│
└──────────────────────┴────────┴─────────────┴───────┴──────────────────────┘
```

### New: Green "Duplicate" Button
- Appears for **ALL roles** (System and Custom)
- Located between "Edit" and "Delete" buttons
- Green color to distinguish from other actions
- Always enabled (no restrictions)

## Step-by-Step Usage

### Example: Duplicating "Main Branch Manager" for a New Warehouse

**Step 1: Click Duplicate**
Click the green "Duplicate" button on "Main Branch Manager" row

**Step 2: Modal Opens**
```
┌─────────────────────────────────────────────────────────────┐
│ Duplicate Role                                          [×] │
│ Creating a copy of "Main Branch Manager" with all its      │
│ permissions. Change the name and select locations.          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Role Name:                                                  │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ Main Branch Manager (Copy)                            │ │  ← Pre-filled, editable
│ └───────────────────────────────────────────────────────┘ │
│                                                             │
│ Permissions:                                                │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ☑ Products                                              ││
│ │   ☑ view      ☑ create    ☑ update    ☑ delete        ││  ← All pre-selected
│ │ ☑ Purchases                                             ││
│ │   ☑ view      ☑ create    ☑ update    ☑ delete        ││
│ │ ☑ Sales                                                 ││
│ │   ☑ view      ☑ create    ...                          ││
│ │ ... (52 permissions total, all selected)               ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Branch/Location Access:                                    │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ☐ Access All Locations                                  ││
│ │                                                          ││
│ │   ☐ Main Branch        ☐ Downtown Store                ││  ← Empty, select new ones
│ │   ☐ Warehouse A        ☐ Warehouse B                   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ [ Duplicate Role ]  [ Cancel ]                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Customize**
1. Change name from "Main Branch Manager (Copy)" to "Warehouse Manager B"
2. Check "Warehouse B" location
3. Leave all permissions checked (or uncheck any you don't need)

**Step 4: Submit**
Click "Duplicate Role" button

**Step 5: Success!**
```
✅ Role "Warehouse Manager B" created successfully with 52 permissions

New table shows:
┌──────────────────────┬────────┬─────────────┬───────┬─────────────────────┐
│ Role Name            │ Type   │ Permissions │ Users │ Actions             │
├──────────────────────┼────────┼─────────────┼───────┼─────────────────────┤
│ Warehouse Manager B  │ Custom │ 52          │ 0     │ Edit Duplicate Del │  ← NEW!
│ All Branch Admin     │ Custom │ 74          │ 1     │ Edit Duplicate Del │
│ Warehouse Manager    │ Custom │ 59          │ 1     │ Edit Duplicate Del │
│ Main Branch Manager  │ Custom │ 52          │ 5     │ Edit Duplicate [dis]│  ← UNCHANGED
└──────────────────────┴────────┴─────────────┴───────┴─────────────────────┘
```

## Common Use Cases

### Use Case 1: Same Role, Different Location
```
Source: "Store Manager" (Main Store)
Action: Duplicate
Result: "Store Manager" (Branch Store)
Change: Only location assignment
```

### Use Case 2: Create Role Variants
```
Source: "Cashier" (basic permissions)
Action: Duplicate
Result: "Senior Cashier"
Change: Name + add more permissions later via Edit
```

### Use Case 3: Customize System Roles
```
Source: "Regular Cashier" (System role)
Action: Duplicate
Result: "Custom Cashier" (Custom role)
Change: Now editable! Add/remove permissions as needed
```

## Key Features

✅ **Fast**: One click to copy all permissions
✅ **Safe**: Original role never touched
✅ **Flexible**: Edit name and locations
✅ **Complete**: All permissions included
✅ **Universal**: Works with any role

## What Happens Behind the Scenes

```
1. User clicks "Duplicate" on Role ID: 5
   ↓
2. System fetches Role #5 with all its permissions
   ↓
3. Modal opens with:
   - Name: "Original Name (Copy)"
   - Permissions: All 52 checkboxes pre-selected
   - Locations: Empty (user choice)
   ↓
4. User edits name, selects locations, clicks Duplicate
   ↓
5. API creates NEW Role ID: 15
   ↓
6. API copies all 52 permissions to Role #15
   ↓
7. API assigns selected locations to Role #15
   ↓
8. Success! Role #5 unchanged, Role #15 created
```

## Comparison: Create vs Duplicate

| Action   | Name      | Permissions        | Time to Setup |
|----------|-----------|-------------------|---------------|
| Create   | Empty     | None selected     | 5-10 minutes  |
| Duplicate| Pre-filled| All pre-selected  | 30 seconds    |

**Time Saved:** ~90% faster for roles with many permissions!

## Tips & Tricks

### Tip 1: Use Descriptive Names
❌ Bad: "Manager Copy", "Role 2", "New Role"
✅ Good: "Warehouse A Manager", "Downtown Store Cashier"

### Tip 2: Duplicate System Roles to Customize
System roles can't be edited, but their duplicates can!
1. Duplicate a system role
2. Edit the duplicate to add/remove permissions
3. Assign to users

### Tip 3: Create Role Templates
1. Set up a comprehensive "Sales Staff Template"
2. Duplicate it whenever you need a sales role
3. Adjust locations for each branch

### Tip 4: Review Before Duplicating
Check the source role's permission count:
- 6 permissions = basic role
- 50+ permissions = comprehensive role
- 100+ permissions = admin role

Make sure you're duplicating the right one!

## Troubleshooting

### "A role with this name already exists"
**Solution:** Change the role name to something unique.
Each business can only have one role with a given name.

### Duplicate button is grayed out
**This should never happen!** Duplicate is always enabled.
If you see this, check your user permissions.

### Permissions not showing as selected
**Refresh the page.** The modal should show all permissions
from the source role as checked.

## Ready to Try?

1. Go to: http://localhost:3006/dashboard/roles
2. Find any role in the table
3. Click the green "Duplicate" button
4. Follow the prompts
5. Done!

## Need Help?

See `ROLE-DUPLICATE-FEATURE.md` for:
- Technical implementation details
- API documentation
- Security information
- Advanced troubleshooting

---

**Last Updated:** 2025-10-12
**Status:** ✅ Production Ready
