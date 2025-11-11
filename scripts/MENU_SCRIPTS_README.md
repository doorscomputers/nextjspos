# Menu Permission Scripts

This folder contains scripts to manage menu permissions without using the UI.

## 📋 Available Scripts

### 1. Check User's Menu Permissions

**File:** `check-menu-permissions-jayvillalon.ts`

**Purpose:** Diagnose why a user can't see sidebar menus

**Usage:**
```bash
npx tsx scripts/check-menu-permissions-jayvillalon.ts
```

**Output:**
- User's roles
- Menu permissions from roles
- Direct user menu permissions
- Total menu count
- Diagnosis of problems

---

### 2. Fix Role's Menu Permissions

**File:** `fix-cross-location-approver-menus.ts`

**Purpose:** Assign specific menu permissions to a role

**Usage:**
```bash
npx tsx scripts/fix-cross-location-approver-menus.ts
```

**Customization:**
- Edit `menuKeysToAssign` array in the file
- Add/remove menu keys as needed
- Run the script

---

### 3. Fix Child Menus

**File:** `fix-jay-child-menus.ts`

**Purpose:** Assign child/sub-menu permissions to a role

**Usage:**
```bash
npx tsx scripts/fix-jay-child-menus.ts
```

**What it does:**
- Finds all child menus under Purchases, Stock Transfers, POS
- Assigns them to the role
- Useful when parent menu is visible but children are not

---

### 4. Template: Assign Menus to Any Role

**File:** `TEMPLATE-assign-menus-to-role.ts`

**Purpose:** Reusable template for configuring any role

**Usage:**
```bash
# 1. Copy the template
cp scripts/TEMPLATE-assign-menus-to-role.ts scripts/assign-menus-cashier.ts

# 2. Edit the new file
# - Change ROLE_NAME
# - Uncomment menu keys to assign

# 3. Run the script
npx tsx scripts/assign-menus-cashier.ts
```

**Example Configuration:**
```typescript
const ROLE_NAME = 'Cashier'

const MENU_KEYS_TO_ASSIGN = [
  'dashboard',
  'pos_sales',
  'point_of_sale',
  'begin_shift',
  'close_shift',
  'x_reading',
  'z_reading',
]
```

---

### 5. Backup Menu Permissions

**File:** `backup-menu-permissions.ts`

**Purpose:** Save current menu configuration to JSON file

**Usage:**
```bash
npx tsx scripts/backup-menu-permissions.ts
```

**Output:**
- Creates `backups/menu-permissions/menu-permissions-backup-[timestamp].json`
- Creates `backups/menu-permissions/menu-permissions-latest.json`

**When to use:**
- BEFORE running any seed commands
- Before major configuration changes
- Weekly/monthly as routine backup

---

### 6. Restore Menu Permissions

**File:** `restore-menu-permissions.ts`

**Purpose:** Restore menu configuration from backup

**Usage:**
```bash
# Restore from latest backup
npx tsx scripts/restore-menu-permissions.ts

# Restore from specific backup
npx tsx scripts/restore-menu-permissions.ts menu-permissions-backup-2024-01-15.json
```

**What it does:**
- Reads backup JSON file
- Recreates all role menu assignments
- Recreates all user menu assignments
- Skips if assignment already exists

---

## 🔄 Typical Workflow

### Daily Operations (Use UI)

For day-to-day menu management, use the UI:
**Settings → User Menu Manager** (route: `/dashboard/settings/user-menu-manager`)

### Before Seeding Database

**ALWAYS** backup before running seed commands:
```bash
# 1. Backup current config
npx tsx scripts/backup-menu-permissions.ts

# 2. Run your seed command
npm run db:seed

# 3. Restore menu permissions
npx tsx scripts/restore-menu-permissions.ts

# 4. Verify in UI
```

### Fixing a User's Access

```bash
# 1. Diagnose the problem
npx tsx scripts/check-menu-permissions-jayvillalon.ts

# 2. Fix via UI (recommended)
# Go to: Settings → User Menu Manager

# OR fix via script (advanced)
npx tsx scripts/fix-cross-location-approver-menus.ts
```

### Configuring a New Role

```bash
# Method 1: Use UI (recommended)
# Go to: Settings → User Menu Manager
# Select "By Role" tab

# Method 2: Use script template
cp scripts/TEMPLATE-assign-menus-to-role.ts scripts/assign-menus-newrole.ts
# Edit the new file
npx tsx scripts/assign-menus-newrole.ts
```

---

## 📚 Menu Key Reference

Common menu keys you'll use in scripts:

### Core Menus
- `dashboard` - Dashboard home
- `products` - Products menu
- `settings` - Settings menu

### POS & Sales
- `pos_sales` - Parent menu
- `point_of_sale` - POS interface
- `begin_shift` - Begin shift
- `close_shift` - Close shift
- `x_reading` - X Reading
- `z_reading` - Z Reading
- `readings_history` - Readings History
- `sales_list` - Sales List

### Purchases
- `purchases` - Parent menu
- `purchases_list` - List Purchases
- `purchases_add` - Add Purchase
- `purchase_orders` - Purchase Orders
- `goods_received` - Goods Received (GRN)
- `serial_number_lookup` - Serial Number Lookup
- `reorder_suggestions` - Reorder Suggestions
- `accounts_payable` - Accounts Payable
- `payments` - Payments
- `banks` - Banks
- `bank_transactions` - Bank Transactions
- `post_dated_cheques` - Post-Dated Cheques

### Stock Transfers
- `stock_transfers` - Parent menu
- `all_transfers` - All Transfers
- `create_transfer` - Create Transfer
- `my_transfers_report` - My Transfers Report
- `my_received_transfers_report` - My Received Transfers Report

### Reports
- `reports` - Parent menu
- `sales_reports` - Sales Reports section
- `purchase_reports` - Purchase Reports section
- `purchase_items_report` - Purchase Items Report
- `transfer_reports` - Transfer Reports section
- `inventory_reports` - Inventory Reports section

**Full list:** Check the `MenuPermission` table in database or use Prisma Studio:
```bash
npx prisma studio
```

---

## ⚠️ Important Notes

### 1. Never Lose Configuration Again

The backup/restore system prevents loss from seed commands:

```bash
# Safe seeding workflow
npx tsx scripts/backup-menu-permissions.ts
npm run db:seed
npx tsx scripts/restore-menu-permissions.ts
```

### 2. Scripts vs UI

| Use Scripts When | Use UI When |
|------------------|-------------|
| Automating bulk changes | One-off user/role changes |
| Running in CI/CD | Quick manual adjustments |
| Restoring from backup | Testing different configs |
| Initial setup | Normal operations |

### 3. Changes Require Re-login

Menu permissions are cached in the user's session. Users MUST:
- Log out
- Log back in
- To see menu changes

### 4. Test After Changes

Always verify after running scripts:
```bash
# 1. Run the check script
npx tsx scripts/check-menu-permissions-jayvillalon.ts

# 2. Or check in UI
# Go to: Settings → User Menu Manager
```

---

## 🆘 Troubleshooting

### Script fails with "Role not found"

**Problem:** Role name doesn't match database

**Solution:**
```bash
# Check exact role names in database
npx prisma studio
# Navigate to Role table
# Copy exact name (case-sensitive)
```

### Script says "No menu permissions found"

**Problem:** Menu keys don't exist in database

**Solution:**
```bash
# 1. Check available menu keys
npx prisma studio
# Navigate to MenuPermission table

# 2. Or use this SQL
npx prisma db execute --stdin <<< "SELECT key, name FROM MenuPermission ORDER BY name;"
```

### Backup file not found

**Problem:** No backups exist yet

**Solution:**
```bash
# Create your first backup
npx tsx scripts/backup-menu-permissions.ts
```

### Changes not visible after restore

**Problem:** Users still logged in with old session

**Solution:**
- All users must log out and log back in
- Or restart the application server

---

## 📖 Additional Documentation

- **Full Guide:** `docs/MENU_PERMISSIONS_GUIDE.md`
- **Quick Reference:** `MENU_PERMISSIONS_SUMMARY.md`
- **UI Page:** Settings → User Menu Manager (`/dashboard/settings/user-menu-manager`)
