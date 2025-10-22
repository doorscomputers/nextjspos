# Auto-Reorder Best Practices Guide

## ✅ Fixed: Non-Inventory Products Excluded

The Bulk Reorder Update page now automatically **excludes products with stock tracking disabled** (services, virtual products, etc.). Only inventory-tracked products will appear.

---

## ❓ Should Every Product Have Auto-Reorder Enabled?

**Short Answer: NO** ❌

**Long Answer:** Auto-reorder should be used strategically, not universally. Here's why:

---

## 📊 When to ENABLE Auto-Reorder

### ✅ High-Volume, Fast-Moving Products

**Best For:**
- Daily necessities (bread, milk, eggs)
- Popular consumer goods
- Regular inventory turnover
- Predictable demand patterns

**Example:** A grocery store's top 50 best-sellers

**Why It Works:**
- Consistent sales history provides accurate predictions
- Regular reordering prevents stockouts
- Saves time on routine ordering

---

### ✅ Critical Stock Items

**Best For:**
- Essential products that customers expect in stock
- Items with high customer demand
- Products with good profit margins
- Items with reliable suppliers

**Example:** Pharmacy's most-prescribed medications

**Why It Works:**
- Stockouts damage customer trust
- Auto-reorder prevents revenue loss
- Maintains competitive advantage

---

### ✅ Products with Stable Suppliers

**Best For:**
- Suppliers with consistent delivery times
- Reliable lead times (e.g., always 7 days)
- Established business relationships
- Predictable pricing

**Example:** Long-term supplier contracts

**Why It Works:**
- System can accurately calculate reorder points
- Lead time predictions are reliable
- Reduces ordering errors

---

## ⛔ When to DISABLE Auto-Reorder

### ❌ New Products (No Sales History)

**Reason:**
- System needs 30 days of sales data
- No baseline for predictions
- Risk of over-ordering untested products

**What to Do:**
- Wait 30-60 days to gather sales data
- Order manually based on market testing
- Enable auto-reorder once demand stabilizes

---

### ❌ Seasonal Products

**Reason:**
- Demand varies dramatically by season
- Historical averages are misleading
- Example: Christmas decorations in January

**What to Do:**
- Manual ordering based on seasonal calendars
- Use sales data from same season last year
- Disable auto-reorder during off-season

---

### ❌ Slow-Moving/Dead Stock

**Reason:**
- Low or zero sales in past 30 days
- Tying up cash in inventory
- Risk of expiration or obsolescence

**What to Do:**
- Manually review before ordering
- Consider discontinuing the product
- Clear out existing stock first

---

### ❌ Promotional/Special Items

**Reason:**
- Demand spikes artificially during promotions
- System over-estimates ongoing demand
- Creates excess inventory post-promotion

**What to Do:**
- Manual ordering for promotional stock
- Disable auto-reorder during promotion period
- Re-enable after demand normalizes

---

### ❌ Custom/Made-to-Order Products

**Reason:**
- No standard inventory levels
- Ordered only when customers request
- Each order may be unique

**What to Do:**
- Keep auto-reorder disabled
- Order based on confirmed customer orders
- Don't maintain standing inventory

---

### ❌ Products Being Phased Out

**Reason:**
- You're discontinuing the product
- Supplier may stop manufacturing
- Replacement products available

**What to Do:**
- Disable auto-reorder immediately
- Sell through existing inventory
- Don't create new purchase orders

---

### ❌ High-Value, Low-Turnover Items

**Reason:**
- Expensive products (e.g., luxury goods)
- Ties up significant capital
- May sit in inventory for months

**What to Do:**
- Manual ordering based on confirmed demand
- Minimize inventory holding costs
- Order only when close to stockout

---

### ❌ Products with Unreliable Suppliers

**Reason:**
- Lead times vary widely (3-14 days)
- Frequent stockouts from supplier
- Price fluctuations

**What to Do:**
- Manual ordering allows flexibility
- Can source from alternate suppliers
- Negotiate better terms before automating

---

## 🎯 Recommended Auto-Reorder Strategy

### Phase 1: Start Small (Week 1-2)

Enable auto-reorder for:
- Your **top 10-20 best-sellers** only
- Products with **consistent sales** (daily/weekly)
- Items with **reliable suppliers**

**Goal:** Learn the system with low risk

---

### Phase 2: Expand Gradually (Week 3-4)

Add:
- Next **50 high-volume products**
- Products with **established demand patterns**
- Items accounting for **80% of your revenue** (Pareto Principle)

**Goal:** Cover majority of your sales

---

### Phase 3: Fine-Tune (Month 2-3)

- Monitor suggestions weekly
- Adjust lead times and safety stock based on actual results
- Add more products as confidence grows
- Disable auto-reorder for products with erratic demand

**Goal:** Optimize the system

---

### Phase 4: Maintenance (Ongoing)

- Review monthly
- Disable for slow movers
- Enable for new products after 30 days
- Seasonal adjustments

**Goal:** Continuous improvement

---

## 📈 Suggested Percentages

For a typical retail business:

| Product Category | Auto-Reorder % | Reasoning |
|-----------------|----------------|-----------|
| **Fast-Moving Consumer Goods** | 80-100% | Predictable demand |
| **Regular Inventory** | 40-60% | Mix of fast and slow movers |
| **Specialty Items** | 10-20% | Unpredictable demand |
| **Custom/Made-to-Order** | 0% | No standard inventory |
| **Seasonal Products** | 0-30% | Varies by season |
| **New Products** | 0% | No sales history yet |

**Overall Target:** Enable auto-reorder for **30-50%** of your total product catalog, covering **70-90%** of your sales volume.

---

## 🚦 Decision Matrix

Use this quick decision tree:

```
Does product have stock tracking enabled?
├─ NO → ❌ Don't enable (services, virtual products)
└─ YES → Continue...

Does product have 30+ days of sales history?
├─ NO → ❌ Wait 30 days, order manually
└─ YES → Continue...

Does product sell at least weekly?
├─ NO → ❌ Manual ordering (slow mover)
└─ YES → Continue...

Is demand predictable (not seasonal/promotional)?
├─ NO → ❌ Manual ordering
└─ YES → Continue...

Does supplier have consistent lead times?
├─ NO → ❌ Manual ordering (unreliable supplier)
└─ YES → Continue...

Are you planning to continue selling this product?
├─ NO → ❌ Don't enable (phasing out)
└─ YES → ✅ ENABLE AUTO-REORDER
```

---

## 💡 Real-World Examples

### ✅ Example 1: Grocery Store

**Enable Auto-Reorder:**
- Milk, bread, eggs (daily sales)
- Canned goods (steady demand)
- Cleaning supplies (weekly sales)
- Beverages (high turnover)

**Disable Auto-Reorder:**
- Holiday-specific items (seasonal)
- New imported products (testing phase)
- Gourmet specialty items (slow movers)
- Products being replaced (phase-out)

**Result:** 45% of products on auto-reorder, covering 85% of sales

---

### ✅ Example 2: Electronics Store

**Enable Auto-Reorder:**
- Popular phone accessories (cables, cases)
- Common batteries (AA, AAA)
- Bestselling headphones
- Standard HDMI cables

**Disable Auto-Reorder:**
- Latest flagship phones (manual control)
- Seasonal gaming consoles (promotional spikes)
- Clearance items (discontinuing)
- Custom build components (per order)

**Result:** 25% of products on auto-reorder, covering 60% of sales

---

### ✅ Example 3: Restaurant Supply Business

**Enable Auto-Reorder:**
- Disposable plates, cups (bulk items)
- Standard utensils (steady demand)
- Common cleaning supplies
- Food storage containers

**Disable Auto-Reorder:**
- Specialty equipment (per customer order)
- Seasonal decor items
- New product lines (testing phase)
- High-value equipment (manual control)

**Result:** 35% of products on auto-reorder, covering 75% of sales

---

## 🎓 Key Takeaways

1. **Quality Over Quantity** - It's better to have auto-reorder on 50 products working perfectly than 500 products with errors

2. **Start Conservative** - Begin with your most predictable products, expand as you gain confidence

3. **Monitor Weekly** - Review purchase suggestions regularly and adjust settings

4. **Seasonal Awareness** - Disable auto-reorder before seasonal changes, re-enable when demand normalizes

5. **30-Day Rule** - Never enable auto-reorder on products without at least 30 days of sales history

6. **80/20 Rule** - Focus on the 20% of products that generate 80% of your revenue

7. **Trust But Verify** - The system is smart, but human oversight is still essential

8. **Adjust and Improve** - Fine-tune lead times and safety stock based on real-world results

---

## 📋 Quick Checklist

Before enabling auto-reorder on a product, verify:

- [ ] Product has stock tracking enabled (`enableStock = true`)
- [ ] Product has 30+ days of sales history
- [ ] Product sells at least weekly (preferably daily)
- [ ] Demand is predictable (not seasonal/promotional)
- [ ] Supplier has reliable lead times
- [ ] You plan to continue selling this product
- [ ] Product is not custom/made-to-order
- [ ] Current stock levels are accurate in the system

---

## 🔄 Ongoing Maintenance

### Weekly Tasks
- Review purchase suggestions
- Approve/reject suggested orders
- Check for unusual quantities

### Monthly Tasks
- Review auto-reorder performance
- Disable slow movers
- Enable new products with enough history
- Adjust lead times based on supplier performance

### Quarterly Tasks
- Analyze stockout rates
- Review excess inventory
- Fine-tune reorder points and quantities
- Seasonal adjustments

### Annually
- Complete inventory audit
- Supplier performance review
- System optimization
- Strategic planning for next year

---

## ✅ Summary

**Auto-Reorder is a Tool, Not a Solution**

Use it strategically for:
- ✅ High-volume, predictable products
- ✅ Essential inventory items
- ✅ Products with reliable suppliers
- ✅ Regular, consistent demand

Avoid it for:
- ❌ New products (no sales history)
- ❌ Seasonal items
- ❌ Slow movers
- ❌ Custom/special orders
- ❌ Products being phased out

**The Goal:** Automate routine ordering for predictable products, allowing you to focus manual attention on strategic inventory decisions.

---

**Updated:** October 20, 2025
**Page:** `http://localhost:3000/dashboard/products/bulk-reorder-update`
