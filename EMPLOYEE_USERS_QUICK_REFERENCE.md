# Employee Users - Quick Reference Card

## 🔐 Login Credentials

**Default Password for ALL accounts:** `password123`

⚠️ **Change password after first login!**

---

## 👥 User Accounts by Employee

### JOJIT KATE

**Main Store:**
- `JOJITKATECashierMain` → POS & Sales
- `JOJITKATETransferReceiverMain` → Transfers

**Bambang:**
- `JOJITKATECashierBambang` → POS & Sales
- `JOJITKATETransferReceiverBambang` → Transfers

---

### JASMIN KATE

**Bambang:**
- `JASMINKATECashierBambang` → POS & Sales
- `JASMINKATETransferReceiverBambang` → Transfers

**Main Store:**
- `JASMINKATECashierMain` → POS & Sales
- `JASMINKATETransferReceiverMain` → Transfers

---

### ERICSON CHAN

**Tuguegarao:**
- `EricsonChanCashierTugue` → POS & Sales
- `EricsonChanTransferReceiverTugue` → Transfers

---

## 📊 Account Types

### Cashier Accounts
**Can:**
- ✅ Process sales
- ✅ Generate X/Z readings
- ✅ Manage cash drawer
- ✅ View sales reports
- ✅ Print receipts

**Cannot:**
- ❌ Receive/send transfers
- ❌ Manage inventory
- ❌ Access other locations

### Transfer Receiver Accounts
**Can:**
- ✅ Receive transfers
- ✅ Send transfers
- ✅ Update inventory
- ✅ View transfer history

**Cannot:**
- ❌ Process sales
- ❌ Access cash drawer
- ❌ Generate X/Z readings

---

## 🌐 Login URL

```
http://localhost:3002/login
```

---

## 🚀 Quick Test

1. Go to login page
2. Enter username (e.g., `JOJITKATECashierMain`)
3. Enter password: `password123`
4. Click Login
5. You should see the dashboard with location-specific data

---

## 📁 Files Created

- `create-employee-users.mjs` - User creation script (can rerun safely)
- `EMPLOYEE_MANAGEMENT_IMPLEMENTATION_COMPLETE.md` - Full documentation
- `EMPLOYEE_USERS_QUICK_REFERENCE.md` - This file

---

**Total Users:** 10 | **Password:** password123 | **Business:** PciNet Computer Trading
