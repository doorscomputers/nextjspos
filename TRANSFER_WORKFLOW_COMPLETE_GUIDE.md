# Stock Transfer Workflow - Complete Guide

## Overview

The stock transfer process involves **4 STAGES** and requires **4 DIFFERENT USERS** (separation of duties for fraud prevention).

---

## The 4-Stage Transfer Workflow

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   STAGE 1   │      │   STAGE 2   │      │   STAGE 3   │      │   STAGE 4   │
│   CREATE    │ ───> │    CHECK    │ ───> │    SEND     │ ───> │   RECEIVE   │
│   (Draft)   │      │  (Approve)  │      │ (Deduct)    │      │   (Add)     │
└─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
     USER 1               USER 2               USER 3              USER 4
  @ Origin Loc        @ Origin Loc         @ Origin Loc        @ Destination
```

---

## Stage-by-Stage Breakdown

### **STAGE 1: CREATE (Draft)**
- **Status:** `draft`
- **Who:** Transfer Creator (User 1)
- **Location:** Must be at ORIGIN location (From Location)
- **Action:** Creates transfer request, selects items and quantities
- **Inventory Impact:** ❌ NO stock deduction yet
- **Permission Required:** `STOCK_TRANSFER_CREATE`
- **API Endpoint:** `POST /api/transfers`

**What happens:**
1. User selects "From Location" (auto-assigned to their location)
2. User selects "To Location" (destination)
3. User adds products and quantities
4. Transfer is saved as "Draft"
5. ✅ Transfer created successfully

---

### **STAGE 2: CHECK & APPROVE (Pending Check → Checked)**
- **Status:** `pending_check` → `checked`
- **Who:** Transfer Checker (User 2) - **MUST BE DIFFERENT from User 1**
- **Location:** Must be at ORIGIN location (same as creator)
- **Action:** Verifies items physically match the transfer request
- **Inventory Impact:** ❌ Still NO stock deduction
- **Permission Required:** `STOCK_TRANSFER_CHECK`
- **API Endpoint:** `POST /api/transfers/{id}/check-approve`

**What happens:**
1. Checker reviews the transfer request
2. Physically verifies items exist and quantities are correct
3. Either:
   - ✅ **Approves** → Transfer moves to "Checked" status
   - ❌ **Rejects** → Transfer goes back to "Draft" or "Cancelled"

**Separation of Duties Check:**
- System prevents creator from checking their own transfer
- Error: "You cannot check your own transfer. Only another user at this location can check it."

---

### **STAGE 3: SEND (Checked → In Transit)**
- **Status:** `checked` → `in_transit`
- **Who:** Transfer Sender (User 3) - **MUST BE DIFFERENT from Users 1 & 2**
- **Location:** Must be at ORIGIN location
- **Action:** Physically packs and dispatches items
- **Inventory Impact:** 🔴 **STOCK DEDUCTED FROM ORIGIN LOCATION**
- **Permission Required:** `STOCK_TRANSFER_SEND`
- **API Endpoint:** `POST /api/transfers/{id}/send`

**What happens:**
1. Sender physically prepares items for shipment
2. Marks transfer as "Sent"
3. 🔴 **CRITICAL:** Stock is **deducted** from origin location
4. `stockDeducted` flag set to `true` (prevents double-deduction)
5. Serial numbers (if any) marked as `in_transit`
6. Product history records: `TRANSFER_OUT`

**Separation of Duties Check:**
- System prevents creator or checker from sending
- Error: "You cannot send this transfer. Only a different user at this location can send it."

---

### **STAGE 4: RECEIVE (In Transit → Received/Completed)**
- **Status:** `in_transit` → `received`
- **Who:** Transfer Receiver (User 4) - **MUST BE AT DESTINATION LOCATION**
- **Location:** Must be at DESTINATION location (To Location)
- **Action:** Receives shipment and verifies items
- **Inventory Impact:** 🟢 **STOCK ADDED TO DESTINATION LOCATION**
- **Permission Required:** `STOCK_TRANSFER_RECEIVE`
- **API Endpoint:** `POST /api/transfers/{id}/receive`

**What happens:**
1. Receiver physically receives the shipment
2. Verifies items and quantities
3. Can record discrepancies (partial receive supported):
   - `receivedQuantity` may be less than `sentQuantity`
   - Can add notes for missing/damaged items
4. 🟢 **CRITICAL:** Stock is **added** to destination location
5. Serial numbers updated to `in_stock` at new location
6. Product history records: `TRANSFER_IN`

**Separation of Duties Check:**
- System requires user to be at destination location
- Error: "You can only receive transfers at locations you are assigned to."

---

## The 4 Required Roles

### **Role 1: Transfer Creator**
**Purpose:** Create transfer requests
**Location:** Origin (From Location)
**Permissions:**
- `STOCK_TRANSFER_VIEW`
- `STOCK_TRANSFER_CREATE`

**Typical Job Titles:**
- Store Clerk
- Warehouse Assistant
- Inventory Clerk

---

### **Role 2: Transfer Checker**
**Purpose:** Verify transfer requests before sending
**Location:** Origin (From Location)
**Permissions:**
- `STOCK_TRANSFER_VIEW`
- `STOCK_TRANSFER_CHECK`

**Typical Job Titles:**
- Warehouse Supervisor
- Store Supervisor
- Inventory Supervisor

---

### **Role 3: Transfer Sender**
**Purpose:** Dispatch verified transfers
**Location:** Origin (From Location)
**Permissions:**
- `STOCK_TRANSFER_VIEW`
- `STOCK_TRANSFER_SEND`

**Typical Job Titles:**
- Warehouse Manager
- Logistics Coordinator
- Dispatch Manager

---

### **Role 4: Transfer Receiver**
**Purpose:** Receive and confirm transfers at destination
**Location:** Destination (To Location)
**Permissions:**
- `STOCK_TRANSFER_VIEW`
- `STOCK_TRANSFER_RECEIVE`

**Typical Job Titles:**
- Store Manager (destination)
- Warehouse Manager (destination)
- Branch Manager (destination)

---

## Complete Test Scenario: Main Warehouse → Main Store

### Scenario Setup
**Transfer:** 50 units of Product X from Main Warehouse → Main Store

### Required Users (4 Different Users)

| # | Username | Role | Location | Action |
|---|----------|------|----------|--------|
| 1 | `warehouse_clerk` | Transfer Creator | Main Warehouse | Creates transfer |
| 2 | `warehouse_supervisor` | Transfer Checker | Main Warehouse | Checks/approves |
| 3 | `warehouse_manager` | Transfer Sender | Main Warehouse | Sends (deducts stock) |
| 4 | `store_manager` | Transfer Receiver | Main Store | Receives (adds stock) |

---

## Step-by-Step Testing Guide

### **STEP 1: Create Transfer (User 1)**
1. Login as `warehouse_clerk`
2. Go to "Transfers" → "Create New Transfer"
3. From Location: **Main Warehouse** (auto-assigned)
4. To Location: **Main Store**
5. Add Product X, Quantity: 50
6. Click "Create Transfer"
7. ✅ Status: **Draft**
8. ❌ Stock NOT deducted yet

---

### **STEP 2: Submit for Check (User 1 - Optional)**
1. Still logged in as `warehouse_clerk`
2. Open the transfer
3. Click "Submit for Check"
4. ✅ Status: **Pending Check**

---

### **STEP 3: Check & Approve (User 2)**
1. **Logout** from `warehouse_clerk`
2. **Login** as `warehouse_supervisor`
3. Go to "Transfers" → Find the pending transfer
4. Click on transfer to view details
5. Physically verify items in warehouse
6. Click "Approve Check"
7. ✅ Status: **Checked**
8. ❌ Stock STILL NOT deducted yet

**NOTE:** If `warehouse_clerk` tries to check, they'll get an error!

---

### **STEP 4: Send Transfer (User 3)**
1. **Logout** from `warehouse_supervisor`
2. **Login** as `warehouse_manager`
3. Go to "Transfers" → Find the checked transfer
4. Click on transfer to view details
5. Physically pack items for shipment
6. Click "Send Transfer"
7. ✅ Status: **In Transit**
8. 🔴 **Stock DEDUCTED from Main Warehouse**
9. Check Product X stock at Main Warehouse: **reduced by 50**

**NOTE:** If `warehouse_clerk` or `warehouse_supervisor` tries to send, they'll get an error!

---

### **STEP 5: Receive Transfer (User 4)**
1. **Logout** from `warehouse_manager`
2. **Login** as `store_manager` (assigned to Main Store)
3. Go to "Transfers" → Find the in-transit transfer
4. Click on transfer to view details
5. Physically receive and verify items
6. Enter received quantities (can be less if damaged/missing)
7. Click "Receive Transfer"
8. ✅ Status: **Received/Completed**
9. 🟢 **Stock ADDED to Main Store**
10. Check Product X stock at Main Store: **increased by 50**

**NOTE:** Only users assigned to Main Store can receive this transfer!

---

## Visual Stock Movement Timeline

```
Time    Action          Main Warehouse Stock    Main Store Stock
----------------------------------------------------------------------
T0      Initial         100                     20
T1      Create          100 (no change)         20 (no change)
T2      Check           100 (no change)         20 (no change)
T3      Send            50 (DEDUCTED -50)       20 (no change)
T4      Receive         50 (no change)          70 (ADDED +50)
----------------------------------------------------------------------
Final                   50                      70
```

---

## Testing Multiple Transfers

### Test 1: Main Warehouse → Main Store
- Use: `warehouse_clerk`, `warehouse_supervisor`, `warehouse_manager`, `store_manager`

### Test 2: Main Warehouse → Bambang
- Use: `warehouse_clerk`, `warehouse_supervisor`, `warehouse_manager`, `bambang_manager`

### Test 3: Main Warehouse → Tuguegarao
- Use: `warehouse_clerk`, `warehouse_supervisor`, `warehouse_manager`, `tuguegarao_manager`

---

## Common Errors & Solutions

### ❌ "No location assigned"
**Solution:** User needs to be assigned to a location via UserLocation table

### ❌ "You cannot check your own transfer"
**Solution:** Use a different user for Stage 2 (checker must be different from creator)

### ❌ "You cannot send this transfer"
**Solution:** Use a different user for Stage 3 (sender must be different from creator and checker)

### ❌ "You can only receive transfers at locations you are assigned to"
**Solution:** Receiver must be assigned to the destination location

### ❌ "Insufficient stock"
**Solution:** Ensure origin location has enough stock before creating transfer

---

## Key Points to Remember

1. ✅ **4 different users** required for complete workflow
2. ✅ Users 1, 2, 3 must be at **origin location**
3. ✅ User 4 must be at **destination location**
4. 🔴 Stock deducted at **SEND** (Stage 3)
5. 🟢 Stock added at **RECEIVE** (Stage 4)
6. ✅ Separation of duties prevents fraud
7. ✅ Each stage requires specific permission
8. ✅ Audit trail tracks every action

---

## Next Steps

1. Run the role creation script to create the 4 transfer roles
2. Create test users and assign them to roles
3. Assign users to appropriate locations
4. Follow the step-by-step testing guide
5. Verify stock movements in Product History report

---

**Created:** 2025-10-19
**System:** UltimatePOS Modern
**Transfer System Version:** 4-Stage with Separation of Duties
