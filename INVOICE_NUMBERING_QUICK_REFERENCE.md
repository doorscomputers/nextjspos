# Invoice Numbering Quick Reference Guide

## Format

```
Inv{LocationName}{MM_DD_YYYY}_####
```

## Real Examples

| Location | Date | Invoice Numbers |
|----------|------|-----------------|
| Main Warehouse | 11/13/2025 | `InvMain11_13_2025_0001` |
| Main Warehouse | 11/13/2025 | `InvMain11_13_2025_0002` |
| Main Warehouse | 11/14/2025 | `InvMain11_13_2025_0001` (resets) |
| Bambang Store | 11/13/2025 | `InvBambang11_13_2025_0001` |
| Tuguegarao Branch | 11/13/2025 | `InvTugue11_13_2025_0001` |

## Key Features

✅ **Independent per Location**: Each location has its own sequence
✅ **Daily Reset**: Sequences reset to 0001 every day
✅ **Thread-Safe**: Supports concurrent transactions
✅ **BIR Compliant**: Meets Philippine Bureau of Internal Revenue requirements
✅ **Shared with X/Z Readings**: Readings use same sequence for continuous numbering

## API Usage

### Sales Invoice
```typescript
import { getNextInvoiceNumber } from '@/lib/atomicNumbers'

const invoiceNumber = await getNextInvoiceNumber(
  businessId,      // 1
  locationId,      // 2
  locationName,    // "Main Warehouse"
  tx              // Optional transaction client
)
// Returns: "InvMain11_13_2025_0042"
```

### X/Z Reading Receipt
```typescript
import { getNextReadingReceiptNumber } from '@/lib/atomicNumbers'

const receiptNumber = await getNextReadingReceiptNumber(
  businessId,
  locationId,
  locationName
)
// Returns: "InvMain11_13_2025_0043"
```

## Testing

```bash
# Run comprehensive tests
npx tsx scripts/test-invoice-numbering.ts

# Reset sequences (development only)
npx tsx scripts/cleanup-old-sequences.ts

# Check database constraints
npx tsx scripts/check-constraints.ts
```

## Troubleshooting

### Check Today's Sequences
```sql
SELECT
  bl.name as location,
  iseq.sequence as current_number,
  iseq.updated_at
FROM invoice_sequences iseq
JOIN business_locations bl ON iseq.location_id = bl.id
WHERE iseq.year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND iseq.month = EXTRACT(MONTH FROM CURRENT_DATE)
  AND iseq.day = EXTRACT(DAY FROM CURRENT_DATE);
```

### View Recent Invoices
```sql
SELECT
  s.invoice_number,
  s.sale_date,
  bl.name as location,
  s.created_at
FROM sales s
JOIN business_locations bl ON s.location_id = bl.id
WHERE s.created_at >= CURRENT_DATE
ORDER BY s.created_at DESC
LIMIT 20;
```

### Reset a Location's Daily Sequence (Emergency Only)
```sql
DELETE FROM invoice_sequences
WHERE location_id = 2
  AND year = 2025
  AND month = 11
  AND day = 13;
-- Next invoice will start at 0001
```

## Migration Status

✅ **Database Migration**: Completed
✅ **Code Updates**: Completed
✅ **Tests**: 7/7 Passing
✅ **Production Ready**: Yes

## Support

For issues or questions:
1. Check logs: Look for "Invoice" or "sequence" errors
2. Verify database: Use SQL queries above
3. Run tests: `npx tsx scripts/test-invoice-numbering.ts`
4. Review documentation: `LOCATION_BASED_INVOICE_NUMBERING_IMPLEMENTATION.md`

---

**Last Updated**: November 13, 2025
**Status**: ✅ Production Ready
