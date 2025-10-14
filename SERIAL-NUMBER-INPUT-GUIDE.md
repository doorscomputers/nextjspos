# Serial Number Input - Complete Guide

## ✅ Summary

**Question:** How are serial numbers identified and entered?

**Answer:** Serial numbers are entered by warehouse staff during the **Goods Received Note (GRN) creation** process. We've implemented a comprehensive UI component with **3 input methods**:

1. ✅ **Manual Entry** - One-by-one input
2. ✅ **Bulk Entry** - Copy/paste from Excel or CSV
3. ✅ **Barcode Scanner** - Scan each item with barcode gun

---

## 🔄 Complete Workflow

### Step 1: Create GRN
```
Warehouse receives goods from supplier
↓
Staff creates GRN (Goods Received Note)
↓
For each product that requires serial tracking...
```

### Step 2: Enter Serial Numbers

#### Method 1: Manual Entry (One-by-One)
```
[Serial Numbers Button] (0/5) ← Click this
  ↓
[Dialog Opens]
  ├─ Serial Number: [SN12345___]
  ├─ IMEI: [123456789___] (optional)
  ├─ Condition: [New ▼]
  └─ [Add Serial Number]

Repeat for all 5 units
Progress: 5/5 ✓
```

#### Method 2: Bulk Entry (Excel/CSV)
```
[Serial Numbers Button] (0/100) ← For large quantities
  ↓
[Dialog Opens] → Switch to "Bulk Entry" tab
  ↓
Paste from Excel:
  SN12345|123456789
  SN12346|123456790
  SN12347|123456791
  ... (100 lines)
  ↓
[Process Bulk Entry]
Progress: 100/100 ✓
```

#### Method 3: Barcode Scanner
```
[Serial Numbers Button] (0/50)
  ↓
[Dialog Opens] → Switch to "Scan Barcode" tab
  ↓
Connect USB/Bluetooth barcode scanner
  ↓
[Focus input field]
  ↓
*BEEP* Scan item 1 → Auto-adds
*BEEP* Scan item 2 → Auto-adds
*BEEP* Scan item 3 → Auto-adds
...
Progress: 50/50 ✓
```

### Step 3: GRN Approval
```
All serial numbers entered
↓
Manager reviews GRN
↓
Manager clicks "Approve"
↓
✅ Serial numbers created in database with supplier_id
✅ Inventory updated
✅ Stock transactions recorded
✅ Supplier linked to each serial number!
```

---

## 📱 UI Components

### New Component Created
**File:** `src/components/purchases/SerialNumberInput.tsx`

**Features:**
- ✅ Progress bar showing completion (e.g., 3/5 = 60%)
- ✅ Duplicate detection
- ✅ IMEI/Serial number support
- ✅ Condition tracking (new, used, damaged, etc.)
- ✅ Auto-close when complete
- ✅ Visual feedback (colors: red=missing, green=complete)
- ✅ Export/import from Excel
- ✅ Barcode scanner integration

### Integration with GRN Form

The `SerialNumberInput` component needs to be integrated into the existing GRN form at line 686 (after "Total" column):

```tsx
// In: src/app/dashboard/purchases/receipts/new/page.tsx
// After line 686, add a new column:

<th className="px-4 py-3 text-center">Serial Numbers</th>

// In the table body (around line 698), add:

<td className="px-4 py-3">
  {item.productRequiresSerial && (
    <SerialNumberInput
      requiredCount={item.quantityReceived}
      productName={item.productName}
      onSerialNumbersChange={(serialNumbers) => {
        updateItem(item.id, 'serialNumbers', serialNumbers)
      }}
      initialSerialNumbers={item.serialNumbers}
    />
  )}
</td>
```

---

## 🎯 User Experience

### For Products WITH Serial Number Tracking

```
┌─────────────────────────────────────────┐
│ Product: iPhone 15 Pro                   │
│ Quantity Received: 5                     │
│                                          │
│ [Serial Numbers (0/5)] ← Red button     │
│                                          │
│ ⚠️ Serial numbers required!             │
└─────────────────────────────────────────┘

After entering all 5:

┌─────────────────────────────────────────┐
│ Product: iPhone 15 Pro                   │
│ Quantity Received: 5                     │
│                                          │
│ [Serial Numbers (5/5)] ← Green button   │
│ SN001, SN002, SN003, SN004, SN005       │
│                                          │
│ ✅ All serial numbers entered            │
└─────────────────────────────────────────┘
```

### For Products WITHOUT Serial Number Tracking

```
┌─────────────────────────────────────────┐
│ Product: Plastic Bags (Box)              │
│ Quantity Received: 10                    │
│                                          │
│ (No serial numbers required)             │
└─────────────────────────────────────────┘
```

---

## 📊 Data Flow

### 1. User Enters Serial Numbers
```javascript
// Component state
serialNumbers = [
  {
    serialNumber: "SN12345",
    imei: "123456789012345",
    condition: "new"
  },
  {
    serialNumber: "SN12346",
    imei: "123456789012346",
    condition: "new"
  }
]
```

### 2. Saved to GRN Item
```javascript
// GRN payload (line 362 in new/page.tsx)
items: [
  {
    productId: 123,
    productVariationId: 456,
    quantityReceived: 2,
    serialNumbers: [
      {
        serialNumber: "SN12345",
        imei: "123456789012345",
        condition: "new"
      },
      {
        serialNumber: "SN12346",
        imei: "123456789012346",
        condition: "new"
      }
    ]
  }
]
```

### 3. Stored in Database (Temporarily)
```sql
-- purchase_receipt_items table
INSERT INTO purchase_receipt_items (
  purchase_receipt_id,
  product_variation_id,
  quantity_received,
  serial_numbers  -- JSON array
)
VALUES (
  123,
  456,
  2,
  '[{"serialNumber":"SN12345","imei":"123456789012345","condition":"new"}]'
)
```

### 4. On GRN Approval → ProductSerialNumber Table
```sql
-- Created during approval (one record per serial)
INSERT INTO product_serial_numbers (
  business_id,
  product_id,
  product_variation_id,
  serial_number,
  imei,
  condition,
  supplier_id,        -- ← LINKED TO SUPPLIER!
  purchase_receipt_id,
  status,
  ...
)
VALUES
  (1, 123, 456, 'SN12345', '123456789012345', 'new', 5, 123, 'in_stock', ...),
  (1, 123, 456, 'SN12346', '123456789012346', 'new', 5, 123, 'in_stock', ...);
```

---

## 🔐 Validation Rules

### Client-Side (UI)
1. ✅ Serial number cannot be empty
2. ✅ No duplicate serial numbers in same GRN
3. ✅ Must enter exact count (e.g., 5/5)
4. ✅ Visual warnings if incomplete

### Server-Side (API)
1. ✅ Duplicate check across entire database
2. ✅ Must match quantity received
3. ✅ Business-scoped (same serial can exist in different businesses)
4. ✅ Prevents approval if serial numbers missing (when required)

---

## 💼 Business Rules

### When Are Serial Numbers Required?

**Configured at Product Level:**
```typescript
// Product.enableProductInfo = true
// This flag determines if product requires serial tracking

if (product.enableProductInfo === true) {
  // Serial numbers MUST be entered
  // Cannot approve GRN without them
} else {
  // Serial numbers optional (skip this step)
}
```

**Typical Use Cases:**
- ✅ Electronics (phones, laptops, tablets)
- ✅ Appliances (refrigerators, washing machines)
- ✅ High-value items (jewelry, watches)
- ✅ Warranty-tracked items
- ❌ Consumables (food, drinks)
- ❌ Bulk items (screws, plastic bags)

---

## 🎓 Training Guide for Warehouse Staff

### Step-by-Step Instructions

#### Scenario: Receiving 10 iPhones

1. **Create GRN**
   - Select Purchase Order or Direct Entry
   - Choose location and date
   - Add items

2. **Enter Quantity**
   - Quantity Received: 10

3. **Click Serial Numbers Button**
   - Shows: "Serial Numbers (0/10)" in RED

4. **Choose Input Method**

   **Option A: Barcode Scanner (Fastest)**
   - Click "Scan Barcode" tab
   - Scan each iPhone's barcode
   - 10 beeps = done!

   **Option B: Bulk Entry (for pre-printed lists)**
   - Click "Bulk Entry" tab
   - Copy from Excel (10 rows)
   - Paste into text box
   - Click "Process Bulk Entry"

   **Option C: Manual Entry (one-by-one)**
   - Enter Serial Number
   - Enter IMEI (if applicable)
   - Select Condition (usually "New")
   - Click "Add"
   - Repeat 10 times

5. **Verify Complete**
   - Button shows: "Serial Numbers (10/10)" in GREEN
   - List shows all 10 serial numbers

6. **Save GRN**
   - Click "Create Purchase Receipt"
   - GRN created with serial numbers

7. **Manager Approves**
   - Manager reviews GRN
   - Clicks "Approve"
   - ✅ Serial numbers linked to supplier automatically!

---

## 🚀 Quick Reference

| Task | Action |
|------|--------|
| Enter 1-5 serial numbers | Use Manual Entry |
| Enter 10-50 serial numbers | Use Barcode Scanner |
| Enter 100+ serial numbers | Use Bulk Entry (Excel paste) |
| Check if complete | Look for green button (X/X) |
| Fix duplicate error | Remove duplicate and re-enter |
| Skip serial numbers | Only if product doesn't require them |

---

## 🔧 Technical Implementation Status

### ✅ Completed
1. Backend API supports serial numbers
2. Database schema ready
3. Supplier linking implemented
4. Serial number component created (`SerialNumberInput.tsx`)
5. Validation logic implemented
6. Duplicate detection added
7. 3 input methods working

### ⚠️ Integration Needed
**File to Update:** `src/app/dashboard/purchases/receipts/new/page.tsx`

**Changes Required:**
1. Import `SerialNumberInput` component
2. Add serial number column to table
3. Check if product requires serial tracking
4. Show `SerialNumberInput` button when required
5. Update item state with serial numbers

**Estimated Time:** 15 minutes

---

## 📸 Visual Flow

```
┌────────────────────────────────────────────┐
│  Create GRN                                 │
│  ┌──────────────────────────────────────┐ │
│  │ Product: iPhone 15 Pro                │ │
│  │ Qty: 5                                │ │
│  │                                        │ │
│  │ [Serial Numbers (0/5)] ← Click        │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│  Serial Number Entry Dialog                 │
│  ╔══════════════════════════════════════╗ │
│  ║ Progress: 0/5 [░░░░░░░░░░] 0%        ║ │
│  ╠══════════════════════════════════════╣ │
│  ║ [Single] [Bulk] [Scan]               ║ │
│  ║                                       ║ │
│  ║ Serial: [_______]                    ║ │
│  ║ IMEI:   [_______]                    ║ │
│  ║ Condition: [New ▼]                   ║ │
│  ║                                       ║ │
│  ║ [Add Serial Number]                  ║ │
│  ╚══════════════════════════════════════╝ │
└────────────────────────────────────────────┘
                    ↓
┌────────────────────────────────────────────┐
│  After Entering All 5                       │
│  ╔══════════════════════════════════════╗ │
│  ║ Progress: 5/5 [██████████] 100%      ║ │
│  ╠══════════════════════════════════════╣ │
│  ║ ✅ All 5 serial numbers entered!     ║ │
│  ║                                       ║ │
│  ║ Entered Serial Numbers (5):          ║ │
│  ║ • SN001 | IMEI: xxx | New            ║ │
│  ║ • SN002 | IMEI: xxx | New            ║ │
│  ║ • SN003 | IMEI: xxx | New            ║ │
│  ║ • SN004 | IMEI: xxx | New            ║ │
│  ║ • SN005 | IMEI: xxx | New            ║ │
│  ╚══════════════════════════════════════╝ │
└────────────────────────────────────────────┘
```

---

## ✅ Next Steps

1. **Integrate Component** into GRN form (15 min)
2. **Test with Real Data** (30 min)
3. **Train Warehouse Staff** (1 hour)
4. **Deploy to Production** ✅

---

**Status:** 🟢 Ready for Integration
**Component File:** `src/components/purchases/SerialNumberInput.tsx`
**Documentation:** Complete
