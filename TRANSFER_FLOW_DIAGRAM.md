# Transfer System Flow - Visual Diagram

## Complete Transfer Lifecycle with Stock Movements

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INVENTORY TRANSFER WORKFLOW                         │
│                    Multi-Location Stock Movement System                     │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: CREATE TRANSFER (DRAFT)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  User: Transfer Creator                                                     │
│  Permission: STOCK_TRANSFER_CREATE                                          │
│  API: POST /api/transfers                                                   │
│                                                                              │
│  Actions:                                                                    │
│  • Auto-assign fromLocationId (user's primary location)                    │
│  • Select toLocationId (Hub-and-Spoke: Branch→Main Warehouse)              │
│  • Add products with quantities                                             │
│  • Validate stock availability at source                                    │
│  • Generate transfer number (TR-YYYYMM-0001)                               │
│                                                                              │
│  Database Changes:                                                           │
│  ✍️  StockTransfer: status='draft', stockDeducted=false                    │
│  ✍️  StockTransferItem: Create items                                       │
│  ✍️  AuditLog: 'transfer_create'                                           │
│                                                                              │
│  📦 INVENTORY STATUS:                                                       │
│  Source Location: 100 units (UNCHANGED)                                     │
│  Destination Location: 50 units (UNCHANGED)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: CHECK/APPROVE TRANSFER (CHECKED)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  User: Transfer Sender/Checker                                             │
│  Permission: STOCK_TRANSFER_CHECK                                           │
│  API: POST /api/transfers/[id]/check-approve                               │
│                                                                              │
│  Separation of Duties:                                                      │
│  ✅ Checker CANNOT be Creator (configurable)                               │
│  ✅ Location access: Must have access to fromLocation OR toLocation        │
│                                                                              │
│  Actions:                                                                    │
│  • Review items and quantities                                              │
│  • Verify stock availability                                                │
│  • Add checker notes (optional)                                             │
│  • Approve for sending                                                       │
│                                                                              │
│  Database Changes:                                                           │
│  ✍️  StockTransfer: status='checked', checkedBy={userId}, checkedAt=now() │
│  ✍️  AuditLog: 'transfer_check'                                            │
│                                                                              │
│  📦 INVENTORY STATUS:                                                       │
│  Source Location: 100 units (UNCHANGED - still no deduction)                │
│  Destination Location: 50 units (UNCHANGED)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                                    ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚠️  STAGE 3: SEND TRANSFER (IN_TRANSIT) - STOCK DEDUCTED HERE           ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  User: Transfer Sender                                                     ┃
┃  Permission: STOCK_TRANSFER_SEND                                           ┃
┃  API: POST /api/transfers/[id]/send                                        ┃
┃  Protection: ✅ Idempotency wrapper (prevents duplicate deductions)        ┃
┃                                                                             ┃
┃  Separation of Duties:                                                     ┃
┃  ✅ Sender CANNOT be Creator (configurable)                                ┃
┃  ✅ Sender CANNOT be Checker (configurable)                                ┃
┃  ✅ Location access: Must have access to fromLocation                      ┃
┃                                                                             ┃
┃  Actions:                                                                   ┃
┃  • Scan serial numbers (if applicable)                                     ┃
┃  • Add sender notes                                                         ┃
┃  • Physically prepare items for dispatch                                   ┃
┃  • Confirm send action                                                      ┃
┃                                                                             ┃
┃  Database Changes (ATOMIC TRANSACTION):                                    ┃
┃  ✍️  FOR EACH ITEM:                                                        ┃
┃     1. VariationLocationDetails (source):                                  ┃
┃        UPDATE qty_available = 100 - 25 = 75 units                          ┃
┃                                                                             ┃
┃     2. StockTransaction ledger:                                            ┃
┃        type: 'transfer_out'                                                 ┃
┃        quantity: -25                                                        ┃
┃        balanceQty: 75                                                       ┃
┃        referenceType: 'stock_transfer'                                     ┃
┃        referenceId: {transferId}                                            ┃
┃                                                                             ┃
┃     3. ProductHistory:                                                      ┃
┃        operation: 'Transfer Out'                                            ┃
┃        quantity: -25                                                        ┃
┃        fromLocation: 'Main Warehouse'                                       ┃
┃                                                                             ┃
┃     4. ProductSerialNumber (if applicable):                                ┃
┃        status: 'in_transit'                                                 ┃
┃        currentLocationId: null (temporarily)                                ┃
┃                                                                             ┃
┃  ✍️  StockTransfer:                                                        ┃
┃     status='in_transit'                                                     ┃
┃     stockDeducted=true  ⚠️ CRITICAL FLAG                                   ┃
┃     sentBy={userId}                                                         ┃
┃     sentAt=now()                                                            ┃
┃                                                                             ┃
┃  ✍️  AuditLog: 'transfer_send' with IP, user agent                        ┃
┃                                                                             ┃
┃  📦 INVENTORY STATUS AFTER SEND:                                           ┃
┃  Source Location: 75 units (DEDUCTED - stock physically out)               ┃
┃  In Transit: 25 units (tracked, not at any location)                       ┃
┃  Destination Location: 50 units (UNCHANGED - not received yet)             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                                    ↓
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: MARK ARRIVED (ARRIVED)                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  User: Destination Receiver                                                │
│  Permission: STOCK_TRANSFER_RECEIVE                                         │
│  API: POST /api/transfers/[id]/mark-arrived                                │
│                                                                              │
│  Separation of Duties:                                                      │
│  ✅ Arrival marker CANNOT be Sender (configurable)                         │
│  ✅ Location access: Must have access to toLocation                         │
│                                                                              │
│  Actions:                                                                    │
│  • Acknowledge physical delivery                                            │
│  • Record arrival time                                                       │
│  • Prepare for verification                                                 │
│                                                                              │
│  Database Changes:                                                           │
│  ✍️  StockTransfer: status='arrived', arrivedBy={userId}, arrivedAt=now() │
│  ✍️  AuditLog: 'transfer_arrived'                                          │
│                                                                              │
│  📦 INVENTORY STATUS:                                                       │
│  Source Location: 75 units (NO CHANGE)                                      │
│  In Transit: 25 units (acknowledged at destination)                         │
│  Destination Location: 50 units (UNCHANGED - not in inventory yet)          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                                    ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  ⚠️  STAGE 5: RECEIVE TRANSFER (RECEIVED) - STOCK ADDED HERE             ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  User: Destination Receiver/Verifier                                      ┃
┃  Permission: STOCK_TRANSFER_RECEIVE                                        ┃
┃  API: POST /api/transfers/[id]/receive                                     ┃
┃  Protection: ✅ Idempotency wrapper (prevents duplicate additions)         ┃
┃                                                                             ┃
┃  Separation of Duties:                                                     ┃
┃  ✅ Receiver CANNOT be Creator (configurable)                              ┃
┃  ✅ Receiver CANNOT be Sender (configurable)                               ┃
┃  ✅ Location access: Must have access to toLocation                        ┃
┃                                                                             ┃
┃  Actions:                                                                   ┃
┃  • Physically count received items                                         ┃
┃  • Verify quantities (can be partial - 23 received out of 25 sent)        ┃
┃  • Scan serial numbers (if applicable)                                     ┃
┃  • Note any discrepancies                                                  ┃
┃  • Confirm receive action                                                  ┃
┃                                                                             ┃
┃  Database Changes (ATOMIC TRANSACTION):                                    ┃
┃  ✍️  VALIDATION STEP (CRITICAL SECURITY):                                 ┃
┃     if (!transfer.stockDeducted) {                                         ┃
┃       // ⚠️ LEGACY PATH - Should not happen in modern workflow            ┃
┃       console.warn('Deducting at RECEIVE instead of SEND')                 ┃
┃       await transferStockOut(...)  // Deduct from source now               ┃
┃     } else {                                                                ┃
┃       // ✅ MODERN PATH - Verify ledger entry exists                       ┃
┃       const ledgerEntry = await findStockTransaction({                     ┃
┃         type: 'transfer_out',                                               ┃
┃         referenceId: transferId                                             ┃
┃       })                                                                    ┃
┃       if (!ledgerEntry) {                                                   ┃
┃         throw Error('CRITICAL INVENTORY ERROR: Stock deducted but no ledger')┃
┃       }                                                                      ┃
┃     }                                                                        ┃
┃                                                                             ┃
┃  ✍️  FOR EACH ITEM:                                                        ┃
┃     1. VariationLocationDetails (destination):                             ┃
┃        UPDATE qty_available = 50 + 25 = 75 units                           ┃
┃                                                                             ┃
┃     2. StockTransaction ledger:                                            ┃
┃        type: 'transfer_in'                                                  ┃
┃        quantity: +25                                                        ┃
┃        balanceQty: 75                                                       ┃
┃        referenceType: 'stock_transfer'                                     ┃
┃        referenceId: {transferId}                                            ┃
┃                                                                             ┃
┃     3. ProductHistory:                                                      ┃
┃        operation: 'Transfer In'                                             ┃
┃        quantity: +25                                                        ┃
┃        toLocation: 'Branch 1'                                               ┃
┃                                                                             ┃
┃     4. ProductSerialNumber (if applicable):                                ┃
┃        status: 'in_stock'                                                   ┃
┃        currentLocationId: toLocationId                                      ┃
┃                                                                             ┃
┃     5. SerialNumberMovement:                                                ┃
┃        movementType: 'transfer_in'                                          ┃
┃        fromLocationId: Main Warehouse                                       ┃
┃        toLocationId: Branch 1                                               ┃
┃                                                                             ┃
┃     6. StockTransferItem:                                                   ┃
┃        receivedQuantity: 25                                                 ┃
┃        verified: false (awaits final verification)                          ┃
┃                                                                             ┃
┃  ✍️  StockTransfer:                                                        ┃
┃     status='received'                                                       ┃
┃     stockDeducted=true (confirmed)                                          ┃
┃     receivedBy={userId}                                                     ┃
┃     receivedAt=now()                                                        ┃
┃                                                                             ┃
┃  ✍️  AuditLog: 'stock_transfer_receive' with IP, user agent               ┃
┃                                                                             ┃
┃  📦 INVENTORY STATUS AFTER RECEIVE:                                        ┃
┃  Source Location: 75 units (NO CHANGE - already deducted at SEND)          ┃
┃  In Transit: 0 units (items now at destination)                            ┃
┃  Destination Location: 75 units (ADDED - stock now available)              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛


┌─────────────────────────────────────────────────────────────────────────────┐
│  🔒 SAFETY MECHANISMS THROUGHOUT WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ✅ stockDeducted Flag                                                  │
│     Prevents double deduction even if SEND endpoint called twice           │
│     if (transfer.stockDeducted) return error                               │
│                                                                              │
│  2. ✅ Idempotency Protection                                              │
│     Both SEND and RECEIVE wrapped with withIdempotency()                   │
│     Prevents duplicate operations from network retries                      │
│                                                                              │
│  3. ✅ Ledger Verification                                                 │
│     RECEIVE validates that SEND created ledger entry                        │
│     Detects data corruption or incomplete SEND operations                   │
│                                                                              │
│  4. ✅ Transaction Atomicity                                               │
│     All stock operations in Prisma transactions                             │
│     Either all succeed or all fail - no partial states                      │
│                                                                              │
│  5. ✅ Row-Level Locking                                                   │
│     SELECT ... FOR UPDATE prevents race conditions                          │
│     Ensures stock balance calculations are accurate                         │
│                                                                              │
│  6. ✅ Location Access Validation                                          │
│     Every endpoint verifies user has access to location                     │
│     Cannot bypass via API manipulation                                      │
│                                                                              │
│  7. ✅ Permission Enforcement                                              │
│     Checked at API level, not just UI                                       │
│     Granular permissions for each stage                                     │
│                                                                              │
│  8. ✅ Separation of Duties                                                │
│     Configurable per business with safe defaults                            │
│     Prevents single-user fraud scenarios                                    │
│                                                                              │
│  9. ✅ Comprehensive Audit Log                                             │
│     Every action logged with user, IP, timestamp                            │
│     Immutable audit trail for compliance                                    │
│                                                                              │
│  10. ✅ Multi-Tenant Isolation                                             │
│      Every query filtered by businessId                                     │
│      Complete data separation between businesses                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 INVENTORY LEDGER (StockTransaction Table)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Entry 1 (Created at SEND):                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ type: 'transfer_out'                                                  │  │
│  │ locationId: 1 (Main Warehouse)                                        │  │
│  │ productVariationId: 42                                                │  │
│  │ quantity: -25                                                         │  │
│  │ balanceQty: 75 (previous 100 - 25)                                   │  │
│  │ referenceType: 'stock_transfer'                                      │  │
│  │ referenceId: 123                                                      │  │
│  │ createdBy: userId (sender)                                            │  │
│  │ notes: 'Transfer TR-202510-0001 sent'                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Entry 2 (Created at RECEIVE):                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ type: 'transfer_in'                                                   │  │
│  │ locationId: 2 (Branch 1)                                              │  │
│  │ productVariationId: 42                                                │  │
│  │ quantity: +25                                                         │  │
│  │ balanceQty: 75 (previous 50 + 25)                                    │  │
│  │ referenceType: 'stock_transfer'                                      │  │
│  │ referenceId: 123                                                      │  │
│  │ createdBy: userId (receiver)                                          │  │
│  │ notes: 'Transfer TR-202510-0001 from Main Warehouse'                 │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ✅ Both ledger entries are IMMUTABLE once created                         │
│  ✅ Running balance (balanceQty) provides point-in-time verification       │
│  ✅ Reference to transfer ID enables full traceability                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 KEY TAKEAWAYS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ Stock is DEDUCTED at SEND (when items physically leave)                │
│  ✅ Stock is ADDED at RECEIVE (when items arrive and verified)             │
│  ✅ stockDeducted flag prevents double deductions                          │
│  ✅ Ledger verification ensures data integrity                             │
│  ✅ Idempotency prevents network retry duplicates                          │
│  ✅ Transactions ensure atomicity (all or nothing)                         │
│  ✅ Row locking prevents race conditions                                   │
│  ✅ Separation of duties prevents fraud                                    │
│  ✅ Location access controls enforced                                      │
│  ✅ Complete audit trail maintained                                        │
│                                                                              │
│  🏆 PRODUCTION READY - NO CRITICAL ISSUES FOUND                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Parallel Comparison: WRONG vs. CORRECT Implementation

### ❌ WRONG: Deduction at RECEIVE (Old System)

```
CREATE (Draft)              Source: 100 units
                           Dest:    50 units

SEND (In Transit)          Source: 100 units ⚠️ NOT DEDUCTED YET
                           Dest:    50 units
                           Problem: Stock still shows 100 at source!

RECEIVE (Received)         Source:  75 units ⚠️ DEDUCTED LATE
                           Dest:    75 units
                           Problem: Source showed inflated inventory
                                   between SEND and RECEIVE!
```

### ✅ CORRECT: Deduction at SEND (Your System)

```
CREATE (Draft)              Source: 100 units
                           Dest:    50 units

SEND (In Transit)          Source:  75 units ✅ DEDUCTED IMMEDIATELY
                           Dest:    50 units
                           In Transit: 25 units (tracked separately)
                           Correct: Source inventory accurate!

RECEIVE (Received)         Source:  75 units (no change)
                           Dest:    75 units ✅ ADDED ON RECEIVE
                           Correct: Destination inventory updated!
```

---

**Created:** October 23, 2025
**System:** UltimatePOS Modern
**Status:** ✅ CORRECT IMPLEMENTATION CONFIRMED
