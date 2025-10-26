---
name: pos-transaction-reversal-manager
description: Safely reverses erroneous inventory transactions while maintaining complete audit trail and data int
---

# pos-transaction-reversal-manager

## Purpose
Safely reverses erroneous inventory transactions while maintaining complete audit trail and data integrity.

## When to Use
- Correcting data entry errors
- Reversing duplicate transactions
- Undoing incorrect sales/purchases
- Fixing wrong location transactions
- Emergency corrections

## Critical Requirements
```typescript
// NEVER delete transactions - always reverse
interface TransactionReversal {
  originalTransactionId: number
  reversalReason: string
  reversalBy: number
  reversalDate: Date
  requiresApproval: boolean
}

// Create offsetting transaction
const reversalTxn = {
  quantity: -originalQuantity,  // Opposite sign
  transactionType: 'correction',
  notes: `REVERSAL of txn #${originalId}: ${reason}`
}
```

## Implementation
```typescript
// Step 1: Verify transaction can be reversed
const txn = await prisma.stockTransaction.findUnique({
  where: { id: transactionId }
})

if (txn.reversedAt) {
  throw new Error('Transaction already reversed')
}

// Step 2: Create reversal transaction
await prisma.$transaction(async (tx) => {
  const reversal = await tx.stockTransaction.create({
    data: {
      ...txn,
      id: undefined,  // New ID
      quantity: -txn.quantity,  // Opposite
      notes: `REVERSAL: ${reason}`,
      referenceType: 'TransactionReversal',
      referenceId: txn.id.toString()
    }
  })

  // Step 3: Mark original as reversed
  await tx.stockTransaction.update({
    where: { id: transactionId },
    data: {
      reversedAt: new Date(),
      reversedBy: userId,
      reversalReason: reason
    }
  })

  // Step 4: Audit log
  await createAuditLog({
    action: 'TRANSACTION_REVERSAL',
    metadata: {
      originalTxnId: txn.id,
      reversalTxnId: reversal.id,
      reason, requiresApproval: true
    }
  })
})
```

## Best Practices
- **Never delete** original transaction
- **Require approval** for all reversals
- **Password protect** reversal function
- **Track reversal patterns** (fraud detection)
- **Limit time window** for reversals (e.g., 30 days)

## Related Skills
- pos-inventory-transaction-logger
- pos-audit-trail-architect
