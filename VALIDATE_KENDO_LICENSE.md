# How to Validate Kendo UI License

## Quick Validation Steps

### Step 1: Add Your License

**Choose ONE of these methods:**

**Method A: Using .env file (Recommended)**
```bash
# Open .env file and add:
KENDO_UI_LICENSE=your-license-key-here
```

**Method B: Using license file**
```bash
# Create file in project root:
# File name: kendo-license.txt
# Content: your-license-key-here (single line, no extra spaces)
```

### Step 2: Restart Server
```bash
npm run dev
```

### Step 3: Check License Status

Open your browser and go to:
```
http://localhost:3000/dashboard/kendo-demo
```

**Look for the License Status box at the top:**

✅ **Success**: Green text "✓ Valid License Activated"
- Your license is working correctly
- Kendo components will not show watermarks
- You're ready to use all features

⚠️ **Warning**: Amber text "⚠ No License Found"
- License file or env variable not found
- Components will show trial watermarks
- Go back to Step 1 and add your license

### Step 4: Verify Components Work

On the demo page, you should see:
- ✅ Data Grid with sortable columns
- ✅ Search input box
- ✅ Category dropdown
- ✅ Date picker
- ✅ Action buttons
- ✅ Dialog popup (click "Refresh Data" button)

All should be styled and functional.

---

## Getting Your License Key

1. Go to: https://www.telerik.com/account/
2. Sign in with your Telerik account
3. Navigate to: **Licenses & Downloads**
4. Find: **Kendo UI for React**
5. Copy the license key (long string starting with `eyJ...`)

**License key format example:**
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3d3dy50ZWxlcm...
```

---

## Troubleshooting

### Issue: License Status Still Shows "No License Found"

**Check:**
1. ✓ License key has no extra spaces or newlines
2. ✓ `.env` file is in project root (same folder as `package.json`)
3. ✓ Environment variable is named exactly `KENDO_UI_LICENSE`
4. ✓ License file is named exactly `kendo-license.txt`
5. ✓ Dev server was restarted after adding license

**Fix:**
```bash
# Stop the server (Ctrl+C)
# Add license again (double-check spelling)
# Start server
npm run dev
```

### Issue: Console Shows License Errors

**Check browser console** (F12 → Console tab):
- Look for messages starting with `✓` (success) or `⚠` (warning)
- Read the error message for specific issues

**Common messages:**
- `✓ Kendo UI license found in environment` - Good!
- `✓ Kendo UI license activated` - Good!
- `⚠ No Kendo UI license found` - Add license
- `⚠ Kendo UI license not activated` - Check format

---

## Validation Checklist

Use this checklist to verify everything works:

- [ ] License key obtained from Telerik account
- [ ] License added to `.env` OR `kendo-license.txt`
- [ ] Development server restarted
- [ ] Demo page loads: http://localhost:3000/dashboard/kendo-demo
- [ ] License status shows green "✓ Valid License Activated"
- [ ] No trial watermarks on components
- [ ] Grid displays sample data
- [ ] Grid columns are sortable (click headers)
- [ ] Search box filters data
- [ ] Dropdown changes category filter
- [ ] Date picker opens calendar
- [ ] Buttons are styled
- [ ] Dialog opens when clicking "Refresh Data"
- [ ] Console shows no license errors

**If all boxes checked: ✅ Integration successful!**

---

## Need Help?

1. **Check Documentation**
   - Full guide: `KENDO_UI_INTEGRATION_GUIDE.md`
   - Summary: `KENDO_UI_INTEGRATION_SUMMARY.md`

2. **Review Code**
   - Demo page: `src/app/dashboard/kendo-demo/page.tsx`
   - License logic: `src/lib/kendo-license.ts`
   - License API: `src/app/api/kendo-license/route.ts`

3. **Telerik Support**
   - https://www.telerik.com/account/support-tickets
   - https://www.telerik.com/forums/kendo-ui-for-react

---

## Quick Reference

### Environment Variable Method
```bash
# .env file
KENDO_UI_LICENSE=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### File Method
```bash
# kendo-license.txt (in project root)
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Test URL
```
http://localhost:3000/dashboard/kendo-demo
```

### Check License API
```
http://localhost:3000/api/kendo-license
```

Should return:
```json
{
  "license": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

**That's it! Your Kendo UI integration is complete and validated.**
