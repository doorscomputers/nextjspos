# Sales Invoice Customer Information Update

## Summary
Modified the sales invoice print layout to include customer information fields below "Amount Tendered".

## Changes Made

### 1. Component Backup Created
✅ **Backup file**: `src/components/SalesInvoicePrint.tsx.backup`

### 2. Modified Component
✅ **File**: `src/components/SalesInvoicePrint.tsx`

**New section added** (lines 662-696):
- **Sold to**: Displays customer name (defaults to "Walk-in Customer")
- **Address**: Displays customer address (shows underscores if empty)
- **TIN**: Displays customer tax number (shows underscores if empty)
- **Bus. Style**: Displays customer business style (shows underscores if empty)

The section is:
- Positioned below "Amount Tendered"
- Positioned above "Change" (if applicable)
- Responsive to all paper sizes (80mm, A4, Letter, Legal)
- Styled consistently with the rest of the invoice

### 3. Database Schema Updated
✅ **File**: `prisma/schema.prisma`

**Added field to Customer model** (line 826):
```prisma
businessStyle String?  @map("business_style") @db.VarChar(100)
```

## Next Steps to Complete Setup

### Option 1: Restart Computer (Recommended)
1. Restart your computer to release file locks
2. After restart, run:
   ```bash
   npx prisma generate
   npm run db:push
   ```

### Option 2: Manual Database Update (If you can't restart)
1. Close all applications that might be using Node.js
2. Close your IDE/editor completely
3. Open a new terminal and run:
   ```bash
   npx prisma generate
   npm run db:push
   ```

### Option 3: Direct SQL Migration
If Prisma still won't work, run this SQL directly in your PostgreSQL database:

```sql
ALTER TABLE customers ADD COLUMN business_style VARCHAR(100);
```

Then try:
```bash
npx prisma generate
```

## Testing the Changes

After successfully running Prisma generate and db:push:

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Go to POS or Sales page
3. Create or view a sale with a customer
4. Click "Print Receipt"
5. You should see the new customer information section below "Amount Tendered"

## Customer Data Fields Used

The invoice will display:
- **Sold to**: `sale.customer?.name` or "Walk-in Customer"
- **Address**: `sale.customer?.address` or underscores
- **TIN**: `sale.customer?.taxNumber` or underscores
- **Bus. Style**: `sale.customer?.businessStyle` or underscores

## Updating Customer Records

To populate these fields for existing customers:

1. Go to Customers page
2. Edit a customer
3. Fill in:
   - Address (already exists)
   - TIN/Tax Number (already exists)
   - Business Style (new field - add via API or seed script)

## Rollback Instructions

If you need to revert the changes:

```bash
# Restore the backup
copy src\components\SalesInvoicePrint.tsx.backup src\components\SalesInvoicePrint.tsx

# Remove the database field
npx prisma db execute --stdin < remove_business_style.sql
```

Create `remove_business_style.sql`:
```sql
ALTER TABLE customers DROP COLUMN business_style;
```

## Notes

- The `businessStyle` field is optional and will display underscores if not filled
- All paper sizes (80mm thermal, A4, Letter, Legal) are supported
- The layout is responsive and maintains proper formatting
- Customer information appears between "Amount Tendered" and "Change"
