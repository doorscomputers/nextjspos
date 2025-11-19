# Database Reset Guide - Transaction Records Only

## Overview

This guide shows how to **delete all transaction records** while **preserving master data** (Users, Roles, Menus, Products, Categories, Brands, Suppliers, Customers).

---

## What Gets DELETED ❌

### Transactional Data
- ❌ **Sales** (all sales transactions, items, payments)
- ❌ **Purchases** (purchase orders, GRN/receipts, items)
- ❌ **Cashier Shifts** (all shift records, Z readings, cash in/out)
- ❌ **Stock Transfers** (all transfer records and items)
- ❌ **Inventory Corrections** (all manual adjustments)
- ❌ **Customer Returns** (all return records)
- ❌ **Supplier Returns** (all return to supplier records)
- ❌ **Expenses** (all expense records)
- ❌ **Quotations** (all quotation records)
- ❌ **Service & Warranty** (all service records and claims)
- ❌ **Quality Control** (all QC inspection records)

### Accounting & Financial
- ❌ **Journal Entries** (all accounting entries)
- ❌ **Bank Transactions** (all bank transaction records)
- ❌ **Payments** (all payment records)
- ❌ **Accounts Payable** (all payable records)
- ❌ **Post-Dated Cheques** (all cheque records)
- ❌ **Chart of Accounts Balances** (reset to 0)

### History & Audit
- ❌ **Product History** (all stock movement history)
- ❌ **Audit Logs** (all audit trail records)
- ❌ **Stock Transactions** (all inventory transaction logs)
- ❌ **Serial Number Movements** (all serial tracking records)
- ❌ **Notifications** (all system notifications)
- ❌ **Announcements** (all announcement records)

### Inventory & Stock
- ❌ **All inventory quantities reset to 0**
- ❌ **Opening stock reset to 0**
- ❌ **Opening stock locks removed**

### Sequences & Counters
- ❌ **Invoice sequences** (all sequence records deleted)
- ❌ **Z-Reading counters** (reset to 0)
- ❌ **Accumulated sales** (reset to 0)
- ❌ **Auto-increment IDs** (reset to 1)

---

## What Gets PRESERVED ✅

### Master Data (SAFE)
- ✅ **Users** (all user accounts)
- ✅ **Roles** (all role definitions)
- ✅ **Permissions** (all permission settings)
- ✅ **Menus** (all menu configurations)
- ✅ **Products** (all product definitions)
- ✅ **Product Variations** (all variation records)
- ✅ **Categories** (all category records)
- ✅ **Brands** (all brand records)
- ✅ **Suppliers** (all supplier records)
- ✅ **Customers** (all customer records)
- ✅ **Business** (business settings)
- ✅ **Business Locations** (all branch/location records)
- ✅ **Chart of Accounts** (account structure, balances reset to 0)
- ✅ **Currencies** (all currency settings)
- ✅ **Units of Measure** (all UOM settings)
- ✅ **Employees** (all employee records)

---

## Available SQL Files

### 1. **RESET-TRANSACTIONS-WITH-SEQUENCES.sql** (PostgreSQL)
- Full reset with auto-increment sequences
- Uses `ALTER SEQUENCE ... RESTART WITH 1`
- Comprehensive verification queries
- **Use this for PostgreSQL/Supabase**

### 2. **RESET-TRANSACTIONS-MYSQL.sql** (MySQL/MariaDB)
- Full reset using TRUNCATE
- Automatically resets auto-increment to 1
- Disables foreign key checks during execution
- **Use this for XAMPP/MySQL**

### 3. **COMPLETE-TRANSACTION-RESET.sql** (PostgreSQL - Original)
- Comprehensive reset script
- Auto-increment reset is COMMENTED OUT
- Use if you want to review before resetting sequences

### 4. **scripts/reset_transactions.sql** (PostgreSQL - Fast)
- Uses TRUNCATE with RESTART IDENTITY CASCADE
- Fastest execution
- Automatically resets sequences

---

## How to Use

### For PostgreSQL (Supabase/Production)

```bash
# Using psql command line
psql "$DATABASE_URL" -f RESET-TRANSACTIONS-WITH-SEQUENCES.sql

# Or using PowerShell environment variable
$env:DATABASE_URL="postgresql://user:password@host:5432/dbname"
psql $env:DATABASE_URL -f RESET-TRANSACTIONS-WITH-SEQUENCES.sql
```

### For MySQL (XAMPP/Local Development)

**Option 1: Using phpMyAdmin**
1. Open phpMyAdmin in browser: http://localhost/phpmyadmin
2. Select your database: `ultimatepos_modern`
3. Click on "SQL" tab
4. Copy and paste contents of `RESET-TRANSACTIONS-MYSQL.sql`
5. Click "Go"
6. Wait for completion message

**Option 2: Using MySQL Command Line**
```bash
# Navigate to project directory
cd C:\xampp\htdocs\ultimatepos-modern

# Execute the SQL file
mysql -u root -p ultimatepos_modern < RESET-TRANSACTIONS-MYSQL.sql

# Or if no password
mysql -u root ultimatepos_modern < RESET-TRANSACTIONS-MYSQL.sql
```

**Option 3: Using MySQL Workbench**
1. Open MySQL Workbench
2. Connect to your local MySQL server
3. File → Open SQL Script
4. Select `RESET-TRANSACTIONS-MYSQL.sql`
5. Execute (⚡ icon or Ctrl+Shift+Enter)

---

## Safety Checklist ⚠️

### Before Running the Script:

1. **✅ BACKUP YOUR DATABASE FIRST!**
   ```bash
   # For PostgreSQL
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # For MySQL (XAMPP)
   mysqldump -u root -p ultimatepos_modern > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **✅ Verify you're on the correct database**
   - Check database name
   - Check connection string
   - Confirm it's NOT production (if testing)

3. **✅ Inform all users**
   - System will be unavailable during reset
   - All transaction history will be lost
   - All inventory will be reset to 0

4. **✅ Export critical data if needed**
   - Export current inventory levels
   - Export any reports you need for reference
   - Save any important transaction records

---

## After Reset - Next Steps

### Step 1: Verify Reset Completed Successfully

The script includes verification queries that show:
- Transaction counts (should all be 0)
- Master data counts (should be unchanged)
- Balances (should all be 0)

### Step 2: Set Opening Stock

After reset, you need to set opening stock for all products:

1. **Manual Entry** (for few products)
   - Go to Products → List Products
   - Edit each product
   - Set opening stock for each location

2. **CSV Import** (for many products)
   - Prepare CSV file with opening stock
   - Go to Products → Import Products
   - Upload CSV file
   - System will set opening stock from CSV

### Step 3: Verify System is Ready

1. Check all master data is intact:
   - Users can login
   - Products are visible
   - Customers and suppliers are listed
   - All locations are active

2. Test critical workflows:
   - Create a test sale
   - Process a test purchase
   - Perform a test transfer
   - Check inventory updates correctly

---

## Common Issues & Solutions

### Issue: "Foreign key constraint violation"

**Solution:** The script deletes in correct order, but if you get this error:
- For MySQL: The script disables foreign key checks
- For PostgreSQL: Use the TRUNCATE version with CASCADE

### Issue: "Table doesn't exist"

**Solution:** Some tables are optional (e.g., `accounting_audit_logs`):
- Comment out the lines for missing tables
- Or use TRY-CATCH blocks if your database supports it

### Issue: "Sequence doesn't exist" (PostgreSQL)

**Solution:** Some sequences might not exist in your schema:
- Comment out the ALTER SEQUENCE line for that table
- Or check your schema has those tables

### Issue: Reset completed but IDs didn't reset to 1

**For PostgreSQL:**
- Uncomment the ALTER SEQUENCE section in COMPLETE-TRANSACTION-RESET.sql
- Or use the RESET-TRANSACTIONS-WITH-SEQUENCES.sql file

**For MySQL:**
- TRUNCATE automatically resets auto-increment
- If using DELETE instead, add: `ALTER TABLE tablename AUTO_INCREMENT = 1;`

---

## Reverting the Reset

⚠️ **WARNING: Reset is PERMANENT and CANNOT be undone!**

If you need to restore:
```bash
# For PostgreSQL
psql $DATABASE_URL < backup_20250117_143022.sql

# For MySQL
mysql -u root -p ultimatepos_modern < backup_20250117_143022.sql
```

---

## Quick Reference

| Action | PostgreSQL File | MySQL File |
|--------|----------------|-----------|
| **Full Reset + Sequences** | `RESET-TRANSACTIONS-WITH-SEQUENCES.sql` | `RESET-TRANSACTIONS-MYSQL.sql` |
| **Fast Reset** | `scripts/reset_transactions.sql` | Use TRUNCATE version |
| **Review First** | `COMPLETE-TRANSACTION-RESET.sql` | N/A |

---

## Support

If you encounter any issues:

1. Check the error message carefully
2. Verify database connection is working
3. Ensure you have sufficient permissions
4. Try running the script in smaller sections
5. Consult the project documentation

---

## Summary

✅ **Safe to Delete:** All transactions, history, audit logs, inventory movements
❌ **Never Deleted:** Users, Roles, Menus, Products, Categories, Brands, Suppliers, Customers
🔄 **Reset to 0:** All balances, counters, sequences, inventory quantities
🔢 **Reset to 1:** All auto-increment IDs (optional, depending on file used)

**Remember: ALWAYS backup before running any database reset script!**
