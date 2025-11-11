# Step 4 vs Step 5: When to Use What?

## Quick Answer

| Product Type | Use Step 4? | Use Step 5? |
|--------------|-------------|-------------|
| **Single-unit only** (e.g., just "Piece") | ✅ YES | ❌ NO |
| **Multi-unit** (e.g., Roll + Meter) | ⏭️ SKIP | ✅ YES |
| **Want to set all prices at once** | ⏭️ SKIP | ✅ YES |

## Visual Workflow

### Scenario 1: Single-Unit Product (e.g., "T-Shirt" in Pieces only)

```
Step 1: Search → "T-Shirt"
Step 2: Review → Primary Unit: Piece
Step 3: Select Locations → ✓ Tuguegarao, ✓ Bambang
Step 4: Enter Price → ₱350
        ⬇️ SAVES TO VariationLocationDetails
Step 5: SKIP (no sub-units)
        ⬇️
        DONE! ✅
```

**POS Result**: Shows ₱350 at Tuguegarao and Bambang

---

### Scenario 2: Multi-Unit Product (e.g., "Cable" - Roll + Meter)

#### Option A: Use Step 5 Only (Recommended ⭐)

```
Step 1: Search → "Sample UTP CABLE"
Step 2: Review → Primary Unit: Roll, Sub-Unit: Meter
Step 3: Select Locations → ✓ Tuguegarao
Step 4: SKIP
Step 5: Enter All Unit Prices →
        Roll:  Purchase ₱1,900, Selling ₱2,014
        Meter: Purchase ₱8,     Selling ₱9
        ⬇️ SAVES TO ProductUnitLocationPrice
        Click "Save All Prices"
        ⬇️
        DONE! ✅
```

**POS Result**:
- Add to cart → Shows ₱2,014 (Roll price from Step 5)
- Change to Meter → Shows ₱9 (Meter price from Step 5)

#### Option B: Use Both Steps

```
Step 1: Search → "Sample UTP CABLE"
Step 2: Review → Primary Unit: Roll
Step 3: Select Locations → ✓ Tuguegarao
Step 4: Enter Roll Price → ₱2,014
        ⬇️ SAVES TO VariationLocationDetails
Step 5: Enter All Unit Prices →
        Roll:  ₱2,014 (should match Step 4!)
        Meter: ₱9
        ⬇️ SAVES TO ProductUnitLocationPrice
        ⬇️
        DONE! ✅
```

**Why Option A is Better**: Less confusion, no duplicate entry needed

---

### Scenario 3: Global Pricing (No Location Selected)

```
Step 1: Search → "Sample UTP CABLE"
Step 2: Review
Step 3: DON'T check any locations
Step 4: SKIP
Step 5: Enter Unit Prices →
        Roll:  ₱1,500, Selling ₱1,650
        Meter: ₱6.33,   Selling ₱6.71
        ⬇️ SAVES TO ProductUnitPrice (global fallback)
        ⬇️
        DONE! ✅
```

**POS Result**: ALL locations use these prices (unless overridden by location-specific)

---

## What Each Step Does

### Step 4: Update Location Price
| Field | What It Updates |
|-------|-----------------|
| **Table** | `VariationLocationDetails` |
| **Scope** | PRIMARY UNIT ONLY (e.g., Roll) |
| **When POS Uses It** | Initial add to cart |
| **Best For** | Single-unit products OR setting base price |

### Step 5: Update Unit Prices
| Field | What It Updates |
|-------|-----------------|
| **Table** | `ProductUnitLocationPrice` (if locations selected)<br>`ProductUnitPrice` (if no locations) |
| **Scope** | ALL UNITS (Roll, Meter, Piece, etc.) |
| **When POS Uses It** | When selecting units in "Change Unit & Quantity" |
| **Best For** | Multi-unit products with different unit prices |

---

## Common Questions

### Q: Can I skip Step 4 and only use Step 5?
**A**: ✅ YES! For multi-unit products, Step 5 is sufficient.

### Q: What if I use both Step 4 and Step 5?
**A**: Both will work, but make sure the primary unit price in Step 5 matches Step 4 to avoid confusion.

### Q: What if Step 4 shows ₱2,014 but Step 5 shows ₱2,000 for Roll?
**A**: POS will use:
- ₱2,014 when first adding to cart (from Step 4)
- ₱2,000 when you select Roll in unit selector (from Step 5)
This can be confusing! **Best practice**: Keep them the same or skip Step 4.

### Q: I only have "Piece" as a unit. Which step?
**A**: Use **Step 4 only**. Step 5 is not needed.

### Q: I have Roll + Meter. Which step?
**A**: Use **Step 5 only**. Set prices for BOTH Roll and Meter in Step 5.

---

## Recommended Best Practices

### ✅ DO THIS:
1. **For single-unit products**: Use Step 4
2. **For multi-unit products**: Use Step 5 and set ALL units
3. **Check locations in Step 3** before setting prices
4. **Keep primary unit price consistent** between Step 4 and Step 5 (if using both)

### ❌ DON'T DO THIS:
1. Don't set different prices in Step 4 vs Step 5 for the same unit
2. Don't use Step 5 for single-unit products (unnecessary)
3. Don't forget to select locations in Step 3 if you want location-specific pricing

---

## Summary Table

| Situation | Step 3 | Step 4 | Step 5 | Example |
|-----------|--------|--------|--------|---------|
| Single unit, one location | ✓ Tuguegarao | ✅ ₱350 | ⏭️ Skip | T-Shirt at Tuguegarao |
| Multi-unit, one location | ✓ Tuguegarao | ⏭️ Skip | ✅ Roll=₱2014, Meter=₱9 | Cable at Tuguegarao |
| Multi-unit, multiple locations | ✓ Tuguegarao<br>✓ Bambang | ⏭️ Skip | ✅ Roll=₱2014, Meter=₱9 | Cable at both locations |
| Global pricing (all locations) | ⬜ None | ⏭️ Skip | ✅ Roll=₱1650, Meter=₱6.71 | Default prices |

---

## Updated UI Indicators

The UI now shows helpful messages:

**In Step 5 when locations are selected**:
> 💡 **For Multi-Unit Products:** Use this step to set prices for ALL units (Roll, Meter, etc.).
> You can skip Step 4 if you're setting all unit prices here.

**In Instructions section**:
> 📌 **Quick Guide for Multi-Unit Products:**
> - Check location(s) in Step 3
> - Skip Step 4 (or use it for primary unit only)
> - Set ALL unit prices in Step 5 (Roll, Meter, etc.)
> - Click "Save All Prices"

---

## Need Help?

If you're still confused:
1. **Check the product**: Does it have sub-units?
   - **No sub-units**: Use Step 4
   - **Has sub-units**: Use Step 5

2. **When in doubt**: Use Step 5
   - It works for ALL cases
   - Sets all unit prices at once

3. **Test in POS**:
   - Add product to cart
   - Check price shown
   - Click "Change Unit & Quantity"
   - Select different unit
   - Verify price changes correctly
