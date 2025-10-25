# pos-bulk-import-wizard

## Purpose
Imports products, inventory, and opening stock from CSV with validation and error reporting.

## Implementation
```typescript
async function importProductsFromCSV(file: File, businessId: number) {
  const rows = await parseCSV(file)
  const results = { success: 0, errors: [] }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      // Validate row
      const validation = validateProductRow(row)
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '))
      }
      
      await prisma.$transaction(async (tx) => {
        // Create product
        const product = await tx.product.create({
          data: {
            businessId,
            name: row.name,
            type: 'single'
          }
        })
        
        // Create variation
        const variation = await tx.productVariation.create({
          data: {
            productId: product.id,
            name: 'Default',
            sku: row.sku,
            barcode: row.barcode,
            costPrice: parseFloat(row.costPrice),
            sellingPrice: parseFloat(row.sellingPrice)
          }
        })
        
        // Set opening stock if provided
        if (row.openingStock) {
          await setOpeningStock(variation.id, row.locationId, row.openingStock, tx)
        }
      })
      
      results.success++
    } catch (error: any) {
      results.errors.push({
        row: i + 1,
        data: row,
        error: error.message
      })
    }
  }
  
  return results
}
```

## CSV Format
```csv
name,sku,barcode,category,costPrice,sellingPrice,openingStock,location
"Product A",PRD-001,1234567890,Electronics,10.00,15.00,100,Main Warehouse
"Product B",PRD-002,0987654321,Clothing,5.00,9.99,50,Branch 1
```

## Best Practices
- Validate before importing
- Show progress bar
- Downloadable error report
- Sample template download
