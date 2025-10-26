---
name: pos-barcode-label-printer
description: Generates and prints barcode/QR code labels for products with customizable templates.
---

# pos-barcode-label-printer

## Purpose
Generates and prints barcode/QR code labels for products with customizable templates.

## Implementation
```typescript
import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

async function generateBarcodeLabel(product: Product) {
  const canvas = document.createElement('canvas')
  
  // Generate barcode
  JsBarcode(canvas, product.barcode, {
    format: 'CODE128',
    width: 2,
    height: 50,
    displayValue: true
  })
  
  // Label template
  return `
    <div class="label">
      <div class="product-name">${product.name}</div>
      <div class="sku">SKU: ${product.sku}</div>
      <img src="${canvas.toDataURL()}" />
      <div class="price">$${product.sellingPrice}</div>
    </div>
  `
}

// Bulk print
async function printLabels(products: Product[]) {
  const labels = await Promise.all(
    products.map(p => generateBarcodeLabel(p))
  )
  
  window.print()  // Or send to label printer
}
```

## Best Practices
- Support multiple barcode formats (EAN13, CODE128, QR)
- Customizable label sizes
- Batch printing
- Preview before print
