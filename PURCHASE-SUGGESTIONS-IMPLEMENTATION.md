# Automatic Purchase Order Suggestions - Implementation Guide

## Overview

An intelligent inventory replenishment system that analyzes sales velocity, current stock levels, and lead times to automatically suggest what products need to be reordered and in what quantities.

## Business Logic

### Reorder Point Formula
```
Reorder Point = (Average Daily Sales × Lead Time Days) + (Average Daily Sales × Safety Stock Days)
```

### Suggested Order Quantity Formula
```
Order Quantity = Reorder Quantity (if set) OR (Average Daily Sales × (Lead Time Days + Safety Stock Days) × 2)
```

### Calculation Steps

1. **Calculate Average Daily Sales (Last 30 Days)**
   - Query all sales for the product in last 30 days
   - Total quantity sold ÷ 30 = Average Daily Sales

2. **Calculate Current Stock (All Locations or Specific Location)**
   - Sum `qtyAvailable` from `VariationLocationDetails`

3. **Determine if Reorder Needed**
   ```
   Need Reorder = Current Stock <= Reorder Point
   ```

4. **Calculate Suggested Order Quantity**
   - If product has `reorderQuantity` set: use that
   - Otherwise: Calculate based on sales velocity

5. **Calculate Days Until Stockout**
   ```
   Days Until Stockout = Current Stock ÷ Average Daily Sales
   ```

## Database Schema Changes

###Added Fields to `Product` Table

```prisma
reorderPoint    Decimal? // When stock hits this level, trigger reorder
reorderQuantity Decimal? // Suggested order quantity
leadTimeDays    Int?     // Supplier delivery time in days
safetyStockDays Int?     // Buffer stock in days
enableAutoReorder Boolean @default(false) // Enable suggestions for this product
```

## API Endpoints

### GET `/api/purchases/suggestions`

**Purpose:** Generate purchase order suggestions based on stock levels and sales velocity

**Query Parameters:**
- `locationId` (optional): Filter by specific location, or "all" for all locations
- `supplierId` (optional): Filter by specific supplier
- `categoryId` (optional): Filter by product category
- `urgency` (optional): Filter by urgency level (critical/high/medium/low)
- `onlyEnabled` (optional): Only show products with `enableAutoReorder=true`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProductsAnalyzed": 150,
      "productsNeedingReorder": 23,
      "totalSuggestedOrderValue": 45000.00,
      "criticalItems": 5,
      "highPriorityItems": 8,
      "mediumPriorityItems": 7,
      "lowPriorityItems": 3
    },
    "suggestions": [
      {
        "productId": 1,
        "productName": "Generic Mouse",
        "variationId": 1,
        "variationName": "Default",
        "sku": "PCI-0001",
        "category": "Computer Peripherals",
        "supplierId": 1,
        "supplierName": "Sample Supplier",
        "currentStock": 25,
        "reorderPoint": 100,
        "suggestedOrderQty": 200,
        "avgDailySales": 15.5,
        "daysUntilStockout": 1.6,
        "leadTimeDays": 7,
        "safetyStockDays": 3,
        "unitCost": 50.00,
        "estimatedOrderValue": 10000.00,
        "urgency": "critical", // critical (<3 days), high (3-7 days), medium (7-14 days), low (>14 days)
        "locations": [
          {
            "locationId": 1,
            "locationName": "Main Warehouse",
            "currentStock": 10,
            "avgDailySales": 8.0
          },
          {
            "locationId": 2,
            "locationName": "Branch A",
            "currentStock": 15,
            "avgDailySales": 7.5
          }
        ]
      }
    ]
  }
}
```

### POST `/api/purchases/suggestions/generate-po`

**Purpose:** Convert suggestions into draft purchase orders grouped by supplier

**Request Body:**
```json
{
  "suggestions": [1, 5, 8, 12], // Product IDs to include
  "locationId": 1, // Delivery location
  "expectedDeliveryDays": 7 // Optional, defaults to product leadTimeDays
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "purchaseOrders": [
      {
        "supplierId": 1,
        "supplierName": "Sample Supplier",
        "totalAmount": 25000.00,
        "itemCount": 5,
        "purchaseOrderId": 123 // Created draft PO
      }
    ]
  }
}
```

## UI Components

### 1. Purchase Suggestions Page

**Route:** `/dashboard/purchases/suggestions`

**Features:**
- Summary cards showing total products, critical items, total value
- Filters: Location, Supplier, Category, Urgency
- Data table with:
  - Product name/SKU
  - Current stock vs Reorder point
  - Suggested order quantity
  - Urgency badge
  - Days until stockout
  - Estimated cost
  - Checkbox to select for PO generation
- Bulk actions:
  - Generate PO (selected items)
  - Export to Excel
  - Print report

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  Purchase Order Suggestions                         │
│  Smart inventory replenishment based on sales data  │
├─────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│ │Critical:5│ │High: 8   │ │Medium: 7│ │Total:23  ││
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘│
├─────────────────────────────────────────────────────┤
│ Filters: [Location▼] [Supplier▼] [Category▼]       │
│          [Urgency▼] [☑ Auto-reorder enabled only]  │
├─────────────────────────────────────────────────────┤
│ ☑ │Product      │Stock│ Reorder │Suggested│Urgency │
│───┼─────────────┼─────┼─────────┼─────────┼────────│
│ ☑ │Generic Mouse│  25 │  100 ▼  │   200   │CRITICAL│
│ ☑ │Generic PS   │  10 │   50 ▼  │   100   │ HIGH   │
│   │Keyboard     │ 150 │  100    │     -   │   OK   │
└─────────────────────────────────────────────────────┘
│ Selected: 2 items                                   │
│ [Generate PO] [Export] [Print]                      │
└─────────────────────────────────────────────────────┘
```

### 2. Product Edit Form Enhancement

Add reorder settings section to product form:

```
┌─────────────────────────────────────────┐
│ Automatic Reorder Settings              │
├─────────────────────────────────────────┤
│ ☑ Enable automatic reorder suggestions │
│                                         │
│ Reorder Point: [____] units             │
│ Reorder Quantity: [____] units          │
│ Lead Time: [__] days                    │
│ Safety Stock: [__] days                 │
│                                         │
│ ℹ️ Based on your sales data, we suggest:│
│   - Reorder Point: 85 units             │
│   - Reorder Quantity: 150 units         │
│ [Calculate from Sales Data]             │
└─────────────────────────────────────────┘
```

## Calculation Examples

### Example 1: Generic Mouse

**Given:**
- Current Stock: 25 units (across all locations)
- Sales Last 30 Days: 465 units
- Average Daily Sales: 465 ÷ 30 = 15.5 units/day
- Lead Time: 7 days
- Safety Stock: 3 days

**Calculations:**
```
Reorder Point = (15.5 × 7) + (15.5 × 3)
              = 108.5 + 46.5
              = 155 units

Current Stock (25) < Reorder Point (155) → REORDER NEEDED

Suggested Order Qty = 15.5 × (7 + 3) × 2
                    = 15.5 × 10 × 2
                    = 310 units

Days Until Stockout = 25 ÷ 15.5
                    = 1.6 days → CRITICAL
```

### Example 2: Low-Moving Product

**Given:**
- Current Stock: 50 units
- Sales Last 30 Days: 10 units
- Average Daily Sales: 10 ÷ 30 = 0.33 units/day
- Lead Time: 14 days
- Safety Stock: 7 days

**Calculations:**
```
Reorder Point = (0.33 × 14) + (0.33 × 7)
              = 4.62 + 2.31
              = 7 units

Current Stock (50) > Reorder Point (7) → NO REORDER NEEDED

Days Until Stockout = 50 ÷ 0.33
                    = 151 days → WELL STOCKED
```

## Urgency Levels

| Level | Days Until Stockout | Badge Color | Action Required |
|-------|---------------------|-------------|-----------------|
| **Critical** | < 3 days | Red | Order immediately |
| **High** | 3-7 days | Orange | Order this week |
| **Medium** | 7-14 days | Yellow | Plan order |
| **Low** | > 14 days | Blue | Monitor |

## Permissions

Add new permissions:
- `PURCHASE_SUGGESTION_VIEW` - View purchase suggestions
- `PURCHASE_SUGGESTION_GENERATE_PO` - Generate PO from suggestions

## Navigation

Add to Purchases submenu:
```
Purchases
├─ Purchase Orders
├─ Goods Received (GRN)
├─ Reorder Suggestions ← NEW
├─ Accounts Payable
└─ Payments
```

## Implementation Phases

### Phase 1: Backend ✅ COMPLETE
- [x] Add reorder fields to Product schema
- [x] Create Purchase Suggestions API endpoint
- [x] Implement sales velocity calculations
- [x] Implement reorder logic
- [x] Add location-based filtering
- [x] Add supplier and urgency filtering

### Phase 2: Frontend ✅ COMPLETE
- [x] Create Purchase Suggestions page
- [x] Add filters and search
- [x] Implement data table with selection
- [x] Add summary statistics cards
- [x] Add print functionality
- [x] Add urgency badges and color coding
- [x] Add navigation menu item

### Phase 3: Product Management 🚧 PENDING
- [ ] Add reorder settings to product form
- [ ] Add "Calculate from Sales" helper
- [ ] Add bulk update reorder settings

### Phase 4: Generate PO from Suggestions 🚧 PENDING
- [ ] Implement Generate PO API endpoint
- [ ] Group suggestions by supplier
- [ ] Create draft purchase orders
- [ ] Link to PO editing page

### Phase 5: Automation (Future)
- [ ] Email alerts for critical items
- [ ] Scheduled reorder suggestions report
- [ ] Auto-generate draft POs
- [ ] Integration with supplier APIs

## Testing Checklist

- [ ] Test with products with no sales history
- [ ] Test with products with inconsistent sales
- [ ] Test with products with high velocity
- [ ] Test with products with low velocity
- [ ] Test location filtering
- [ ] Test supplier filtering
- [ ] Test urgency calculations
- [ ] Test PO generation
- [ ] Test with multiple suppliers
- [ ] Test edge cases (zero stock, negative stock)

## Future Enhancements

1. **Seasonal Adjustments**
   - Account for seasonal sales patterns
   - Adjust reorder points based on historical trends

2. **Supplier Performance Tracking**
   - Track actual lead times vs estimated
   - Auto-adjust lead time based on history

3. **Multi-Supplier Optimization**
   - Compare prices from multiple suppliers
   - Suggest best supplier based on price/lead time

4. **Demand Forecasting**
   - Use ML to predict future demand
   - Account for promotions and events

5. **Economic Order Quantity (EOQ)**
   - Calculate optimal order quantity
   - Consider ordering costs and holding costs

## Related Files

- `/prisma/schema.prisma` - Database schema (reorder fields added)
- `/src/app/api/purchases/suggestions/route.ts` - API endpoint (to create)
- `/src/app/dashboard/purchases/suggestions/page.tsx` - UI page (to create)
- `/src/lib/rbac.ts` - Permissions (to update)
- `/src/components/Sidebar.tsx` - Navigation (to update)

## Status

🚧 **IN PROGRESS** - Schema updated, implementing API endpoint next
