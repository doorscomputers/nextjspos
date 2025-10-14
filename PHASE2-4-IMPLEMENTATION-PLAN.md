# Purchase Reports Phase 2-4 Implementation Plan

## Status: IN PROGRESS

### Completed
- ✅ Phase 1 (4 reports) - ALL WORKING
  - Item Purchase Summary
  - Supplier Purchase Summary
  - Purchase Trend Analysis
  - Payment Status Report

- ✅ Phase 2 - Item Purchase Detail (1/3)
  - API: `/api/reports/purchases/item-detail`
  - UI: `/dashboard/reports/purchases/item-detail`

### Phase 2 - Remaining (2/3)

#### 1. Supplier Performance Report
**Purpose:** On-time delivery, quality metrics, and reliability scores

**API Endpoint:** `/api/reports/purchases/supplier-performance`

**Key Metrics:**
- On-time delivery rate
- Quality score (based on returns/complaints)
- Order fulfillment rate
- Average lead time
- Total purchase volume
- Number of orders

**Data Sources:**
- Purchase table (delivery dates, order dates)
- SupplierReturn table (quality issues)
- PurchaseItem table (order quantities vs received)

**Filters:** Year, Quarter, Month, Supplier

#### 2. Category Summary Report
**Purpose:** Purchase analysis grouped by product categories

**API Endpoint:** `/api/reports/purchases/category-summary`

**Key Metrics:**
- Total spend per category
- Percentage of total purchases
- Number of items per category
- Number of suppliers per category
- Average cost per category
- Top products in each category

**Data Sources:**
- Purchase + PurchaseItem
- Product + Category
- Supplier

**Filters:** Year, Quarter, Month, Location

### Phase 3 - All 3 Reports

#### 1. Daily Summary Report
**Purpose:** Day-to-day purchase operations overview

**API Endpoint:** `/api/reports/purchases/daily-summary`

**Key Metrics:**
- Daily purchase totals
- Number of POs per day
- Number of suppliers active per day
- Average PO value per day
- Comparison with previous period

**Data Sources:**
- Purchase table grouped by date

**Filters:** Date range (last 7/30/90 days)

#### 2. Item Cost Trend Report
**Purpose:** Visual charts showing price changes over time

**API Endpoint:** `/api/reports/purchases/item-cost-trend`

**Key Metrics:**
- Price history for selected products
- Price increase/decrease percentage
- Min/Max/Avg prices over time
- Supplier price comparison

**Data Sources:**
- PurchaseItem historical data
- Product
- Supplier

**Filters:** Product, Date range, Supplier

#### 3. Budget vs Actual Report
**Purpose:** Compare planned spending against actual purchases

**API Endpoint:** `/api/reports/purchases/budget-vs-actual`

**Key Metrics:**
- Budget amount (by category/department)
- Actual spending
- Variance (amount and percentage)
- Remaining budget
- Forecast to year-end

**Data Sources:**
- Budget table (needs to be created if doesn't exist)
- Purchase + PurchaseItem aggregated
- Category

**Filters:** Year, Quarter, Month, Category

### Implementation Order

1. ✅ Item Purchase Detail
2. ⏳ Supplier Performance (NEXT)
3. Category Summary
4. Daily Summary
5. Item Cost Trend
6. Budget vs Actual

### Technical Notes

**Common Patterns:**
- All use same date filtering logic
- All require multi-tenant isolation (businessId)
- All support period types: month, quarter, year, custom
- All return summary + detailed data
- All support print functionality
- All have responsive table/card layouts

**Database Considerations:**
- No direct relations between Purchase and Location
- PurchaseItem has no relation to Product (manual join required)
- AccountsPayable uses `paymentStatus` not `status`
- AccountsPayable uses `totalAmount` not `amount`

**Performance:**
- Use query batching where possible
- Implement pagination for large datasets
- Cache frequently accessed data
- Use indexes on date fields

### Next Steps

1. Complete Supplier Performance Report (API + UI)
2. Complete Category Summary Report (API + UI)
3. Complete all Phase 3 reports
4. Run comprehensive Playwright tests on all reports
5. Document any new findings
6. Mark Phase 2-4 as complete
