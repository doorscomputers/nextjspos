# Quick Test Instructions

## Test the Dashboard Fix

1. **Open Browser**
   - Navigate to: http://localhost:3002
   - Or: http://localhost:3002/dashboard

2. **Login**
   - Use any of these accounts:
     - Username: `superadmin` / Password: `password`
     - Username: `admin` / Password: `password`
     - Username: `manager` / Password: `password`

3. **Check Dashboard**
   - Look for the "Sales Payment Due" widget (usually in bottom section)
   - You should see:
     ```
     Invoice: INVT-202510-0002
     Customer: Juan de la Cruz
     Location: Tuguegarao
     Date: 2025-10-25
     Amount: ₱1,980.00
     ```

4. **Verify Total**
   - The summary row should show total: **₱1,980.00**

## Expected Result

✅ The charge invoice for Juan de la Cruz should now appear in the "Sales Payment Due" widget with the location name "Tuguegarao".

## If It's Not Showing

The Prisma Client might not have regenerated due to file locks. To fix:

1. Stop the dev server (Ctrl+C in terminal)
2. Close VS Code completely
3. Reopen VS Code
4. Run: `npm run dev`
5. The Prisma Client should regenerate automatically

## Alternative: Force Prisma Regeneration

If you need to force regenerate:

1. Stop dev server
2. Run: `npx prisma generate --force`
3. Restart dev server: `npm run dev`

---

Current Server: **http://localhost:3002** (running in background)
