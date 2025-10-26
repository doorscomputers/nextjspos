---
name: pos-concurrent-update-guardian
description: Prevents race conditions with optimistic locking and transaction isolation.
---

# pos-concurrent-update-guardian

## Purpose
Prevents race conditions with optimistic locking and transaction isolation.

## Implementation
```typescript
// Optimistic locking with version field
interface VariationLocationDetails {
  version: number  // Incremented on each update
}

// Update with version check
await prisma.variationLocationDetails.updateMany({
  where: {
    variationId_locationId: { variationId, locationId },
    version: expectedVersion  // Must match
  },
  data: {
    currentQty: newQty,
    version: { increment: 1 }
  }
})

// Check if update succeeded
if (updateResult.count === 0) {
  throw new Error('Concurrent modification detected. Please retry.')
}

// Alternative: Pessimistic locking
await prisma.$executeRaw`
  SELECT * FROM VariationLocationDetails
  WHERE variationId = ${variationId}
  FOR UPDATE  -- Locks row until transaction completes
`
```

## Best Practices
- Use Prisma transactions
- Implement retry logic (exponential backoff)
- Show conflict resolution UI
- Lock critical sections
