# 📦 Direct GRN Entry & Defective Item Tracking - Implementation Plan

## ✅ Phase 1: Direct GRN Entry (COMPLETED - Schema)

### What Changed:
The `PurchaseReceipt` model now supports creating Goods Received Notes **WITHOUT** a Purchase Order.

### Database Schema Changes:
```prisma
model PurchaseReceipt {
  // BEFORE: Required Purchase Order
  // purchaseId Int

  // AFTER: Optional Purchase Order
  purchaseId Int?      // Can be NULL now!
  purchase   Purchase?

  // NEW: Direct supplier reference
  supplierId Int      // Required - must specify supplier
  supplier   Supplier // Direct link to supplier
}
```

### Two Workflows Now Supported:

#### **Workflow 1: With Purchase Order** (Planned Purchases)
```
1. Create PO → Send to supplier
2. Supplier delivers
3. Create GRN from PO
4. Link: GRN → PO → Supplier
5. Inventory updated
```

#### **Workflow 2: Direct GRN** (Walk-in/Unplanned Purchases) ⭐ **NEW!**
```
1. Go to supplier, buy items
2. Return to store
3. Create GRN directly:
   - Select supplier (required)
   - Enter items manually
   - Enter quantities & costs
   - NO Purchase Order needed!
4. Link: GRN → Supplier (direct)
5. Inventory updated
```

---

## 🔨 Phase 2: Implementation Tasks

### Task 1: Update GRN Create Page ⏳ IN PROGRESS
**File**: `src/app/dashboard/purchases/receipts/new/page.tsx`

**What needs to be done**:
1. Add toggle: "Create from Purchase Order" vs "Direct Entry"
2. If "Direct Entry":
   - Show supplier dropdown (required)
   - Show empty items table
   - Allow manual product selection
   - Allow manual quantity/cost entry
3. If "From Purchase Order":
   - Show PO selector
   - Pre-fill items from selected PO
   - Allow editing received quantities

### Task 2: Update GRN API
**File**: `src/app/api/purchases/receipts/route.ts`

**What needs to be done**:
1. Validate:
   - If `purchaseId` provided: Use supplier from PO
   - If no `purchaseId`: Require `supplierId` in request
2. Create GRN with or without PO link
3. Update inventory correctly in both cases
4. Create accounts payable entry linked to supplier

### Task 3: Update GRN List Page
**File**: `src/app/dashboard/purchases/receipts/page.tsx`

**What needs to be done**:
- Show "Direct Entry" badge for GRNs without PO
- Display supplier name from direct link if no PO

---

## 📊 Phase 3: Product Purchase History Report

### Report Specifications:
**Columns**:
1. SKU
2. Product Name
3. Last Purchase Cost
4. Last Supplier Name
5. Last Purchase Qty
6. Last Purchase Amount (Qty × Cost)
7. Last Purchase Date

**File to create**: `src/app/dashboard/reports/product-purchase-history/page.tsx`

### SQL Logic (Pseudocode):
```sql
SELECT
  p.sku,
  p.name,
  last_purchase.cost AS last_cost,
  last_purchase.supplier_name,
  last_purchase.quantity,
  last_purchase.amount,
  last_purchase.date
FROM products p
LEFT JOIN LATERAL (
  SELECT
    pi.unitCost AS cost,
    s.name AS supplier_name,
    pi.quantity,
    (pi.quantity * pi.unitCost) AS amount,
    pu.purchaseDate AS date
  FROM purchase_items pi
  JOIN purchases pu ON pi.purchaseId = pu.id
  JOIN suppliers s ON pu.supplierId = s.id
  WHERE pi.productId = p.id
  ORDER BY pu.purchaseDate DESC
  LIMIT 1
) last_purchase ON true
```

---

## 🔍 Phase 4: Serial Number Tracking for Defective Returns

### The Problem:
**Scenario**: Customer returns defective iPhone
- **Question**: Which supplier did we buy it from?
- **Why it matters**: Need to return to correct supplier
- **Current issue**: Same product from multiple suppliers - can't tell which one!

### The Solution: Serial Number Tracking ✨

### How It Works:

#### Step 1: Record Serial Numbers When Purchasing
```
Purchase from Supplier A (ABC Electronics):
  - iPhone 14 Pro, Qty: 3
  - Serial Numbers:
    1. SN-ABC-001 (IMEI: 111111111)
    2. SN-ABC-002 (IMEI: 222222222)
    3. SN-ABC-003 (IMEI: 333333333)

Purchase from Supplier B (XYZ Tech):
  - iPhone 14 Pro, Qty: 2
  - Serial Numbers:
    1. SN-XYZ-001 (IMEI: 444444444)
    2. SN-XYZ-002 (IMEI: 555555555)
```

**Database Storage**:
```prisma
model PurchaseItem {
  // Existing fields...
  serialNumbers Json? // Array of {serialNumber, imei, condition}
}

// Example JSON:
[
  {
    "serialNumber": "SN-ABC-001",
    "imei": "111111111",
    "condition": "new",
    "receivedDate": "2025-01-15"
  },
  {
    "serialNumber": "SN-ABC-002",
    "imei": "222222222",
    "condition": "new",
    "receivedDate": "2025-01-15"
  }
]
```

#### Step 2: Track Serial Number in Sales
```
Customer buys iPhone 14 Pro:
  - Select specific serial number: SN-ABC-001
  - System records:
    - Product sold
    - Serial number used
    - Original supplier (ABC Electronics)
    - Original purchase date
```

**Database Storage**:
```prisma
model SaleItem {
  // Existing fields...
  serialNumbers Json? // Array of sold serial numbers with origin info
}

// Example JSON:
[
  {
    "serialNumber": "SN-ABC-001",
    "imei": "111111111",
    "originalPurchaseId": 123,
    "originalSupplierId": 45,
    "supplierName": "ABC Electronics",
    "purchaseDate": "2025-01-15",
    "soldDate": "2025-02-01"
  }
]
```

#### Step 3: Customer Returns (Defective)
```
Customer returns iPhone with SN-ABC-001:
  1. Scan/enter serial number: SN-ABC-001
  2. System looks up:
     - Original supplier: ABC Electronics
     - Purchase date: 2025-01-15
     - Purchase Order: PO-00123
     - Original cost: $900
  3. Create customer return record
  4. Option to create supplier return to ABC Electronics
```

#### Step 4: Return to Supplier
```
Create Supplier Return:
  - Supplier: ABC Electronics (auto-filled from serial number)
  - Product: iPhone 14 Pro
  - Serial Number: SN-ABC-001
  - Reason: Defective
  - Original PO: PO-00123
  - Refund Amount: $900
```

---

## 🗄️ Database Schema for Serial Number Tracking

### Already Exists (Good News!):
```prisma
model PurchaseReceiptItem {
  serialNumbers Json? @map("serial_numbers")
  // Stores: [{ serialNumber, imei, condition }]
}

model SupplierReturnItem {
  serialNumbers Json? @map("serial_numbers")
  // Can track which serial numbers returned to supplier
}
```

### Need to Add:
```prisma
model SaleItem {
  // Add this field:
  serialNumbers Json? @map("serial_numbers")
  // Will store: [{
  //   serialNumber,
  //   imei,
  //   originalPurchaseId,
  //   originalSupplierId,
  //   supplierName
  // }]
}

model CustomerReturn {
  // Create this new model
  id Int @id @default(autoincrement())
  businessId Int

  saleId Int
  sale Sale @relation(...)

  returnNumber String @unique
  returnDate DateTime

  customerId Int
  customer Customer @relation(...)

  status String // pending, approved, completed
  returnReason String // defective, warranty, wrong_item, damaged

  totalAmount Decimal
  refundMethod String // cash, credit, replacement

  notes String?

  createdBy Int
  approvedBy Int?
  approvedAt DateTime?

  items CustomerReturnItem[]
}

model CustomerReturnItem {
  id Int @id @default(autoincrement())
  customerReturnId Int
  customerReturn CustomerReturn @relation(...)

  saleItemId Int
  saleItem SaleItem @relation(...)

  productId Int
  productVariationId Int

  quantity Decimal
  unitPrice Decimal

  // Serial numbers being returned
  serialNumbers Json? // { serialNumber, imei, defectDescription }

  // Link to original supplier (from serial number lookup)
  originalSupplierId Int?
  originalPurchaseId Int?

  condition String // defective, damaged, warranty_claim
  defectDescription String?

  canReturnToSupplier Boolean @default(false)

  notes String?
}
```

---

## 🎯 Implementation Priority

### Must Do Now:
1. ✅ **Schema Update** (DONE)
2. ⏳ **Direct GRN UI** (In Progress)
3. ⏳ **Direct GRN API** (Pending)

### Should Do Soon:
4. 📊 **Product Purchase History Report** (High Value)
5. 🔢 **Serial Number Entry in Purchase Form** (Critical for defective tracking)

### Can Do Later:
6. 🔍 **Serial Number Tracking in Sales**
7. 📋 **Customer Returns Module**
8. 🔄 **Supplier Return with Serial Number Matching**

---

## 💡 Benefits of This System

### For Direct GRN:
- ✅ No need to create fake POs for walk-in purchases
- ✅ Faster data entry for emergency purchases
- ✅ Still maintains supplier tracking
- ✅ Inventory stays accurate
- ✅ Accounts payable still tracked

### For Serial Number Tracking:
- ✅ **Know exactly which supplier** to return defective items to
- ✅ **Warranty claims** - can prove when/where item was purchased
- ✅ **Prevent fraud** - track item history from purchase to sale to return
- ✅ **Supplier quality tracking** - see which suppliers have more defective items
- ✅ **Inventory accuracy** - track individual high-value items
- ✅ **Lost/Stolen tracking** - know which serial numbers are missing

---

## 📝 User Stories

### Story 1: Emergency Purchase
```
As a: Store Manager
I want to: Buy urgent stock from supplier without creating PO
So that: I can quickly restock fast-moving items

Steps:
1. Go to Purchases → Goods Received → New
2. Select "Direct Entry" (no PO)
3. Select Supplier: ABC Electronics
4. Add items manually
5. Enter quantities and costs
6. Save
Result: Inventory updated, AP created, no PO needed
```

### Story 2: Defective Item Return
```
As a: Customer Service Rep
I want to: Process defective item return and know which supplier to claim from
So that: We can recover costs from the right supplier

Steps:
1. Customer returns iPhone (defective)
2. Scan serial number: SN-ABC-001
3. System shows: "Purchased from ABC Electronics on 2025-01-15"
4. Create customer return (refund customer)
5. Create supplier return to ABC Electronics
6. Track refund from supplier
Result: Customer happy, supplier pays for defective unit
```

### Story 3: Product Cost Analysis
```
As a: Business Owner
I want to: See last purchase cost and supplier for each product
So that: I can negotiate better prices with suppliers

Steps:
1. Go to Reports → Product Purchase History
2. View report showing:
   - Product Name
   - Last Cost
   - Last Supplier
   - Last Purchase Date
3. Filter by product category
4. Export to Excel
Result: Data for price negotiations and supplier comparison
```

---

## ⚡ Next Steps

**Ready to implement!** Let me know if you want me to:
1. Continue with Direct GRN UI and API
2. Create the Product Purchase History Report
3. Design the Serial Number Tracking forms

All of this is possible and will make your system very robust! 🚀
