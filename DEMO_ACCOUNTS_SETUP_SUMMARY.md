# Demo Accounts Setup Summary

**Date**: October 20, 2025
**System**: UltimatePOS Modern - PciNet Computer Trading and Services
**Database**: PostgreSQL

---

## What Was Created

This setup created **16 new demo accounts** for comprehensive workflow testing across 4 active locations.

### New Accounts Created

#### Inventory Correction Workflow (8 accounts)
- `mainstore_inv_creator` - Main Store
- `mainstore_inv_approver` - Main Store
- `mainwarehouse_inv_creator` - Main Warehouse
- `mainwarehouse_inv_approver` - Main Warehouse
- `bambang_inv_creator` - Bambang
- `bambang_inv_approver` - Bambang
- `tuguegarao_inv_creator` - Tuguegarao
- `tuguegarao_inv_approver` - Tuguegarao

#### Sales Workflow (8 accounts)
- `mainstore_cashier` - Main Store
- `mainstore_sales_mgr` - Main Store
- `mainwarehouse_cashier` - Main Warehouse
- `mainwarehouse_sales_mgr` - Main Warehouse
- `bambang_cashier` - Bambang
- `bambang_sales_mgr` - Bambang
- `tuguegarao_cashier` - Tuguegarao
- `tuguegarao_sales_mgr` - Tuguegarao

**All passwords**: `password`

---

## New Roles Created

1. **Inventory Correction Creator** (ID: 30)
   - Permissions:
     - `inventory_correction.create`
     - `inventory_correction.view`
     - `product.view`
     - `report.stock.view`
     - `dashboard.view`

2. **Inventory Correction Approver** (ID: 14)
   - Permissions:
     - `inventory_correction.view`
     - `inventory_correction.approve`
     - `product.view`
     - `report.stock.view`
     - `dashboard.view`

---

## Complete Account Summary by Location

### Main Store (Location ID: 1)

| Workflow | Role | Username | Status |
|----------|------|----------|--------|
| Transfer | Creator | `mainstore_clerk` | ✅ Existing |
| Transfer | Checker | `mainstore_supervisor` | ✅ Existing |
| Transfer | Sender | `store_manager` | ✅ Existing |
| Transfer | Receiver | `mainstore_receiver` | ✅ Existing |
| Inventory Correction | Creator | `mainstore_inv_creator` | 🆕 **NEW** |
| Inventory Correction | Approver | `mainstore_inv_approver` | 🆕 **NEW** |
| Sales | Cashier | `mainstore_cashier` | 🆕 **NEW** |
| Sales | Manager | `mainstore_sales_mgr` | 🆕 **NEW** |
| Management | Branch Manager | `mainmgr` | ✅ Existing |

**Total**: 9 accounts (4 existing + 5 new)

---

### Main Warehouse (Location ID: 2)

| Workflow | Role | Username | Status |
|----------|------|----------|--------|
| Transfer | Creator | `warehouse_clerk` | ✅ Existing |
| Transfer | Checker | `warehouse_supervisor` | ✅ Existing |
| Transfer | Sender | `warehouse_manager` | ✅ Existing |
| Transfer | Receiver | `warehouse_receiver` | ✅ Existing |
| Inventory Correction | Creator | `mainwarehouse_inv_creator` | 🆕 **NEW** |
| Inventory Correction | Approver | `mainwarehouse_inv_approver` | 🆕 **NEW** |
| Sales | Cashier | `mainwarehouse_cashier` | 🆕 **NEW** |
| Sales | Manager | `mainwarehouse_sales_mgr` | 🆕 **NEW** |

**Total**: 8 accounts (4 existing + 4 new)

---

### Bambang (Location ID: 3)

| Workflow | Role | Username | Status |
|----------|------|----------|--------|
| Transfer | Creator | `bambang_clerk` | ✅ Existing |
| Transfer | Checker | `bambang_supervisor` | ✅ Existing |
| Transfer | Sender | `bambang_manager` | ✅ Existing |
| Transfer | Receiver | `bambang_receiver` | ✅ Existing |
| Inventory Correction | Creator | `bambang_inv_creator` | 🆕 **NEW** |
| Inventory Correction | Approver | `bambang_inv_approver` | 🆕 **NEW** |
| Sales | Cashier | `bambang_cashier` | 🆕 **NEW** |
| Sales | Manager | `bambang_sales_mgr` | 🆕 **NEW** |

**Total**: 8 accounts (4 existing + 4 new)

---

### Tuguegarao (Location ID: 4)

| Workflow | Role | Username | Status |
|----------|------|----------|--------|
| Transfer | Creator | `tugue_clerk` | ✅ Existing |
| Transfer | Checker | `tugue_supervisor` | ✅ Existing |
| Transfer | Sender | `tugue_manager` | ✅ Existing |
| Transfer | Receiver | `tugue_receiver` | ✅ Existing |
| Inventory Correction | Creator | `tuguegarao_inv_creator` | 🆕 **NEW** |
| Inventory Correction | Approver | `tuguegarao_inv_approver` | 🆕 **NEW** |
| Sales | Cashier | `tuguegarao_cashier` | 🆕 **NEW** |
| Sales | Manager | `tuguegarao_sales_mgr` | 🆕 **NEW** |

**Total**: 8 accounts (4 existing + 4 new)

---

## System-Wide Accounts (No Specific Location)

| Username | Roles | Purpose |
|----------|-------|---------|
| `superadmin` | Super Admin | Complete system access |
| `jayvillalon` | Purchase Approver, Transfer Approver, Return Approver, Inventory Correction Approver, GRN Approver, All Branch Admin | Multi-workflow approver |
| `Gemski` | All Branch Admin | Cross-location administration |
| `Jheirone` | Warehouse Manager | Warehouse operations |
| `MainStoreApprove` | Transfer Approver | Transfer approval authority |
| `mainverifier` | Main Store Transfer Verifier | Transfer verification |
| `warehousesender` | Warehouse Transfer Sender | Alternative warehouse sender |

---

## Accounts Needing Attention

### Users Without Location Assignments
These users exist but have no location assignment. They may need to be assigned to specific locations:

1. **Baguio Users** (Baguio is active but users not assigned):
   - `baguio_clerk`
   - `baguio_supervisor`
   - `baguio_manager`
   - `baguio_receiver`

2. **Santiago Users** (Santiago is active but users not assigned):
   - `santiago_clerk`
   - `santiago_supervisor`
   - `santiago_manager`
   - `santiago_receiver`

3. **Legacy/Unused Accounts**:
   - `cashiermain` - Regular Cashier Main (no location)
   - `cebu_mgr` - Main Store Branch Manager (no Cebu location exists)
   - `makati_mgr` - Main Store Branch Manager (no Makati location exists)
   - `pasig_mgr` - Main Store Branch Manager (no Pasig location exists)

---

## Database Statistics

### Total Users: 62
- Active Locations: 6 (Main Store, Main Warehouse, Bambang, Tuguegarao, Baguio, Santiago)
- Inactive Locations: 4 (Future locations)
- Total Roles: 21
- New Roles Created Today: 2

### Accounts by Workflow
- **Transfer Workflow**: 28 users (4 roles × 7 locations, some overlap)
- **Inventory Correction Workflow**: 8 users (new)
- **Sales Workflow**: 12 users (8 new + 4 existing)
- **Administrative**: 7 users
- **Legacy/Unassigned**: 7 users

---

## Files Created

1. **INVENTORY_CORRECTIONS_DEMO_ACCOUNTS.md**
   - Detailed guide for inventory correction workflow
   - Includes testing scenarios
   - Quick reference table

2. **COMPLETE_DEMO_ACCOUNTS_ALL_WORKFLOWS.md**
   - Comprehensive guide covering ALL workflows
   - Includes transfer, inventory corrections, sales, and purchases
   - Complete testing scenarios
   - Troubleshooting guide
   - Quick reference tables

3. **DEMO_ACCOUNTS_SETUP_SUMMARY.md** (this file)
   - Overview of what was created
   - Statistics and summaries

---

## Scripts Created/Used

1. **scripts/create-comprehensive-demo-accounts.mjs**
   - Creates inventory correction and sales demo accounts
   - Creates roles if they don't exist
   - Assigns users to locations
   - Skips existing users

2. **scripts/check-existing-setup.mjs**
   - Lists all business locations
   - Lists all users with roles and locations
   - Lists all available roles

---

## How to Use

### Quick Start
1. Open `COMPLETE_DEMO_ACCOUNTS_ALL_WORKFLOWS.md` for comprehensive guide
2. Find the workflow you want to test
3. Use the appropriate demo accounts
4. All passwords are: `password`

### Testing Inventory Corrections
1. Open `INVENTORY_CORRECTIONS_DEMO_ACCOUNTS.md`
2. Choose a location (e.g., Main Store)
3. Login as creator: `mainstore_inv_creator` / `password`
4. Create inventory correction
5. Login as approver: `mainstore_inv_approver` / `password`
6. Approve the correction

### Testing Transfers
1. See existing transfer accounts in comprehensive guide
2. Follow the 4-step workflow: Create → Check → Send → Receive
3. Example: Main Warehouse to Bambang transfer

### Testing Sales
1. Login as cashier (e.g., `bambang_cashier` / `password`)
2. Create sale transaction
3. Login as manager to void/refund if needed

---

## Next Steps / Recommendations

### 1. Assign Locations to Baguio and Santiago Users
Run a script to assign location assignments to:
- All `baguio_*` users → Baguio location
- All `santiago_*` users → Santiago location

### 2. Create Inventory Correction Accounts for Baguio and Santiago
Similar to what was created for Main Store, Main Warehouse, Bambang, and Tuguegarao

### 3. Clean Up Legacy Accounts
Decide what to do with:
- `cebu_mgr`, `makati_mgr`, `pasig_mgr` (locations don't exist)
- `cashiermain` (no location assigned)

### 4. Add Purchase Workflow Accounts
Currently only `jayvillalon` can approve purchases. May want to create:
- Location-specific purchase creators
- Location-specific purchase approvers
- GRN (Goods Receipt Note) processors

### 5. Add Testing Data
- Create sample products
- Add opening stock at each location
- Create some test transactions

---

## Verification Checklist

- ✅ All 4 active locations have transfer workflow accounts
- ✅ All 4 active locations have inventory correction workflow accounts
- ✅ All 4 active locations have sales workflow accounts
- ✅ All new users have proper role assignments
- ✅ All new users have location assignments
- ✅ All passwords set to 'password' for easy testing
- ✅ Comprehensive documentation created
- ✅ Testing scenarios documented
- ⚠️ Baguio and Santiago users need location assignments
- ⚠️ Purchase workflow needs more accounts

---

## Technical Details

### Database Schema
- User-Location relationship: `UserLocation` junction table
- User-Role relationship: `UserRole` junction table
- Role-Permission relationship: `RolePermission` junction table

### Multi-Tenant Isolation
- All accounts belong to Business ID: 1 (PciNet Computer Trading and Services)
- Users can only access data from their assigned locations
- Super Admin can access all locations

### Permission System
- Permissions defined in: `src/lib/rbac.ts`
- Permission format: `resource.action` (e.g., `inventory_correction.create`)
- Users inherit permissions from roles
- Users can also have direct permissions

---

## Support & Maintenance

### To Add More Demo Accounts
1. Edit `scripts/create-comprehensive-demo-accounts.mjs`
2. Add new account definitions
3. Run: `node scripts/create-comprehensive-demo-accounts.mjs`

### To Verify Setup
Run: `node scripts/check-existing-setup.mjs`

### To Reset Demo Data
**WARNING**: This will delete all data!
```bash
npm run db:push  # Reset schema
npm run db:seed  # Reseed demo data
```

### Database Access
- Use Prisma Studio: `npm run db:studio`
- Direct SQL: Connect to PostgreSQL database

---

## Contact

For issues or questions about demo accounts:
1. Check the comprehensive guides first
2. Verify location and role assignments
3. Check server logs for permission errors
4. Review database schema in `prisma/schema.prisma`

---

**Setup Completed**: October 20, 2025
**Total New Accounts**: 16
**Total New Roles**: 2
**Documentation Files**: 3
**Script Files**: 2

🎉 **Demo account setup is now complete and ready for comprehensive workflow testing!**
