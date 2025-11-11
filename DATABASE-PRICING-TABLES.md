# Database Tables for Location-Specific Pricing

## Overview

The system uses **3 main tables** for pricing:

```
1. VariationLocationDetails        (Step 4 - Base product price per location)
2. ProductUnitPrice               (Global unit prices - fallback)
3. ProductUnitLocationPrice       (Step 5 - Location-specific unit prices) ⭐
```

---

## 📊 Table Structures

### 1. `variation_location_details` (Step 4)

**Purpose**: Base product price per location (single price, not per unit)

**Schema**:
```sql
CREATE TABLE variation_location_details (
  id                    SERIAL PRIMARY KEY,
  product_id            INT NOT NULL,
  product_variation_id  INT NOT NULL,
  location_id           INT NOT NULL,

  -- Pricing
  selling_price         DECIMAL(22,4),     -- Base selling price
  price_percentage      DECIMAL(5,2),      -- Markup/markdown %

  -- Stock
  qty_available         DECIMAL(22,4),     -- Current stock

  -- Audit
  last_price_update     TIMESTAMP,
  last_price_updated_by INT,

  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),

  UNIQUE(product_variation_id, location_id)
);
```

**Example Data**:
| product_variation_id | location_id | selling_price | Location Name |
|---------------------|-------------|---------------|---------------|
| 5890 | 3 | ₱1,650.00 | Bambang |
| 5890 | 4 | ₱1,650.00 | Tuguegarao |

**Used By**: Step 4 in Price Editor - sets ONE price per location (not per unit)

---

### 2. `product_unit_prices` (Global)

**Purpose**: Global unit prices (fallback when no location-specific price exists)

**Schema**:
```sql
CREATE TABLE product_unit_prices (
  id              SERIAL PRIMARY KEY,
  business_id     INT NOT NULL,
  product_id      INT NOT NULL,
  unit_id         INT NOT NULL,

  -- Pricing per unit
  purchase_price  DECIMAL(22,4) NOT NULL,  -- Cost price
  selling_price   DECIMAL(22,4) NOT NULL,  -- Selling price

  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  UNIQUE(product_id, unit_id)
);
```

**Example Data**:
| product_id | unit_id | purchase_price | selling_price | Unit Name |
|-----------|---------|----------------|---------------|-----------|
| 4627 | 3 | ₱1,500.00 | ₱1,650.00 | Roll |
| 4627 | 4 | ₱6.33 | ₱6.71 | Meter |

**Used By**: Fallback when ProductUnitLocationPrice doesn't exist

---

### 3. `product_unit_location_prices` ⭐ (Location-Specific)

**Purpose**: Location-specific unit prices (Step 5 - highest priority)

**Schema**:
```sql
CREATE TABLE product_unit_location_prices (
  id              SERIAL PRIMARY KEY,
  business_id     INT NOT NULL,
  product_id      INT NOT NULL,
  location_id     INT NOT NULL,  -- ⭐ Location-specific!
  unit_id         INT NOT NULL,  -- ⭐ Per unit!

  -- Pricing per unit per location
  purchase_price  DECIMAL(22,4) NOT NULL,
  selling_price   DECIMAL(22,4) NOT NULL,

  -- Audit trail
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  last_updated_by    INT,

  UNIQUE(product_id, location_id, unit_id)  -- One price per product-location-unit
);
```

**Example Data**:
| product_id | location_id | unit_id | purchase_price | selling_price | Location | Unit |
|-----------|-------------|---------|----------------|---------------|----------|------|
| 4627 | 3 | 3 | ₱1,900.00 | **₱2,014.00** | **Bambang** | Roll |
| 4627 | 3 | 4 | ₱8.00 | **₱9.00** | **Bambang** | Meter |
| 4627 | 4 | 3 | ₱1,900.00 | **₱2,014.00** | **Tuguegarao** | Roll |
| 4627 | 4 | 4 | ₱8.00 | **₱9.00** | **Tuguegarao** | Meter |
| 4627 | 5 | 3 | ₱1,500.00 | **₱1,650.00** | **Santiago** | Roll |
| 4627 | 5 | 4 | ₱6.33 | **₱6.71** | **Santiago** | Meter |

**Used By**: Step 5 in Price Editor + POS (highest priority)

---

## 🔄 Price Priority Logic

When POS needs a price, it checks in this order:

```
Priority 1: ProductUnitLocationPrice (product_unit_location_prices)
  ├─ Check: WHERE product_id=4627 AND location_id=3 AND unit_id=3
  └─ If found: Use ₱2,014 ✅

Priority 2: ProductUnitPrice (product_unit_prices)
  ├─ Check: WHERE product_id=4627 AND unit_id=3
  └─ If found: Use ₱1,650 (global fallback)

Priority 3: VariationLocationDetails (variation_location_details)
  ├─ Check: WHERE product_variation_id=5890 AND location_id=3
  └─ If found: Use base price (last resort)
```

---

## 📝 SQL Queries Used by POS

### When adding product to cart (e.g., Bambang location, Roll unit):

```sql
-- Step 1: Try location-specific unit price (PRIORITY 1)
SELECT selling_price
FROM product_unit_location_prices
WHERE product_id = 4627
  AND location_id = 3      -- Bambang
  AND unit_id = 3          -- Roll
LIMIT 1;

-- Result: ₱2,014.00 ✅ (if exists)

-- Step 2: If not found, try global unit price (PRIORITY 2)
SELECT selling_price
FROM product_unit_prices
WHERE product_id = 4627
  AND unit_id = 3          -- Roll
LIMIT 1;

-- Result: ₱1,650.00 (fallback)

-- Step 3: If not found, try base product price (PRIORITY 3)
SELECT selling_price
FROM variation_location_details
WHERE product_variation_id = 5890
  AND location_id = 3      -- Bambang
LIMIT 1;

-- Result: ₱1,650.00 (last resort)
```

---

## 🎯 How Step 5 Saves Prices

When you check **Bambang** in Step 3 and set prices in Step 5:

**API Call**:
```javascript
POST /api/products/unit-prices
{
  productId: 4627,
  locationIds: [3],  // Bambang only
  unitPrices: [
    { unitId: 3, purchasePrice: 1900, sellingPrice: 2014 },  // Roll
    { unitId: 4, purchasePrice: 8, sellingPrice: 9 }         // Meter
  ]
}
```

**SQL Executed**:
```sql
-- For EACH location (only Bambang in this case)
-- For EACH unit (Roll and Meter)

-- Roll price for Bambang
INSERT INTO product_unit_location_prices
  (business_id, product_id, location_id, unit_id, purchase_price, selling_price, last_updated_by)
VALUES
  (1, 4627, 3, 3, 1900.00, 2014.00, 1)
ON CONFLICT (product_id, location_id, unit_id)
DO UPDATE SET
  purchase_price = 1900.00,
  selling_price = 2014.00,
  last_updated_by = 1,
  updated_at = NOW();

-- Meter price for Bambang
INSERT INTO product_unit_location_prices
  (business_id, product_id, location_id, unit_id, purchase_price, selling_price, last_updated_by)
VALUES
  (1, 4627, 3, 4, 8.00, 9.00, 1)
ON CONFLICT (product_id, location_id, unit_id)
DO UPDATE SET
  purchase_price = 8.00,
  selling_price = 9.00,
  last_updated_by = 1,
  updated_at = NOW();
```

**Result**: ONLY Bambang prices are updated. Other locations are NOT touched.

---

## 🔍 How to Check What's in Database

### Option 1: Run Diagnostic Script (Local)

```bash
npx tsx scripts/diagnose-pricing-issue.ts
```

### Option 2: Direct SQL (Production)

```sql
-- Check location-specific prices for Sample UTP CABLE
SELECT
  p.name as product_name,
  bl.name as location_name,
  u.name as unit_name,
  pulp.purchase_price,
  pulp.selling_price,
  pulp.updated_at
FROM product_unit_location_prices pulp
JOIN products p ON pulp.product_id = p.id
JOIN business_locations bl ON pulp.location_id = bl.id
JOIN units u ON pulp.unit_id = u.id
WHERE p.name = 'Sample UTP CABLE'
ORDER BY bl.name, u.name;
```

**Expected Result**:
```
product_name      | location_name | unit_name | selling_price | updated_at
------------------|---------------|-----------|---------------|------------------
Sample UTP CABLE  | Bambang       | Roll      | 2014.00       | 2025-11-11 16:00
Sample UTP CABLE  | Bambang       | Meter     | 9.00          | 2025-11-11 16:00
Sample UTP CABLE  | Tuguegarao    | Roll      | 2014.00       | 2025-11-11 13:47
Sample UTP CABLE  | Tuguegarao    | Meter     | 9.00          | 2025-11-11 13:47
```

---

## ✅ Summary

| Table | Purpose | Priority | Updated By |
|-------|---------|----------|------------|
| **product_unit_location_prices** | Location-specific unit prices | **1 (Highest)** | **Step 5** |
| **product_unit_prices** | Global unit prices | 2 (Fallback) | Global settings |
| **variation_location_details** | Base product price per location | 3 (Last resort) | Step 4 |

**Key Points**:
- ✅ POS **always checks** `product_unit_location_prices` **first**
- ✅ Each location can have **different prices** for each unit
- ✅ Step 5 **only updates checked locations** (not all locations)
- ✅ Prices are stored with `unique(product_id, location_id, unit_id)`

---

## 🔧 Troubleshooting

### Problem: POS showing wrong price

**Check 1**: What's in the database?
```sql
SELECT selling_price
FROM product_unit_location_prices
WHERE product_id = 4627
  AND location_id = 3     -- Your location
  AND unit_id = 3;        -- Your unit
```

**Check 2**: Is locationId being passed correctly?
- Open browser console (F12)
- Go to Network tab
- Add product to cart
- Look for request to `/api/pos/product-units`
- Check URL params: `?productId=4627&locationId=3`

**Check 3**: Is shift started at correct location?
```sql
SELECT u.username, s.location_id, bl.name as location_name
FROM shifts s
JOIN users u ON s.user_id = u.id
JOIN business_locations bl ON s.location_id = bl.id
WHERE s.status = 'open'
  AND u.username = 'BambangCashier';
```

---

**Last Updated**: 2025-11-11
**Related Docs**:
- `POS-LOCATION-PRICING-VERIFICATION.md`
- `STEP-4-VS-STEP-5-GUIDE.md`
- `FIX-POS-INITIAL-CART-PRICING.md`
