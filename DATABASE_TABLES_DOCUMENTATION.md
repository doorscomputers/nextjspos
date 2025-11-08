# UltimatePOS Modern - Database Tables Documentation

## Table of Contents
1. [Core System Tables](#core-system-tables)
2. [Product & Inventory Tables](#product--inventory-tables)
3. [Sales & POS Tables](#sales--pos-tables)
4. [Purchase & Supplier Tables](#purchase--supplier-tables)
5. [Financial & Accounting Tables](#financial--accounting-tables)
6. [Transfer & Logistics Tables](#transfer--logistics-tables)
7. [Customer & Returns Tables](#customer--returns-tables)
8. [UOM (Unit of Measure) Tables](#uom-unit-of-measure-tables)

---

## Core System Tables

### `business`
**Description:** Multi-tenant core table. Each business is a separate tenant.

**Used In:**
- All modules (businessId filter)
- Business Settings (`/dashboard/settings/business`)
- Dashboard (`/dashboard`)

**Key Fields:**
- `id` - Primary key, referenced by all tenant data
- `name` - Business name
- `owner_id` - References `users.id`
- `currency_id` - Default currency
- `z_counter`, `accumulated_sales` - BIR compliance (Philippines)
- `pricing_strategy`, `bulk_price_sync` - Pricing configuration

---

### `users`
**Description:** User accounts with business association.

**Used In:**
- Authentication (`/login`)
- User Management (`/dashboard/users`)
- RBAC/Permissions
- All audit trails (created_by fields)

**Key Fields:**
- `id` - Primary key
- `username` - Login credential
- `password` - Hashed password (bcrypt)
- `business_id` - Tenant association
- `email`, `first_name`, `last_name` - Profile info

---

### `business_locations`
**Description:** Physical branches/stores within a business.

**Used In:**
- Location selector (all pages)
- Inventory management (location-specific stock)
- Sales (where transaction occurred)
- Transfers (from/to locations)
- POS (`/dashboard/pos`)

**Key Fields:**
- `id` - Primary key
- `business_id` - Parent business
- `name` - Location name (e.g., "Main Warehouse", "Bambang Branch")
- `location_code` - Unique identifier
- `printer_id`, `receipt_printer_type` - POS printing config
- `is_active` - Enable/disable location

---

### `roles`
**Description:** RBAC roles (Admin, Manager, Cashier, etc.)

**Used In:**
- User Management (`/dashboard/users`)
- Permission Management (`/dashboard/roles`)
- Access control (all modules)

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant-specific roles
- `name` - Role name
- `description` - Role purpose

---

### `permissions`
**Description:** System-wide permissions catalog.

**Used In:**
- RBAC system
- Menu visibility
- Feature access control

**Key Fields:**
- `id` - Primary key
- `name` - Permission identifier
- `description` - What it controls

---

### `menu_permissions`
**Description:** UI menu items with permission requirements.

**Used In:**
- Sidebar navigation (`/components/Sidebar.tsx`)
- Menu visibility control

**Key Fields:**
- `id` - Primary key
- `key` - Unique menu identifier
- `label` - Display name
- `icon` - Menu icon
- `parent_id` - For nested menus

---

### `user_roles` (Junction Table)
**Description:** Links users to their assigned roles.

**Used In:**
- Permission checking
- Role assignment UI

---

### `role_permissions` (Junction Table)
**Description:** Links roles to their granted permissions.

**Used In:**
- Permission inheritance
- Role configuration

---

### `user_permissions` (Junction Table)
**Description:** Direct permission grants to users (overrides role permissions).

**Used In:**
- Fine-grained access control
- Special user permissions

---

## Product & Inventory Tables

### `products`
**Description:** Product master data (name, SKU, category, brand, unit).

**Used In:**
- Product Management (`/dashboard/products`)
- POS product search (`/dashboard/pos`)
- Inventory tracking
- Purchase orders
- Sales transactions

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Product name
- `sku` - Stock Keeping Unit
- `type` - 'single' or 'variable' or 'combo'
- `category_id` - Product category
- `brand_id` - Product brand
- `unit_id` - **Primary unit** (base unit for inventory, e.g., Roll)
- `sub_unit_ids` - **JSON array of sub-unit IDs** (e.g., [4] for Meter)
- `alert_quantity` - Low stock threshold
- `enable_stock` - Track inventory for this product
- `barcode_type` - Barcode format
- `requires_serial_number` - Serial tracking requirement

---

### `product_variations`
**Description:** Product variants (color, size, etc.) or single variation for simple products.

**Used In:**
- Product detail pages
- Inventory (stock tracked per variation)
- Sales (specific variant sold)
- Pricing (each variation has its own price)

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `product_id` - Parent product
- `name` - Variation name (e.g., "Red", "Large", "Default")
- `sku` - Variation-specific SKU
- `selling_price` - Default selling price
- `purchase_price` - Default purchase price
- `is_default` - Mark as default variation

---

### `variation_location_details`
**Description:** **CRITICAL** - Stock quantities per variation per location.

**Used In:**
- Inventory reports (`/dashboard/inventory`)
- Stock checking (POS, sales, transfers)
- Stock adjustments
- Purchase receipts (increase stock)
- Sales (decrease stock)

**Key Fields:**
- `id` - Primary key
- `product_id` - Product reference
- `product_variation_id` - Specific variant
- `location_id` - Which branch/warehouse
- `qty_available` - **Current stock level (base unit)**
- `selling_price` - Location-specific price override
- `opening_stock_locked` - Prevent changes to opening stock
- `last_price_update` - Audit trail

**Stock Flow:**
- Purchase → Increases `qty_available`
- Sale → Decreases `qty_available`
- Transfer Out → Decreases at source location
- Transfer In → Increases at destination location

---

### `product_history`
**Description:** Audit trail of all stock movements.

**Used In:**
- Inventory reports
- Stock movement tracking
- Debugging stock discrepancies

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `product_id` - Product
- `product_variation_id` - Variant
- `location_id` - Where movement occurred
- `transaction_type` - 'opening_stock', 'purchase', 'sale', 'transfer_in', 'transfer_out', 'adjustment'
- `quantity` - Amount changed (base unit)
- `balance_after` - Stock level after transaction
- `unit_cost` - Cost per unit at time of transaction
- `reference_id` - Links to source transaction (sale_id, purchase_id, etc.)
- `created_at` - Timestamp

---

### `categories`
**Description:** Product categorization.

**Used In:**
- Product organization
- Product filters (`/dashboard/products`)
- Reports by category

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Category name
- `description` - Category description

---

### `brands`
**Description:** Product brands.

**Used In:**
- Product organization
- Brand-based filtering
- Reports by brand

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Brand name
- `description` - Brand info

---

## UOM (Unit of Measure) Tables

### `units`
**Description:** **CRITICAL** - Defines units of measure and their relationships.

**Used In:**
- Product setup (primary unit + sub-units)
- POS unit selection (`/dashboard/pos`)
- Purchase orders (buying units)
- Sales (selling units)
- Inventory conversion
- Pricing (unit-specific prices)

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Unit name (e.g., "Roll", "Meter", "Box", "Piece")
- `short_name` - Abbreviation (e.g., "m", "pc", "kg")
- `allow_decimal` - Can this unit have decimal quantities? (e.g., Meter: true, Box: false)
- `base_unit_id` - **Points to parent unit** (NULL if this IS the base unit)
- `base_unit_multiplier` - **Conversion factor** (e.g., 300 means 1 Roll = 300 Meters)

**Relationships:**
```
Roll (base unit)
  ├─ base_unit_id: NULL
  ├─ base_unit_multiplier: NULL

Meter (sub-unit of Roll)
  ├─ base_unit_id: 3 (Roll's ID)
  ├─ base_unit_multiplier: 300
  └─ Meaning: 1 Roll = 300 Meters
```

**Critical Logic:**
- Inventory is ALWAYS stored in **BASE UNIT**
- Display can use any unit
- Conversions: `baseQuantity = displayQuantity / multiplier`
- Example: 10 Meters = 10 / 300 = 0.0333 Rolls

---

### `product_unit_prices`
**Description:** Unit-specific pricing for products (optional, used for custom prices per unit).

**Used In:**
- POS unit pricing (`/dashboard/pos`)
- Purchase orders (unit costs)
- Price management

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `product_id` - Product
- `unit_id` - Which unit this price applies to
- `purchase_price` - Cost to buy in this unit
- `selling_price` - Price to sell in this unit

**Pricing Logic:**
- If record exists → Use this price
- If no record → Calculate proportionally from base unit price
  - Example: Roll = ₱1,650, Meter = ₱1,650 ÷ 300 = ₱5.50

---

## Sales & POS Tables

### `sales`
**Description:** Sales transaction header.

**Used In:**
- POS (`/dashboard/pos`)
- Sales reports (`/dashboard/reports/sales`)
- Invoicing
- Payment tracking

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `location_id` - Where sale occurred
- `customer_id` - Customer (optional)
- `invoice_number` - Unique invoice #
- `sale_date` - Transaction date
- `status` - 'draft', 'final', 'void'
- `sale_type` - 'pos', 'invoice'
- `shift_id` - Cashier shift
- `subtotal` - Before discounts/tax
- `tax_amount` - VAT/sales tax
- `discount_amount` - Total discounts
- `total_amount` - Final amount
- `senior_citizen_id`, `pwd_id` - Discount tracking (Philippines)
- `discount_approved_by` - Who authorized discount
- `created_by` - Cashier/user

---

### `sale_items`
**Description:** Line items in a sale.

**Used In:**
- Sale details
- Inventory deduction
- Receipt printing
- Sales reports (item-level)

**Key Fields:**
- `id` - Primary key
- `sale_id` - Parent sale
- `product_id` - Product sold
- `product_variation_id` - Specific variant
- `quantity` - **Quantity sold in BASE UNIT** (for inventory)
- `unit_price` - Price per unit
- `unit_cost` - Cost per unit (for profit calculation)
- `serial_numbers` - JSON array of serial numbers (if applicable)
- `sub_unit_id` - **UOM: Unit customer bought in** (e.g., Meter)
- `sub_unit_price` - **UOM: Price per sub-unit** (e.g., ₱5.50 per Meter)

**UOM Example:**
```
Customer buys 10 Meters:
  quantity: 0.0333      (base unit: Rolls for inventory)
  unit_price: 5.50      (price per Meter)
  sub_unit_id: 4        (Meter unit ID)
  sub_unit_price: 5.50  (for display/reporting)

Receipt shows: "10 Meters @ ₱5.50 = ₱55.00"
Inventory deducted: 0.0333 Rolls
```

---

### `sale_payments`
**Description:** Payment methods for a sale (cash, card, cheque, etc.)

**Used In:**
- Payment processing
- Cash drawer reconciliation
- Financial reports

**Key Fields:**
- `id` - Primary key
- `sale_id` - Parent sale
- `payment_method` - 'cash', 'card', 'gcash', 'cheque', 'bank_transfer'
- `amount` - Payment amount
- `payment_date` - When received
- `note` - Payment details

---

### `cashier_shifts`
**Description:** POS shift tracking for cashiers.

**Used In:**
- POS (`/dashboard/pos`)
- X Reading / Z Reading (`/dashboard/readings`)
- Cash drawer management
- BIR compliance (Philippines)

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `location_id` - Branch
- `user_id` - Cashier
- `shift_number` - Sequential shift #
- `opened_at` - Shift start time
- `closed_at` - Shift end time
- `beginning_cash` - Starting cash in drawer
- `ending_cash` - Counted cash at shift close
- `system_cash` - Calculated cash (sales + cash in - cash out)
- `cash_over` - Overage
- `cash_short` - Shortage
- `total_sales` - Total sales for shift
- `status` - 'open', 'closed'

---

## Purchase & Supplier Tables

### `suppliers`
**Description:** Supplier/vendor master data.

**Used In:**
- Purchase orders (`/dashboard/purchases`)
- Accounts payable
- Supplier reports

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Supplier name
- `contact_person` - Contact name
- `mobile` - Phone number
- `email` - Email address
- `address` - Supplier address
- `tax_number` - VAT/TIN
- `credit_limit` - Maximum credit allowed

---

### `purchases`
**Description:** Purchase order header.

**Used In:**
- Purchase Management (`/dashboard/purchases`)
- Inventory receiving
- Accounts payable

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `location_id` - Receiving location
- `supplier_id` - Supplier
- `purchase_order_number` - PO #
- `purchase_date` - Order date
- `status` - 'draft', 'ordered', 'received', 'approved'
- `total_amount` - PO total
- `paid_amount` - Amount paid so far
- `payment_status` - 'pending', 'partial', 'paid'

---

### `purchase_items`
**Description:** Line items in a purchase order.

**Used In:**
- Purchase order details
- Receiving (stock increases)
- Cost tracking

**Key Fields:**
- `id` - Primary key
- `purchase_id` - Parent PO
- `product_id` - Product ordered
- `product_variation_id` - Specific variant
- `quantity` - **Quantity ordered (can be in any unit)**
- `unit_cost` - Cost per unit
- `unit_id` - **UOM: Unit purchased in** (e.g., Box)
- `received_quantity` - How much received so far
- `subtotal` - Line total

---

## Financial & Accounting Tables

### `accounts_payable`
**Description:** Outstanding supplier invoices.

**Used In:**
- Accounts Payable Management (`/dashboard/ap`)
- Payment tracking
- Financial reports

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `supplier_id` - Supplier
- `purchase_id` - Related purchase order
- `invoice_number` - Supplier invoice #
- `invoice_date` - Invoice date
- `due_date` - Payment due date
- `total_amount` - Invoice total
- `paid_amount` - Amount paid
- `balance_amount` - Outstanding balance
- `payment_status` - 'unpaid', 'partial', 'paid', 'overdue'

---

### `payments`
**Description:** Payments made to suppliers.

**Used In:**
- Payment processing
- AP reconciliation
- Cash flow tracking

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `supplier_id` - Supplier
- `accounts_payable_id` - Which invoice paid
- `payment_number` - Payment reference #
- `payment_date` - Date paid
- `payment_method` - 'cash', 'cheque', 'bank_transfer'
- `amount` - Amount paid
- `cheque_number` - If cheque payment
- `bank_name` - Bank details
- `status` - 'pending', 'approved', 'cleared'

---

## Transfer & Logistics Tables

### `stock_transfers`
**Description:** Stock movement between locations (branch-to-branch).

**Used In:**
- Transfer Management (`/dashboard/transfers`)
- Inventory reconciliation
- Multi-location stock management

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `transfer_number` - Transfer reference #
- `from_location_id` - Source location
- `to_location_id` - Destination location
- `transfer_date` - When initiated
- `status` - 'pending', 'in_transit', 'received', 'completed', 'cancelled'
- `stock_deducted` - Has source stock been reduced?
- `notes` - Transfer notes
- `created_by` - Who initiated
- `checked_by` - Who verified items
- `sent_by` - Who dispatched
- `received_by` - Who received
- `verified_by` - Who verified received items
- `completed_by` - Who finalized

**Workflow:**
1. Created → Stock stays at source
2. Approved → Stock deducted from source
3. In Transit → Stock in limbo
4. Received → Stock added to destination
5. Completed → Transaction finalized

---

### `stock_transfer_items`
**Description:** Line items in stock transfer.

**Used In:**
- Transfer details
- Stock movement tracking

**Key Fields:**
- `id` - Primary key
- `stock_transfer_id` - Parent transfer
- `product_id` - Product
- `product_variation_id` - Variant
- `quantity` - Quantity transferred (base unit)
- `unit_id` - **UOM: Unit used for transfer**
- `received_quantity` - Actual quantity received
- `cost` - Unit cost

---

## Customer & Returns Tables

### `customers`
**Description:** Customer master data.

**Used In:**
- Customer Management (`/dashboard/customers`)
- Sales (customer assignment)
- Accounts receivable

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `name` - Customer name
- `email` - Email
- `mobile` - Phone
- `address` - Customer address
- `credit_limit` - Maximum credit allowed
- `customer_group_id` - Customer segmentation

---

### `customer_returns`
**Description:** Product returns from customers.

**Used In:**
- Returns Management (`/dashboard/returns`)
- Inventory adjustments (stock back in)
- Refund processing

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `location_id` - Return location
- `customer_id` - Customer
- `sale_id` - Original sale (if known)
- `return_number` - Return reference #
- `return_date` - Date of return
- `status` - 'pending', 'approved', 'rejected'
- `total_amount` - Return value
- `refund_method` - 'cash', 'credit_note', 'exchange'

---

### `customer_return_items`
**Description:** Line items in customer return.

**Used In:**
- Return details
- Stock adjustments

**Key Fields:**
- `id` - Primary key
- `customer_return_id` - Parent return
- `product_id` - Product returned
- `product_variation_id` - Variant
- `quantity` - Quantity returned (base unit)
- `unit_price` - Price per unit
- `reason` - Return reason

---

## Special Tables

### `currencies`
**Description:** Multi-currency support.

**Key Fields:**
- `id` - Primary key
- `code` - Currency code (PHP, USD, EUR)
- `name` - Currency name
- `symbol` - Symbol (₱, $, €)

---

### `notifications`
**Description:** In-app notifications for users.

**Used In:**
- Notification bell icon
- Alerts system

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `user_id` - Recipient
- `type` - Notification type
- `title` - Notification title
- `message` - Notification body
- `is_read` - Read status
- `action_url` - Where to navigate when clicked

---

### `announcements`
**Description:** System-wide announcements.

**Used In:**
- Dashboard announcements
- Ticker on pages

**Key Fields:**
- `id` - Primary key
- `business_id` - Tenant
- `title` - Announcement title
- `message` - Announcement body
- `type` - 'info', 'warning', 'success', 'error'
- `priority` - Display priority
- `start_date`, `end_date` - Display period
- `target_roles` - JSON array of role IDs
- `target_locations` - JSON array of location IDs
- `is_active` - Enable/disable

---

## Key Relationships Summary

```
business (1) → (*) users
business (1) → (*) business_locations
business (1) → (*) products
business (1) → (*) suppliers
business (1) → (*) customers

products (1) → (*) product_variations
products (1) → (1) units (primary unit)

product_variations (1) → (*) variation_location_details
  - Each variation tracked per location

sales (1) → (*) sale_items
sales (1) → (*) sale_payments
sales (1) → (1) cashier_shifts

purchases (1) → (*) purchase_items
purchases (1) → (1) accounts_payable

stock_transfers (1) → (*) stock_transfer_items

units (parent-child relationship)
  - base_unit (Roll) ← base_unit_id ← sub_unit (Meter)
```

---

## Critical Data Flow: UOM Sale Example

**Scenario:** Customer buys 10 Meters of Sample UTP Cable

**Step 1: Product Setup**
```sql
-- Product
id: 1, name: "Sample UTP CABLE", unit_id: 3 (Roll), sub_unit_ids: [4]

-- Units
Roll: id=3, base_unit_id=NULL, base_unit_multiplier=NULL
Meter: id=4, base_unit_id=3, base_unit_multiplier=300

-- Unit Prices
Roll: selling_price=1650
Meter: selling_price=5.50 (auto-calculated: 1650/300)
```

**Step 2: Stock Check**
```sql
-- variation_location_details
location_id=1, qty_available=5.0 (5 Rolls in stock)

-- Conversion check
5 Rolls = 5 × 300 = 1500 Meters available ✅
Customer wants 10 Meters ✅
```

**Step 3: Sale Creation**
```sql
-- sales table
INSERT: total_amount = 55.00 (10 × 5.50)

-- sale_items table
INSERT:
  quantity = 0.0333           (10 / 300 = 0.0333 Rolls for inventory)
  unit_price = 5.50           (price per Meter)
  sub_unit_id = 4             (Meter)
  sub_unit_price = 5.50       (for display)
```

**Step 4: Inventory Update**
```sql
-- variation_location_details
UPDATE: qty_available = 5.0 - 0.0333 = 4.9667 Rolls

-- product_history
INSERT:
  transaction_type = 'sale'
  quantity = -0.0333
  balance_after = 4.9667
```

**Step 5: Receipt Display**
```
Sample UTP CABLE
10 Meters @ ₱5.50 = ₱55.00
```

---

## Database Best Practices

1. **Always filter by `business_id`** for multi-tenant isolation
2. **Stock quantities always in BASE UNIT** in `variation_location_details.qty_available`
3. **UOM conversions** use `base_unit_multiplier` for accuracy
4. **Audit trails** via `product_history` for all stock movements
5. **Soft deletes** via `deleted_at` timestamp
6. **Currency precision** use Decimal type for money fields

---

This documentation covers the core tables used in UltimatePOS Modern with focus on UOM implementation.
