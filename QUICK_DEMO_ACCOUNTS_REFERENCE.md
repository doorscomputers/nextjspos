# Quick Demo Accounts Reference Card

**All Passwords**: `password`

---

## Super Admin
- **superadmin** - Complete system access

---

## Main Store

| Workflow | Role | Username |
|----------|------|----------|
| Transfer | Create | `mainstore_clerk` |
| Transfer | Check | `mainstore_supervisor` |
| Transfer | Send | `store_manager` |
| Transfer | Receive | `mainstore_receiver` |
| Inventory | Create | `mainstore_inv_creator` |
| Inventory | Approve | `mainstore_inv_approver` |
| Sales | Cashier | `mainstore_cashier` |
| Sales | Manager | `mainstore_sales_mgr` |

---

## Main Warehouse

| Workflow | Role | Username |
|----------|------|----------|
| Transfer | Create | `warehouse_clerk` |
| Transfer | Check | `warehouse_supervisor` |
| Transfer | Send | `warehouse_manager` |
| Transfer | Receive | `warehouse_receiver` |
| Inventory | Create | `mainwarehouse_inv_creator` |
| Inventory | Approve | `mainwarehouse_inv_approver` |
| Sales | Cashier | `mainwarehouse_cashier` |
| Sales | Manager | `mainwarehouse_sales_mgr` |

---

## Bambang

| Workflow | Role | Username |
|----------|------|----------|
| Transfer | Create | `bambang_clerk` |
| Transfer | Check | `bambang_supervisor` |
| Transfer | Send | `bambang_manager` |
| Transfer | Receive | `bambang_receiver` |
| Inventory | Create | `bambang_inv_creator` |
| Inventory | Approve | `bambang_inv_approver` |
| Sales | Cashier | `bambang_cashier` |
| Sales | Manager | `bambang_sales_mgr` |

---

## Tuguegarao

| Workflow | Role | Username |
|----------|------|----------|
| Transfer | Create | `tugue_clerk` |
| Transfer | Check | `tugue_supervisor` |
| Transfer | Send | `tugue_manager` |
| Transfer | Receive | `tugue_receiver` |
| Inventory | Create | `tuguegarao_inv_creator` |
| Inventory | Approve | `tuguegarao_inv_approver` |
| Sales | Cashier | `tuguegarao_cashier` |
| Sales | Manager | `tuguegarao_sales_mgr` |

---

## Multi-Location Admins

- **jayvillalon** - All approver roles (Purchase, Transfer, Return, Inventory, GRN)
- **Gemski** - All Branch Admin

---

## Quick Testing Workflows

### Transfer (Main Warehouse → Bambang)
1. `warehouse_clerk` - Create transfer
2. `warehouse_supervisor` - Check transfer
3. `warehouse_manager` - Send transfer
4. `bambang_receiver` - Receive transfer

### Inventory Correction (Main Store)
1. `mainstore_inv_creator` - Create correction
2. `mainstore_inv_approver` - Approve correction

### Sale (Bambang)
1. `bambang_cashier` - Create sale
2. `bambang_sales_mgr` - Void/refund if needed

---

**For detailed guides, see**:
- `COMPLETE_DEMO_ACCOUNTS_ALL_WORKFLOWS.md`
- `INVENTORY_CORRECTIONS_DEMO_ACCOUNTS.md`
- `DEMO_ACCOUNTS_SETUP_SUMMARY.md`
