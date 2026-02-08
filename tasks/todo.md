# Update Product Prices from Excel (SRP UPDATES 6 FEB 2026)

## Task Overview
Update product prices from the Excel file "SRP UPDATES 6 FEB 2026.xlsx" to all active product locations in the database.

## Excel File Details
- **Path**: `c:\Users\Warenski\Downloads\SRP UPDATES 6 FEB 2026.xlsx`
- **Columns**:
  - `CODE` - Product SKU/code
  - `ITEM` - Product description
  - `NEW RETAIL PRICE` - New selling price
- **Sample Data**: 3 products found in preview (21,995 to 22,990 PHP)

## Todo List

- [ ] Update the `update-prices-from-excel.ts` script to match the new Excel file structure
  - Change file path to new Excel file
  - Update interface to use 'CODE' column instead of 'SKU'
  - Update column reference to 'NEW RETAIL PRICE' (no leading space)
- [ ] Run the updated script to update all product prices across all active locations
- [ ] Review the summary output (updated, skipped, not found counts)
- [ ] Report results to user

## Changes Needed

### Script: `scripts/update-prices-from-excel.ts`

1. **Line 12**: Update `EXCEL_FILE_PATH` constant
   ```typescript
   // FROM:
   const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/gigabyte 5feb2026.xlsx'

   // TO:
   const EXCEL_FILE_PATH = 'C:/Users/Warenski/Downloads/SRP UPDATES 6 FEB 2026.xlsx'
   ```

2. **Lines 14-17**: Update `PriceUpdateRow` interface
   ```typescript
   // FROM:
   interface PriceUpdateRow {
     'SKU': string
     ' New Retail Price ': number | string
   }

   // TO:
   interface PriceUpdateRow {
     'CODE': string
     'NEW RETAIL PRICE': number | string
   }
   ```

3. **Line 54**: Update column reference
   ```typescript
   // FROM:
   const itemCode = String(row['SKU'] || '').trim()

   // TO:
   const itemCode = String(row['CODE'] || '').trim()
   ```

4. **Line 55**: Update column reference
   ```typescript
   // FROM:
   const newSrpRaw = row[' New Retail Price ']

   // TO:
   const newSrpRaw = row['NEW RETAIL PRICE']
   ```

## Expected Outcome
All products matching the CODE in the Excel file will have their selling prices updated across all active business locations, with a summary report showing:
- ✅ Number of products updated
- ⏭️ Number of rows skipped (invalid data)
- ❌ Number of products not found in database
- Detailed list of not found products
- Detailed list of skipped rows with reasons

## Notes
- The script updates `productVariation.sellingPrice` for all variations
- Also updates `variationLocationDetails.sellingPrice` and `lastPriceUpdate` for all active locations
- Only ACTIVE locations (isActive=true, deletedAt=null) are updated
- Business ID is hardcoded to 1
