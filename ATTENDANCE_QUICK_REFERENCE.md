# Attendance Records - Quick Reference Guide

## 🚀 Quick Start

### Access the Page
**URL**: http://localhost:3006/dashboard/attendance

### Required Permissions
One of the following:
- `ATTENDANCE_VIEW` - View all records
- `ATTENDANCE_MANAGE` - Manage all records
- `ATTENDANCE_VIEW_OWN` - View own records only

---

## 📊 Page Components

### 1. Filter Panel
Located at the top, used to narrow down attendance records.

| Filter | Component Type | Features |
|--------|---------------|----------|
| **Employee** | DevExtreme SelectBox | Search by name, clear button |
| **Location** | DevExtreme SelectBox | Search by location name, clear button |
| **Status** | DevExtreme SelectBox | 6 status options + "All" |
| **Start Date** | DevExtreme DateBox | Date picker, formatted display |
| **End Date** | DevExtreme DateBox | Date picker, formatted display |
| **Apply** | DevExtreme Button | Blue, search icon, applies filters |
| **Clear** | DevExtreme Button | Outlined, clears all filters |

**Status Options:**
- All Statuses
- On Time
- Late
- Absent
- Early Departure
- Emergency Change
- Location Switch

---

### 2. Summary Cards
4 statistics cards showing at-a-glance metrics.

| Card | Border Color | Shows |
|------|-------------|-------|
| **Total Records** | Blue | Count of all displayed records |
| **Currently Clocked In** | Green | Records with no clockOut time |
| **Late Today** | Yellow | Records with status = 'late' |
| **Overtime Records** | Orange | Records with isOvertime = true |

---

### 3. DataGrid (Main Table)

#### Columns
| Column | Width | Type | Features |
|--------|-------|------|----------|
| ID | 80px | Number | Center aligned |
| Employee | 200px+ | Custom | Name + email (2 lines) |
| Location | 180px+ | Custom | Shows switches |
| Date | 120px | Date | "MMM dd, yyyy" |
| Clock In | 100px | Time | "hh:mm a" format |
| Clock Out | 100px | Time | "Active" badge if clocked in |
| Scheduled Start | 120px | Text | Scheduled start time |
| Scheduled End | 120px | Text | Scheduled end time |
| Hours Worked | 120px | Number | Right-aligned, "OT" badge |
| Status | 140px | Badge | Color-coded |
| Actions | 100px | Button | View button |

#### Toolbar Features
- **Refresh**: Reload data from API
- **Group Panel**: Drag columns here to group
- **Search**: Search all columns
- **Export**: Download as Excel
- **Column Chooser**: Show/hide columns

#### Grid Features
✅ **Sorting**: Click column headers
✅ **Filtering**: Use filter row below headers
✅ **Search**: Type in search box (searches all)
✅ **Paging**: 20 records per page
✅ **Selection**: Click checkboxes to select rows
✅ **Reordering**: Drag column headers
✅ **Resizing**: Drag column borders
✅ **Grouping**: Drag to group panel
✅ **State Saving**: Settings persist on reload

---

## 🎨 Status Colors

| Status | Color | Hex Code |
|--------|-------|----------|
| On Time | Green | #10b981 |
| Late | Yellow/Amber | #f59e0b |
| Absent | Red | #ef4444 |
| Early Departure | Orange | #f97316 |
| Emergency Change | Blue | #3b82f6 |
| Location Switch | Purple | #8b5cf6 |
| Default | Gray | #6b7280 |

---

## 🔄 Common Workflows

### Filter by Employee
1. Click **Employee** dropdown
2. Type employee name to search
3. Select employee
4. Click **Apply**

### Filter by Date Range
1. Click **Start Date** picker
2. Select start date
3. Click **End Date** picker
4. Select end date
5. Click **Apply**

### Export to Excel
1. Click **Export** button in toolbar (appears as grid icon)
2. File downloads automatically
3. Open with Excel/Google Sheets
4. Filename: `attendance_records_YYYY-MM-DD.xlsx`

### Group by Location
1. Drag **Location** column header to group panel (top of grid)
2. Groups appear with expand/collapse arrows
3. Summary shows in each group
4. Drag out to ungroup

### View Attendance Details
1. Find record in grid
2. Click **View** button in Actions column
3. Redirects to detail page: `/dashboard/attendance/{id}`

### Clear Filters
1. Click **Clear** button (next to Apply)
2. All filters reset to default
3. Full dataset loads

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Focus Search | Click search box |
| Next Page | Click "Next" in pager |
| Sort Column | Click column header |
| Open Filter | Click filter icon in header |
| Select Row | Click checkbox or row |

---

## 📱 Mobile Usage

### Filter Panel
- Filters stack vertically (1 column)
- Touch-friendly dropdowns
- Date pickers use native mobile UI

### Summary Cards
- Stack vertically (1 column)
- Full width on mobile

### DataGrid
- Horizontal scroll enabled
- Touch gestures for scrolling
- Tap row to select
- Column chooser recommended (hide columns)

---

## 🔧 Troubleshooting

### No Data Showing
**Check:**
1. Are filters too restrictive? Click **Clear**
2. Does user have permission?
3. Is there attendance data in database?
4. Check browser console for errors

### Excel Export Not Working
**Check:**
1. Pop-up blocker enabled?
2. Browser has download permission?
3. Check console for errors
4. Try selecting specific rows first

### Filters Not Working
**Check:**
1. Did you click **Apply** after setting filters?
2. Check filter values are valid
3. Try **Clear** then reapply

### Page Loading Slowly
**Check:**
1. Large dataset? Use filters to reduce
2. Network connection stable?
3. Check browser DevTools Network tab
4. Consider adding date range filter

---

## 💡 Pro Tips

### Tip 1: Save Column Layout
Your column order, widths, and visibility are automatically saved. Set it up once!

### Tip 2: Use Multiple Filters
Combine filters for precise results:
- Employee + Date Range = One person's attendance for period
- Location + Status = All late records at specific location

### Tip 3: Export Filtered Data
Apply filters first, then export. Only filtered data is exported!

### Tip 4: Use Header Filters
Click filter icon in column header for advanced filtering (checkboxes for each value).

### Tip 5: Group and Export
Group by location, then export to see grouped data in Excel.

---

## 🎯 Performance Tips

### For Large Datasets (1000+ records)
1. **Always use date filters** to limit results
2. **Group by location** for better organization
3. **Export in batches** using date ranges
4. **Hide unused columns** with column chooser

### For Slow Networks
1. **Increase page size** to reduce requests (configure in grid)
2. **Use server-side filtering** (already implemented)
3. **Avoid excessive sorting/filtering** client-side

---

## 🌙 Dark Mode

### Automatic Support
- Respects system theme preference
- All text readable in dark mode
- Status badges optimized for dark backgrounds
- Toggle theme in user menu (top right)

### Dark Mode Colors
- Background: Dark gray (#1f2937)
- Text: Light gray (#f9fafb)
- Borders: Dark borders (#374151)
- Cards: Slightly lighter gray (#111827)

---

## 📞 Support & Help

### Documentation
- **Full Implementation**: `ATTENDANCE_DEVEXTREME_IMPLEMENTATION.md`
- **DevExtreme Docs**: https://js.devexpress.com/React/
- **Project CLAUDE.md**: Project root

### Common Questions

**Q: Can I print the grid?**
A: Not directly, but export to Excel then print from there.

**Q: Can I edit records in the grid?**
A: No, click View button to edit on detail page.

**Q: How far back does data go?**
A: All historical data, use date filters to narrow.

**Q: Can I see deleted records?**
A: No, soft-deleted records are hidden by API.

**Q: What's the "OT" badge?**
A: Overtime indicator - employee worked beyond scheduled hours.

---

## 🔐 Security & Permissions

### Permission Levels
1. **ATTENDANCE_VIEW**: See all attendance records
2. **ATTENDANCE_MANAGE**: See + manage all records
3. **ATTENDANCE_VIEW_OWN**: See only your own records

### Data Isolation
- Multi-tenant: Only see your business's data
- Location-based: Can filter by accessible locations
- User-based: Own records only if limited permission

---

## 🎓 Best Practices

### Daily Use
1. ✅ Filter by date for current day/week
2. ✅ Check "Currently Clocked In" card for active employees
3. ✅ Review "Late Today" for attendance issues
4. ✅ Use location filter for specific branches

### Weekly Review
1. ✅ Export full week's data to Excel
2. ✅ Group by employee to see patterns
3. ✅ Check overtime hours total (summary row)
4. ✅ Review early departures

### Monthly Reporting
1. ✅ Set date range for entire month
2. ✅ Export to Excel
3. ✅ Create pivot tables in Excel for analysis
4. ✅ Compare scheduled vs actual hours

---

## 📊 Data Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| **ID** | Unique attendance record ID | 123 |
| **Employee** | Full name or username | John Doe |
| **Location** | Business location/branch | Main Store |
| **Date** | Attendance date | Oct 23, 2025 |
| **Clock In** | Actual clock-in time | 08:05 AM |
| **Clock Out** | Actual clock-out time | 05:00 PM |
| **Scheduled Start** | Expected start time | 08:00 |
| **Scheduled End** | Expected end time | 17:00 |
| **Hours Worked** | Total hours (calculated) | 8.92 hrs |
| **Status** | Attendance status | On Time |

---

## 🚦 Status Definitions

| Status | Meaning |
|--------|---------|
| **On Time** | Clocked in within grace period |
| **Late** | Clocked in after grace period |
| **Absent** | Did not clock in |
| **Early Departure** | Clocked out before scheduled end |
| **Emergency Change** | Emergency location/schedule change |
| **Location Switch** | Switched locations mid-shift |

---

## ✅ Testing Checklist (For Developers)

Quick validation checklist:
- [ ] Page loads without console errors
- [ ] Filters work (apply and clear)
- [ ] Grid displays data correctly
- [ ] Sorting works on all columns
- [ ] Search finds records
- [ ] Export downloads Excel file
- [ ] Summary cards show correct counts
- [ ] Dark mode renders properly
- [ ] Mobile responsive (test on phone)
- [ ] Permissions respected

---

**Last Updated**: 2025-10-23
**Page URL**: /dashboard/attendance
**Dev Server**: http://localhost:3006/dashboard/attendance
