---
name: pos-webhook-event-manager
description: Sends real-time event notifications to external systems via webhooks for inventory changes, sales, a
---

# pos-webhook-event-manager

## Purpose
Sends real-time event notifications to external systems via webhooks for inventory changes, sales, and stock alerts.

## Implementation
```typescript
interface WebhookEvent {
  event: string  // 'inventory.updated', 'sale.created', 'stock.low'
  data: any
  timestamp: Date
}

async function triggerWebhook(event: string, data: any) {
  const webhooks = await prisma.webhook.findMany({
    where: {
      businessId: data.businessId,
      events: { has: event },
      active: true
    }
  })
  
  for (const webhook of webhooks) {
    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': generateSignature(webhook.secret, data)
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        })
      })
      
      // Log success
      await prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event,
          status: 'success',
          sentAt: new Date()
        }
      })
    } catch (error: any) {
      // Log failure and retry
      await prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          event,
          status: 'failed',
          error: error.message,
          sentAt: new Date()
        }
      })
    }
  }
}

// Usage after sale creation
await triggerWebhook('sale.created', {
  businessId,
  saleId: sale.id,
  invoiceNumber: sale.invoiceNumber,
  totalAmount: sale.totalAmount
})
```

## Supported Events
- inventory.updated
- inventory.low_stock
- sale.created
- purchase.received
- transfer.completed
