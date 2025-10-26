# Multi-Location Pricing & Cost Management System - Implementation Plan

## Executive Summary

Complete pricing management system for multi-branch operations with:
- ✅ Per-location price management
- ✅ Role-based access control (RBAC)
- ✅ Bulk price editing with DevExtreme components
- ✅ Cost audit and profitability tracking
- ✅ **Telegram security alerts** for below-cost sales
- ✅ Three pricing strategies (Fallback, Required, Percentage-based)

---

## PHASE 1: Foundation & Core Features (Current Session)

### 1.1 Database Schema Updates ✅ IN PROGRESS

**File**: `prisma/schema.prisma`

**Add to Business model:**
```prisma
model Business {
  // ... existing fields

  // Pricing Strategy Configuration
  pricingStrategy    String  @default("fallback") @map("pricing_strategy") @db.VarChar(20)
  // Values: 'fallback', 'required', 'percentage'

  bulkPriceSync      Boolean @default(false) @map("bulk_price_sync")
  // When true: changing price at one location updates ALL locations
  // When false: independent pricing per location

  priceRoundingRule  String  @default("none") @map("price_rounding_rule") @db.VarChar(20)
  // Values: 'none', 'nearest_5', 'nearest_10', 'nearest_50', 'nearest_100'

  // Telegram Alert Configuration
  telegramBotToken     String? @map("telegram_bot_token") @db.VarChar(255)
  telegramChatId       String? @map("telegram_chat_id") @db.VarChar(255)
  enablePricingAlerts  Boolean @default(true) @map("enable_pricing_alerts")
  belowCostThreshold   Decimal @default(0) @map("below_cost_threshold") @db.Decimal(5, 2)
  // Alert if selling price < (cost × (1 - threshold)) e.g., 0.05 = 5% below cost

  belowRetailThreshold Decimal @default(0.20) @map("below_retail_threshold") @db.Decimal(5, 2)
  // Alert if selling price < (retail × (1 - threshold)) e.g., 0.20 = 20% below retail
}
```

**Add to VariationLocationDetails model:**
```prisma
model VariationLocationDetails {
  // ... existing fields

  // For percentage-based pricing strategy
  pricePercentage Decimal? @map("price_percentage") @db.Decimal(5, 2)
  // e.g., 10.00 = +10% markup, -5.00 = -5% discount from global price

  // Pricing metadata
  lastPriceUpdate     DateTime? @map("last_price_update")
  lastPriceUpdatedBy  Int?      @map("last_price_updated_by")
  priceUpdatedByUser  User?     @relation("PriceUpdatedBy", fields: [lastPriceUpdatedBy], references: [id])
}
```

**Add to User model:**
```prisma
model User {
  // ... existing relations

  // Price management relations
  priceUpdates VariationLocationDetails[] @relation("PriceUpdatedBy")
}
```

**New Model: PricingAlert**
```prisma
model PricingAlert {
  id         Int      @id @default(autoincrement())
  businessId Int      @map("business_id")

  // Alert details
  alertType  String   @db.VarChar(50) // 'below_cost', 'below_retail', 'excessive_discount'
  severity   String   @db.VarChar(20) // 'warning', 'critical'

  // Sale information
  saleId          Int?     @map("sale_id")
  invoiceNumber   String?  @map("invoice_number") @db.VarChar(100)

  // Product information
  productId          Int     @map("product_id")
  productName        String  @map("product_name") @db.VarChar(255)
  productVariationId Int     @map("product_variation_id")
  sku                String  @db.VarChar(191)

  // Location & User
  locationId   Int    @map("location_id")
  locationName String @map("location_name") @db.VarChar(255)
  userId       Int    @map("user_id")
  userName     String @map("user_name") @db.VarChar(191)

  // Pricing details
  costPrice     Decimal @map("cost_price") @db.Decimal(22, 4)
  retailPrice   Decimal @map("retail_price") @db.Decimal(22, 4)
  actualPrice   Decimal @map("actual_price") @db.Decimal(22, 4)
  discountGiven Decimal @map("discount_given") @db.Decimal(22, 4)

  // Alert message
  message String @db.Text

  // Telegram notification status
  telegramSent      Boolean   @default(false) @map("telegram_sent")
  telegramSentAt    DateTime? @map("telegram_sent_at")
  telegramMessageId String?   @map("telegram_message_id") @db.VarChar(100)

  // Acknowledgment
  acknowledged      Boolean   @default(false)
  acknowledgedBy    Int?      @map("acknowledged_by")
  acknowledgedAt    DateTime? @map("acknowledged_at")
  acknowledgedNotes String?   @map("acknowledged_notes") @db.Text

  createdAt DateTime @default(now()) @map("created_at")

  @@index([businessId])
  @@index([alertType])
  @@index([locationId])
  @@index([userId])
  @@index([saleId])
  @@index([createdAt])
  @@index([acknowledged])
  @@map("pricing_alerts")
}
```

---

### 1.2 Pricing Settings Page

**File**: `src/app/dashboard/settings/pricing/page.tsx`

**Features:**
- Global pricing strategy selector (DevExtreme RadioGroup)
- Bulk price sync toggle (DevExtreme Switch)
- Price rounding rules (DevExtreme SelectBox)
- Telegram alert configuration:
  - Bot Token input
  - Chat ID input
  - Enable/Disable alerts toggle
  - Below-cost threshold (NumberBox with %)
  - Below-retail threshold (NumberBox with %)
  - Test Telegram connection button
- Per-location default markup/markdown (DataGrid for percentage-based strategy)

**RBAC:**
- Only Super Admin and Admin can access
- Permission: `SETTINGS_MANAGE`

---

### 1.3 Bulk Price Editor Page

**File**: `src/app/dashboard/products/prices/bulk/page.tsx`

**Features:**
- DevExtreme DataGrid with virtual scrolling
- Columns:
  - Product Name
  - SKU
  - Category
  - Global Price (editable by Admin+)
  - [Dynamic columns for each location] (editable based on user role)
  - Last Updated
  - Actions
- Toolbar:
  - "Copy Global to All Locations" button
  - "Apply Percentage Adjustment" popup
  - Import from Excel button
  - Export to Excel button
  - Bulk validation button
- Inline editing
- Cell validation:
  - Warn if price < cost (yellow highlight)
  - Error if price < 0 (red highlight)
- Real-time save on cell change
- Shows only locations user has access to

**RBAC:**
- **Cashier/Location User**: See only THEIR location's prices, can edit only their location
- **Warehouse Manager**: See ALL locations, can edit ALL locations
- **Admin**: See ALL locations, can edit ALL locations + global prices
- **Super Admin**: Full access to everything

**Permission**: `PRODUCT_PRICE_EDIT` (new permission to add)

---

### 1.4 Pricing Settings API Route

**File**: `src/app/api/settings/pricing/route.ts`

**Endpoints:**
- `GET /api/settings/pricing` - Get current pricing settings
- `PUT /api/settings/pricing` - Update pricing settings (Admin only)
- `POST /api/settings/pricing/test-telegram` - Test Telegram connection

**Features:**
- Validate Telegram bot token and chat ID
- Send test message to Telegram
- Update Business pricing fields
- Multi-tenant isolation by businessId

---

### 1.5 Bulk Price Update API Route

**File**: `src/app/api/products/prices/bulk-update/route.ts`

**Endpoints:**
- `POST /api/products/prices/bulk-update`

**Request Body:**
```typescript
{
  updates: [
    {
      productVariationId: 123,
      locationId: 5,
      sellingPrice: 499.00,
      pricePercentage?: 10.00 // For percentage-based strategy
    },
    // ... more updates
  ],
  syncToAllLocations?: boolean // Respects bulkPriceSync setting
}
```

**Features:**
- Batch update prices
- RBAC enforcement (only allow locations user has access to)
- Audit trail (track who changed what price)
- Validate against cost price (optional warning)
- Update `VariationLocationDetails.sellingPrice`
- Update `VariationLocationDetails.lastPriceUpdate` and `lastPriceUpdatedBy`

---

### 1.6 Price Import from Excel API Route

**File**: `src/app/api/products/prices/import/route.ts`

**Endpoints:**
- `POST /api/products/prices/import`

**Expected Excel Format:**
```
SKU         | Location Name | Selling Price | Price Percentage
KB-001      | Manila        | 500.00        | 10.00
KB-001      | Cebu          | 480.00        | 5.00
MOUSE-002   | Manila        | 350.00        | 0.00
```

**Features:**
- Parse Excel/CSV file
- Validate SKU and location names
- Batch import with validation
- Return summary: success count, errors, warnings
- RBAC enforcement

---

### 1.7 Telegram Alert Service

**File**: `src/lib/telegram-alerts.ts`

**Functions:**

```typescript
/**
 * Send pricing alert to Telegram
 */
async function sendPricingAlert(
  businessId: number,
  alertData: {
    alertType: 'below_cost' | 'below_retail' | 'excessive_discount'
    productName: string
    sku: string
    locationName: string
    userName: string
    costPrice: number
    retailPrice: number
    actualPrice: number
    discountGiven: number
    invoiceNumber?: string
  }
): Promise<void>

/**
 * Test Telegram connection
 */
async function testTelegramConnection(
  botToken: string,
  chatId: string
): Promise<boolean>
```

**Alert Message Format:**
```
🚨 PRICING ALERT - [BELOW COST]

📍 Location: Manila Branch
👤 Cashier: John Doe
🏷️ Product: Wireless Mouse (SKU: MOUSE-001)
💰 Cost Price: ₱400.00
💵 Retail Price: ₱500.00
⚠️ Sold For: ₱350.00
📉 Discount: ₱150.00 (30% below retail, 12.5% below cost!)
📄 Invoice: INV-2025-001234

⏰ Time: Jan 26, 2025 10:30 AM

⚠️ This sale is below cost price! Potential loss: ₱50.00
```

---

### 1.8 POS Integration - Price Lookup

**File**: `src/app/dashboard/pos/page.tsx` (Update)

**Changes:**
1. When adding product to cart, lookup price from `VariationLocationDetails` for current location
2. If location price is NULL:
   - Strategy = 'fallback' → Use global `ProductVariation.sellingPrice`
   - Strategy = 'required' → Show error "Price not configured for this location"
   - Strategy = 'percentage' → Calculate from global price + `pricePercentage`
3. Before finalizing sale, check each item:
   - If `actualPrice < costPrice × (1 - belowCostThreshold)` → Create alert
   - If `actualPrice < retailPrice × (1 - belowRetailThreshold)` → Create alert
4. Send Telegram alerts asynchronously (don't block sale)

---

## PHASE 2: Advanced Features (Next Session)

### 2.1 Individual Product Price Editor

**File**: `src/app/dashboard/products/[id]/edit/page.tsx` (Add new tab)

**Features:**
- New "Location Pricing" tab
- Shows global selling price at top
- Table with columns:
  - Location Name
  - Current Price (editable)
  - Stock Quantity
  - Last Updated
  - Updated By
  - Actions (Edit, Reset to Global)
- Inline editing
- Show "Using Global Price (₱XXX)" badge when NULL

---

### 2.2 Price Comparison Report

**File**: `src/app/dashboard/reports/price-comparison/page.tsx`

**Features:**
- DevExtreme DataGrid with all products
- Dynamic columns for each location
- Color-coded price variations:
  - Green: Within 5% of average
  - Yellow: 5-15% different from average
  - Red: >15% different from average
- Statistics panel:
  - Products with consistent pricing
  - Products with high price variance
  - Average price per product
  - Min/Max price spread
- Export to Excel/PDF

---

### 2.3 Cost Audit Report

**File**: `src/app/dashboard/reports/cost-audit/page.tsx`

**Features:**
- DevExtreme DataGrid
- Columns:
  - Product Name
  - SKU
  - Location
  - Current Stock
  - **Average Cost** (from FIFO/LIFO/Weighted Avg)
  - **Last Purchase Cost**
  - Last Purchase Date
  - Current Selling Price
  - Profit Margin (%)
  - Stock Value
- Summary panel:
  - Total stock value
  - Total inventory (units)
  - Average profit margin
  - Products below minimum margin
- Filter by location, category, brand, supplier
- Export to Excel

**API Route**: `GET /api/products/costs`

**Cost Calculation:**
```typescript
// Use existing inventoryValuation.ts library
import { getInventoryValuation } from '@/lib/inventoryValuation'

const valuation = await getInventoryValuation(
  variationId,
  locationId,
  businessId,
  method // From Business.accountingMethod
)

const averageCost = valuation.unitCost
const profitMargin = ((sellingPrice - averageCost) / sellingPrice) * 100
```

---

### 2.4 Pricing Alert Dashboard

**File**: `src/app/dashboard/reports/pricing-alerts/page.tsx`

**Features:**
- List all pricing alerts
- Filters:
  - Date range
  - Alert type (below_cost, below_retail, excessive_discount)
  - Location
  - Acknowledged/Unacknowledged
  - User
- Actions:
  - Acknowledge alert (with notes)
  - View related sale
  - Resend to Telegram
- Statistics:
  - Total alerts this month
  - Alerts by location
  - Alerts by cashier
  - Most frequently discounted products

---

## RBAC Implementation

### Permissions to Add

```typescript
// In src/lib/rbac.ts

export const PERMISSIONS = {
  // ... existing permissions

  // Price Management
  PRODUCT_PRICE_VIEW: 'product_price_view',           // View prices
  PRODUCT_PRICE_EDIT: 'product_price_edit',           // Edit prices for assigned locations
  PRODUCT_PRICE_EDIT_ALL: 'product_price_edit_all',   // Edit prices for ALL locations
  PRODUCT_PRICE_GLOBAL: 'product_price_global',       // Edit global prices

  // Settings
  PRICING_SETTINGS_MANAGE: 'pricing_settings_manage', // Manage pricing strategy & Telegram

  // Alerts
  PRICING_ALERTS_VIEW: 'pricing_alerts_view',         // View pricing alerts
  PRICING_ALERTS_ACKNOWLEDGE: 'pricing_alerts_acknowledge', // Acknowledge alerts
} as const
```

### Role Assignments

```typescript
// Cashier/Location User
{
  PRODUCT_PRICE_VIEW: true,
  PRODUCT_PRICE_EDIT: true, // Only for their location
}

// Warehouse Manager
{
  PRODUCT_PRICE_VIEW: true,
  PRODUCT_PRICE_EDIT: true,
  PRODUCT_PRICE_EDIT_ALL: true, // All locations
}

// Admin
{
  PRODUCT_PRICE_VIEW: true,
  PRODUCT_PRICE_EDIT: true,
  PRODUCT_PRICE_EDIT_ALL: true,
  PRODUCT_PRICE_GLOBAL: true, // Can edit global prices
  PRICING_SETTINGS_MANAGE: true,
  PRICING_ALERTS_VIEW: true,
  PRICING_ALERTS_ACKNOWLEDGE: true,
}

// Super Admin
{
  // All permissions
}
```

### Location Filtering

```typescript
// In API routes
const userLocationIds = await getUserAssignedLocationIds(session.user.id)

// If user has PRODUCT_PRICE_EDIT_ALL, ignore location filter
// Otherwise, filter to only user's locations
const locationFilter = hasPermission(user, PERMISSIONS.PRODUCT_PRICE_EDIT_ALL)
  ? {} // No filter - all locations
  : { locationId: { in: userLocationIds } }
```

---

## Testing Checklist

### Phase 1 Testing
- [ ] Pricing settings page loads and saves correctly
- [ ] Bulk price editor shows only authorized locations
- [ ] Cashier can edit only their location's prices
- [ ] Admin can edit all locations
- [ ] Bulk price sync setting works (updates all locations when enabled)
- [ ] Excel import validates and imports correctly
- [ ] Telegram alerts send successfully
- [ ] Below-cost sale triggers Telegram alert
- [ ] Below-retail sale triggers Telegram alert
- [ ] POS uses location-specific prices

### Phase 2 Testing
- [ ] Individual product price editor works per location
- [ ] Price comparison report highlights variances correctly
- [ ] Cost audit shows accurate average costs
- [ ] Cost audit respects FIFO/LIFO/Weighted Avg setting
- [ ] Pricing alerts dashboard shows all alerts
- [ ] Alert acknowledgment saves correctly

---

## Database Migration Commands

```bash
# After updating schema.prisma
npx prisma generate

# Push to database
npx prisma db push

# Or create migration
npx prisma migrate dev --name add_multi_location_pricing
```

---

## Sidebar Menu Updates

**File**: `src/components/Sidebar.tsx`

Add new menu items:

```typescript
// Under "Products" section
{
  label: 'Bulk Price Editor',
  href: '/dashboard/products/prices/bulk',
  icon: DollarSign,
  permission: PERMISSIONS.PRODUCT_PRICE_EDIT,
},

// Under "Settings" section
{
  label: 'Pricing Settings',
  href: '/dashboard/settings/pricing',
  icon: Settings,
  permission: PERMISSIONS.PRICING_SETTINGS_MANAGE,
},

// Under "Reports" section
{
  label: 'Price Comparison',
  href: '/dashboard/reports/price-comparison',
  icon: BarChart,
  permission: PERMISSIONS.PRODUCT_PRICE_VIEW,
},
{
  label: 'Cost Audit',
  href: '/dashboard/reports/cost-audit',
  icon: DollarSign,
  permission: PERMISSIONS.PRODUCT_PRICE_VIEW,
},
{
  label: 'Pricing Alerts',
  href: '/dashboard/reports/pricing-alerts',
  icon: AlertTriangle,
  permission: PERMISSIONS.PRICING_ALERTS_VIEW,
},
```

---

## Environment Variables

Add to `.env`:

```env
# Telegram Bot Configuration (Optional)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

---

## Implementation Timeline

### Phase 1 (Current Session)
1. ✅ Schema updates - 15 min
2. ✅ Pricing settings page - 30 min
3. ✅ Pricing settings API - 20 min
4. ✅ Bulk price editor page - 45 min
5. ✅ Bulk price update API - 30 min
6. ✅ Excel import API - 25 min
7. ✅ Telegram alert service - 30 min
8. ✅ POS integration - 20 min

**Total Phase 1**: ~3.5 hours (estimated)

### Phase 2 (Next Session)
1. Individual product price tab - 30 min
2. Price comparison report - 35 min
3. Cost audit report - 40 min
4. Pricing alerts dashboard - 35 min

**Total Phase 2**: ~2.5 hours (estimated)

---

## Security Considerations

1. **RBAC Enforcement**: Always check user permissions before allowing price edits
2. **Audit Trail**: Log all price changes with user ID and timestamp
3. **Telegram Alerts**: Only send to authorized chat IDs, validate bot token
4. **SQL Injection**: Use Prisma parameterized queries
5. **XSS Prevention**: Sanitize all user inputs
6. **Multi-tenant Isolation**: Always filter by businessId

---

## Success Criteria

✅ **Phase 1 Complete When:**
- Cashiers can edit prices for their assigned location only
- Admins can edit all locations
- Bulk price editor works with DevExtreme DataGrid
- Excel import/export functional
- Telegram alerts send when sales are below cost/retail
- POS respects location-specific pricing

✅ **Phase 2 Complete When:**
- Individual product price editor functional
- Price comparison report shows variances
- Cost audit shows accurate average costs
- Pricing alerts dashboard fully functional
- All features tested and documented

---

## Notes

- All pages use **DevExtreme components** for consistency
- All currency displays use **Philippine Peso (₱)** symbol
- All pages are **mobile responsive**
- All pages support **dark mode**
- All APIs enforce **multi-tenant isolation**
- All APIs respect **RBAC permissions**

---

**Status**: Phase 1 - Ready to Implement
**Last Updated**: January 26, 2025
**Developer**: Claude Code AI Assistant
**Client**: Igoro Tech Inventory Management System
