# Attendance Records - Access Guide

## 🌐 Quick Access

### Development Server
**URL**: http://localhost:3006/dashboard/attendance

### Production Server (when deployed)
**URL**: https://your-domain.com/dashboard/attendance

---

## 🔐 Login & Permissions

### Required Permissions
To access the attendance page, your user account must have **at least one** of these permissions:

| Permission | Level | What You Can Do |
|------------|-------|-----------------|
| `ATTENDANCE_VIEW` | All Records | View all attendance records in your business |
| `ATTENDANCE_MANAGE` | All Records + Edit | View and manage all attendance records |
| `ATTENDANCE_VIEW_OWN` | Own Records Only | View only your own attendance records |

### How to Check Your Permissions
1. Log in to the system
2. Look at the sidebar menu
3. If you see "Attendance" → You have access
4. If you don't see it → Contact your administrator

### Default Role Permissions
Based on the seeded roles:

| Role | Has Access? | Permission Level |
|------|-------------|------------------|
| **Super Admin** | ✅ Yes | ATTENDANCE_MANAGE (full access) |
| **Admin** | ✅ Yes | ATTENDANCE_MANAGE (full access) |
| **Manager** | ✅ Yes | ATTENDANCE_VIEW (view all) |
| **Cashier** | ⚠️ Maybe | ATTENDANCE_VIEW_OWN (own only) |

---

## 📁 File Locations

### Source Code
All files are in: `C:\xampp\htdocs\ultimatepos-modern\`

| Type | Path |
|------|------|
| **Page Component** | `src/app/dashboard/attendance/page.tsx` |
| **API Route** | `src/app/api/attendance/route.ts` |
| **Permissions** | `src/lib/rbac.ts` |
| **Schema** | `prisma/schema.prisma` |

### Documentation
All documentation files are in the project root:

| Document | Filename | Purpose |
|----------|----------|---------|
| **Technical Guide** | `ATTENDANCE_DEVEXTREME_IMPLEMENTATION.md` | Full technical details |
| **User Guide** | `ATTENDANCE_QUICK_REFERENCE.md` | End-user instructions |
| **Comparison** | `ATTENDANCE_BEFORE_AFTER_COMPARISON.md` | Before/after analysis |
| **Summary** | `ATTENDANCE_IMPLEMENTATION_SUMMARY.md` | Implementation overview |
| **Access Guide** | `ATTENDANCE_ACCESS_GUIDE.md` | This file |

---

## 🚀 Starting the Development Server

### Option 1: npm (Recommended)
```bash
cd C:\xampp\htdocs\ultimatepos-modern
npm run dev
```

### Option 2: With custom port
```bash
npm run dev -- -p 3005
```

### Server Status
- **Starting**: Shows "Starting..." message
- **Ready**: Shows "Ready in Xs" message
- **URL**: Displays local URL (usually port 3000, 3005, or 3006)

### Common Ports
- `3000` - Default Next.js port
- `3005` - Often used for this project
- `3006` - Backup port (if 3000 and 3005 are busy)

---

## 🔍 Navigation

### From Login
1. Login at: http://localhost:3006/login
2. Enter username and password
3. Redirect to: http://localhost:3006/dashboard
4. Look for "Attendance" in sidebar
5. Click to go to: http://localhost:3006/dashboard/attendance

### From Dashboard
1. Already at: http://localhost:3006/dashboard
2. Look at left sidebar
3. Find "Attendance" section (may be in Employee/HR section)
4. Click "Attendance Records"
5. Loads: http://localhost:3006/dashboard/attendance

### Direct Access (if logged in)
Simply go to: http://localhost:3006/dashboard/attendance

---

## 📊 API Endpoints

### Get Attendance Records
**Endpoint**: `GET /api/attendance`

**Base URL**: http://localhost:3006/api/attendance

**Query Parameters**:
```
?userId=5                   // Filter by specific employee
?locationId=2               // Filter by location
?status=late                // Filter by status
?startDate=2025-10-01       // Filter from date
?endDate=2025-10-31         // Filter to date
```

**Example Requests**:
```bash
# Get all records
curl http://localhost:3006/api/attendance

# Get records for employee ID 5
curl http://localhost:3006/api/attendance?userId=5

# Get late records
curl http://localhost:3006/api/attendance?status=late

# Get records for date range
curl http://localhost:3006/api/attendance?startDate=2025-10-01&endDate=2025-10-31

# Combine filters
curl http://localhost:3006/api/attendance?userId=5&locationId=2&startDate=2025-10-01
```

---

## 🗂️ Database Access

### Prisma Studio (Visual Database Tool)
```bash
cd C:\xampp\htdocs\ultimatepos-modern
npm run db:studio
```
This opens: http://localhost:5555

### Attendance Table
**Table Name**: `attendance`
**Model Name**: `Attendance`

**Direct Database Fields**:
- `id` - Primary key
- `user_id` - Foreign key to users
- `business_id` - Foreign key to businesses
- `location_id` - Foreign key to business_locations
- `date` - Attendance date
- `clock_in` - Clock in timestamp
- `clock_out` - Clock out timestamp
- `scheduled_start` - Scheduled start time
- `scheduled_end` - Scheduled end time
- `status` - Attendance status
- `total_hours_worked` - Calculated hours
- `is_overtime` - Boolean flag
- `overtime_hours` - Overtime amount
- And many more...

---

## 🎨 UI Components Location

### Filter Panel
**Location**: Top of page, below header

**Components**:
- Employee dropdown (left)
- Location dropdown
- Status dropdown
- Start date picker
- End date picker
- Apply/Clear buttons (right)

### Summary Cards
**Location**: Below filter panel

**Cards** (left to right):
1. Total Records (blue border)
2. Currently Clocked In (green border)
3. Late Today (yellow border)
4. Overtime Records (orange border)

### DataGrid
**Location**: Below summary cards

**Toolbar** (top of grid):
- Refresh button (left)
- Group panel (center)
- Search box (center-right)
- Export button (right)
- Column chooser button (right)

---

## 📱 Mobile Access

### Mobile URL
Same as desktop: http://localhost:3006/dashboard/attendance

### Mobile Features
- ✅ Filters stack vertically
- ✅ Cards stack vertically
- ✅ Grid scrolls horizontally
- ✅ Touch-friendly buttons
- ✅ Column chooser for hiding columns

### Mobile Testing
Use browser DevTools:
1. Press F12 (open DevTools)
2. Click device toolbar icon (Ctrl+Shift+M)
3. Select mobile device (iPhone, Android, etc.)
4. Test page responsiveness

---

## 🧪 Testing the Page

### Quick Test Steps
1. **Start server**: `npm run dev`
2. **Open browser**: http://localhost:3006/dashboard/attendance
3. **Check page loads**: No errors in console
4. **Test filters**: Select employee, click Apply
5. **Test sorting**: Click column header
6. **Test search**: Type in search box
7. **Test export**: Click export button
8. **Test dark mode**: Toggle theme
9. **Test mobile**: Resize browser window

### Verification Checklist
```
✅ Page URL: /dashboard/attendance
✅ Server: Running on port 3006
✅ Compilation: No errors
✅ API: Returns data
✅ Filters: All 6 work
✅ Grid: Displays data
✅ Export: Downloads Excel
✅ Dark Mode: Looks good
✅ Mobile: Responsive
```

---

## 🐛 Troubleshooting

### Cannot Access Page
**Problem**: Page shows 404 or redirect to login

**Solution**:
1. Check you're logged in
2. Verify your user has permissions
3. Check URL is correct: `/dashboard/attendance`
4. Try logging out and back in

### Server Not Running
**Problem**: "Cannot GET /dashboard/attendance" or connection refused

**Solution**:
```bash
# Stop any running servers
Ctrl+C

# Start fresh
cd C:\xampp\htdocs\ultimatepos-modern
npm run dev

# Wait for "Ready in Xs" message
# Then access URL shown in terminal
```

### Wrong Port
**Problem**: Page loads but shows old version

**Solution**:
1. Check terminal for actual port number
2. Update URL to match (e.g., :3006 instead of :3000)
3. Hard refresh browser (Ctrl+Shift+R)

### Compilation Errors
**Problem**: "Failed to compile" message

**Solution**:
```bash
# Stop server
Ctrl+C

# Clear cache
rm -rf .next

# Reinstall if needed
npm install

# Restart
npm run dev
```

### No Data Showing
**Problem**: Grid is empty

**Solution**:
1. Check database has attendance records
2. Check filters aren't too restrictive
3. Click "Clear" to reset filters
4. Check browser console for API errors
5. Verify API endpoint: http://localhost:3006/api/attendance

---

## 📞 Getting Help

### Check Documentation
1. **This file** - Quick access and navigation
2. **Quick Reference** - User guide and workflows
3. **Implementation Guide** - Technical details
4. **Comparison** - Before/after analysis

### Common Questions

**Q: What port is the server on?**
A: Check terminal output, usually 3000, 3005, or 3006

**Q: Why can't I see the Attendance menu?**
A: Your user needs ATTENDANCE_VIEW, ATTENDANCE_MANAGE, or ATTENDANCE_VIEW_OWN permission

**Q: How do I add test data?**
A: Use Prisma Studio (npm run db:studio) or seed file

**Q: Can I use this on mobile?**
A: Yes, fully responsive and touch-friendly

**Q: How do I export data?**
A: Click export button in grid toolbar, downloads Excel file

---

## 🔗 Related Pages

### Other Attendance Pages
- **Clock In/Out**: `/dashboard/clock`
- **My Schedule**: `/dashboard/my-schedule`
- **Leave Requests**: `/dashboard/leave-requests`
- **Location Changes**: `/dashboard/location-changes`

### Admin Pages
- **Users**: `/dashboard/users`
- **Schedules**: `/dashboard/schedules`
- **Locations**: `/dashboard/locations`
- **Roles**: `/dashboard/roles`

### Reports
- **Attendance Report**: `/dashboard/reports/attendance`
- **Hours Report**: `/dashboard/reports/hours`
- **Overtime Report**: `/dashboard/reports/overtime`

---

## 📋 Quick Command Reference

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linter
```

### Database
```bash
npm run db:push      # Sync schema to database
npm run db:seed      # Seed demo data
npm run db:studio    # Open Prisma Studio
npx prisma generate  # Regenerate Prisma client
```

### Git
```bash
git status           # Check changes
git add .            # Stage all changes
git commit -m "msg"  # Commit changes
git push             # Push to remote
```

---

## 🎯 Success Checklist

When everything is working, you should be able to:

- [ ] Start server with `npm run dev`
- [ ] Access http://localhost:3006/dashboard/attendance
- [ ] See filter panel with 6 filters
- [ ] See 4 summary cards
- [ ] See DataGrid with attendance data
- [ ] Click Apply to filter data
- [ ] Click column headers to sort
- [ ] Type in search to find records
- [ ] Click Export to download Excel
- [ ] Toggle dark mode (looks good)
- [ ] Resize to mobile (works well)
- [ ] Click View button (goes to detail page)

If all checkboxes can be checked → ✅ **WORKING PERFECTLY**

---

## 🌟 Pro Tips

### Tip 1: Bookmark the URL
Add http://localhost:3006/dashboard/attendance to browser bookmarks

### Tip 2: Keep Terminal Open
Always keep terminal visible to see errors/warnings

### Tip 3: Use DevTools
F12 → Console tab to see any JavaScript errors

### Tip 4: Test Filters First
Before reporting bugs, try clearing filters (may be hiding data)

### Tip 5: Check Permissions
If features are missing, check user role and permissions

---

## 📍 Visual Map

```
Project Root (C:\xampp\htdocs\ultimatepos-modern)
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── attendance/
│   │   │       └── route.ts          ← API endpoint
│   │   │
│   │   └── dashboard/
│   │       └── attendance/
│   │           └── page.tsx          ← Main page component
│   │
│   ├── lib/
│   │   ├── rbac.ts                   ← Permissions
│   │   ├── prisma.ts                 ← Database client
│   │   └── auth.ts                   ← Authentication
│   │
│   └── hooks/
│       └── usePermissions.ts         ← Permission hook
│
├── prisma/
│   └── schema.prisma                 ← Database schema
│
├── ATTENDANCE_DEVEXTREME_IMPLEMENTATION.md    ← Technical guide
├── ATTENDANCE_QUICK_REFERENCE.md              ← User guide
├── ATTENDANCE_BEFORE_AFTER_COMPARISON.md      ← Comparison
├── ATTENDANCE_IMPLEMENTATION_SUMMARY.md       ← Summary
└── ATTENDANCE_ACCESS_GUIDE.md                 ← This file
```

---

**Last Updated**: 2025-10-23
**Server**: http://localhost:3006/dashboard/attendance
**Status**: ✅ Ready for Use

**Need Help?** Check the other documentation files listed above!
