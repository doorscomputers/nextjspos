# pos-quality-control-workflow

## Purpose
Manages quality control inspections for purchase receipts with checklist templates, pass/fail tracking, and defect recording.

## Implementation
```typescript
// Create QC inspection on GRN approval
await prisma.qualityControlInspection.create({
  data: {
    businessId, receiptId,
    scheduledDate: new Date(),
    status: 'pending',
    templateId: qcTemplateId
  }
})

// Record inspection results
await prisma.qualityControlItem.create({
  data: {
    inspectionId, itemId,
    inspectedQty, passedQty, failedQty,
    defects: ['scratched', 'misaligned'],
    inspector: userId
  }
})

// Update receipt item quantities
await prisma.purchaseReceiptItem.update({
  data: {
    acceptedQty: passedQty,
    rejectedQty: failedQty
  }
})
```

## Best Practices
- Use **checklist templates** for consistency
- **Photo documentation** of defects
- **Supplier quality tracking**
- **Automatic supplier returns** for failures
