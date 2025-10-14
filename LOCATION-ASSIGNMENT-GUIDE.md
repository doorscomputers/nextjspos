# Location Assignment Guide

## Issue Fixed
✅ User location not loading in Begin Shift page
✅ Dashboard showing "All Locations" instead of user's assigned location

## What Changed

### 1. Begin Shift Page API (`/api/user-locations/my-location`)
- Fixed undefined `userLocation` error
- Added null safety checks
- Returns user's first assigned location

### 2. Dashboard Page
- Auto-selects user's location if they have only ONE assigned location
- Hides "All Locations" option for users with single location
- Shows "All Locations" only if user has access to multiple locations

## How to Assign Location to a User

### Method 1: Using Database Script (Quick)

Create a script to assign a location to your cashier:

```javascript
// assign-location-to-user.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function assignLocation() {
  try {
    // Find the user (e.g., Main Store Cashier)
    const user = await prisma.user.findFirst({
      where: { username: 'cashier' } // Change to your cashier's username
    })

    if (!user) {
      console.log('❌ User not found')
      return
    }

    // Find the location (e.g., Main Store)
    const location = await prisma.businessLocation.findFirst({
      where: {
        businessId: user.businessId,
        name: 'Main Store' // Change to your location name
      }
    })

    if (!location) {
      console.log('❌ Location not found')
      return
    }

    // Check if assignment already exists
    const existing = await prisma.userLocation.findFirst({
      where: {
        userId: user.id,
        locationId: location.id
      }
    })

    if (existing) {
      console.log('✅ User already assigned to this location')
      return
    }

    // Create the assignment
    await prisma.userLocation.create({
      data: {
        userId: user.id,
        locationId: location.id
      }
    })

    console.log(`✅ Assigned ${user.username} to ${location.name}`)
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignLocation()
```

Run it:
```bash
node assign-location-to-user.js
```

### Method 2: Using SQL (Direct)

```sql
-- Find the user ID
SELECT id, username, name FROM User WHERE username = 'cashier';

-- Find the location ID
SELECT id, name FROM BusinessLocation WHERE name = 'Main Store';

-- Assign location to user (replace IDs with actual values)
INSERT INTO UserLocation (userId, locationId, createdAt, updatedAt)
VALUES (5, 1, NOW(), NOW());
```

### Method 3: Through the UI (Recommended for Production)

1. Login as **Admin** or **Branch Admin**
2. Go to **User Management** → **Users**
3. Click **Edit** on the cashier user
4. Select the **Assigned Location(s)**
5. Click **Save**

*Note: The UI for this needs to be built if not already available*

## Expected Behavior After Assignment

### For Cashiers (Single Location)
- ✅ Begin Shift page: Shows assigned location automatically
- ✅ Dashboard: Shows only their location (no "All Locations" option)
- ✅ Location dropdown: Auto-selected to their location

### For Managers (Multiple Locations)
- ✅ Dashboard: Shows "All Locations" + all assigned locations
- ✅ Can filter data by location
- ✅ Can view all locations they manage

### For Branch Admin (All Locations Access)
- ✅ Dashboard: Shows "All Locations" + all business locations
- ✅ Can filter data by any location
- ✅ Full access to all locations

## Troubleshooting

### Issue: "No location assigned to your account"
**Solution**: Assign a location using one of the methods above

### Issue: Begin Shift page still not loading location
**Solution**:
1. Clear browser cache
2. Log out and log back in
3. Check browser console for errors
4. Verify user has a location in `UserLocation` table

### Issue: Dashboard still showing "All Locations"
**Solution**:
1. Refresh the page
2. Check if user has `ACCESS_ALL_LOCATIONS` permission (remove it for cashiers)
3. Verify user has exactly 1 location assigned

### Issue: Internal Server Error on Begin Shift
**Solution**:
1. Check server console logs
2. Verify database connection
3. Ensure `UserLocation` table exists
4. Run: `npx prisma generate`

## Database Schema Reference

```prisma
model UserLocation {
  id         Int      @id @default(autoincrement())
  userId     Int      @map("user_id")
  locationId Int      @map("location_id")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  user     User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  location BusinessLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([userId, locationId])
  @@map("user_locations")
}
```

## Testing Checklist

- [ ] Login as cashier with single location
- [ ] Begin Shift page shows location automatically
- [ ] Dashboard shows only assigned location (no "All Locations")
- [ ] Can start shift successfully
- [ ] Location is recorded correctly in shift data
- [ ] Sales are associated with correct location
- [ ] Reports show correct location data

## Next Steps

After fixing location assignment:
1. Run migration script for granular permissions: `node scripts/add-granular-permissions.js`
2. Test with different user roles
3. Verify sidebar menus show correct items based on permissions
4. Test report access restrictions

---

**Quick Fix for Current Issue:**
Run this script to assign Main Store to your cashier:

```bash
node -e "const {PrismaClient}=require('@prisma/client');const p=new PrismaClient();(async()=>{const u=await p.user.findFirst({where:{username:'cashier'}});const l=await p.businessLocation.findFirst({where:{name:'Main Store'}});await p.userLocation.create({data:{userId:u.id,locationId:l.id}});console.log('✅ Done');process.exit()})();"
```

Then refresh the Begin Shift page!
