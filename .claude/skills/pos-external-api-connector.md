# pos-external-api-connector

## Purpose
Integrates with external accounting systems (QuickBooks, Xero), e-commerce platforms, and payment gateways.

## QuickBooks Integration
```typescript
import { QuickBooksClient } from 'quickbooks-sdk'

async function syncSaleToQuickBooks(saleId: number) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true, customer: true }
  })
  
  const qb = new QuickBooksClient({
    clientId: process.env.QB_CLIENT_ID,
    clientSecret: process.env.QB_CLIENT_SECRET,
    realmId: business.qbRealmId
  })
  
  // Create invoice in QuickBooks
  const invoice = await qb.createInvoice({
    CustomerRef: { value: sale.customer.qbCustomerId },
    Line: sale.items.map(item => ({
      Amount: item.unitPrice * item.quantity,
      DetailType: 'SalesItemLineDetail',
      SalesItemLineDetail: {
        ItemRef: { value: item.product.qbItemId },
        Qty: item.quantity,
        UnitPrice: item.unitPrice
      }
    })),
    TotalAmt: sale.totalAmount
  })
  
  // Store QB invoice ID
  await prisma.sale.update({
    where: { id: saleId },
    data: { qbInvoiceId: invoice.Id }
  })
}
```

## Xero Integration
```typescript
import { XeroClient } from 'xero-node'

async function syncInventoryToXero(businessId: number) {
  const xero = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID,
    clientSecret: process.env.XERO_CLIENT_SECRET,
    tenantId: business.xeroTenantId
  })
  
  const products = await prisma.product.findMany({
    where: { businessId }
  })
  
  for (const product of products) {
    await xero.accountingApi.createOrUpdateItems({
      items: [{
        Code: product.sku,
        Name: product.name,
        InventoryAssetAccountCode: '1200',
        QuantityOnHand: product.currentQty,
        PurchaseDetails: {
          UnitPrice: product.costPrice
        },
        SalesDetails: {
          UnitPrice: product.sellingPrice
        }
      }]
    })
  }
}
```

## E-commerce Integration (Shopify/WooCommerce)
```typescript
async function syncStockToShopify(productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variations: true }
  })
  
  for (const variation of product.variations) {
    const totalStock = await getTotalStock(variation.id)
    
    await fetch(`https://${shopDomain}/admin/api/2024-01/inventory_levels/set.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        location_id: shopifyLocationId,
        inventory_item_id: variation.shopifyInventoryItemId,
        available: totalStock
      })
    })
  }
}
```
