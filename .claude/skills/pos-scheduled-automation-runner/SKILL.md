---
name: pos-scheduled-automation-runner
description: Runs scheduled background jobs for reports, reorder suggestions, stock alerts, and data cleanup.
---

# pos-scheduled-automation-runner

## Purpose
Runs scheduled background jobs for reports, reorder suggestions, stock alerts, and data cleanup.

## Implementation with Node Cron
```typescript
import cron from 'node-cron'

// Daily stock alert check (8 AM)
cron.schedule('0 8 * * *', async () => {
  const businesses = await prisma.business.findMany()
  
  for (const business of businesses) {
    const lowStockItems = await findLowStockItems(business.id)
    
    if (lowStockItems.length > 0) {
      await sendEmail({
        to: business.ownerEmail,
        subject: 'Low Stock Alert',
        body: `You have ${lowStockItems.length} items below reorder point`,
        attachments: [generateLowStockReport(lowStockItems)]
      })
    }
  }
})

// Weekly reorder suggestions (Monday 9 AM)
cron.schedule('0 9 * * 1', async () => {
  const businesses = await prisma.business.findMany()
  
  for (const business of businesses) {
    const suggestions = await generateReorderSuggestions(business.id)
    
    await sendEmail({
      to: business.procurementEmail,
      subject: 'Weekly Reorder Suggestions',
      body: `Suggested purchase orders for ${suggestions.length} items`,
      attachments: [generateReorderReport(suggestions)]
    })
  }
})

// Monthly inventory valuation (1st of month)
cron.schedule('0 0 1 * *', async () => {
  const businesses = await prisma.business.findMany()
  
  for (const business of businesses) {
    const valuation = await calculateMonthEndValuation(business.id)
    
    await prisma.inventoryValuationSnapshot.create({
      data: {
        businessId: business.id,
        valuationDate: new Date(),
        totalValue: valuation.totalValue,
        method: business.valuationMethod,
        itemCount: valuation.itemCount
      }
    })
  }
})

// Daily data cleanup (midnight)
cron.schedule('0 0 * * *', async () => {
  // Clean up old logs (older than 90 days)
  await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: subDays(new Date(), 90) }
    }
  })
  
  // Archive old transactions (older than 2 years)
  await archiveOldTransactions()
})

// Hourly sync with e-commerce (every hour)
cron.schedule('0 * * * *', async () => {
  const businesses = await prisma.business.findMany({
    where: { shopifyEnabled: true }
  })
  
  for (const business of businesses) {
    await syncInventoryToShopify(business.id)
  }
})
```

## Alternative: Vercel Cron (for serverless)
```typescript
// /app/api/cron/daily-alerts/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  await runDailyAlerts()
  
  return Response.json({ success: true })
}

// vercel.json
{
  "crons": [{
    "path": "/api/cron/daily-alerts",
    "schedule": "0 8 * * *"
  }]
}
```

## Best Practices
- Error handling and retries
- Email notifications on failures
- Execution time logging
- Rate limiting for external APIs
- Timezone awareness
