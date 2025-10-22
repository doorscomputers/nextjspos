# Super Test Users Guide
## Easy Testing Without Account Switching

**Created:** October 22, 2025
**Purpose:** Simplify testing of inventory workflows without switching between multiple user accounts

---

## 🎯 Overview

To make testing easier, we created "super users" for each location that have all necessary permissions. This eliminates the need to constantly switch accounts while testing workflows like purchases, transfers, and sales.

---

## ✅ Created Users

### Main Warehouse
**Username:** `warehouse_super`
**Password:** `password`
**Location:** Main Warehouse
**Permissions:**
- Create & Approve Purchase Orders
- Create & Approve GRN (Goods Received Notes)
- Create & Approve Purchase Returns
- Create & Approve Supplier Returns
- Create, Approve, Send, and Receive Transfers
- Full warehouse operations

**Use For:**
- Testing complete purchase workflows
- Testing warehouse-to-branch transfers
- Verifying inventory updates after purchases

---

### Main Store
**Username:** `mainstore_super`
**Password:** `password`
**Location:** Main Store
**Permissions:**
- Process sales transactions (POS)
- Create, Approve, Send, and Receive Transfers
- Create & Approve Inventory Corrections
- All main store operations

**Use For:**
- Testing sales workflows
- Testing transfer receipt from warehouse
- Testing inventory corrections
- Verifying product history after sales

---

### Bambang Branch
**Username:** `bambang_super`
**Password:** `password`
**Location:** Bambang
**Permissions:**
- Process sales transactions (POS)
- Create, Approve, Send, and Receive Transfers
- Create & Approve Inventory Corrections
- All branch operations

**Use For:**
- Testing branch sales
- Testing branch-to-branch transfers
- Testing inventory corrections at branch level

---

### Tuguegarao Branch
**Username:** `tuguegarao_super`
**Password:** `password`
**Location:** Tuguegarao
**Permissions:**
- Process sales transactions (POS)
- Create, Approve, Send, and Receive Transfers
- Create & Approve Inventory Corrections
- All branch operations

---

### Santiago Branch
**Username:** `santiago_super`
**Password:** `password`
**Location:** Santiago
**Permissions:**
- Process sales transactions (POS)
- Create, Approve, Send, and Receive Transfers
- Create & Approve Inventory Corrections
- All branch operations

---

### Baguio Branch
**Username:** `baguio_super`
**Password:** `password`
**Location:** Baguio
**Permissions:**
- Process sales transactions (POS)
- Create, Approve, Send, and Receive Transfers
- Create & Approve Inventory Corrections
- All branch operations

---

## 🔄 Complete Testing Workflow Examples

### Example 1: Purchase Order to Sales

**Step 1: Purchase (Main Warehouse)**
```
Login as: warehouse_super
1. Navigate to Purchases → Create Purchase Order
2. Add products and quantities
3. Submit PO
4. Approve PO (same account!)
5. When goods arrive: Create GRN
6. Approve GRN (same account!)
✅ Inventory added to Main Warehouse
```

**Step 2: Transfer to Store**
```
Still logged in as: warehouse_super
1. Navigate to Transfers → Create Transfer
2. FROM: Main Warehouse (auto-filled)
3. TO: Main Store
4. Add products and quantities
5. Approve Transfer (same account!)
6. Mark as Sent (same account!)

Then login as: mainstore_super
7. Navigate to Transfers → Receive
8. Receive the transfer
9. Complete transfer (same account!)
✅ Inventory moved: Warehouse → Main Store
```

**Step 3: Sell Products**
```
Still logged in as: mainstore_super
1. Navigate to POS → Sales
2. Open shift
3. Process sales to customers
4. Close shift
✅ Sales recorded, inventory deducted
```

**Step 4: Verify**
```
Check Product History at both locations
Check Inventory Ledger Report
Confirm all movements recorded correctly
```

**Total Accounts Used:** Only 2 (warehouse_super + mainstore_super)
**Time Saved:** Massive! No switching between 6+ accounts

---

### Example 2: Inventory Correction

**Single Account Testing:**
```
Login as: mainstore_super (or any branch super user)

1. Navigate to Inventory → Corrections
2. Create correction
   - Product: Select product
   - System Qty: 100
   - Actual Qty: 95 (5 damaged)
   - Reason: Damage
   - Notes: "5 units damaged during handling"
   - Upload photo of damaged items
3. Submit correction
4. Approve correction (same account!)
✅ Inventory adjusted from 100 to 95

Check: View Product History to see adjustment entry
```

**Accounts Used:** Only 1
**Traditional Method:** Would need 2 accounts (creator + approver)

---

## 🆚 Super Users vs. Regular Users

### When to Use Super Users
✅ Quick testing of workflows
✅ Verifying inventory movements
✅ Checking product history and reports
✅ End-to-end process validation
✅ Developer testing
✅ Demo preparations

### When to Use Regular Users
✅ Staff training (to show separation of duties)
✅ Production environment
✅ Audit trail requirements
✅ Teaching role-based permissions
✅ Security best practices training

---

## 📊 Comparison Table

| Task | Super User Method | Regular User Method |
|------|-------------------|---------------------|
| **Purchase Order** | 1 account (warehouse_super) | 2 accounts (clerk + manager) |
| **Transfer** | 2 accounts (sender + receiver super) | 6 accounts (clerk, manager, sender, receiver, verifier, approver) |
| **Sales** | 1 account (store super) | 1 account (cashier) |
| **Inventory Correction** | 1 account (location super) | 2 accounts (creator + approver) |
| **Complete Business Cycle** | 2 accounts | 10+ accounts |

---

## 🔐 Security Note

**Important:** These super users are designed for **TESTING ONLY**.

In a production environment:
- Use role-based separation of duties
- Different users for creating vs. approving
- Proper audit trails
- Individual accountability

The super users violate separation of duties principles but make testing much more efficient.

---

## 🎓 Training Recommendation

**Phase 1: Testing & Development**
- Use super users for quick testing
- Verify workflows function correctly
- Check inventory movements
- Validate reports

**Phase 2: Staff Training**
- Switch to regular role-based users
- Show separation of duties
- Explain approval workflows
- Practice with real-world constraints

**Phase 3: Production**
- Only use regular role-based users
- Disable super users (or use different passwords)
- Enforce proper access controls
- Maintain audit trails

---

## 🚀 Quick Reference

### Testing Purchase Flow
```bash
warehouse_super → Create → Approve → GRN → Approve
```

### Testing Transfer Flow
```bash
warehouse_super → Create → Approve → Send
mainstore_super → Receive → Complete
```

### Testing Sales Flow
```bash
mainstore_super → Open Shift → Sell → Close Shift
```

### Testing Inventory Correction
```bash
bambang_super → Create Correction → Approve
```

---

## 📝 Notes

1. All super users use password: `password`
2. Each super user is assigned to their specific location
3. Super users have multiple roles combined
4. Perfect for testing Product History and Ledger reports
5. Eliminates account switching during testing

---

## ✅ Checklist for Testing

Before testing with super users:

- [ ] Verify super users are created in database
- [ ] Confirm each super user can login
- [ ] Test permissions for each super user
- [ ] Prepare test products with sufficient stock
- [ ] Clear understanding of workflow being tested
- [ ] Have Product History report ready for verification
- [ ] Have Inventory Ledger report ready for verification

After testing:

- [ ] Verify all inventory movements recorded
- [ ] Check Product History is accurate
- [ ] Confirm Ledger Report balances
- [ ] Document any issues found
- [ ] Clean up test data if needed

---

**Document Version:** 1.0
**Last Updated:** October 22, 2025
**Created By:** System Administrator
**Purpose:** Testing and Development Support
