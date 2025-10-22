# Testing Quick Reference
## Super Test Users for Easy Workflow Testing

---

## 🚀 QUICK START - Just Login and Test!

| What You Want to Test | Login As | Password | What You Can Do |
|----------------------|----------|----------|-----------------|
| **Purchases** | `warehouse_super` | `password` | Create PO → Approve → GRN → Approve (all in one!) |
| **Sales (Main Store)** | `mainstore_super` | `password` | Process sales, manage transfers |
| **Sales (Bambang)** | `bambang_super` | `password` | Process sales, manage transfers |
| **Sales (Tuguegarao)** | `tuguegarao_super` | `password` | Process sales, manage transfers |
| **Sales (Santiago)** | `santiago_super` | `password` | Process sales, manage transfers |
| **Sales (Baguio)** | `baguio_super` | `password` | Process sales, manage transfers |
| **Everything** | `superadmin` | `password` | Full system access |

---

## ⚡ 30-Second Test Workflows

### Purchase Order (1 account, 2 minutes)
```
warehouse_super → Create PO → Approve → Create GRN → Approve
✅ Done! Check Product History.
```

### Transfer (2 accounts, 3 minutes)
```
warehouse_super → Create Transfer → Approve → Send
mainstore_super → Receive → Complete
✅ Done! Check Product History at both locations.
```

### Sales (1 account, 1 minute)
```
mainstore_super → Open Shift → Scan Products → Process Payment → Done
✅ Sales recorded, inventory deducted.
```

### Inventory Correction (1 account, 1 minute)
```
bambang_super → Create Correction → Approve
✅ Inventory adjusted.
```

---

## 📍 Location Assignments

| Location | Super User Account | Regular Users Available |
|----------|-------------------|-------------------------|
| **Main Warehouse** | `warehouse_super` | warehouse_clerk, warehouse_manager, warehouse_receiver, warehouse_supervisor |
| **Main Store** | `mainstore_super` | mainstore_cashier, mainstore_clerk, mainstore_receiver, mainstore_supervisor, mainstore_inv_creator, mainstore_inv_approver |
| **Bambang** | `bambang_super` | bambang_cashier, bambang_clerk, bambang_receiver, bambang_supervisor, bambang_inv_creator, bambang_inv_approver |
| **Tuguegarao** | `tuguegarao_super` | tuguegarao_cashier, tugue_clerk, tugue_receiver, tugue_supervisor, tuguegarao_inv_creator, tuguegarao_inv_approver |
| **Santiago** | `santiago_super` | (Regular users available) |
| **Baguio** | `baguio_super` | (Regular users available) |

---

## 💡 Testing Tips

### For Developers
- ✅ Use super users for quick testing
- ✅ Focus on verifying inventory movements
- ✅ Check Product History and Ledger reports
- ✅ Test complete business cycles

### For Trainers
- 📚 Use regular users to demonstrate separation of duties
- 📚 Show approval workflows with different accounts
- 📚 Explain role-based permissions
- 📚 Use super users only for quick demos

### For QA
- 🔍 Use super users for rapid testing
- 🔍 Use regular users for security testing
- 🔍 Verify audit trails with both methods
- 🔍 Test permission restrictions with regular accounts

---

## 🎯 Complete Business Cycle Test (5 minutes)

**Test the entire inventory flow from purchase to sale:**

```
Step 1: Purchase (warehouse_super)
   Create PO for 100 units → Approve → Create GRN → Approve
   ✅ Main Warehouse: +100 units

Step 2: Transfer (warehouse_super → mainstore_super)
   warehouse_super: Create Transfer 50 units → Approve → Send
   mainstore_super: Receive → Complete
   ✅ Warehouse: 50 | Main Store: 50

Step 3: Sales (mainstore_super)
   Sell 30 units
   ✅ Main Store: 20 units

Step 4: Verify
   Check Product History
   Check Inventory Ledger
   ✅ Total: 50 warehouse + 20 store + 30 sold = 100 ✓
```

**Time:** ~5 minutes
**Accounts:** 2 (warehouse_super + mainstore_super)
**Traditional Method:** ~20 minutes with 10+ account switches

---

## 🔑 All Passwords

**Every user** in the system uses the same password: `password`

This includes:
- All super users
- All regular users
- superadmin
- All branch-specific users

⚠️ **Change in production!**

---

## 🎓 Which Users for Which Purpose?

### Use SUPER USERS when:
- ✅ Testing workflows quickly
- ✅ Verifying inventory accuracy
- ✅ Checking reports
- ✅ Developing new features
- ✅ Demonstrating the system

### Use REGULAR USERS when:
- 📚 Training actual staff
- 📚 Teaching role-based security
- 📚 Production environment
- 📚 Audit trail requirements
- 📚 Best practices demonstration

---

## 📊 Performance Comparison

| Workflow | Super Users | Regular Users |
|----------|-------------|---------------|
| Complete Purchase Cycle | 2 min, 1 account | 5 min, 2 accounts |
| Complete Transfer | 3 min, 2 accounts | 10 min, 6+ accounts |
| Sales Transaction | 1 min, 1 account | 1 min, 1 account |
| Inventory Correction | 1 min, 1 account | 2 min, 2 accounts |
| **Full Business Cycle** | **5 min, 2 accounts** | **20+ min, 10+ accounts** |

**Time Saved:** ~75% faster with super users!

---

## 🚨 Common Testing Scenarios

### Scenario 1: "I need to test if purchases update inventory correctly"
```
Solution: warehouse_super
Time: 2 minutes
Steps: Create PO → Approve → GRN → Approve → Check Product History
```

### Scenario 2: "I need to verify transfer between locations"
```
Solution: warehouse_super + mainstore_super
Time: 3 minutes
Steps: Create Transfer → Approve → Send → Receive → Complete → Check both locations
```

### Scenario 3: "I need to test the complete flow from purchase to sale"
```
Solution: warehouse_super + mainstore_super
Time: 5 minutes
Steps: Full business cycle (see above)
```

### Scenario 4: "I need to verify Product History report accuracy"
```
Solution: Any super user
Time: Ongoing
Steps: Perform transactions → Check Product History after each → Verify all recorded
```

---

## 📱 Mobile Testing Quick Reference

All super users work on mobile devices too:

```
Mobile Browser → Login → Super User Account → Full Functionality
```

Perfect for testing:
- Mobile POS (sales)
- Mobile inventory checking
- Mobile transfer receiving
- Mobile approval workflows

---

## ✅ Pre-Testing Checklist

Before you start testing:

- [ ] Confirm you have login credentials
- [ ] Know which location you're testing
- [ ] Have test products ready
- [ ] Understand the workflow you're testing
- [ ] Know how to access Product History
- [ ] Know how to access Inventory Ledger

---

## 🎬 Ready to Start?

1. **Choose your workflow** (Purchase, Transfer, Sales, Correction)
2. **Find the super user** from the table at the top
3. **Login** with username and password: `password`
4. **Execute workflow** (no account switching needed!)
5. **Verify** using Product History and reports
6. **Done!** ✅

---

**Remember:**
- Super users = Fast testing
- Regular users = Training & production
- All passwords = `password` (change in production!)

---

**Last Updated:** October 22, 2025
**Purpose:** Quick testing reference for developers and QA
