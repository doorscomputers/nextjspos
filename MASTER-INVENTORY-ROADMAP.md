# 🎯 MASTER INVENTORY SYSTEM ROADMAP
## Bulletproof, Tamper-Proof, Audit-Complete Inventory Management

**Project:** UltimatePOS Modern - Complete Inventory Management System
**Goal:** Build a robust, tamper-proof inventory system with full serial number tracking, branch transfers, and complete audit trails
**Status:** Planning Phase
**Last Updated:** 2025-10-06

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

### Core Principles
1. **Tamper-Proof** - All changes logged, no direct database updates
2. **Serial Number Tracking** - Every serialized item tracked individually
3. **Branch-Based** - Warehouse-centric distribution model
4. **Approval Workflow** - Two-step transfers (send → receive/approve)
5. **Zero Inventory Prevention** - Can't sell what you don't have
6. **Complete Audit Trail** - Every movement logged with WHO, WHEN, WHY, WHERE

### Distribution Model
```
SUPPLIERS → WAREHOUSE (Central Hub) → BRANCHES
                ↑            ↓
                └─── Inter-Branch Transfers ───┘
```

---

## 📦 FEATURE MODULES TO BUILD

### ✅ COMPLETED
- [x] Product CRUD with serial number flag
- [x] Opening Stock with location support
- [x] Inventory Corrections with audit logging
- [x] Physical Inventory Count (Excel import/export)
- [x] Location-based access control
- [x] RBAC permissions system

### 🚧 IN PROGRESS
- [ ] Opening Stock audit logging (URGENT)
- [ ] Stock transaction verification

### 📋 TO BUILD (Priority Order)

---

## 1️⃣ PURCHASES MODULE (From Suppliers)
**Priority:** CRITICAL
**Estimated Time:** 3-5 days
**Status:** Not Started

### Features Required:

#### A. Purchase Order Creation
- Create PO with multiple products/variations
- Specify supplier, expected delivery date
- Warehouse location as default receiving location
- Status: Draft, Sent, Received, Partial, Cancelled

#### B. Purchase Receipt/GRN (Goods Received Note)
**CRITICAL: Serial Number Scanning**

```typescript
interface PurchaseReceipt {
  purchaseOrderId: number
  receivedBy: number (userId)
  receivedDate: Date
  locationId: number (warehouse)

  items: PurchaseReceiptItem[]

  status: 'pending' | 'completed'
}

interface PurchaseReceiptItem {
  productId: number
  variationId: number
  orderedQty: number
  receivedQty: number
  unitCost: Decimal

  // CRITICAL: For serialized items
  requiresSerial: boolean
  serialNumbers: SerialNumberEntry[]
}

interface SerialNumberEntry {
  serialNumber: string
  scannedAt: DateTime
  scannedBy: number (userId)
  condition: 'new' | 'damaged' | 'defective'
}
```

#### C. Serial Number Scanning UI
**Barcode Integration:**
- Webcam barcode scanning (using `html5-qrcode` or `quagga.js`)
- Manual entry fallback
- Real-time validation (duplicate check)
- Visual feedback (scanned count vs expected count)
- Bulk scan mode

**Workflow:**
1. Receive PO → Select item with serial numbers
2. Scan Mode activates
3. Scan each unit individually
4. System validates: unique, not already in system
5. Mark condition (new/damaged/defective)
6. When count matches → Complete item
7. When all items done → Finalize receipt

#### D. Stock Update Logic
```typescript
// After GRN completion:
for (const item of receiptItems) {
  if (item.requiresSerial) {
    // Create individual serial number records
    for (const serial of item.serialNumbers) {
      await prisma.productSerialNumber.create({
        data: {
          productId: item.productId,
          variationId: item.variationId,
          serialNumber: serial.serialNumber,
          locationId: warehouseLocationId,
          status: 'in_stock',
          condition: serial.condition,
          purchasedAt: receipt.receivedDate,
          purchaseCost: item.unitCost,
          createdBy: receipt.receivedBy
        }
      })
    }
  }

  // Update variation_location_details
  await updateStock({
    locationId: warehouseLocationId,
    variationId: item.variationId,
    qtyChange: +item.receivedQty
  })

  // Create stock transaction
  await createStockTransaction({
    type: 'purchase',
    productId: item.productId,
    variationId: item.variationId,
    locationId: warehouseLocationId,
    qtyBefore: currentQty,
    qtyAfter: currentQty + item.receivedQty,
    qtyChange: +item.receivedQty,
    referenceType: 'purchase_receipt',
    referenceId: receipt.id
  })

  // AUDIT LOG
  await createAuditLog({
    action: 'purchase_received',
    entityType: 'purchase_receipt',
    entityId: receipt.id,
    metadata: {
      productId: item.productId,
      variationId: item.variationId,
      quantity: item.receivedQty,
      serialNumbers: item.serialNumbers.map(s => s.serialNumber),
      locationId: warehouseLocationId
    }
  })
}
```

#### E. Database Schema Updates Needed

```prisma
model ProductSerialNumber {
  id              Int      @id @default(autoincrement())
  businessId      Int      @map("business_id")
  business        Business @relation(fields: [businessId], references: [id])

  productId       Int      @map("product_id")
  product         Product  @relation(fields: [productId], references: [id])

  variationId     Int      @map("variation_id")
  variation       ProductVariation @relation(fields: [variationId], references: [id])

  serialNumber    String   @map("serial_number")
  imei            String?  // Alternative to serial number for phones

  // Current status
  status          String   // in_stock, sold, transferred, returned_to_supplier, damaged, lost
  condition       String   // new, used, refurbished, damaged, defective

  // Current location
  currentLocationId Int?   @map("current_location_id")
  currentLocation   BusinessLocation? @relation(fields: [currentLocationId], references: [id])

  // Purchase info
  purchasedAt     DateTime? @map("purchased_at")
  purchaseCost    Decimal?  @map("purchase_cost") @db.Decimal(20, 2)
  supplierId      Int?      @map("supplier_id")

  // Sale info
  soldAt          DateTime? @map("sold_at")
  soldPrice       Decimal?  @map("sold_price") @db.Decimal(20, 2)
  soldTo          String?   @map("sold_to") // Customer name
  invoiceNumber   String?   @map("invoice_number")

  // Warranty info
  warrantyExpiry  DateTime? @map("warranty_expiry")
  warrantyStatus  String?   @map("warranty_status") // active, expired, claimed

  // Tracking
  createdBy       Int       @map("created_by")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // History tracking
  movements       SerialNumberMovement[]

  @@unique([businessId, serialNumber])
  @@index([serialNumber])
  @@index([status])
  @@index([currentLocationId])
  @@map("product_serial_numbers")
}

model SerialNumberMovement {
  id              Int      @id @default(autoincrement())
  serialNumberId  Int      @map("serial_number_id")
  serialNumber    ProductSerialNumber @relation(fields: [serialNumberId], references: [id])

  movementType    String   @map("movement_type") // purchase, sale, transfer_out, transfer_in, return_from_customer, return_to_supplier

  fromLocationId  Int?     @map("from_location_id")
  toLocationId    Int?     @map("to_location_id")

  referenceType   String?  @map("reference_type") // purchase, sale, transfer, return
  referenceId     Int?     @map("reference_id")

  notes           String?
  movedBy         Int      @map("moved_by")
  movedAt         DateTime @default(now()) @map("moved_at")

  @@map("serial_number_movements")
}

model Purchase {
  id              Int      @id @default(autoincrement())
  businessId      Int      @map("business_id")
  business        Business @relation(fields: [businessId], references: [id])

  referenceNo     String   @unique @map("reference_no")

  supplierId      Int      @map("supplier_id")
  supplier        Supplier @relation(fields: [supplierId], references: [id])

  locationId      Int      @map("location_id") // Receiving location (warehouse)
  location        BusinessLocation @relation(fields: [locationId], references: [id])

  purchaseDate    DateTime @map("purchase_date")
  status          String   // draft, ordered, received, partial, cancelled

  totalAmount     Decimal  @map("total_amount") @db.Decimal(20, 2)
  taxAmount       Decimal  @default(0) @map("tax_amount") @db.Decimal(20, 2)
  discountAmount  Decimal  @default(0) @map("discount_amount") @db.Decimal(20, 2)
  shippingCost    Decimal  @default(0) @map("shipping_cost") @db.Decimal(20, 2)

  paymentStatus   String   @default("pending") @map("payment_status") // pending, partial, paid
  paymentMethod   String?  @map("payment_method")

  notes           String?

  createdBy       Int      @map("created_by")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  items           PurchaseItem[]
  receipts        PurchaseReceipt[]

  @@map("purchases")
}

model PurchaseItem {
  id              Int      @id @default(autoincrement())
  purchaseId      Int      @map("purchase_id")
  purchase        Purchase @relation(fields: [purchaseId], references: [id])

  productId       Int      @map("product_id")
  product         Product  @relation(fields: [productId], references: [id])

  variationId     Int      @map("variation_id")
  variation       ProductVariation @relation(fields: [variationId], references: [id])

  orderedQty      Decimal  @map("ordered_qty") @db.Decimal(20, 2)
  receivedQty     Decimal  @default(0) @map("received_qty") @db.Decimal(20, 2)

  unitCost        Decimal  @map("unit_cost") @db.Decimal(20, 2)
  subtotal        Decimal  @db.Decimal(20, 2)

  requiresSerial  Boolean  @default(false) @map("requires_serial")

  @@map("purchase_items")
}

model PurchaseReceipt {
  id              Int      @id @default(autoincrement())
  purchaseId      Int      @map("purchase_id")
  purchase        Purchase @relation(fields: [purchaseId], references: [id])

  receiptNo       String   @unique @map("receipt_no")
  receivedDate    DateTime @map("received_date")

  status          String   // pending, completed

  receivedBy      Int      @map("received_by")
  completedAt     DateTime? @map("completed_at")

  notes           String?

  createdAt       DateTime @default(now()) @map("created_at")

  items           PurchaseReceiptItem[]

  @@map("purchase_receipts")
}

model PurchaseReceiptItem {
  id              Int      @id @default(autoincrement())
  receiptId       Int      @map("receipt_id")
  receipt         PurchaseReceipt @relation(fields: [receiptId], references: [id])

  purchaseItemId  Int      @map("purchase_item_id")

  productId       Int      @map("product_id")
  variationId     Int      @map("variation_id")

  receivedQty     Decimal  @map("received_qty") @db.Decimal(20, 2)
  condition       String   @default("new") // new, damaged, defective

  serialNumbers   Json?    @map("serial_numbers") // Array of scanned serials

  @@map("purchase_receipt_items")
}
```

---

## 2️⃣ SALES / POS MODULE
**Priority:** CRITICAL
**Estimated Time:** 4-6 days
**Status:** Not Started

### Features Required:

#### A. POS Interface
- Quick product search (exclude zero inventory items)
- Barcode scanning for product lookup
- **SERIAL NUMBER SCANNING FOR SERIALIZED ITEMS**
- Cart management
- Multiple payment methods
- Customer selection (optional)
- Print receipt

#### B. Serial Number Selection During Sale
**Critical Workflow:**

```typescript
// When adding serialized item to cart:
async function addSerializedItemToCart(productId, variationId, locationId) {
  // 1. Fetch available serial numbers at this location
  const availableSerials = await prisma.productSerialNumber.findMany({
    where: {
      productId,
      variationId,
      currentLocationId: locationId,
      status: 'in_stock',
      condition: { in: ['new', 'refurbished'] } // Don't sell damaged items
    },
    include: {
      product: true,
      variation: true
    }
  })

  if (availableSerials.length === 0) {
    throw new Error('No available stock with serial numbers')
  }

  // 2. Show scanning interface
  return {
    requiresSerialScan: true,
    availableCount: availableSerials.length,
    availableSerials // For validation
  }
}

// During serial scan:
async function validateScannedSerial(scannedSerial, expectedProduct) {
  const serial = await prisma.productSerialNumber.findUnique({
    where: {
      businessId_serialNumber: {
        businessId: currentBusinessId,
        serialNumber: scannedSerial
      }
    }
  })

  // Validation checks:
  if (!serial) return { valid: false, error: 'Serial number not found in system' }
  if (serial.productId !== expectedProduct.productId) return { valid: false, error: 'Serial belongs to different product' }
  if (serial.status !== 'in_stock') return { valid: false, error: `Serial is ${serial.status}` }
  if (serial.currentLocationId !== currentLocationId) return { valid: false, error: 'Serial not at this location' }

  return { valid: true, serial }
}
```

#### C. Sale Completion Logic
```typescript
async function completeSale(saleData) {
  return await prisma.$transaction(async (tx) => {
    // 1. Create sale record
    const sale = await tx.sale.create({ data: saleData })

    // 2. Process each item
    for (const item of saleData.items) {
      if (item.requiresSerial) {
        // Update each scanned serial number
        for (const serialNumber of item.scannedSerials) {
          await tx.productSerialNumber.update({
            where: { id: serialNumber.id },
            data: {
              status: 'sold',
              soldAt: sale.saleDate,
              soldPrice: item.unitPrice,
              soldTo: sale.customerName,
              invoiceNumber: sale.invoiceNo,
              currentLocationId: null // No longer at any location
            }
          })

          // Create movement record
          await tx.serialNumberMovement.create({
            data: {
              serialNumberId: serialNumber.id,
              movementType: 'sale',
              fromLocationId: item.locationId,
              toLocationId: null,
              referenceType: 'sale',
              referenceId: sale.id,
              movedBy: sale.createdBy,
              movedAt: sale.saleDate
            }
          })
        }
      }

      // 3. Update variation_location_details
      await updateStock({
        locationId: item.locationId,
        variationId: item.variationId,
        qtyChange: -item.quantity // Deduct
      })

      // 4. Create stock transaction
      await createStockTransaction({
        type: 'sale',
        locationId: item.locationId,
        productId: item.productId,
        variationId: item.variationId,
        qtyChange: -item.quantity,
        referenceType: 'sale',
        referenceId: sale.id
      })

      // 5. Audit log
      await createAuditLog({
        action: 'sale_completed',
        entityType: 'sale',
        entityId: sale.id,
        metadata: {
          productId: item.productId,
          quantity: item.quantity,
          serialNumbers: item.scannedSerials?.map(s => s.serialNumber)
        }
      })
    }

    return sale
  })
}
```

#### D. Zero Inventory Prevention
```typescript
// In product search API:
const products = await prisma.product.findMany({
  where: {
    businessId,
    isActive: true,
    variations: {
      some: {
        variationLocationDetails: {
          some: {
            locationId: currentLocationId,
            qtyAvailable: { gt: 0 } // ONLY products with stock > 0
          }
        }
      }
    }
  }
})
```

---

## 3️⃣ STOCK TRANSFERS (Branch to Branch)
**Priority:** CRITICAL
**Estimated Time:** 3-4 days
**Status:** Not Started

### Two-Step Transfer Process

#### Step 1: Transfer Request/Send
**Source Branch initiates:**

```typescript
interface StockTransfer {
  id: number
  transferNo: string

  fromLocationId: number // Source branch/warehouse
  toLocationId: number   // Destination branch

  status: 'pending' | 'in_transit' | 'received' | 'partially_received' | 'rejected'

  requestedBy: number
  requestedAt: DateTime

  sentBy: number
  sentAt: DateTime

  items: StockTransferItem[]
}

interface StockTransferItem {
  productId: number
  variationId: number
  requestedQty: number
  sentQty: number
  receivedQty: number

  requiresSerial: boolean
  sentSerials: string[] // Scanned during send
  receivedSerials: string[] // Verified during receive
}
```

**Send Logic:**
```typescript
async function sendTransfer(transferId) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true }
  })

  return await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      if (item.requiresSerial) {
        // SCAN EACH SERIAL NUMBER
        // Update serial status to 'in_transit'
        await tx.productSerialNumber.updateMany({
          where: {
            serialNumber: { in: item.sentSerials },
            currentLocationId: transfer.fromLocationId
          },
          data: {
            status: 'in_transit',
            currentLocationId: null // Temporarily no location
          }
        })

        // Create movement records
        for (const serial of item.sentSerials) {
          await createSerialMovement({
            serialNumber: serial,
            movementType: 'transfer_out',
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            referenceType: 'stock_transfer',
            referenceId: transferId
          })
        }
      }

      // IMPORTANT: DO NOT deduct inventory yet!
      // Stock remains at source until destination confirms receipt
    }

    await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'in_transit',
        sentBy: currentUserId,
        sentAt: new Date()
      }
    })

    // Audit log
    await createAuditLog({
      action: 'transfer_sent',
      entityType: 'stock_transfer',
      entityId: transferId,
      metadata: transfer
    })
  })
}
```

#### Step 2: Receive/Approve Transfer
**Destination Branch verifies:**

```typescript
async function receiveTransfer(transferId, receivedItems) {
  return await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true }
    })

    for (const receivedItem of receivedItems) {
      const sentItem = transfer.items.find(i => i.id === receivedItem.itemId)

      if (sentItem.requiresSerial) {
        // SCAN AND VERIFY EACH SERIAL
        // Check: received serials match sent serials
        const allMatch = receivedItem.scannedSerials.every(
          s => sentItem.sentSerials.includes(s)
        )

        if (!allMatch) {
          throw new Error('Received serials do not match sent serials')
        }

        // Update serial status to 'in_stock' at new location
        await tx.productSerialNumber.updateMany({
          where: {
            serialNumber: { in: receivedItem.scannedSerials }
          },
          data: {
            status: 'in_stock',
            currentLocationId: transfer.toLocationId
          }
        })

        // Create movement records
        for (const serial of receivedItem.scannedSerials) {
          await createSerialMovement({
            serialNumber: serial,
            movementType: 'transfer_in',
            fromLocationId: transfer.fromLocationId,
            toLocationId: transfer.toLocationId,
            referenceType: 'stock_transfer',
            referenceId: transferId
          })
        }
      }

      // NOW update inventory at BOTH locations
      // DEDUCT from source
      await updateStock({
        locationId: transfer.fromLocationId,
        variationId: sentItem.variationId,
        qtyChange: -receivedItem.receivedQty
      })

      // ADD to destination
      await updateStock({
        locationId: transfer.toLocationId,
        variationId: sentItem.variationId,
        qtyChange: +receivedItem.receivedQty
      })

      // Stock transactions
      await createStockTransaction({
        type: 'transfer_out',
        locationId: transfer.fromLocationId,
        variationId: sentItem.variationId,
        qtyChange: -receivedItem.receivedQty,
        referenceType: 'stock_transfer',
        referenceId: transferId
      })

      await createStockTransaction({
        type: 'transfer_in',
        locationId: transfer.toLocationId,
        variationId: sentItem.variationId,
        qtyChange: +receivedItem.receivedQty,
        referenceType: 'stock_transfer',
        referenceId: transferId
      })
    }

    // Update transfer status
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'received',
        receivedBy: currentUserId,
        receivedAt: new Date()
      }
    })

    // Audit log
    await createAuditLog({
      action: 'transfer_received',
      entityType: 'stock_transfer',
      entityId: transferId,
      metadata: { receivedItems }
    })
  })
}
```

---

## 4️⃣ CUSTOMER REFUNDS / RETURNS
**Priority:** HIGH
**Estimated Time:** 2-3 days
**Status:** Not Started

### Features:

#### A. Return Initiation
- Link to original sale
- Select items to return
- Specify reason (defective, wrong item, customer changed mind, etc.)
- Condition check (resellable, damaged, needs repair)
- **SCAN SERIAL NUMBERS** if applicable

#### B. Return Logic
```typescript
async function processReturn(returnData) {
  return await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: returnData.saleId },
      include: { items: true }
    })

    for (const returnItem of returnData.items) {
      if (returnItem.requiresSerial) {
        // Find and update serial number
        await tx.productSerialNumber.update({
          where: {
            businessId_serialNumber: {
              businessId: currentBusinessId,
              serialNumber: returnItem.scannedSerial
            }
          },
          data: {
            status: returnItem.condition === 'resellable' ? 'in_stock' : 'damaged',
            currentLocationId: returnData.returnLocationId,
            soldAt: null,
            soldTo: null,
            invoiceNumber: null
          }
        })

        await createSerialMovement({
          serialNumber: returnItem.scannedSerial,
          movementType: 'return_from_customer',
          fromLocationId: null,
          toLocationId: returnData.returnLocationId,
          referenceType: 'customer_return',
          referenceId: returnRecord.id
        })
      }

      // Update stock if resellable
      if (returnItem.condition === 'resellable') {
        await updateStock({
          locationId: returnData.returnLocationId,
          variationId: returnItem.variationId,
          qtyChange: +returnItem.quantity
        })
      }

      await createStockTransaction({
        type: 'customer_return',
        locationId: returnData.returnLocationId,
        variationId: returnItem.variationId,
        qtyChange: +returnItem.quantity,
        referenceType: 'customer_return',
        referenceId: returnRecord.id
      })
    }

    // Create refund record
    // Process payment refund
    // Audit log
  })
}
```

---

## 5️⃣ SUPPLIER RETURNS (Warranty/Defective)
**Priority:** HIGH
**Estimated Time:** 2-3 days
**Status:** Not Started

### Features:

#### A. Return to Supplier
- Select items from purchase history
- Specify reason (warranty, defective, damaged on arrival)
- **SCAN SERIAL NUMBERS** to identify specific units
- Track return status (sent, accepted, rejected, replaced)

#### B. Logic
```typescript
async function returnToSupplier(returnData) {
  return await prisma.$transaction(async (tx) => {
    for (const item of returnData.items) {
      if (item.requiresSerial) {
        await tx.productSerialNumber.update({
          where: { serialNumber: item.scannedSerial },
          data: {
            status: 'returned_to_supplier',
            currentLocationId: null
          }
        })

        await createSerialMovement({
          serialNumber: item.scannedSerial,
          movementType: 'return_to_supplier',
          fromLocationId: returnData.fromLocationId,
          toLocationId: null,
          referenceType: 'supplier_return',
          referenceId: returnRecord.id
        })
      }

      // Deduct from inventory
      await updateStock({
        locationId: returnData.fromLocationId,
        variationId: item.variationId,
        qtyChange: -item.quantity
      })

      await createStockTransaction({
        type: 'return_to_supplier',
        locationId: returnData.fromLocationId,
        variationId: item.variationId,
        qtyChange: -item.quantity,
        referenceType: 'supplier_return',
        referenceId: returnRecord.id
      })
    }

    // Audit log
  })
}
```

---

## 🔧 TECHNICAL IMPLEMENTATION CHECKLIST

### Phase 1: Foundation (Week 1)
- [ ] Add database schema for all new tables
- [ ] Run Prisma migration
- [ ] Create audit logging utility functions
- [ ] Create stock update utility functions
- [ ] Create serial number tracking utilities

### Phase 2: Purchases (Week 2)
- [ ] Purchase Order CRUD API
- [ ] Purchase Receipt/GRN API
- [ ] Serial number scanning component
- [ ] Barcode scanner integration
- [ ] Purchase list UI
- [ ] GRN workflow UI
- [ ] Serial scanning UI

### Phase 3: Sales/POS (Week 3)
- [ ] POS interface design
- [ ] Product search (zero inventory exclusion)
- [ ] Serial number selection during sale
- [ ] Cart management
- [ ] Payment processing
- [ ] Receipt printing
- [ ] Sales history

### Phase 4: Transfers (Week 4)
- [ ] Transfer request API
- [ ] Transfer send API (with serial scan)
- [ ] Transfer receive API (with verification)
- [ ] Transfer list UI
- [ ] Send workflow UI
- [ ] Receive workflow UI
- [ ] Transfer status tracking

### Phase 5: Returns (Week 5)
- [ ] Customer return API
- [ ] Supplier return API
- [ ] Return workflow UI
- [ ] Refund processing
- [ ] Warranty tracking

### Phase 6: Reporting & Analytics (Week 6)
- [ ] Inventory valuation report
- [ ] Stock movement report
- [ ] Serial number tracking report
- [ ] Low stock alerts
- [ ] Expiring warranty alerts
- [ ] Audit trail viewer

---

## 🎯 KEY BUSINESS RULES

### Serial Number Rules:
1. **Unique per business** - No duplicate serial numbers
2. **One location at a time** - Serial can only be at one location
3. **Status tracking** - in_stock, sold, in_transit, returned, damaged, lost
4. **Complete history** - Every movement logged
5. **Scan required** - Cannot sell/transfer serialized items without scanning

### Stock Update Rules:
1. **No direct updates** - All changes via API endpoints only
2. **Transaction-based** - Stock change + audit log in single transaction
3. **Negative stock prevention** - Configurable (warn or block)
4. **Location-based** - Every stock quantity tied to a location

### Transfer Rules:
1. **Two-step process** - Send → Receive (no auto-deduct)
2. **Scan both ends** - Serial scan on send AND receive
3. **Quantity verification** - Must match sent vs received
4. **Approval required** - Destination must approve receipt

### Audit Trail Rules:
1. **Immutable** - Never update or delete audit logs
2. **Complete metadata** - All relevant details in JSON
3. **User tracking** - Always log who did what
4. **Timestamp everything** - Exact date/time of every action

---

## 📊 REPORTS & DASHBOARDS

### Essential Reports:
1. **Stock Summary by Location** - Current qty, value per location
2. **Product Movement History** - All transactions for a product
3. **Serial Number Tracker** - Where is serial #XYZ?
4. **Low Stock Alert** - Products below reorder level
5. **Aging Inventory** - Products sitting too long
6. **Transfer Status** - Pending, in-transit transfers
7. **Warranty Expiry** - Upcoming warranty expirations
8. **Audit Trail** - Filter by user, date, action, product
9. **Sales by Location** - Performance per branch
10. **Purchase Order Status** - Pending POs, late deliveries

---

## 🔒 SECURITY & PERMISSIONS

### New Permissions Needed:
```typescript
PERMISSIONS = {
  // Purchases
  PURCHASE_CREATE: 'purchase.create',
  PURCHASE_VIEW: 'purchase.view',
  PURCHASE_RECEIVE: 'purchase.receive',
  PURCHASE_DELETE: 'purchase.delete',

  // Sales
  SELL_CREATE: 'sell.create',
  SELL_VIEW: 'sell.view',
  SELL_DELETE: 'sell.delete',

  // Transfers
  TRANSFER_REQUEST: 'transfer.request',
  TRANSFER_SEND: 'transfer.send',
  TRANSFER_RECEIVE: 'transfer.receive',
  TRANSFER_REJECT: 'transfer.reject',

  // Returns
  CUSTOMER_RETURN_CREATE: 'customer_return.create',
  SUPPLIER_RETURN_CREATE: 'supplier_return.create',
  RETURN_APPROVE: 'return.approve',

  // Serial Numbers
  SERIAL_NUMBER_VIEW: 'serial_number.view',
  SERIAL_NUMBER_TRACK: 'serial_number.track',

  // Reports
  REPORT_STOCK: 'report.stock',
  REPORT_MOVEMENT: 'report.movement',
  REPORT_AUDIT: 'report.audit',
}
```

---

## 🧪 TESTING STRATEGY

### Critical Test Scenarios:

1. **Purchase Receipt with Serials**
   - Scan 10 serials
   - Verify all created in DB
   - Verify stock increased by 10
   - Verify audit log created

2. **Sale with Serial Selection**
   - Search product
   - Only show items with stock > 0
   - Scan serial from available list
   - Verify serial marked as sold
   - Verify stock decreased
   - Verify cannot sell same serial again

3. **Transfer Workflow**
   - Branch A sends 5 serials to Branch B
   - Verify stock NOT deducted yet
   - Verify serials marked 'in_transit'
   - Branch B scans and receives 5 serials
   - Verify stock deducted from A
   - Verify stock added to B
   - Verify serials now at Branch B

4. **Customer Return**
   - Return serialized item from sale
   - Scan serial number
   - Verify serial back in stock
   - Verify stock increased
   - Verify can sell again

5. **Supplier Return**
   - Return defective serial to supplier
   - Verify serial marked 'returned_to_supplier'
   - Verify stock decreased
   - Verify cannot sell this serial

6. **Tamper Prevention**
   - Try to manually update qty_available in DB
   - Verify audit log shows direct update (if we add trigger)
   - Try to sell zero-stock item
   - Verify error thrown

---

## 📱 UI/UX REQUIREMENTS

### Barcode Scanner Integration:
- **Libraries:** `html5-qrcode` or `quagga.js`
- **Features:**
  - Webcam scanning
  - Manual entry fallback
  - Beep on successful scan
  - Visual feedback (green checkmark)
  - Error handling (red X, error message)
  - Auto-focus on next item

### Serial Number Scanning UI:
```
┌─────────────────────────────────────┐
│ Scanning: Dell 24" Monitor          │
│ Expected: 10 units                   │
│ Scanned: 7 / 10 ✅                   │
├─────────────────────────────────────┤
│ [📷 Scan Mode Active]               │
│                                      │
│ Recent Scans:                        │
│ ✅ SN1234567890 - 10:23 AM          │
│ ✅ SN0987654321 - 10:23 AM          │
│ ✅ SN1122334455 - 10:24 AM          │
│                                      │
│ [Scan Next] [Manual Entry] [Done]   │
└─────────────────────────────────────┘
```

### Transfer Workflow UI:
```
Step 1: Request Transfer (Branch A)
┌─────────────────────────────────────┐
│ From: Warehouse                      │
│ To: Tuguegarao Branch                │
│                                      │
│ Items to Transfer:                   │
│ • Dell Monitor x5 (needs scanning)  │
│ • Mouse x10 (no serial required)     │
│                                      │
│ [Submit Request]                     │
└─────────────────────────────────────┘

Step 2: Send Transfer (Warehouse)
┌─────────────────────────────────────┐
│ Transfer #TR-001                     │
│ Status: Pending Send                 │
│                                      │
│ Scan Items Before Sending:           │
│ Dell Monitor: 0/5 scanned            │
│ [Start Scanning]                     │
│                                      │
│ Mouse: Ready (10 units)              │
│                                      │
│ [Complete Send]                      │
└─────────────────────────────────────┘

Step 3: Receive Transfer (Tuguegarao)
┌─────────────────────────────────────┐
│ Transfer #TR-001                     │
│ Status: In Transit                   │
│                                      │
│ Verify Received Items:               │
│ Dell Monitor: 0/5 verified           │
│ [Start Verification]                 │
│                                      │
│ Mouse: Qty Received: [____]          │
│                                      │
│ [Accept Transfer] [Reject]           │
└─────────────────────────────────────┘
```

---

## 🎓 KNOWLEDGE TRANSFER

### For Future Claude Sessions:
1. **Always read this file first** before working on inventory features
2. **Follow the architecture** - Don't bypass stock update functions
3. **Audit everything** - Every inventory change MUST be logged
4. **Test serial scanning** - Critical for integrity
5. **Respect transfer workflow** - Two-step process is mandatory

### Key Files to Reference:
- `INVENTORY-AUDIT-TRAIL-STATUS.md` - Current audit status
- `OPENING-STOCK-LOCK-GUIDE.md` - Opening stock rules
- `PHYSICAL-INVENTORY-COUNT-GUIDE.md` - Bulk update process
- `RBAC-QUICK-REFERENCE.md` - Permission checking

---

## 📌 CURRENT STATUS & NEXT STEPS

### ✅ Completed:
- Product management with serial number flag
- Opening stock (needs audit logging)
- Inventory corrections with audit
- Physical inventory count
- Location-based access control

### 🚧 In Progress:
- Opening stock audit logging (URGENT)

### 📋 Next Immediate Tasks:
1. Add audit logging to opening stock
2. Create database migration for new tables
3. Build purchases module (start with PO creation)
4. Implement serial number scanning component
5. Build GRN workflow

### 🎯 Long-term Goals:
- Complete all 5 modules (purchases, sales, transfers, returns)
- Build comprehensive reporting
- Add mobile app for warehouse scanning
- Integrate with accounting system
- Multi-currency support
- Advanced analytics & forecasting

---

**END OF MASTER ROADMAP**
**Version:** 1.0
**Last Updated:** 2025-10-06
**Status:** Blueprint Complete - Ready for Implementation

**IMPORTANT:** Bookmark this file! Every Claude session working on inventory should read this FIRST!
