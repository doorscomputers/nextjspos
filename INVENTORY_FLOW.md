# Complete Inventory Tracking Flow

> **From product creation to sale: Understanding how inventory quantities change throughout the system**

---

## Overview

This document explains the complete inventory tracking lifecycle in the UltimatePOS Modern application, showing exactly how inventory quantities are initialized, increased, and decreased through various operations.

---

## The Three Core Inventory Operations

### 1. **INITIALIZE** - Product Creation (qty = 0)
### 2. **ADD** - Purchase Receipt Approval (qty increases)
### 3. **DEDUCT** - Sales Transaction (qty decreases)

---

## Database Tables Involved

### Core Inventory Table

**`VariationLocationDetails`** - The heart of inventory tracking

```
Fields:
- id                    : Primary key
- productId             : Link to Product
- productVariationId    : Link to ProductVariation
- locationId            : Link to BusinessLocation
- qtyAvailable          : CURRENT STOCK QUANTITY ⭐
- sellingPrice          : Price at this location
- createdAt             : When record created
- updatedAt             : When quantity last changed
- deletedAt             : Soft delete timestamp
```

**This table stores the CURRENT inventory quantity for each variation at each location.**

Example records:
```
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 50           | ← Laptop at Main Store: 50 units
| 1         | 1           | 2          | 30           | ← Laptop at Branch A: 30 units
| 2         | 3           | 1          | 100          | ← T-Shirt (Small) at Main Store: 100 units
| 2         | 4           | 1          | 75           | ← T-Shirt (Medium) at Main Store: 75 units
```

---

## Operation 1: INITIALIZE - Product Creation

### When: Creating a new product

### What Happens:

**Step 1: User creates product**
- Navigate to: `/dashboard/products/add`
- Fill form: Name, Type, Prices, etc.
- Click "Save"

**Step 2: API creates product with ZERO inventory**
- API: `POST /api/products`
- File: `src/app/api/products/route.ts`
- Lines: 694-790 (inventory initialization)

**Step 3: System creates inventory records**
```typescript
// For EACH location in the business:
//   For EACH variation of the product:
//     Create VariationLocationDetails with qtyAvailable = 0

// Example for product with 3 variations at 2 locations:
//   Creates 3 × 2 = 6 records, all with qty = 0
```

### Database Changes:

**Before:**
```
VariationLocationDetails: (empty for this product)
```

**After:**
```
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 0            | ← NEW (Main Store)
| 1         | 1           | 2          | 0            | ← NEW (Branch A)
| 1         | 1           | 3          | 0            | ← NEW (Warehouse)
```

### Result:
- ✅ Product exists in system
- ✅ Inventory tracking enabled at all locations
- ⚠️ Zero stock (cannot sell yet)
- ➡️ Next step: Receive goods via purchase receipt

---

## Operation 2: ADD - Purchase Receipt Approval

### When: Receiving goods from supplier

### What Happens:

**Step 1: Create purchase order**
- API: `POST /api/purchases`
- Order 100 units from Supplier A
- Cost: $50 per unit
- Status: pending

**Step 2: Receive goods (create GRN)**
- API: `POST /api/purchases/[id]/receive`
- File: `src/app/api/purchases/[id]/receive/route.ts`
- Record: Physically received 100 units
- Status: GRN created (pending approval)
- **NOTE: Inventory NOT added yet!**

**Step 3: Approve GRN (THIS IS WHERE INVENTORY IS ADDED!)**
- API: `POST /api/purchases/receipts/[id]/approve`
- File: `src/app/api/purchases/receipts/[id]/approve/route.ts`
- Line 189-203: Calls `processPurchaseReceipt()`
- **CRITICAL: This function INCREASES qtyAvailable**

**Step 4: processPurchaseReceipt() function executes**
```typescript
// src/lib/stockOperations.ts - processPurchaseReceipt()

// 1. Find inventory record
const inventoryRecord = await tx.variationLocationDetails.findFirst({
  where: {
    productVariationId: productVariationId,
    locationId: locationId
  }
})

// 2. UPDATE: ADD quantity to existing stock
await tx.variationLocationDetails.update({
  where: { id: inventoryRecord.id },
  data: {
    qtyAvailable: inventoryRecord.qtyAvailable + quantityReceived  // ⭐ ADD
  }
})

// 3. Create transaction record
await tx.stockTransaction.create({
  data: {
    type: 'purchase',
    quantity: quantityReceived,  // Positive number
    productId, productVariationId, locationId
  }
})

// 4. Create history record
await tx.productHistory.create({
  data: {
    transactionType: 'PURCHASE_RECEIPT',
    quantity: quantityReceived,
    unitCost: unitCost
  }
})
```

### Database Changes:

**Before Approval:**
```
VariationLocationDetails:
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 0            | ← Main Warehouse
```

**After Approval:**
```
VariationLocationDetails:
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 100          | ← INCREASED (0 + 100)
```

**New Transaction Record:**
```
StockTransaction:
| type     | quantity | productVariationId | locationId |
|----------|----------|-------------------|------------|
| purchase | +100     | 1                 | 1          |
```

**New History Record:**
```
ProductHistory:
| transactionType   | quantity | unitCost | notes                    |
|-------------------|----------|----------|--------------------------|
| PURCHASE_RECEIPT  | 100      | $50.00   | GRN-202501-0001 approved |
```

### Cost Accounting (Weighted Average):

If there was existing stock:
```
Old stock: 10 units @ $60 = $600
New stock: 100 units @ $50 = $5,000
Total: 110 units = $5,600
New average cost: $5,600 / 110 = $50.91

ProductVariation.purchasePrice updated to $50.91
```

### Result:
- ✅ Inventory INCREASED from 0 to 100 units
- ✅ Cost tracked ($50 per unit)
- ✅ Transaction history recorded
- ✅ Ready to sell!

---

## Operation 3: DEDUCT - Sales Transaction

### When: Selling products at POS

### What Happens:

**Step 1: Cashier scans products**
- Navigate to: `/dashboard/pos`
- Scan or select products
- Customer wants: 2 units
- Price: $75 per unit

**Step 2: Check stock availability BEFORE sale**
```typescript
// CRITICAL: Validate stock FIRST to prevent overselling
const stockCheck = await batchCheckStockAvailability(items, locationId)

if (!stockCheck.available) {
  throw new Error("Insufficient stock!")
  // Sale is BLOCKED
}
```

**Step 3: Create sale (if stock sufficient)**
- API: `POST /api/sales`
- File: `src/app/api/sales/route.ts`
- Line 230: Calls `processSale()` for each item
- **CRITICAL: This function DECREASES qtyAvailable**

**Step 4: processSale() function executes**
```typescript
// src/lib/stockOperations.ts - processSale()

// 1. Find inventory record
const inventoryRecord = await tx.variationLocationDetails.findFirst({
  where: {
    productVariationId: productVariationId,
    locationId: locationId
  }
})

// 2. VALIDATE: Ensure sufficient stock
if (inventoryRecord.qtyAvailable < quantitySold) {
  throw new Error("Insufficient stock!")
}

// 3. UPDATE: SUBTRACT quantity from stock
await tx.variationLocationDetails.update({
  where: { id: inventoryRecord.id },
  data: {
    qtyAvailable: inventoryRecord.qtyAvailable - quantitySold  // ⭐ SUBTRACT
  }
})

// 4. Create transaction record (NEGATIVE quantity)
await tx.stockTransaction.create({
  data: {
    type: 'sale',
    quantity: -quantitySold,  // Negative to show deduction
    productId, productVariationId, locationId
  }
})

// 5. Create history record
await tx.productHistory.create({
  data: {
    transactionType: 'SALE',
    quantity: quantitySold,
    unitCost: productVariation.purchasePrice,
    sellingPrice: salePrice
  }
})
```

### Database Changes:

**Before Sale:**
```
VariationLocationDetails:
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 100          | ← Main Warehouse
```

**After Sale:**
```
VariationLocationDetails:
| productId | variationId | locationId | qtyAvailable |
|-----------|-------------|------------|--------------|
| 1         | 1           | 1          | 98           | ← DECREASED (100 - 2)
```

**New Transaction Record:**
```
StockTransaction:
| type | quantity | productVariationId | locationId |
|------|----------|-------------------|------------|
| sale | -2       | 1                 | 1          | ← NEGATIVE
```

**New History Record:**
```
ProductHistory:
| transactionType | quantity | unitCost | sellingPrice | profit    |
|----------------|----------|----------|--------------|-----------|
| SALE           | 2        | $50.91   | $75.00       | $48.18    |
```

### Profit Calculation:

```
Cost: 2 units × $50.91 = $101.82
Revenue: 2 units × $75.00 = $150.00
Profit: $150.00 - $101.82 = $48.18 ✅
Margin: $48.18 / $150.00 = 32.12%
```

### Result:
- ✅ Inventory DECREASED from 100 to 98 units
- ✅ Revenue recorded ($150)
- ✅ Profit calculated ($48.18)
- ✅ Invoice generated (INV-202501-0042)
- ✅ Transaction history recorded

---

## Complete Lifecycle Example

### Product: "Laptop" (Model: 15-inch)
### Location: Main Warehouse
### Timeline: January 2025

#### Day 1 - Product Creation
```
Action: Admin creates "Laptop" product
API: POST /api/products
File: src/app/api/products/route.ts

Result:
VariationLocationDetails: qty = 0 ← INITIALIZED
```

#### Day 2 - Purchase Order Created
```
Action: Manager orders 100 units from Dell
API: POST /api/purchases
Cost: $500 per unit
Total: $50,000

Result:
Purchase: status = "pending"
Inventory: qty = 0 (unchanged - order not received yet)
```

#### Day 5 - Goods Received
```
Action: Warehouse staff receives 100 units
API: POST /api/purchases/1/receive
Creates: GRN-202501-0001 (status: pending approval)

Result:
PurchaseReceipt: status = "pending"
Inventory: qty = 0 (unchanged - GRN not approved yet)
```

#### Day 5 (1 hour later) - GRN Approved
```
Action: Manager approves GRN-202501-0001
API: POST /api/purchases/receipts/1/approve
File: src/app/api/purchases/receipts/[id]/approve/route.ts

Result:
PurchaseReceipt: status = "approved"
Inventory: qty = 100 ← ADDED (+100)
Cost: $500 per unit
```

#### Day 6 - First Sale
```
Action: Cashier sells 2 units to Customer A
API: POST /api/sales
File: src/app/api/sales/route.ts
Price: $700 per unit

Result:
Sale: INV-202501-0042
Inventory: qty = 98 ← DEDUCTED (-2)
Revenue: $1,400
Cost: $1,000
Profit: $400
```

#### Day 7 - Another Sale
```
Action: Cashier sells 3 units to Customer B
API: POST /api/sales
Price: $700 per unit

Result:
Sale: INV-202501-0043
Inventory: qty = 95 ← DEDUCTED (-3)
Revenue: $2,100
Cost: $1,500
Profit: $600
```

#### Day 10 - Stock Check
```
Action: Manager views inventory report
Page: /dashboard/reports/stock-report

Current State:
- Opening stock: 0
- Received: 100 (via GRN-202501-0001)
- Sold: 5 (2 + 3)
- Current stock: 95 ✅
- Stock value: 95 × $500 = $47,500
```

#### Day 15 - Reorder
```
Action: Manager orders 50 more units
API: POST /api/purchases
Cost: $480 per unit (new supplier discount)

Future: When received and approved
- Inventory will increase to: 95 + 50 = 145
- New weighted avg cost: (95 × $500 + 50 × $480) / 145 = $493.10
```

---

## Key Files Reference

### Product Creation (Initialize to Zero)
- **API**: `src/app/api/products/route.ts`
- **Page**: `src/app/dashboard/products/add/page.tsx`
- **Function**: Creates product + variations + zero inventory records
- **Lines**: 694-790 (inventory initialization)

### Purchase Receipt Approval (ADD Inventory)
- **API**: `src/app/api/purchases/receipts/[id]/approve/route.ts`
- **Function**: `processPurchaseReceipt()` in `src/lib/stockOperations.ts`
- **Action**: Increases qtyAvailable
- **Formula**: `qtyAvailable = qtyAvailable + received`

### Sales Transaction (DEDUCT Inventory)
- **API**: `src/app/api/sales/route.ts`
- **Page**: `src/app/dashboard/pos/page.tsx`
- **Function**: `processSale()` in `src/lib/stockOperations.ts`
- **Action**: Decreases qtyAvailable
- **Formula**: `qtyAvailable = qtyAvailable - sold`

---

## Other Inventory Operations

### Inventory Adjustments
```
API: POST /api/inventory/adjustments
Purpose: Manual corrections (damaged, expired, shrinkage)
Effect: Can increase OR decrease inventory
Example: Found 5 damaged units → qty = qty - 5
```

### Stock Transfers
```
API: POST /api/transfers/[id]/send
     POST /api/transfers/[id]/receive
Purpose: Move stock between locations
Effect:
  - Source location: qty = qty - transferred
  - Destination location: qty = qty + transferred
Example: Transfer 10 units from Warehouse to Store A
```

### Purchase Returns
```
API: POST /api/purchases/returns/[id]/approve
Purpose: Return defective goods to supplier
Effect: Decreases inventory
Example: Return 3 defective units → qty = qty - 3
```

### Sales Returns
```
API: POST /api/sales/[id]/return
Purpose: Customer returns product
Effect: Increases inventory
Example: Customer returns 1 unit → qty = qty + 1
```

---

## Stock Transaction Types

All inventory movements create `StockTransaction` records:

| Type              | Effect      | Quantity Sign | Example    |
|-------------------|-------------|---------------|------------|
| purchase          | ADD         | Positive      | +100       |
| sale              | DEDUCT      | Negative      | -2         |
| transfer_out      | DEDUCT      | Negative      | -10        |
| transfer_in       | ADD         | Positive      | +10        |
| adjustment        | ADD/DEDUCT  | +/-           | -5 (loss)  |
| purchase_return   | DEDUCT      | Negative      | -3         |
| sale_return       | ADD         | Positive      | +1         |

---

## Reporting & Queries

### Current Stock Query
```sql
SELECT
  p.name AS product_name,
  v.name AS variation_name,
  l.name AS location_name,
  vld.qtyAvailable AS current_stock,
  vld.qtyAvailable * v.purchasePrice AS stock_value
FROM VariationLocationDetails vld
JOIN ProductVariation v ON v.id = vld.productVariationId
JOIN Product p ON p.id = vld.productId
JOIN BusinessLocation l ON l.id = vld.locationId
WHERE vld.deletedAt IS NULL
```

### Stock Movement History
```sql
SELECT
  st.createdAt AS date,
  st.type AS transaction_type,
  st.quantity AS qty_change,
  p.name AS product_name,
  l.name AS location_name,
  u.username AS performed_by
FROM StockTransaction st
JOIN Product p ON p.id = st.productId
JOIN BusinessLocation l ON l.id = st.locationId
LEFT JOIN User u ON u.id = st.userId
ORDER BY st.createdAt DESC
```

### Stock Valuation Report
```sql
SELECT
  p.name AS product_name,
  SUM(vld.qtyAvailable) AS total_units,
  v.purchasePrice AS unit_cost,
  SUM(vld.qtyAvailable) * v.purchasePrice AS total_value
FROM VariationLocationDetails vld
JOIN ProductVariation v ON v.id = vld.productVariationId
JOIN Product p ON p.id = vld.productId
WHERE vld.deletedAt IS NULL
GROUP BY p.id, v.id
```

---

## Best Practices

### ✅ Always Validate Stock Before Sale
```typescript
// BAD: Selling without checking
await processSale({ quantity: 10, ... })  // Might fail!

// GOOD: Check first
const stockCheck = await checkStockAvailability(productVariationId, locationId, 10)
if (!stockCheck.available) {
  throw new Error(`Only ${stockCheck.availableQuantity} units available`)
}
await processSale({ quantity: 10, ... })
```

### ✅ Use Transactions for Multi-Step Operations
```typescript
// Ensure all-or-nothing execution
await prisma.$transaction(async (tx) => {
  await tx.variationLocationDetails.update({ ... })  // Update stock
  await tx.stockTransaction.create({ ... })          // Record transaction
  await tx.productHistory.create({ ... })            // Record history
})
```

### ✅ Always Record Transaction History
Every inventory change should create:
1. `StockTransaction` record (what changed)
2. `ProductHistory` record (why it changed)
3. Audit log (who changed it)

### ✅ Use Weighted Average Costing
```typescript
// Calculate new average cost when receiving stock
const oldValue = currentStock * currentCost
const newValue = receivedQty * receivedCost
const totalQty = currentStock + receivedQty
const newAvgCost = (oldValue + newValue) / totalQty

await tx.productVariation.update({
  where: { id: variationId },
  data: { purchasePrice: newAvgCost }
})
```

---

## Troubleshooting

### ❌ Error: "Insufficient stock"
**Cause**: Trying to sell more than available
**Solution**:
- Check current stock at location
- Transfer stock from another location
- Adjust sale quantity
- Wait for purchase receipt

### ❌ Error: "Negative inventory"
**Cause**: Database integrity issue
**Solution**:
- Check recent transactions for errors
- Run inventory reconciliation
- Create adjustment to fix discrepancy
- Investigate root cause

### ❌ Error: "Stock transaction failed"
**Cause**: Database transaction rollback
**Solution**:
- Check database logs
- Verify all related records exist
- Retry operation
- Contact support if persists

---

## Summary

### Inventory Flow Cycle

```
1. CREATE PRODUCT
   └─> qty = 0 at all locations

2. RECEIVE GOODS
   └─> qty = qty + received (via GRN approval)

3. SELL PRODUCTS
   └─> qty = qty - sold (at POS)

4. REPEAT
   └─> Continuous cycle of purchases and sales
```

### Critical Functions

| Function | File | Action | Effect on qty |
|----------|------|--------|---------------|
| Product creation | `src/app/api/products/route.ts` | Initialize | Set to 0 |
| `processPurchaseReceipt()` | `src/lib/stockOperations.ts` | Add inventory | qty + received |
| `processSale()` | `src/lib/stockOperations.ts` | Deduct inventory | qty - sold |
| `processTransferOut()` | `src/lib/stockOperations.ts` | Transfer out | qty - transferred |
| `processTransferIn()` | `src/lib/stockOperations.ts` | Transfer in | qty + transferred |

### Key Database Table

**`VariationLocationDetails`** - The single source of truth for inventory

```
qtyAvailable = Current stock quantity ⭐
             = Opening stock
             + Purchases received
             - Sales
             + Returns from customers
             - Returns to suppliers
             + Transfers in
             - Transfers out
             +/- Adjustments
```

---

## Next Steps

To understand the complete system:

1. ✅ Read this document (INVENTORY_FLOW.md)
2. ✅ Review commented files:
   - `src/app/api/products/route.ts` (Initialize)
   - `src/app/api/purchases/receipts/[id]/approve/route.ts` (Add)
   - `src/app/api/sales/route.ts` (Deduct)
3. ✅ Study `src/lib/stockOperations.ts` (Core functions)
4. ✅ Test the flow:
   - Create product
   - Create purchase order
   - Receive and approve GRN
   - Make a sale
   - Check inventory reports

---

**Generated**: 2025-01-12
**Version**: 1.0
**Project**: Igoro Tech(IT) Inventory Management System

**Complete Inventory Tracking Flow - From Zero to Sale** 🚀
