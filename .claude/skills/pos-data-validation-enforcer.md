# pos-data-validation-enforcer

## Purpose
Enforces pre-save validation rules to prevent invalid data entry.

## Validation Rules
```typescript
const productValidation = {
  name: { required: true, minLength: 3, maxLength: 255 },
  sku: { required: true, unique: true, pattern: /^[A-Z0-9-]+$/ },
  costPrice: { min: 0, max: 999999.99 },
  sellingPrice: { min: 0, greaterThan: 'costPrice' },
  barcode: { unique: true, pattern: /^[0-9]{8,13}$/ },
  taxRate: { min: 0, max: 100 }
}

async function validateProduct(data: any) {
  const errors = []
  
  // Required fields
  if (!data.name || data.name.length < 3) {
    errors.push('Name must be at least 3 characters')
  }
  
  // SKU uniqueness
  const existingSKU = await prisma.product.findFirst({
    where: { sku: data.sku, businessId: data.businessId }
  })
  if (existingSKU) {
    errors.push('SKU already exists')
  }
  
  // Price validation
  if (data.sellingPrice < data.costPrice) {
    errors.push('Selling price must be greater than cost price')
  }
  
  return { valid: errors.length === 0, errors }
}
```

## Best Practices
- Validate on client AND server
- Clear error messages
- Field-level validation feedback
- Prevent form submission if invalid
