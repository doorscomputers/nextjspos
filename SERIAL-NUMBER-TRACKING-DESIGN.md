# 🔢 Serial Number Tracking System - Design Document

**Date:** October 9, 2025
**Feature:** Serial Number Tracking for Defective Item Returns
**Status:** 📋 **DESIGN PHASE**
**Priority:** HIGH - User Requested

---

## 🎯 Business Problem

**User's Request:**
> "I think the only way to do this is to record all the serial numbers of each products purchased in the Purchase Entry form, this way, when a customer complains about the item and it is really defective then the company will know where to return the item to a certain supplier, because a product can have many suppliers."

**Scenario:**
1. Company purchases Product X from multiple suppliers
2. Each unit has a unique serial number or IMEI
3. Company sells Product X to customer
4. Customer returns Product X as defective
5. **Problem:** Which supplier do we return it to?
6. **Solution:** Track serial numbers from purchase through sale

---

## 📊 Current Schema Support

### Already in Database ✅

**PurchaseReceiptItem Model:**
```prisma
model PurchaseReceiptItem {
  // ... other fields
  serialNumbers Json? @map("serial_numbers") // Array of {serialNumber, imei, condition}
  // ... other fields
}
```

**SaleItem Model:**
```prisma
model SaleItem {
  // ... other fields
  serialNumbers Json? @map("serial_numbers") // For tracking individual items
  // ... other fields
}
```

**CustomerReturn Model:**
```prisma
model CustomerReturn {
  // ... fields for tracking returns
  items CustomerReturnItem[]
}

model CustomerReturnItem {
  // ... fields including serialNumber
}
```

✅ **Good News:** Schema already supports serial numbers in key places!

---

## 🔄 Complete Workflow Design

### Phase 1: Purchase Receipt (GRN) - Record Serial Numbers ✅ SCHEMA READY

**When:** Creating GRN (From PO or Direct Entry)

**UI Changes Needed:**
1. Add "Track Serial Numbers" checkbox per product
2. When checked, show dynamic serial number input fields
3. For each unit received, allow entry of:
   - Serial Number (required)
   - IMEI (optional, for phones/electronics)
   - Condition (new/refurbished/used)
4. Validate: Number of serial numbers = Quantity received

**Data Storage:**
```json
{
  "serialNumbers": [
    {
      "serialNumber": "SN123456789",
      "imei": "354312345678901",
      "condition": "new"
    },
    {
      "serialNumber": "SN987654321",
      "imei": "354312345678902",
      "condition": "new"
    }
  ]
}
```

**Saved To:** `PurchaseReceiptItem.serialNumbers` (JSON field)

### Phase 2: Inventory Tracking - Link Serial Numbers to Stock

**When:** GRN approved, stock added to inventory

**Implementation:**
1. Create `SerialNumberInventory` table (new)
2. For each serial number in GRN:
   - Create inventory record
   - Status: "in_stock"
   - Location: GRN location
   - Product & Variation ID
   - **Supplier ID** (critical for returns)
   - **Purchase Receipt ID** (traceability)
   - Date Received
3. Unique constraint on serial number per business

**Schema Addition Needed:**
```prisma
model SerialNumberInventory {
  id                  Int                @id @default(autoincrement())
  businessId          Int                @map("business_id")
  serialNumber        String             @map("serial_number")
  imei                String?
  condition           String             // new, refurbished, used

  // Product Info
  productId           Int                @map("product_id")
  productVariationId  Int                @map("product_variation_id")

  // Current Status
  status              String             // in_stock, sold, returned, defective
  locationId          Int                @map("location_id")

  // Purchase Traceability (CRITICAL)
  supplierId          Int                @map("supplier_id")
  purchaseReceiptId   Int                @map("purchase_receipt_id")
  purchaseReceiptItemId Int              @map("purchase_receipt_item_id")
  unitCost            Decimal            @map("unit_cost") @db.Decimal(22, 4)
  purchaseDate        DateTime           @map("purchase_date")

  // Sale Traceability (when sold)
  saleId              Int?               @map("sale_id")
  saleItemId          Int?               @map("sale_item_id")
  soldDate            DateTime?          @map("sold_date")
  soldToCustomerId    Int?               @map("sold_to_customer_id")

  // Return Traceability (if returned)
  customerReturnId    Int?               @map("customer_return_id")
  returnDate          DateTime?          @map("return_date")
  returnReason        String?            @map("return_reason")

  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  // Relations
  business            Business           @relation(fields: [businessId], references: [id], onDelete: Cascade)
  product             Product            @relation(fields: [productId], references: [id])
  productVariation    ProductVariation   @relation(fields: [productVariationId], references: [id])
  supplier            Supplier           @relation(fields: [supplierId], references: [id])
  location            BusinessLocation   @relation(fields: [locationId], references: [id])
  purchaseReceipt     PurchaseReceipt    @relation(fields: [purchaseReceiptId], references: [id])
  purchaseReceiptItem PurchaseReceiptItem @relation(fields: [purchaseReceiptItemId], references: [id])
  sale                Sale?              @relation(fields: [saleId], references: [id])
  saleItem            SaleItem?          @relation(fields: [saleItemId], references: [id])
  customerReturn      CustomerReturn?    @relation(fields: [customerReturnId], references: [id])

  @@unique([businessId, serialNumber])
  @@index([businessId, serialNumber])
  @@index([businessId, status])
  @@index([productId, status])
  @@index([supplierId])
  @@map("serial_number_inventory")
}
```

### Phase 3: Sales - Link Serial Number to Sale

**When:** Creating a sale for serialized product

**UI Changes Needed:**
1. When adding serialized product to sale, show "Select Serial Numbers"
2. Display available serial numbers for that product/variation
3. Status filter: Only show "in_stock" serial numbers
4. Allow barcode scanning for quick selection
5. Validate: Selected serial numbers = Quantity sold

**Data Flow:**
1. User selects Product X (quantity 2)
2. System checks if Product X tracks serial numbers
3. If yes, show modal with available serial numbers
4. User selects 2 serial numbers
5. Sale created with selected serial numbers in `SaleItem.serialNumbers`
6. Update `SerialNumberInventory`:
   - Status → "sold"
   - saleId → Sale ID
   - saleItemId → SaleItem ID
   - soldDate → Sale date
   - soldToCustomerId → Customer ID

### Phase 4: Customer Return - Trace Back to Supplier

**When:** Customer returns defective item

**UI Changes Needed:**
1. Customer Returns page (create new)
2. Enter serial number of returned item
3. System looks up in `SerialNumberInventory`
4. Display:
   - **Original Supplier** (from purchaseReceiptId)
   - Purchase Date
   - Unit Cost
   - Customer who bought it
   - Sale Date
   - Return eligibility (warranty period)
5. Record return with reason
6. Update serial number status to "returned" or "defective"

**Data Flow:**
1. Customer returns item with serial number SN123456789
2. Lookup in `SerialNumberInventory` by serial number
3. Retrieve `supplierId` → Know which supplier to return to
4. Create `CustomerReturn` record
5. Update `SerialNumberInventory`:
   - Status → "defective"
   - customerReturnId → Return ID
   - returnDate → Today
   - returnReason → User input

### Phase 5: Supplier Return - Process Return to Supplier

**When:** Returning defective item to supplier

**UI Changes Needed:**
1. Supplier Returns page (create new)
2. List defective items with serial numbers
3. Group by supplier automatically
4. Select items to return to supplier
5. Generate Supplier Return Note (SRN)
6. Record expected credit/replacement

**Data Flow:**
1. Filter serial numbers with status "defective"
2. Group by supplierId
3. Create `SupplierReturn` record
4. Link serial numbers to supplier return
5. Track supplier's response (credit/replacement)
6. Final status: "returned_to_supplier"

---

## 📋 Implementation Phases

### Phase 1: Database Schema (Week 1) 🔄
- [ ] Create `SerialNumberInventory` model
- [ ] Add relations to existing models
- [ ] Create migration
- [ ] Update Prisma Client

### Phase 2: Purchase Receipt Serial Entry (Week 1-2) 🔄
- [ ] Add "Track Serial Numbers" toggle to GRN UI
- [ ] Create serial number input component
- [ ] Validate serial number count = quantity
- [ ] Save to `PurchaseReceiptItem.serialNumbers`
- [ ] Populate `SerialNumberInventory` on GRN creation

### Phase 3: Serial Number Search & Lookup (Week 2) ⏳
- [ ] Create API: `GET /api/serial-numbers/:serialNumber`
- [ ] Returns complete traceability info
- [ ] Show supplier, purchase date, sale date, customer

### Phase 4: Sales Serial Number Selection (Week 2-3) ⏳
- [ ] Add serial number selection to Sale UI
- [ ] Show available serial numbers modal
- [ ] Update serial number status on sale
- [ ] Link sale to serial number

### Phase 5: Customer Returns (Week 3-4) ⏳
- [ ] Create Customer Returns UI
- [ ] Serial number lookup on return
- [ ] Display supplier information
- [ ] Record return with reason
- [ ] Update serial number status

### Phase 6: Supplier Returns (Week 4-5) ⏳
- [ ] Create Supplier Returns UI
- [ ] Group defectives by supplier
- [ ] Generate Supplier Return Notes
- [ ] Track supplier credits

### Phase 7: Reporting & Analytics (Week 5-6) ⏳
- [ ] Serial Number Traceability Report
- [ ] Defect Rate by Supplier Report
- [ ] Warranty Claim Report
- [ ] Serial Number Lookup Tool

---

## 🎯 Key Features

### 1. **Complete Traceability** ✅
- Track serial number from purchase to sale to return
- Know exactly which supplier for any defective item
- Audit trail for warranty claims

### 2. **Status Tracking** ✅
- **in_stock:** Available for sale
- **sold:** Sold to customer
- **returned:** Returned by customer
- **defective:** Confirmed defective
- **returned_to_supplier:** Returned to supplier
- **replaced:** Replaced by supplier
- **disposed:** End of life

### 3. **Supplier Accountability** ✅
- Automatically identify supplier for returns
- Track defect rates per supplier
- Historical data for supplier performance

### 4. **Customer Service** ✅
- Quick lookup of purchase history
- Warranty validation
- Replacement tracking

### 5. **Financial Tracking** ✅
- Track cost per serial number
- Calculate loss on defectives
- Supplier credit management

---

## 🔒 Data Integrity Rules

### Uniqueness:
- Serial numbers must be unique per business
- Cannot have duplicate serial numbers in stock
- Soft delete for historical tracking

### Validation:
- Serial number required if product type = "serialized"
- Quantity sold must match serial number count
- Cannot sell serial number twice

### Status Transitions:
```
in_stock → sold → (normal flow)
sold → returned → defective → returned_to_supplier (defective flow)
in_stock → defective (found defective before sale)
```

---

## 🎨 UI/UX Mockups

### GRN Serial Number Entry:
```
┌─────────────────────────────────────────────────┐
│ Product: iPhone 13 Pro                          │
│ Quantity Received: 3                             │
│                                                  │
│ [x] Track Serial Numbers                        │
│                                                  │
│ Unit 1:                                          │
│   Serial Number: [SN123456789           ]       │
│   IMEI:         [354312345678901       ]       │
│   Condition:    [New ▾]                         │
│                                                  │
│ Unit 2:                                          │
│   Serial Number: [SN987654321           ]       │
│   IMEI:         [354312345678902       ]       │
│   Condition:    [New ▾]                         │
│                                                  │
│ Unit 3:                                          │
│   Serial Number: [SN456789123           ]       │
│   IMEI:         [354312345678903       ]       │
│   Condition:    [New ▾]                         │
│                                                  │
│ [+ Add Another Unit]                             │
└─────────────────────────────────────────────────┘
```

### Sale Serial Number Selection:
```
┌─────────────────────────────────────────────────┐
│ Select Serial Numbers for: iPhone 13 Pro        │
│ Quantity to Sell: 2                              │
│                                                  │
│ Available Serial Numbers:                        │
│                                                  │
│ [x] SN123456789 - New - Supplier: ABC          │
│     Purchased: Oct 1, 2025 - Location: Main     │
│                                                  │
│ [x] SN987654321 - New - Supplier: XYZ          │
│     Purchased: Oct 5, 2025 - Location: Main     │
│                                                  │
│ [ ] SN456789123 - New - Supplier: ABC          │
│     Purchased: Oct 1, 2025 - Location: Main     │
│                                                  │
│ Selected: 2 of 2 required                        │
│                                                  │
│ [Cancel] [Confirm Selection]                     │
└─────────────────────────────────────────────────┘
```

### Customer Return Serial Lookup:
```
┌─────────────────────────────────────────────────┐
│ Customer Return - Serial Number Lookup          │
│                                                  │
│ Serial Number: [SN123456789] [Search]          │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✅ Serial Number Found                       │ │
│ │                                               │ │
│ │ Product: iPhone 13 Pro - 128GB Black         │ │
│ │                                               │ │
│ │ PURCHASE INFO:                                │ │
│ │ ├─ Supplier: ABC Electronics                 │ │
│ │ ├─ Purchase Date: Oct 1, 2025                │ │
│ │ ├─ Unit Cost: $899.00                        │ │
│ │ └─ GRN: GRN-000015                           │ │
│ │                                               │ │
│ │ SALE INFO:                                    │ │
│ │ ├─ Customer: John Doe                        │ │
│ │ ├─ Sale Date: Oct 3, 2025                    │ │
│ │ ├─ Sale Price: $1,099.00                     │ │
│ │ └─ Invoice: INV-000234                       │ │
│ │                                               │ │
│ │ WARRANTY: Active (87 days remaining)         │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Return Reason: [Defective - Won't Power On ▾]  │
│                                                  │
│ Notes: [_________________________________]      │
│        [_________________________________]      │
│                                                  │
│ [Cancel] [Process Return]                       │
└─────────────────────────────────────────────────┘
```

---

## 💡 Additional Benefits

### 1. Warranty Management:
- Track warranty periods per serial number
- Auto-calculate warranty expiry
- Alert for expired warranties

### 2. Theft Prevention:
- Register stolen serial numbers
- Flag during sale attempts
- Report to authorities

### 3. Product Recalls:
- Identify affected serial numbers
- Contact customers who purchased
- Track recall completion

### 4. Supplier Performance:
- Defect rate per supplier
- Average time to resolve returns
- Quality scoring

### 5. Inventory Audits:
- Physical count vs system count per serial number
- Identify missing items
- Reconciliation reports

---

## 📊 Reporting Capabilities

### Reports to Create:

1. **Serial Number Traceability Report**
   - Enter serial number → Full history

2. **Defect Rate by Supplier**
   - % of items returned defective per supplier
   - Time period comparison

3. **Warranty Claims Report**
   - Items returned within warranty
   - Financial impact

4. **Outstanding Supplier Returns**
   - Defective items awaiting return to supplier
   - Grouped by supplier

5. **Serial Number Movement Report**
   - Track movements between locations
   - Status changes over time

---

## ✅ Success Metrics

### KPIs to Track:
- **Return Processing Time:** From customer return to supplier return
- **Supplier Response Time:** Days to receive credit/replacement
- **Defect Rate:** % of items sold that are returned defective
- **Supplier Defect Rate:** Defects per supplier
- **Warranty Claim Rate:** % of items claimed under warranty

---

## 🚀 Implementation Timeline

**Total Duration:** 6 weeks

**Week 1:** Database schema + GRN serial entry
**Week 2:** Serial number lookup API + Sales integration
**Week 3:** Customer returns functionality
**Week 4:** Supplier returns functionality
**Week 5:** Reporting & analytics
**Week 6:** Testing, refinement, documentation

---

## 📝 Next Steps

### Immediate (This Week):
1. ✅ Review this design with user
2. ✅ Get approval on schema
3. ✅ Confirm UI/UX expectations
4. [ ] Create `SerialNumberInventory` migration
5. [ ] Start Phase 1 implementation

### Short-term (Next 2 Weeks):
1. [ ] Implement GRN serial number entry
2. [ ] Create serial number lookup API
3. [ ] Build sales serial number selection

### Medium-term (Weeks 3-6):
1. [ ] Customer returns module
2. [ ] Supplier returns module
3. [ ] Reporting suite

---

**Design by:** Claude Code
**Date:** October 9, 2025
**Status:** 📋 **READY FOR APPROVAL**
**Priority:** HIGH - Critical for defective returns workflow

**User Approval Needed Before Implementation** ✋
