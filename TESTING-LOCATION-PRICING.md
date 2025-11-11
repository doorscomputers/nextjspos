# Testing Location-Specific Unit Pricing

## Test Accounts

### Admin Account (for setting prices)
- **Username**: `pcinetadmin`
- **Password**: `111111`
- **Role**: Admin/Warehouse Manager
- **Can**: Set location-specific prices for all locations

### Cashier Account (for POS testing)
- **Username**: `EricsonChanCashierTugue`
- **Password**: `111111`
- **Location**: Tuguegarao (ID: 4)
- **Can**: View and use location-specific prices in POS

## Test Product
- **Product**: Sample UTP CABLE
- **SKU**: PROD-4627
- **Units**: Roll (primary), Meter (sub-unit)

## Pre-Test Setup (Already Done ✅)

The test script has already set up location-specific prices for Tuguegarao:
- **Roll**: Purchase ₱1,900, Selling **₱2,014**
- **Meter**: Purchase ₱8, Selling **₱9**

## Test Procedure

### Part 1: Verify Price Setup (Admin View)

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Login as Admin**:
   - Navigate to: http://localhost:3000/login
   - Username: `pcinetadmin`
   - Password: `111111`

3. **Navigate to Price Editor**:
   - Go to: **Products > Simple Price Editor**
   - Or: http://localhost:3000/dashboard/products/simple-price-editor

4. **Search for Product**:
   - In **Step 1**: Type "Sample UTP CABLE" in search box
   - Click "Search by Name"
   - Product should appear with SKU: PROD-4627

5. **Review Current Prices** (Step 2):
   - Current Selling Price: ₱1,650.00
   - Cost Price: ₱1,585.90
   - Current Profit Margin: 3.88%
   - Status: Ready to Update

6. **Check Location-Specific Prices** (Step 5):
   - Scroll to **Step 5: Update Unit Prices (Sub-Units)**
   - You should see:
     - **Roll (PRIMARY)**: Selling ₱1,650 (or updated value)
     - **Meter (m)**: Selling ₱6.71 (or updated value)

7. **Set New Location-Specific Prices**:
   - In **Step 3**: ✅ Check **Tuguegarao** location
   - In **Step 5**: Update prices:
     - **Roll**: Purchase Price: `1900`, Selling Price: `2014`
     - **Meter**: Purchase Price: `8`, Selling Price: `9`
   - Click **"Save All Prices"** button
   - ✅ Verify success message: "Successfully updated prices for 2 unit(s) across 1 location(s)"

### Part 2: Test POS (Cashier View)

1. **Logout from Admin**:
   - Click user menu > Logout

2. **Login as Cashier**:
   - Username: `EricsonChanCashierTugue`
   - Password: `111111`

3. **Navigate to POS**:
   - Go to: **POS** (from sidebar)
   - Or: http://localhost:3000/dashboard/pos

4. **Start Shift**:
   - If not already started, start a new shift
   - Location should be: **Tuguegarao**
   - Enter beginning cash if prompted

5. **Add Product to Cart**:
   - In search box, type: `Sample UTP CABLE`
   - Press Enter or click product
   - Product should be added to cart with **Roll** unit by default

6. **Verify Roll Price**:
   - Check cart item shows:
     - Unit: Roll
     - Price: **₱2,014.00** (location-specific price)
     - NOT ₱1,650 (old global price)

7. **Test Meter Unit**:
   - Click the **"📏 Selling in: Roll · Click to Change Unit & Quantity"** button
   - Unit selector should appear
   - Select **"Meter (m)"** from dropdown
   - Enter quantity: `1`
   - Click **"✓ Apply Unit & Quantity"**

8. **Verify Meter Price**:
   - Cart should update to show:
     - Unit: Meter
     - Unit Price: **₱9.00** (location-specific price)
     - NOT ₱6.71 (old global price)
   - Quantity: 1
   - Total: ₱9.00

### Part 3: Test Other Locations (Global Fallback)

To test that other locations fall back to global prices:

1. **Login as Admin** (`pcinetadmin`)

2. **Go to Price Editor**

3. **Select Bambang or Main Store** (Step 3)
   - Do NOT set location-specific prices

4. **Login as cashier at Bambang/Main Store**
   - If you have a cashier account for those locations

5. **Test POS**:
   - Should show **global prices** (₱1,650 for Roll, ₱6.71 for Meter)
   - NOT the Tuguegarao-specific prices

## Expected Results

### ✅ Success Criteria

1. **Admin can set location-specific prices**:
   - Price Editor Step 5 accepts new unit prices
   - Success message confirms location-specific save
   - Prices saved to `ProductUnitLocationPrice` table

2. **POS uses correct prices**:
   - Tuguegarao cashier sees **₱2,014 for Roll**
   - Tuguegarao cashier sees **₱9 for Meter**
   - Prices are location-specific, not global

3. **Fallback works**:
   - Locations without specific prices use global prices
   - No errors or missing prices

### ❌ Failure Scenarios

If you see these issues:

**Issue 1: POS shows old prices (₱1,650 / ₱6.71)**
- **Cause**: API not returning location-specific prices
- **Fix**: Check browser console for API errors
- **Check**: Network tab > `/api/pos/product-units` > Response

**Issue 2: Price Editor doesn't show location-specific option**
- **Cause**: Step 3 locations not selected
- **Fix**: Make sure to check location checkboxes in Step 3

**Issue 3: "Insufficient stock" error**
- **Cause**: No inventory at Tuguegarao location
- **Fix**: Add opening stock or transfer inventory

## Database Verification

To verify prices were saved correctly:

```sql
-- Check location-specific prices
SELECT p.name, bl.name as location, u.name as unit, pulp.sellingPrice
FROM product_unit_location_prices pulp
JOIN products p ON pulp.product_id = p.id
JOIN business_locations bl ON pulp.location_id = bl.id
JOIN units u ON pulp.unit_id = u.id
WHERE p.name LIKE '%Sample UTP CABLE%'
  AND bl.name = 'Tuguegarao';

-- Should return:
-- Sample UTP CABLE | Tuguegarao | Roll  | 2014
-- Sample UTP CABLE | Tuguegarao | Meter | 9
```

Or use **Prisma Studio**:
```bash
npx prisma studio
```
- Navigate to `ProductUnitLocationPrice` table
- Filter by `productId = 4627` and `locationId = 4`

## Troubleshooting

### Clear Browser Cache
If you see stale prices:
1. Open DevTools (F12)
2. Right-click Refresh button > "Empty Cache and Hard Reload"

### Restart Dev Server
If changes don't appear:
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Check Database
Verify prices in Prisma Studio:
```bash
npx prisma studio
```

### API Testing
Test API directly:
```bash
# PowerShell
curl "http://localhost:3000/api/pos/product-units?productId=4627&locationId=4"
```

Should return JSON with:
```json
{
  "success": true,
  "data": {
    "unitPrices": [
      {"unitId": 3, "sellingPrice": 2014, "isLocationSpecific": true},
      {"unitId": 4, "sellingPrice": 9, "isLocationSpecific": true}
    ]
  }
}
```

## Notes

- Location-specific prices **override** global prices
- Global prices remain unchanged (fallback for other locations)
- Each location can have completely different pricing
- Admin/Warehouse Manager role required to set prices
- Cashiers automatically see their location's prices

## Success! 🎉

If all tests pass:
- ✅ Location-specific unit pricing is working
- ✅ POS uses correct location prices
- ✅ Price Editor integration successful
- ✅ Ready for production use
