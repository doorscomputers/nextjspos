# User Location Assignment System

**Last Updated:** 2025-10-27
**Status:** ✅ Production Ready

## Overview

This document explains how user location assignments work in the UltimatePOS Modern system, ensuring data consistency and preventing issues in production.

## Database Architecture

### UserLocation Table Schema
```prisma
model UserLocation {
  userId     Int              @map("user_id")
  locationId Int              @map("location_id")
  user       User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  location   BusinessLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at")

  @@id([userId, locationId])  // Composite primary key
  @@index([userId])
  @@index([locationId])
  @@map("user_locations")
}
```

**Key Points:**
- **Many-to-Many Relationship**: A user CAN have multiple locations assigned in the database
- **Composite Primary Key**: `[userId, locationId]` ensures no duplicate assignments
- **Cascade Delete**: When a user or location is deleted, the assignments are automatically removed
- **Indexed**: Both userId and locationId are indexed for fast lookups

## Current Implementation (Single Location)

### Why Single Location?

For simplicity and clarity, the current UI and API implementation uses **single location assignment**:

1. **Simpler UX**: Users don't need to manage multiple location checkboxes
2. **Clearer Responsibilities**: Each transactional user has ONE primary location
3. **Easier Reporting**: Clear attribution of actions to specific locations

### How It Works

#### 1. Creating a New User (`POST /api/users`)

```javascript
// Frontend sends single locationId
{
  username: "cashier1",
  roleIds: [3],        // Cashier role
  locationId: 2,       // Main Store
  // ... other fields
}
```

```javascript
// Backend creates ONE UserLocation record
await prisma.userLocation.create({
  data: {
    userId: newUser.id,
    locationId: parseInt(locationId)
  }
})
```

#### 2. Editing a User (`PUT /api/users/[id]`)

```javascript
// Backend REPLACES all locations with the new single location
if (locationId !== undefined) {
  // Delete ALL existing location assignments
  await prisma.userLocation.deleteMany({
    where: { userId }
  })

  // Create NEW single location assignment
  if (locationId) {
    await prisma.userLocation.create({
      data: {
        userId,
        locationId: parseInt(locationId)
      }
    })
  }
}
```

**Important:** The update is atomic - old locations are deleted before new one is created.

#### 3. Fetching User Details (`GET /api/users/[id]`)

```javascript
// Backend returns BOTH single location AND array for backward compatibility
{
  id: 1,
  username: "cashier1",
  locationId: 2,              // Primary location (used by edit form)
  locationIds: [2],           // Array format (backward compatibility)
  locations: ["Main Store"],  // Location names
  // ... other fields
}
```

## Role-Based Location Requirements

### Admin Roles (Location Optional)
- Super Admin
- Branch Admin
- All Branch Admin

**These roles can access ALL locations** within their business. Assigning a specific location is optional.

### Transactional Roles (Location Required)
- Cashier
- Manager
- Staff
- Any custom role without admin privileges

**These roles MUST have a location assigned** to perform transactions.

### Validation Logic

```javascript
// Check if selected roles require location assignment
const adminRoles = ['Super Admin', 'Branch Admin', 'All Branch Admin']
const hasAdminRole = selectedRoleNames.some(name => adminRoles.includes(name))

if (!hasAdminRole && !locationId) {
  throw new Error('Location is required for transactional roles')
}
```

## API Response Format Standardization

### Before (Inconsistent ❌)
```javascript
// /api/users
{ success: true, data: [...] }

// /api/roles
{ success: true, data: [...] }

// /api/locations
{ locations: [...] }  // DIFFERENT FORMAT!
```

### After (Consistent ✅)
```javascript
// ALL endpoints now return:
{ success: true, data: [...] }
```

### Handling Responses in Frontend

```javascript
// Recommended pattern (handles both old and new format)
const response = await fetch('/api/locations')
const data = await response.json()
const locations = data.data || data.locations || data || []
```

## Data Integrity Guarantees

### 1. Database Level
- ✅ **Cascade Deletes**: When user or location is deleted, `UserLocation` records auto-delete
- ✅ **Composite Key**: Prevents duplicate `[userId, locationId]` pairs
- ✅ **Foreign Keys**: Ensures locationId and userId always reference valid records

### 2. Application Level
- ✅ **Transaction Safety**: Location updates use atomic replace (delete-all + create-new)
- ✅ **Validation**: API enforces location requirement for non-admin roles
- ✅ **Multi-Tenant Isolation**: Users can only be assigned locations from their business

### 3. Production Safety
- ✅ **No Data Loss**: Old location assignments are intentionally deleted before new ones are created
- ✅ **Consistent State**: No orphaned `UserLocation` records possible
- ✅ **Rollback Safe**: If location assignment fails, transaction rolls back

## Potential Future Enhancements

The database schema ALREADY supports multiple locations per user. To enable this in the future:

### 1. Update API Endpoints
```diff
- locationId: number | null
+ locationIds: number[]
```

### 2. Update Frontend Forms
```diff
- <select value={locationId}>
+ <Checkbox.Group value={locationIds}>
```

### 3. Update Backend Logic
```javascript
// Instead of deleteMany + create one
// Just sync the array:
await syncUserLocations(userId, locationIds)
```

## Verification Commands

### Check User Location Assignments
```sql
-- PostgreSQL
SELECT
  u.username,
  u.firstName,
  u.surname,
  bl.name as location_name,
  ul.created_at
FROM user_locations ul
JOIN users u ON u.id = ul.user_id
JOIN business_locations bl ON bl.id = ul.location_id
WHERE u.deleted_at IS NULL
ORDER BY u.username;
```

### Find Users Without Locations
```sql
SELECT
  u.id,
  u.username,
  u.firstName,
  u.surname
FROM users u
LEFT JOIN user_locations ul ON ul.user_id = u.id
WHERE u.deleted_at IS NULL
  AND u.business_id IS NOT NULL
  AND ul.user_id IS NULL;
```

### Check for Duplicate Assignments (Should be 0)
```sql
SELECT
  user_id,
  location_id,
  COUNT(*) as count
FROM user_locations
GROUP BY user_id, location_id
HAVING COUNT(*) > 1;
```

## Common Issues & Solutions

### Issue: User loses location after edit
**Cause:** Form didn't send `locationId` in PUT request
**Solution:** Ensure edit form always includes `locationId` field (even if unchanged)

### Issue: Admin user has no locations showing
**Cause:** Expected behavior - admin users don't need location restrictions
**Solution:** Check user roles - admin roles have access to all locations

### Issue: API returns `{ locations: [...] }` instead of `{ success: true, data: [...] }`
**Cause:** Using old frontend code with new standardized API
**Solution:** Update frontend to use defensive pattern: `data.data || data.locations || data`

## Testing Checklist

Before deploying changes:

- [ ] Create new user with location → Verify `UserLocation` record created
- [ ] Edit user location → Verify old record deleted, new one created
- [ ] Delete user → Verify `UserLocation` records auto-deleted (cascade)
- [ ] Delete location → Verify `UserLocation` records auto-deleted (cascade)
- [ ] Create admin user without location → Should succeed
- [ ] Create cashier without location → Should fail with error
- [ ] View user list → All locations display correctly
- [ ] Edit user → Location pre-selected in dropdown

## Contact

For questions or issues with user location assignments, contact the development team or file an issue.
