# Stock Transfer Error Correction Guide

## What to Do If You Selected the Wrong Location

Human errors happen! Here's a comprehensive guide on how to correct transfer errors at each stage of the workflow.

---

## Quick Reference Table

| Transfer Status | Can Cancel? | Can Edit? | Stock Impact | What to Do |
|----------------|-------------|-----------|--------------|------------|
| **Draft** | ✅ Yes | ✅ Yes (limited) | None | Cancel and recreate |
| **Pending Check** | ✅ Yes | ❌ No | None | Cancel and recreate |
| **Checked** | ✅ Yes | ❌ No | None | Cancel and recreate |
| **In Transit** | ✅ Yes* | ❌ No | Stock deducted | Cancel to restore stock, then recreate |
| **Arrived** | ❌ No | ❌ No | Stock deducted | Contact admin - may need manual adjustment |
| **Verifying** | ❌ No | ❌ No | Stock deducted | Contact admin - may need manual adjustment |
| **Verified** | ❌ No | ❌ No | Stock deducted | Contact admin - may need manual adjustment |
| **Completed** | ❌ No | ❌ No | Stock transferred | Use Stock Adjustment or Return Process |

*Requires special permission

---

## Detailed Correction Procedures

### Scenario 1: Wrong Location - Transfer Still in Draft

**Status**: Draft
**Stock Impact**: None (no inventory changes yet)
**Difficulty**: ⭐ Easy

#### Steps:
1. Go to "All Transfers" page
2. Find your transfer by number (e.g., TR-202510-0001)
3. Click the "View" button
4. Click "Cancel Transfer" button
5. Confirm cancellation
6. Create a new transfer with the correct location

**Why this works**: Draft transfers have no impact on inventory. Cancelling simply marks them as deleted.

**Time Required**: 2-3 minutes

---

### Scenario 2: Wrong Location - Pending Check or Checked

**Status**: Pending Check or Checked
**Stock Impact**: None (no inventory changes yet)
**Difficulty**: ⭐⭐ Moderate

#### Steps:
1. **If you have STOCK_TRANSFER_DELETE permission:**
   - Go to transfer detail page
   - Click "Cancel Transfer" button
   - Confirm cancellation
   - Create new transfer with correct location

2. **If you don't have permission:**
   - Contact your supervisor/manager
   - Ask them to cancel the transfer
   - Once cancelled, create new transfer

**Why this works**: These statuses haven't triggered any stock movement yet. Cancellation is clean with no inventory adjustments needed.

**Time Required**: 5-10 minutes

---

### Scenario 3: Wrong Location - In Transit ⚠️ CRITICAL

**Status**: In Transit
**Stock Impact**: ⚠️ Stock has been DEDUCTED from source location
**Difficulty**: ⭐⭐⭐ Complex

#### Understanding the Problem:
When a transfer is marked "In Transit", the system has already:
- ✅ Deducted stock from the source location
- ✅ Marked serial numbers (if any) as "in_transit"
- ❌ Stock is NOT yet at the destination

#### Steps:
1. **Stop the physical movement immediately**
   - Contact the driver/courier
   - Prevent goods from reaching wrong location

2. **Cancel the transfer in the system:**
   - Go to transfer detail page
   - Click "Cancel Transfer" (requires STOCK_TRANSFER_DELETE permission)
   - Confirm cancellation
   - **Result**: Stock will be RESTORED to the source location

3. **Verify stock restoration:**
   - Go to "Products" page
   - Check that quantities are back at source location
   - If using serial numbers, verify they're back to "in_stock" status

4. **Create new transfer with correct location:**
   - Create fresh transfer
   - Select CORRECT destination this time
   - Add same items and quantities
   - Submit and follow normal workflow

**Why this is critical**: Cancelling an "In Transit" transfer triggers a stock restoration process. If the goods physically reach the wrong location but the system shows them at the original location, your inventory will be incorrect.

**Time Required**: 15-30 minutes

**Warning**: If goods have already physically arrived at the wrong location, DO NOT cancel. See Scenario 4 instead.

---

### Scenario 4: Wrong Location - Arrived or Later ❌ CANNOT CANCEL

**Status**: Arrived, Verifying, Verified, or Completed
**Stock Impact**: 🔴 Stock deducted from source (Arrived/Verifying/Verified) OR fully transferred (Completed)
**Difficulty**: ⭐⭐⭐⭐⭐ Very Complex

#### Why You Can't Cancel:
Once goods physically arrive at the destination, the transfer workflow assumes:
- Goods are at the destination location (even if stock not added yet)
- Multiple people have confirmed the transfer
- Physical receipt has occurred

Cancelling at this stage would cause inventory discrepancies because:
- System would restore stock to source
- But goods are physically at destination
- Result: Ghost inventory (system shows stock that doesn't physically exist)

#### Solution A: If Transfer is Arrived/Verifying/Verified (Not Yet Completed)

**Contact your system administrator immediately.**

The administrator will need to:
1. Complete the current transfer to the wrong location
2. Create a new transfer from wrong location to correct location
3. Process the second transfer through the workflow

**Example:**
- Original: Main Warehouse → Store A (wrong!)
- Should be: Main Warehouse → Store B (correct)
- Solution: Complete transfer to Store A, then transfer Store A → Store B

#### Solution B: If Transfer is Completed

You have two options:

##### Option B1: Create Reverse Transfer (Recommended)

**Steps:**
1. Complete the original transfer (it's at the wrong location now)
2. Create new transfer: Wrong Location → Correct Location
3. Process through complete workflow
4. Stock ends up at correct location

**Pros:**
- ✅ Complete audit trail
- ✅ All movements documented
- ✅ No inventory discrepancies

**Cons:**
- ❌ Takes time (full workflow twice)
- ❌ Shows "error" in reporting

##### Option B2: Use Stock Adjustment (Last Resort)

**Steps:**
1. Administrator creates Stock Adjustment to deduct from wrong location
2. Administrator creates Stock Adjustment to add to correct location
3. Document the reason thoroughly

**Pros:**
- ✅ Fast correction

**Cons:**
- ❌ No transfer audit trail
- ❌ Looks like manual adjustment (red flag in audits)
- ❌ Requires admin privileges

**Time Required**: 1-2 hours

---

## Prevention Tips

### 1. Use the Confirmation Dialog
When creating a transfer, you'll see a confirmation dialog showing:
```
Are you sure you want to transfer X item(s) to:
[DESTINATION LOCATION NAME]
From: [SOURCE LOCATION NAME]
```

**READ THIS CAREFULLY** before clicking "Yes, Create Transfer"

### 2. Double-Check Before Each Stage
Before clicking any workflow buttons:
- ✅ "Submit for Check" - Verify TO location is correct
- ✅ "Approve" - Verify locations match business need
- ✅ "Send Transfer" - FINAL CHECK before stock deduction
- ✅ "Mark as Arrived" - Verify you're at the correct destination
- ✅ "Complete Transfer" - Verify goods match transfer document

### 3. Print Transfer Document
Before sending goods:
1. Print the transfer detail page
2. Attach to physical shipment
3. Destination staff should verify location on document

### 4. Use Notes Field
Add notes like:
- "URGENT: Deliver to Main Store, NOT Warehouse"
- "Destination contact: John Doe - 555-1234"
- "Delivery address: 123 Main St"

### 5. Phone Confirmation
For critical/large transfers:
- Call destination location before sending
- Confirm they're expecting the transfer
- Verify they have space/capacity to receive

---

## Who Can Cancel Transfers?

### Permissions Required:
- **STOCK_TRANSFER_DELETE**: Can cancel transfers in Draft, Pending Check, Checked, or In Transit status

### Default Role Permissions:
| Role | Can Cancel? | Notes |
|------|-------------|-------|
| Super Admin | ✅ Yes | Can cancel any transfer at any stage |
| Admin | ✅ Yes | Can cancel transfers for their business |
| Manager | ✅ Usually | Check your specific role configuration |
| Staff | ❌ Usually not | Must request manager/admin to cancel |

To check your permissions:
1. Go to "Profile" page
2. Look for "STOCK_TRANSFER_DELETE" in your permissions list

---

## Emergency Contacts

### If You Made an Error:

1. **Draft/Pending/Checked Stage**
   - Contact: Your direct supervisor
   - Action: Ask them to cancel and guide you in recreating

2. **In Transit Stage**
   - Contact: Logistics manager + System admin
   - Action: Stop physical shipment, cancel in system, recreate

3. **Arrived or Later Stage**
   - Contact: System administrator immediately
   - Action: Follow their instructions for correction

### Internal Escalation Path:
```
You (Transfer Creator)
    ↓
Your Supervisor/Manager
    ↓
Branch Manager
    ↓
System Administrator
    ↓
Business Owner
```

---

## Frequently Asked Questions

### Q: Can I edit the TO location after creating a transfer?
**A**: No. The TO location cannot be changed after creation. You must cancel and recreate.

### Q: What if I selected the wrong items but the right location?
**A**:
- If still in Draft: You can cancel and recreate
- If Pending Check or later: Cancel and recreate (no other option)

### Q: Will cancelling affect my inventory reports?
**A**:
- Cancelled transfers appear in transfer reports with status "Cancelled"
- They do NOT affect stock levels (if cancelled before "In Transit", or after cancellation if "In Transit")
- Audit logs show who cancelled and why

### Q: Can I undo a cancellation?
**A**: No. Cancellation is permanent. You must create a new transfer.

### Q: What if I already printed the wrong transfer document?
**A**:
1. Mark the printed document as "VOID" in red ink
2. Do not send it with goods
3. Cancel in system
4. Create new transfer
5. Print correct document

### Q: How long do cancelled transfers stay in the system?
**A**: Forever (soft deleted). They're hidden from main views but visible in audit reports.

### Q: Can I reuse a cancelled transfer number?
**A**: No. Transfer numbers are unique and never reused. The cancelled one will remain in history.

---

## Summary: Decision Tree

```
┌─────────────────────────────────────┐
│  Did I select wrong TO location?    │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  What is the transfer status?        │
└──────────────┬───────────────────────┘
               │
       ┌───────┴───────────────────────┬──────────────────┬──────────────────┐
       │                               │                  │                  │
       ▼                               ▼                  ▼                  ▼
   DRAFT                      PENDING/CHECKED        IN TRANSIT        ARRIVED/LATER
   │                               │                  │                  │
   ▼                               ▼                  ▼                  ▼
Cancel & Recreate          Cancel & Recreate    Stop shipment!     Contact Admin
(Easy, 2 min)              (Need permission)    Cancel & Restore   (Complex fix)
                                                (Complex, 30 min)
```

---

## Additional Resources

- See **TRANSFER-WORKFLOW-STATUS-GUIDE.md** for complete workflow details
- See **TRANSFER-QUICK-START.md** for transfer creation walkthrough
- Contact your system administrator for training on transfer procedures

---

**Remember**: The confirmation dialog is your friend! Always read it carefully before confirming. Prevention is easier than correction! 🛡️
