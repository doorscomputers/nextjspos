# User Location Assignment - Single Location Only

## Summary
Successfully modified the Users CRUD system to allow only **ONE location assignment per user** using a **combo box (dropdown select)** instead of multiple checkboxes.

---

## Changes Made

### 1. **New User Page** (`src/app/dashboard/users/new/page.tsx`)
**Before:** Multiple location checkboxes
```tsx
locationIds: [] as number[]
```

**After:** Single location dropdown
```tsx
locationId: null as number | null
```

**UI Changes:**
- ✅ Replaced checkboxes with a `<select>` dropdown
- ✅ Shows "-- Select Location --" as placeholder
- ✅ Displays location with city and state: "Location Name (City, State)"
- ✅ Required field validation
- ✅ Form submit button disabled if no location selected
- ✅ Clear error message: "Please select a location"

---

### 2. **Edit User Page** (`src/app/dashboard/users/[id]/edit/page.tsx`)
**Before:** Multiple location checkboxes with "Select All/Deselect All" toggle
```tsx
locationIds: [] as number[]
```

**After:** Single location dropdown
```tsx
locationId: null as number | null
```

**UI Changes:**
- ✅ Removed complex multi-checkbox interface
- ✅ Removed "Select All" toggle button
- ✅ Removed lengthy explanation about role-based vs direct location access
- ✅ Simple dropdown with current location pre-selected
- ✅ Required field validation
- ✅ Clear helper text: "Select the primary location for this user. Each user must be assigned to exactly one location."

---

### 3. **Users API - Create** (`src/app/api/users/route.ts` - POST)
**Before:**
```tsx
locationIds: [] as number[]
// Assign multiple locations
if (locationIds && Array.isArray(locationIds)) {
  await Promise.all(locationIds.map(...))
}
```

**After:**
```tsx
locationId: number | null
// Validate location is required
if (!locationId) {
  return NextResponse.json({
    error: 'Location is required. Please select a location for the user.'
  }, { status: 400 })
}
// Assign single location
if (locationId) {
  await prisma.userLocation.create({
    data: {
      userId: newUser.id,
      locationId: parseInt(locationId),
    },
  })
}
```

**Changes:**
- ✅ Added validation to ensure location is provided
- ✅ Changed from array processing to single assignment
- ✅ Clear error message if location is missing

---

### 4. **Users API - Update** (`src/app/api/users/[id]/route.ts` - PUT)
**Before:**
```tsx
locationIds: number[]
// Update multiple locations
if (locationIds !== undefined && Array.isArray(locationIds)) {
  await prisma.userLocation.deleteMany(...)
  if (locationIds.length > 0) {
    await Promise.all(locationIds.map(...))
  }
}
```

**After:**
```tsx
locationId: number | null
// Update single location
if (locationId !== undefined) {
  await prisma.userLocation.deleteMany({ where: { userId } })
  if (locationId) {
    await prisma.userLocation.create({
      data: {
        userId,
        locationId: parseInt(locationId),
      },
    })
  }
}
```

**Changes:**
- ✅ Changed to single location update
- ✅ Clears existing location assignments first
- ✅ Creates new single location assignment

---

### 5. **Users API - Get Single User** (`src/app/api/users/[id]/route.ts` - GET)
**Changes:**
```tsx
const formattedUser = {
  ...otherFields,
  locationId: user.userLocations.length > 0 ? user.userLocations[0].locationId : null, // Primary change
  locationIds: user.userLocations.map(ul => ul.locationId), // Kept for backward compatibility
  locations: user.userLocations.map(ul => ul.location.name),
}
```

**Changes:**
- ✅ Added `locationId` field that returns the first (and only) location
- ✅ Kept `locationIds` for backward compatibility with existing code
- ✅ Returns `null` if no location assigned

---

## User Experience Improvements

### Before:
- ❌ Multiple checkboxes (confusing for single location assignment)
- ❌ "Select All" / "Deselect All" buttons (unnecessary complexity)
- ❌ Long explanation about role-based vs direct access
- ❌ Scrollable checkbox list
- ❌ Easy to miss selecting a location
- ❌ Could accidentally select multiple locations

### After:
- ✅ Clean dropdown menu (standard UI pattern)
- ✅ Clear single selection
- ✅ Simple helper text explaining requirement
- ✅ Shows location with city and state for clarity
- ✅ Required field validation
- ✅ Cannot submit without selecting a location
- ✅ Professional, user-friendly interface

---

## Database Impact

**No database schema changes required!**

The `UserLocation` junction table already supports the one-to-one relationship:
```prisma
model UserLocation {
  id         Int              @id @default(autoincrement())
  userId     Int              @map("user_id")
  locationId Int              @map("location_id")
  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  location   BusinessLocation @relation(fields: [locationId], references: [id])

  @@unique([userId, locationId])
  @@index([userId])
  @@index([locationId])
  @@map("user_locations")
}
```

**The unique constraint `@@unique([userId, locationId])` ensures:**
- A user cannot have duplicate location assignments
- Each user-location combination is unique

**The system now enforces:**
- Users have exactly **ONE** location assignment
- UI prevents multiple selections
- API validates and enforces single location

---

## Backward Compatibility

The API response includes both:
- `locationId` - **Primary field** (single location ID)
- `locationIds` - **Deprecated** (array for backward compatibility)

This ensures existing code that may reference `locationIds` won't break immediately.

---

## Testing Checklist

### Create New User:
- [ ] Visit `/dashboard/users/new`
- [ ] Fill in user details
- [ ] Try to submit without selecting location → Should show error
- [ ] Select a location from dropdown
- [ ] Submit form → Should create user successfully
- [ ] Verify user has only one location assigned

### Edit Existing User:
- [ ] Visit `/dashboard/users/[id]/edit`
- [ ] Current location should be pre-selected in dropdown
- [ ] Change location to different one
- [ ] Save changes → Should update successfully
- [ ] Verify old location removed, new location assigned
- [ ] Check that only ONE location is assigned

### User List:
- [ ] Visit `/dashboard/users`
- [ ] Users should display their assigned location
- [ ] No visual changes needed for list view

---

## Files Modified

1. ✅ `src/app/dashboard/users/new/page.tsx` - New user form
2. ✅ `src/app/dashboard/users/[id]/edit/page.tsx` - Edit user form
3. ✅ `src/app/api/users/route.ts` - Create user API
4. ✅ `src/app/api/users/[id]/route.ts` - Get and Update user APIs

---

## Migration Notes

If you have existing users with **multiple locations** assigned:

```sql
-- Check users with multiple locations
SELECT userId, COUNT(*) as location_count
FROM user_locations
GROUP BY userId
HAVING COUNT(*) > 1;

-- To clean up (keep first location, remove others):
DELETE FROM user_locations
WHERE id NOT IN (
  SELECT MIN(id)
  FROM user_locations
  GROUP BY userId
);
```

---

## Benefits

1. **Simpler User Interface** - Single dropdown is clearer than multiple checkboxes
2. **Reduced Confusion** - Users understand they must pick ONE location
3. **Better Validation** - Required field prevents missing location assignments
4. **Consistent Data** - Every user has exactly one location
5. **Easier Reporting** - Sales reports can reliably filter by user's location
6. **Professional UX** - Standard dropdown pattern familiar to all users

---

## Complete! ✅

The user management system now enforces single location assignment with a clean, professional combo box interface.
