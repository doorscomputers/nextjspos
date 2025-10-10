# Product Type Immutability - Design Decision

## Overview
Product types (Single, Variable, Combo) **CANNOT be changed** after a product is created. This is a deliberate design decision to maintain data integrity.

## Why Product Types Are Locked

### 1. Inventory Data Corruption
Changing product types would corrupt inventory records across all business locations:

- **Single → Variable**: Existing stock in one DUMMY variation, but now multiple variations exist. Which variation gets the stock?
- **Variable → Single**: Multiple variations (Small/Medium/Large) each with location-specific stock. Which becomes the "single" product's stock?
- **Any ↔ Combo**: Combos don't have direct stock; they deduct from component products. Complete inventory model mismatch.

### 2. Transaction History Integrity
- Sales transactions reference specific product variations
- Purchase orders link to specific SKUs
- Stock transfers record variation-level movements
- Changing type breaks these relationships

### 3. Stock Movement Audit Trail
- Each variation has its own audit trail at each location
- Opening stock, adjustments, transfers all tied to specific variations
- Type change would make historical data meaningless

### 4. Financial Reporting
- Cost of Goods Sold (COGS) calculations rely on consistent product structure
- Profit margins tracked per variation
- Inventory valuation would become incorrect

### 5. Serial Number Tracking
- Serial numbers are assigned to specific variations
- Movement history tracks serial numbers across locations
- Type change would orphan serial number records

### 6. Multi-Location Complexity
- Stock levels are maintained per variation per location
- Different locations may have different variation stock levels
- Type change would require complex cross-location data migration

## Implementation

### Frontend Protection
- Product type dropdown is **disabled** on edit page
- Visual warning explains why type cannot be changed
- Clear instructions for workaround provided

**File**: `src/app/dashboard/products/[id]/edit/page.tsx`

### Backend Protection
- API validates that product type hasn't changed
- Returns 400 error if type change attempted
- Prevents bypassing frontend restrictions

**File**: `src/app/api/products/[id]/route.ts`

## Recommended Workflow for Type Changes

If a user needs to change a product's type:

1. **Mark Original Product as Inactive**
   - Set `isActive = false`
   - Or set `notForSelling = true`
   - This preserves historical data

2. **Create New Product with Desired Type**
   - Use different name/SKU to distinguish
   - Set up variations/combo items as needed

3. **Transfer Stock (if needed)**
   - Use inventory correction/adjustment feature
   - Manually transfer stock from old to new product
   - Maintains audit trail of the change

4. **Update References**
   - Update any standing purchase orders
   - Notify relevant staff of the change

5. **Archive Old Product**
   - Keep for historical reporting
   - Reference in old invoices/transactions remains valid

## Benefits of This Approach

✅ **Data Integrity**: Zero risk of corrupted inventory records
✅ **Audit Compliance**: Complete historical record preserved
✅ **Financial Accuracy**: Accounting reports remain accurate
✅ **Multi-Tenant Safety**: Prevents cross-tenant data issues
✅ **Serial Number Integrity**: Tracking remains consistent
✅ **User Clarity**: Explicit workflow prevents confusion

## Technical Details

### Database Schema
Product type is stored in `products.type` field:
- `'single'`: One SKU, one price, stock tracked in DUMMY variation
- `'variable'`: Multiple variations, each with own SKU/price/stock
- `'combo'`: Bundle of other products, no direct stock

### Variation Relationship
- All products have at least one `ProductVariation` record
- Single products: 1 variation named "DUMMY" with same SKU
- Variable products: User-defined variations (Small, Medium, etc.)
- Combo products: 1 variation named "DUMMY", but stock managed via components

### Stock Tracking
- Stock is **always** tracked at `ProductVariation` level
- Location stock stored in `VariationLocationDetails`
- Transactions reference `productVariationId`, not just `productId`

## Future Considerations

If product type conversion becomes a strict business requirement, it would require:

1. **Data Migration System**
   - Complex logic to migrate stock across variations
   - Decision rules for which variation gets what stock
   - Location-by-location migration confirmation

2. **Transaction Reconciliation**
   - Update all historical transaction references
   - Maintain referential integrity in financial records
   - Preserve audit trail despite structure change

3. **Approval Workflow**
   - Multi-level approval (manager + admin)
   - Explicit confirmation of data implications
   - "Point of no return" warning system

4. **Rollback Capability**
   - Snapshot original state
   - Ability to undo conversion
   - Data integrity verification

**Conclusion**: The complexity and risk of supporting type conversion far outweighs the benefit. Current workflow (deactivate + create new) is simpler, safer, and more transparent.

---

**Last Updated**: October 8, 2025
**Decision Made By**: User requirement + Developer agreement
**Status**: Implemented and enforced
