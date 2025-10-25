# pos-negative-stock-blocker

## Purpose
Prevents overselling by blocking operations that would result in negative stock.

## Implementation
```typescript
// In updateStock function
if (newQty < 0 && !(allowNegative ?? false)) {
  throw new Error(
    `Insufficient stock: Available ${currentQty}, Required ${Math.abs(quantity)}, ` +
    `Shortage: ${Math.abs(newQty)}`
  )
}

// Business settings
interface BusinessSettings {
  allowNegativeStock: boolean  // Default: false
  negativeStockAlert: boolean  // Alert if going negative
  negativeStockThreshold: number  // Warn at -5
}

// Sales validation
async function validateSaleStock(items: SaleItem[], locationId: number) {
  const insufficient = []
  
  for (const item of items) {
    const stock = await getStock(item.variationId, locationId)
    if (stock < item.quantity) {
      insufficient.push({
        product: item.productName,
        available: stock,
        requested: item.quantity,
        shortage: item.quantity - stock
      })
    }
  }
  
  if (insufficient.length > 0) {
    throw new Error(`Insufficient stock for ${insufficient.length} items`)
  }
}
```

## Best Practices
- Check before sale
- Real-time stock display
- Suggest alternatives
- Backorder support
