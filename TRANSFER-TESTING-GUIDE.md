# Stock Transfer Testing Guide
## How to Progress Transfer TR-202510-0002 Through All Workflow Stages

This guide shows you how to test the complete transfer workflow by logging in as different users at each stage.

---

## Current Status: Arrived (Step 4) ✅

### Transfer Details:
- **Transfer Number**: TR-202510-0001
- **From**: Main Warehouse
- **To**: Main Store
- **Created By**: jheirone ✅
- **Checked By**: mainmgr ✅
- **Sent By**: warehousesender ✅
- **Marked Arrived By**: mainmgr ✅
- **Current Status**: Arrived
- **Next Action**: Start Verification (requires DIFFERENT user than mainmgr)

---

## Complete Workflow with User Assignments

### Stage 1: ✅ COMPLETED - Draft → Pending Check
**Status**: Draft → Pending Check
**Action**: Submit for Checking
**Already Done By**: jheirone
**Permission Required**: `STOCK_TRANSFER_CREATE`

---

### Stage 2: ⏳ CURRENT STAGE - Pending Check → Checked
**Status**: Pending Check → Checked
**Action**: Click "Approve" button
**Permission Required**: `STOCK_TRANSFER_CHECK`

**Who Can Do This**:
- **mainmgr** (Branch Manager at Main Store) ✅ RECOMMENDED
- **superadmin** (Super Admin)
- Any user with Branch Admin or Branch Manager role

**Important**: The "Approve" button will NOT show for jheirone because of separation of duties (creator cannot approve their own transfer)

**Steps**:
1. **Log out** from jheirone account
2. **Log in as mainmgr**:
   - Username: `mainmgr`
   - Password: `111111`
3. Go to "Stock Transfers" menu
4. Click "View" on transfer TR-202510-0002
5. You will see the **"Approve"** button in the "Workflow Actions" section
6. Click **"Approve"**
7. Status will change to "Checked"

**Alternative**: If mainmgr doesn't work, log in as `superadmin` (password: `password`)

---

### Stage 3: Checked → In Transit
**Status**: Checked → In Transit
**Action**: Click "Send Transfer" button
**Permission Required**: `STOCK_TRANSFER_SEND`
**Stock Impact**: ⚠️ **Stock will be DEDUCTED from Main Warehouse**

**Who Can Do This**:
- **mainmgr** (Branch Manager)
- **superadmin**
- Any user with Send permission (Branch Admin or Branch Manager)

**Important**: Cannot be done by jheirone (creator) or the person who approved (separation of duties)

**Steps**:
1. Stay logged in as **mainmgr** (or log in as a different user with SEND permission)
2. On the transfer detail page, click **"Send Transfer"** button
3. Confirm the action (it will warn you that stock will be deducted)
4. Status changes to "In Transit"
5. **Verify**: Stock is now deducted from Main Warehouse

**What Happens**:
- Stock quantity deducted from Main Warehouse
- Serial numbers (if any) marked as "in_transit"
- `stockDeducted` flag set to true
- `sentBy` field recorded with current user ID
- `sentAt` timestamp recorded

---

### Stage 4: In Transit → Arrived
**Status**: In Transit → Arrived
**Action**: Click "Mark as Arrived" button
**Permission Required**: `STOCK_TRANSFER_RECEIVE`

**Who Can Do This**:
- User at **Tugusarao location** (Location 4)
- Someone with Branch Manager or Branch Admin role
- **superadmin**

**Important**: This should ideally be done by someone AT the destination location (Tugusarao)

**Steps**:
1. **Log in as a user assigned to Tugusarao location**
   - If you don't have one, you can use **superadmin**
2. Go to transfer TR-202510-0002
3. Click **"Mark as Arrived"** button
4. Status changes to "Arrived"

**What Happens**:
- Confirms goods physically arrived at destination
- `arrivedBy` field recorded
- `arrivedAt` timestamp recorded
- Stock is still at source (not yet added to destination)

---

### Stage 5: Arrived → Verifying
**Status**: Arrived → Verifying
**Action**: Click "Start Verification" button
**Permission Required**: `STOCK_TRANSFER_VERIFY`

**Who Can Do This**:
- User at destination with VERIFY permission
- Branch Manager or Branch Admin
- **superadmin**

**Important**: Cannot be done by the person who marked it as arrived (separation of duties)

**Steps**:
1. **Log in as a DIFFERENT user** than who marked it as arrived
   - Use **superadmin** or another manager
2. Go to transfer TR-202510-0002
3. Click **"Start Verification"** button
4. Status changes to "Verifying"

**What Happens**:
- Opens the verification process
- Each item can now be verified individually
- Status set to "verifying"

---

### Stage 6: Verifying → Verified
**Status**: Verifying (verify each item individually)
**Action**: For EACH item, enter received quantity and click "Verify"
**Permission Required**: `STOCK_TRANSFER_VERIFY`

**Who Can Do This**:
- Same user who started verification
- Any user with VERIFY permission

**Steps**:
1. On the transfer detail page, you'll see input boxes for each item
2. **For Samsung SSD 128**:
   - Enter quantity: `1`
   - Click **"Verify"** button next to that item
3. **For Samsung SSD 256**:
   - Enter quantity: `1`
   - Click **"Verify"** button next to that item
4. When ALL items are verified, status automatically changes to "Verified"

**What Happens**:
- Each item gets `isVerified` flag set to true
- `receivedQuantity` recorded for each item
- When all items verified → auto-transition to "Verified" status
- `verifiedBy` and `verifiedAt` recorded

---

### Stage 7: Verified → Completed
**Status**: Verified → Completed
**Action**: Click "Complete Transfer" button
**Permission Required**: `STOCK_TRANSFER_COMPLETE`
**Stock Impact**: ⚠️ **Stock will be ADDED to Tugusarao location**

**Who Can Do This**:
- Branch Manager or Branch Admin
- **superadmin**

**Important**: Cannot be done by jheirone (creator) or the person who sent (separation of duties)

**Steps**:
1. Stay logged in or log in as user with COMPLETE permission
2. On transfer detail page, click **"Complete Transfer"** button
3. Confirm the action (it will warn you that stock will be added)
4. Status changes to "Completed"

**What Happens**:
- Stock ADDED to Tugusarao location (Location 4)
- Serial numbers (if any) updated to destination location
- `completedBy` and `completedAt` recorded
- Transfer is now IMMUTABLE (cannot be changed)
- Workflow complete!

---

## Quick Reference: User Credentials

| Username | Password | Role | Can Approve? | Can Send? | Can Complete? |
|----------|----------|------|--------------|-----------|---------------|
| jheirone | 111111 | (Unknown) | ❌ No (creator) | ❌ No (creator) | ❌ No (creator) |
| mainmgr | 111111 | Branch Manager | ✅ Yes | ✅ Yes | ✅ Yes |
| superadmin | password | Super Admin | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Recommended Testing Path

**For fastest testing** (using minimal users):

1. **Stay as jheirone** - Already created transfer ✅
2. **Log in as mainmgr** - Approve the transfer (Pending Check → Checked)
3. **Stay as mainmgr** - Send the transfer (Checked → In Transit)
4. **Log in as superadmin** - Mark as arrived (In Transit → Arrived)
5. **Stay as superadmin** - Start verification (Arrived → Verifying)
6. **Stay as superadmin** - Verify each item (Verifying → Verified)
7. **Stay as superadmin** - Complete transfer (Verified → Completed)

---

## What If You Want to Test Real Separation of Duties?

If you want to see the **full separation of duties enforcement**, you need 6 different users:

1. **User 1 (jheirone)**: Create transfer
2. **User 2 (mainmgr)**: Approve transfer
3. **User 3**: Send transfer
4. **User 4**: Mark as arrived
5. **User 5**: Start verification & verify items
6. **User 6**: Complete transfer

To create additional users, go to "Users" menu and create new accounts with appropriate roles.

---

## Verification Checklist

After completing the workflow, verify:

- ✅ Transfer status shows "Completed"
- ✅ Stock deducted from Main Warehouse (check Products page)
- ✅ Stock added to Tugusarao location (check Products page)
- ✅ "Workflow Audit Trail" section shows all participants
- ✅ Each stage has username and timestamp
- ✅ Transfer is immutable (no action buttons visible)

---

## Troubleshooting

### Problem: "Approve" button doesn't show
**Reason**: You're logged in as jheirone (the creator)
**Solution**: Log in as mainmgr or superadmin

### Problem: "Send Transfer" button doesn't show
**Reason**: Either you don't have SEND permission, OR you're the creator/checker
**Solution**: Log in as a different user with Branch Manager or Branch Admin role

### Problem: Can't mark as arrived
**Reason**: You might be the creator, checker, or sender
**Solution**: Log in as superadmin or a user at destination location

### Problem: Items won't verify
**Reason**: You haven't clicked "Start Verification" first
**Solution**: Click "Start Verification" button, THEN verify each item

### Problem: Can't complete transfer
**Reason**: Not all items verified yet, OR you're the creator/sender
**Solution**: Verify ALL items first, then log in as different user

---

## Next Steps After Completion

Once transfer is completed:

1. ✅ Check "All Transfers" page - Status should show "Completed"
2. ✅ Go to "Products" page - Verify stock quantities at both locations
3. ✅ Go to "Audit Logs" page - See complete activity trail
4. ✅ Print transfer document for records

---

## Additional Notes

- **Cancellation**: You can cancel the transfer at ANY stage before "Arrived" by clicking "Cancel Transfer" button
- **Stock Restoration**: If you cancel during "In Transit", stock will be automatically restored to Main Warehouse
- **Cannot Cancel After Arrival**: Once goods arrive at destination, cancellation is not allowed (must use Return process instead)

---

**Happy Testing!** 🚀

Follow this guide step-by-step and you'll see the complete workflow in action, including the separation of duties enforcement that prevents fraud and ensures proper controls.
