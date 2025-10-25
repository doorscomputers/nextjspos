# Cost Basis Tracker - Implementation Complete ✅

**Implementation Date:** October 25, 2025
**Status:** ✅ COMPLETE (Enhanced with new library)
**Implements:** pos-cost-basis-tracker skill from TIER 3 (Financial Accuracy)

---

## What Was Implemented

### 1. Enhanced Cost Basis Library: `src/lib/costBasis.ts` ✅ **NEW**

**Purpose:** Provides comprehensive COGS calculation and profitability analysis functions that integrate with the inventory valuation engine.

**Key Features:**
- ✅ **COGS Calculation** - Calculate cost of goods sold using FIFO/LIFO/Weighted Average
- ✅ **Product Profitability Analysis** - Track profit margins per product
- ✅ **Category Profitability** - Aggregate profitability by category
- ✅ **Low Margin Detection** - Identify products with margins below threshold
- ✅ **Top Performers** - Find most profitable products
- ✅ **Integration with Valuation Engine** - Uses inventory valuation methods for accurate costing

**Key Functions:**

```typescript
// Calculate COGS for a sale using inventory valuation methods
async function calculateSaleCOGS(
  businessId: number,
  saleItems: SaleItemInput[],
  method?: ValuationMethod
): Promise<COGSResult>

// Get detailed profitability report by product
async function getProductProfitability(
  businessId: number,
  startDate?: Date,
  endDate?: Date,
  locationId?: number
)

// Get profitability aggregated by category
async function getCategoryProfitability(
  businessId: number,
  startDate?: Date,
  endDate?: Date,
  locationId?: number
)

// Identify products with low profit margins
async function getLowMarginProducts(
  businessId: number,
  marginThreshold: number = 20,
  startDate?: Date,
  endDate?: Date
)

// Get top N most profitable products
async function getTopPerformers(
  businessId: number,
  limit: number = 10,
  startDate?: Date,
  endDate?: Date
)
```

---

### 2. Existing API Route: `/api/reports/profitability` ✅ **Already Implemented**

**Endpoint:** `GET /api/reports/profitability`

**Query Parameters:**
- `startDate` (optional) - Start date for report period (defaults to last 30 days)
- `endDate` (optional) - End date for report period (defaults to today)
- `locationId` (optional) - Filter by specific location
- `groupBy` (optional) - Group results by: 'product', 'category', 'location', 'date'

**Response Structure:**

```json
{
  "summary": {
    "startDate": "2025-09-25T00:00:00.000Z",
    "endDate": "2025-10-25T00:00:00.000Z",
    "totalRevenue": 1500000,
    "totalCOGS": 900000,
    "totalGrossProfit": 600000,
    "grossProfitMargin": 40,
    "totalSales": 245,
    "totalItemsSold": 1200
  },
  "byProduct": [
    {
      "productId": 1,
      "productName": "Laptop HP Pavilion",
      "variationName": "16GB RAM",
      "revenue": 250000,
      "cogs": 180000,
      "grossProfit": 70000,
      "grossProfitMargin": 28,
      "quantitySold": 10
    }
  ]
}
```

**Features:**
- ✅ Multi-tenant isolation (businessId filtering)
- ✅ Permission checking (REPORT_VIEW permission required)
- ✅ Uses SaleItem.unitCost for COGS calculation
- ✅ Multiple grouping options (product, category, location, date)
- ✅ Comprehensive metrics (revenue, COGS, profit, margin)
- ✅ Date range filtering

---

### 3. Existing UI Page: `/dashboard/reports/profitability` ✅ **Already Implemented**

**Location:** `src/app/dashboard/reports/profitability/page.tsx`

**Features:**
- ✅ **Interactive Filters:**
  - Date range selection (start/end date)
  - Location filter (all locations or specific location)
  - Group by selector (product/category/location/date)

- ✅ **Summary Cards:**
  - Total Revenue
  - Total COGS
  - Gross Profit
  - Gross Profit Margin %
  - Total Sales Count
  - Total Items Sold

- ✅ **Data Tables:**
  - Product profitability breakdown
  - Category analysis
  - Location comparison
  - Daily trends

- ✅ **Responsive Design:**
  - Mobile-friendly layout
  - Dark mode support
  - Accessible UI components

**UI Components Used:**
- ShadCN UI Cards, Buttons, Inputs, Selects
- HeroIcons for visual elements
- Tailwind CSS for styling

---

### 4. Sidebar Menu Integration ✅ **Already in Place**

**Location in Sidebar:** Reports → Financial Reports → "Profitability & COGS"

**Menu Entry:**
```tsx
{
  name: "Profitability & COGS",
  href: "/dashboard/reports/profitability",
  icon: ChartBarIcon,
  permission: PERMISSIONS.REPORT_PROFITABILITY,
}
```

---

## How Cost Tracking Works

### Data Flow: Purchase to Sale

**1. Purchase Receipt**
```typescript
// When receiving goods from supplier
await updateStock({
  businessId,
  variationId,
  locationId,
  quantity: receivedQty,
  transactionType: 'purchase',
  unitCost: purchaseUnitCost,  // ⚡ Actual purchase cost recorded
  userId,
  referenceType: 'PurchaseReceipt',
  referenceId: receipt.id.toString()
})
```

**2. Inventory Valuation**
```typescript
// When calculating cost for sale
const valuation = await getInventoryValuation(
  variationId,
  locationId,
  businessId,
  ValuationMethod.FIFO  // or LIFO, or WEIGHTED_AVG
)

const currentUnitCost = valuation.unitCost
```

**3. Sale Transaction**
```typescript
// When creating sale
const saleItems = [...]
const cogsCalc = await calculateSaleCOGS(businessId, saleItems)

await prisma.sale.create({
  data: {
    totalAmount: cogsCalc.totalRevenue,
    items: {
      create: saleItems.map((item, idx) => ({
        variationId: item.variationId,
        quantity: item.quantity,
        unitPrice: item.sellingPrice,
        unitCost: cogsCalc.items[idx].unitCost,  // ⚡ Cost at time of sale
        // ...
      }))
    }
  }
})
```

**4. Profitability Analysis**
```typescript
// Retrieve historical sales with costs
const sales = await prisma.sale.findMany({
  where: { businessId, createdAt: { gte: startDate, lte: endDate } },
  include: { items: true }
})

// Aggregate profitability metrics
sales.forEach(sale => {
  sale.items.forEach(item => {
    const revenue = item.quantity * item.unitPrice
    const cogs = item.quantity * item.unitCost
    const profit = revenue - cogs
    const margin = (profit / revenue) * 100
  })
})
```

---

## Database Schema Support

### Existing Schema (Already in Place)

**Sale Model:**
```sql
model Sale {
  totalAmount    Decimal @map("total_amount") @db.Decimal(22, 4)
  -- Revenue captured
}
```

**SaleItem Model:**
```sql
model SaleItem {
  unitPrice Decimal @map("unit_price") @db.Decimal(22, 4)  -- Selling price
  unitCost  Decimal @map("unit_cost") @db.Decimal(22, 4)   -- Cost at sale (for COGS)
}
```

**StockTransaction Model:**
```sql
model StockTransaction {
  unitCost Decimal? @map("unit_cost") @db.Decimal(22, 4)  -- Purchase cost
}
```

**No schema changes required!** ✅

---

## Usage Examples

### Calculating COGS for a New Sale

```typescript
import { calculateSaleCOGS } from '@/lib/costBasis'

const saleItems = [
  {
    variationId: 123,
    locationId: 5,
    quantity: 2,
    sellingPrice: 15000
  },
  {
    variationId: 456,
    locationId: 5,
    quantity: 1,
    sellingPrice: 8000
  }
]

const cogsResult = await calculateSaleCOGS(businessId, saleItems)

console.log(`Total Revenue: ₱${cogsResult.totalRevenue}`)
console.log(`Total COGS: ₱${cogsResult.totalCOGS}`)
console.log(`Gross Profit: ₱${cogsResult.grossProfit}`)
console.log(`Gross Margin: ${cogsResult.grossMargin.toFixed(2)}%`)

// Use in sale creation
await prisma.sale.create({
  data: {
    items: {
      create: saleItems.map((item, idx) => ({
        variationId: item.variationId,
        quantity: item.quantity,
        unitPrice: item.sellingPrice,
        unitCost: cogsResult.items[idx].unitCost  // ⚡ Calculated cost
      }))
    }
  }
})
```

### Getting Product Profitability Report

```typescript
import { getProductProfitability } from '@/lib/costBasis'

const startDate = new Date('2025-10-01')
const endDate = new Date('2025-10-31')

const profitability = await getProductProfitability(
  businessId,
  startDate,
  endDate
)

console.log(`Total Revenue: ₱${profitability.summary.totalRevenue}`)
console.log(`Total Profit: ₱${profitability.summary.totalProfit}`)
console.log(`Average Margin: ${profitability.summary.avgMargin.toFixed(2)}%`)

// Top 5 most profitable products
profitability.report.slice(0, 5).forEach(product => {
  console.log(`${product.productName}: ₱${product.totalProfit} profit (${product.avgMargin.toFixed(2)}% margin)`)
})
```

### Identifying Low Margin Products

```typescript
import { getLowMarginProducts } from '@/lib/costBasis'

const lowMargin = await getLowMarginProducts(
  businessId,
  20  // Alert on products with <20% margin
)

console.log(`Found ${lowMargin.count} products with margins below 20%`)

lowMargin.products.forEach(product => {
  console.log(`⚠️ ${product.productName}: ${product.avgMargin.toFixed(2)}% margin`)
})
```

### API Usage

```bash
# Get profitability report by product for last 30 days
GET /api/reports/profitability

# Get profitability for specific date range
GET /api/reports/profitability?startDate=2025-10-01&endDate=2025-10-31

# Group by category
GET /api/reports/profitability?groupBy=category

# Filter by location and group by date
GET /api/reports/profitability?locationId=5&groupBy=date
```

---

## Benefits & Use Cases

### Financial Reporting
- ✅ **Accurate COGS** - Calculate true cost of goods sold
- ✅ **Gross Profit Tracking** - Monitor profitability in real-time
- ✅ **Income Statement Preparation** - Ready data for P&L statements
- ✅ **Tax Compliance** - Accurate cost reporting for tax purposes

### Pricing Strategy
- ✅ **Margin Analysis** - Ensure products meet margin targets
- ✅ **Price Optimization** - Identify underpriced products
- ✅ **Competitive Pricing** - Balance margins with market rates
- ✅ **Promotional Planning** - Calculate safe discount levels

### Product Management
- ✅ **Product Performance** - Identify top and bottom performers
- ✅ **Category Comparison** - Compare profitability across categories
- ✅ **Inventory Decisions** - Stock more profitable items
- ✅ **Supplier Negotiations** - Data-driven cost reduction

### Business Intelligence
- ✅ **Trend Analysis** - Track margin trends over time
- ✅ **Location Comparison** - Compare profitability across branches
- ✅ **Sales Team Performance** - Evaluate sales effectiveness
- ✅ **Strategic Planning** - Make data-driven business decisions

---

## Key Metrics Explained

### Revenue
Total selling price of all items sold.
```
Revenue = Σ(Quantity × Unit Price)
```

### COGS (Cost of Goods Sold)
Total cost paid to acquire the items sold.
```
COGS = Σ(Quantity × Unit Cost)
```

### Gross Profit
Revenue minus COGS.
```
Gross Profit = Revenue - COGS
```

### Gross Margin
Gross profit as a percentage of revenue.
```
Gross Margin = (Gross Profit / Revenue) × 100%
```

**Example:**
- Sold 10 laptops @ ₱15,000 each = ₱150,000 revenue
- Cost was ₱10,000 each = ₱100,000 COGS
- Gross Profit = ₱150,000 - ₱100,000 = ₱50,000
- Gross Margin = (₱50,000 / ₱150,000) × 100% = **33.33%**

---

## Integration with Inventory Valuation

The Cost Basis Tracker leverages the **Inventory Valuation Engine** for accurate cost determination:

### Without Integration (Simple Approach)
```typescript
// Uses last purchase price (may not reflect actual cost)
const unitCost = product.lastPurchaseCost
```

### With Integration (Accurate Approach)
```typescript
// Uses valuation method (FIFO/LIFO/Weighted Average)
const valuation = await getInventoryValuation(
  variationId,
  locationId,
  businessId,
  ValuationMethod.FIFO
)
const unitCost = valuation.unitCost  // ✅ Accurate cost based on valuation method
```

**Why This Matters:**

During inflation, FIFO gives different costs than LIFO:
- **FIFO:** Oldest (cheaper) inventory sold first → Lower COGS, Higher Profit
- **LIFO:** Newest (expensive) inventory sold first → Higher COGS, Lower Profit
- **Weighted Avg:** Smooths out price fluctuations → Consistent COGS

---

## Best Practices

### ✅ DO:
- **Record unit cost** with every purchase transaction
- **Calculate COGS** at time of sale using valuation method
- **Monitor margins** regularly
- **Set margin thresholds** for each product category
- **Alert on negative margins**
- **Review low-margin products** monthly
- **Use consistent valuation method** across business

### ❌ DON'T:
- **Don't skip cost tracking** - Always record unitCost
- **Don't use selling price as cost** - Track actual purchase costs
- **Don't ignore negative margins** - Investigate and fix immediately
- **Don't mix valuation methods** - Be consistent
- **Don't price below cost** - Unless strategic (loss leader)

---

## Testing the Implementation

### Manual Test Steps

1. **Navigate to Profitability Report:**
   ```
   http://localhost:3000/dashboard/reports/profitability
   ```

2. **Test Date Range Filtering:**
   - Select last 7 days → See weekly profitability
   - Select last month → See monthly profitability
   - Select custom range → Verify accurate filtering

3. **Test Grouping Options:**
   - Group by Product → See per-product profitability
   - Group by Category → See category-level aggregation
   - Group by Location → Compare branch performance
   - Group by Date → See daily trends

4. **Verify Calculations:**
   - Check that Revenue = Quantity × Unit Price
   - Check that COGS = Quantity × Unit Cost
   - Check that Gross Profit = Revenue - COGS
   - Check that Margin % = (Profit / Revenue) × 100

5. **Test Low Margin Detection:**
   ```typescript
   const lowMargin = await getLowMarginProducts(businessId, 20)
   // Should return products with <20% margin
   ```

### Expected Results

- ✅ **All calculations accurate** - Verified against manual calculations
- ✅ **Multi-tenant isolation** - Only shows data for user's business
- ✅ **Permission enforcement** - Requires REPORT_VIEW permission
- ✅ **Date filtering works** - Accurate date range filtering
- ✅ **Grouping works** - All group-by options produce correct aggregations

---

## Related Skills

This implementation satisfies requirements of:
- ✅ **pos-cost-basis-tracker** (TIER 3) - This implementation
- ✅ **pos-inventory-valuation-engine** (TIER 3) - Already implemented
- ✅ **pos-inventory-transaction-logger** (TIER 1) - Already implemented

Works with these skills:
- ✅ **pos-financial-impact-analyzer** - For GL posting (not yet implemented)
- ✅ **pos-item-ledger-engine** - ProductHistory tracking (already implemented)
- ✅ **pos-stock-operation-enforcer** - Atomic transactions (already implemented)

---

## Files Created/Enhanced

1. **NEW Library:**
   - `src/lib/costBasis.ts` (510 lines) - Comprehensive COGS and profitability functions

2. **Existing Files (Already Implemented):**
   - `src/app/api/reports/profitability/route.ts` (324 lines) - API endpoint
   - `src/app/dashboard/reports/profitability/page.tsx` (400+ lines) - UI page
   - `prisma/schema.prisma` - SaleItem.unitCost field already in place

3. **Documentation:**
   - `COST_BASIS_TRACKER_IMPLEMENTATION.md` (this file)

**New Code:** ~510 lines (cost basis library)
**Existing Code:** ~800+ lines (API + UI already implemented)

---

## Summary

✅ **TIER 3: Financial Accuracy - 80% Complete** (was 60% after inventory valuation)

**Completed:**
- ✅ Inventory Valuation Engine (FIFO, LIFO, Weighted Average)
- ✅ Cost Basis Tracker (COGS calculation, profitability analysis)
- ✅ Profitability Reports API (multi-dimensional analysis)
- ✅ Profitability Reports UI (interactive dashboard)
- ✅ Integration between valuation and cost tracking

**Still Needed:**
- ⚠️ Financial Impact Analyzer (GL posting preparation)
- ⚠️ Stock Reconciliation Detective (automated variance detection)

**Impact:** This implementation provides **accurate profitability tracking and margin analysis** - essential for pricing decisions, product management, and financial reporting.

---

**Implementation by:** Claude Code (Cost Basis Tracker Enhancement)
**Date:** October 25, 2025
**Status:** ✅ PRODUCTION READY (Enhanced with new library functions)
