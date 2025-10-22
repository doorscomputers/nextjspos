# 📢 Announcement System - Complete Guide

## Overview

You now have a complete **Announcement & Reminder** system with a scrolling ticker in the header! This feature allows administrators to broadcast important messages, reminders, and announcements to all users.

## What Was Implemented

### 1. ✅ Database Schema
- **New Table**: `announcements`
- **Fields**: title, message, type, priority, start/end dates, targeting, icons, display order
- **Multi-tenant**: Properly isolated by `businessId`
- **Soft Delete**: Uses `deletedAt` for safe removal

### 2. ✅ RBAC Permissions
Added to `src/lib/rbac.ts`:
- `ANNOUNCEMENT_VIEW` - View announcements
- `ANNOUNCEMENT_CREATE` - Create new announcements
- `ANNOUNCEMENT_UPDATE` - Edit existing announcements
- `ANNOUNCEMENT_DELETE` - Delete announcements
- `ANNOUNCEMENT_MANAGE` - Full management access

**Roles with Full Access:**
- Super Admin (all permissions)
- Branch Admin
- Branch Manager

### 3. ✅ API Routes

**GET /api/announcements**
- List all announcements for the business
- Query params:
  - `active=true` - Only active announcements
  - `forTicker=true` - Announcements for ticker (with date/targeting filters)

**POST /api/announcements**
- Create new announcement
- Requires: `ANNOUNCEMENT_CREATE` permission

**PUT /api/announcements/[id]**
- Update existing announcement
- Requires: `ANNOUNCEMENT_UPDATE` permission

**DELETE /api/announcements/[id]**
- Soft delete announcement
- Requires: `ANNOUNCEMENT_DELETE` permission

### 4. ✅ Scrolling Ticker Component
**Location**: `src/components/AnnouncementTicker.tsx`

**Features**:
- Auto-scrolling marquee animation
- Pauses on hover
- Color-coded by priority:
  - 🔴 **Urgent** - Red
  - 🟠 **Warning** - Orange
  - 🟢 **Success** - Green
  - 🔵 **Info** - Blue
- Icon support (emojis)
- Auto-refreshes every 5 minutes
- Dismissible (hide button)
- Seamless infinite loop

### 5. ✅ Management Page
**Location**: `/dashboard/announcements`

**Features**:
- Full CRUD interface
- Table view with sortable columns
- Create/Edit modal form
- Priority and type badges
- Active/Inactive status indicators
- Permission-based access control
- Toast notifications for actions

### 6. ✅ Sidebar Integration
- New menu item: "Announcements" with speaker icon
- Visible to users with `ANNOUNCEMENT_VIEW` permission
- Located between Reports and Settings

## How to Use

### For Administrators

1. **Access the Management Page**:
   - Click "Announcements" in the sidebar
   - Or navigate to `/dashboard/announcements`

2. **Create an Announcement**:
   - Click "Create Announcement" button
   - Fill in the form:
     - **Title**: Short headline (e.g., "Flash Sale Today!")
     - **Message**: Full announcement text
     - **Type**: System, Business Reminder, Promotional, Location Specific
     - **Priority**: Info, Success, Warning, Urgent
     - **Start Date** (optional): When to start showing
     - **End Date** (optional): When to stop showing
     - **Icon** (optional): Emoji (📢 🎉 ⚠️ ℹ️)
     - **Display Order**: Lower numbers show first
     - **Active**: Check to show in ticker
   - Click "Create"

3. **Edit an Announcement**:
   - Click the pencil icon on any announcement
   - Modify fields
   - Click "Update"

4. **Delete an Announcement**:
   - Click the trash icon
   - Confirm deletion

### For All Users

- Announcements automatically appear in the **header ticker**
- Scrolls continuously from right to left
- **Hover** to pause and read
- **Click X** to hide the ticker (until page refresh)

## Announcement Types

1. **System** ⚙️
   - Platform updates
   - Maintenance notices
   - System changes

2. **Business Reminder** 📋
   - Daily tasks
   - Inventory counts
   - Shift responsibilities

3. **Promotional** 🎉
   - Sales events
   - Special offers
   - Marketing campaigns

4. **Location Specific** 📍
   - Branch-specific notices
   - Local announcements

## Priority Levels

1. **Info** (Blue) - General information
2. **Success** (Green) - Positive news
3. **Warning** (Orange) - Important notices
4. **Urgent** (Red) - Critical alerts

## Scheduling Features

### Auto Show/Hide
- **Start Date**: Announcement begins showing at this date/time
- **End Date**: Announcement stops showing after this date/time
- Leave blank for "always show"

### Targeting (Future Enhancement)
Currently supports:
- `targetRoles` - Show to specific roles (comma-separated)
- `targetLocations` - Show to specific locations (comma-separated)
- Leave null to show to everyone

## Sample Use Cases

### 1. Daily Reminder
```
Title: "Cash Count Required"
Message: "Remember to count your cash drawer at shift end. Report any discrepancies immediately."
Type: Business Reminder
Priority: Info
Icon: 💰
```

### 2. Flash Sale
```
Title: "Weekend Sale - 20% Off!"
Message: "All electronics 20% off this weekend! Tell every customer!"
Type: Promotional
Priority: Success
Icon: 🎉
Start Date: Friday 00:00
End Date: Sunday 23:59
```

### 3. System Maintenance
```
Title: "Scheduled Maintenance Tonight"
Message: "System will be down 10PM-12AM for updates. Complete all transactions before 10PM."
Type: System
Priority: Warning
Icon: ⚠️
Start Date: Today 08:00
End Date: Today 22:00
```

### 4. Urgent Alert
```
Title: "IMPORTANT: Power Outage Drill"
Message: "Power outage drill at 3PM. Save all work. UPS will last 30 minutes."
Type: System
Priority: Urgent
Icon: 🚨
```

## Technical Details

### Database Structure
```sql
CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  business_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'system',
  priority VARCHAR(20) DEFAULT 'info',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  target_roles TEXT,
  target_locations TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  icon VARCHAR(50),
  created_by_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);
```

### File Locations
- **Database Migration**: `migrate-announcements.mjs`
- **Prisma Schema**: `prisma/schema.prisma` (lines 2446-2493)
- **RBAC Permissions**: `src/lib/rbac.ts` (lines 350-355)
- **API Routes**:
  - `src/app/api/announcements/route.ts`
  - `src/app/api/announcements/[id]/route.ts`
- **Ticker Component**: `src/components/AnnouncementTicker.tsx`
- **Management Page**: `src/app/dashboard/announcements/page.tsx`
- **Header Integration**: `src/components/Header.tsx` (line 129)
- **Sidebar Menu**: `src/components/Sidebar.tsx` (lines 696-700)

## Customization

### Change Scroll Speed
Edit `AnnouncementTicker.tsx`, line with `animation: scroll 30s`:
- Faster: Reduce seconds (e.g., `20s`)
- Slower: Increase seconds (e.g., `45s`)

### Change Refresh Interval
Edit `AnnouncementTicker.tsx`, line `5 * 60 * 1000`:
- Change `5` to desired minutes

### Add New Priority Colors
Edit `AnnouncementTicker.tsx`, `getPriorityColors()` function

## Future Enhancements (Optional)

Potential features you could add:
1. Rich text editor for messages
2. Image/file attachments
3. Click tracking (views/impressions)
4. Email/SMS notifications
5. Recurring announcements
6. Template library
7. Multi-language support
8. Sound notifications
9. Browser push notifications
10. Analytics dashboard

## Troubleshooting

### Ticker Not Showing
- Check if there are active announcements
- Verify announcement dates (start/end)
- Check browser console for errors
- Ensure user has proper permissions

### Announcements Not Appearing
- Verify `isActive` is checked
- Check date range
- Ensure targeting matches user's role/location

### Permission Issues
- Verify user has `ANNOUNCEMENT_VIEW` permission
- Check role assignments in RBAC
- Re-seed database if needed

## Support

The announcement system is fully integrated and ready to use! Access it at:

**Management Page**: http://localhost:3002/dashboard/announcements

Login with:
- **Super Admin**: `superadmin` / `password`
- **Admin**: `admin` / `password`

---

## Summary

✅ Complete announcement system implemented
✅ Scrolling ticker in header
✅ Full CRUD management interface
✅ RBAC permissions configured
✅ Multi-tenant isolation
✅ Date-based scheduling
✅ Priority color coding
✅ Icon support
✅ Auto-refresh functionality

**Ready to use!** 🎉
