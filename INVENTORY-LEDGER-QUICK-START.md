# Inventory Ledger - Quick Start Guide

## What is the Inventory Ledger?

The Inventory Transaction Ledger is a comprehensive audit report that tracks every inventory movement for a product at a specific location. It proves that your current system inventory matches reality by showing all transactions since the last inventory correction.

## Quick Access

**URL:** `/dashboard/reports/inventory-ledger`

**Menu:** Dashboard → Reports → Inventory Ledger

**Required Permission:** `inventory_ledger.view`

## How to Use

### 1. Generate a Report

1. **Search for Product:**
   - Type product name or SKU in search box
   - Select product from dropdown

2. **Select Variation:**
   - Choose the specific variation (size, color, etc.)

3. **Choose Location:**
   - Select the warehouse/branch location

4. **Optional Date Range:**
   - Leave blank to use last inventory correction as baseline
   - Override if you want custom date range

5. **Click "Generate Report"**

### 2. Review the Report

**Reconciliation Status:**
- ✅ **Green "Matched"** = Your inventory is accurate
- ❌ **Red "Discrepancy"** = Investigation needed

**Transaction Details:**
- View every stock movement chronologically
- See running balance after each transaction
- Check reference numbers for source documents

**Summary Statistics:**
- Total Stock In (additions)
- Total Stock Out (reductions)
- Net Change
- Transaction Count

### 3. Export or Print

- **Export to Excel:** Download CSV file for analysis
- **Print Report:** Create PDF for records

## Understanding the Report

### Starting Point (Baseline)
The report starts from your LAST inventory correction. This is the most recent "known-correct" count.

If no correction exists, it starts from the first transaction.

### Transaction Types

| Type | Meaning | Impact |
|------|---------|--------|
| **Stock Received** | Goods received from supplier (GRN) | ➕ Increases inventory |
| **Stock Sold** | Items sold to customers | ➖ Decreases inventory |
| **Transfer In** | Stock received from another location | ➕ Increases inventory |
| **Transfer Out** | Stock sent to another location | ➖ Decreases inventory |
| **Sales Return** | Customer returned items | ➕ Increases inventory |
| **Purchase Return** | Items returned to supplier | ➖ Decreases inventory |
| **Inventory Correction** | Manual adjustment after physical count | ➕➖ Can increase or decrease |

### Running Balance
The "Running Balance" column shows inventory level after each transaction. The final balance should match your current system inventory.

### Variance
If the calculated final balance doesn't match your current system inventory, you'll see a variance amount. This indicates:
- Missing transactions
- Unapproved transactions
- Data entry errors
- Physical discrepancies

## Troubleshooting

### "No Baseline Found"
**Problem:** No inventory correction exists for this product/location.

**Solution:**
1. Create an inventory correction first (Physical Inventory menu)
2. Or use the optional date range to manually set start date

### Report Shows Discrepancy
**Problem:** Calculated balance ≠ System inventory.

**Solution:**
1. Review all transactions carefully
2. Check for pending/unapproved transactions
3. Look for transactions created outside the system
4. Perform physical count and create correction

### No Transactions Shown
**Problem:** Report is empty.

**Possible Causes:**
- Wrong product or location selected
- No transactions in the date range
- All transactions are still pending (not approved)

**Solution:**
1. Verify product and location selection
2. Check transaction statuses (must be approved/completed)
3. Adjust date range

### Today's Transactions Missing
**Problem:** Sales made today not showing.

**Cause:** Report might have been run before transactions were created.

**Solution:**
- Regenerate the report (it includes everything up to current time)

## Best Practices

### 1. Regular Corrections
- Perform inventory corrections regularly (monthly/quarterly)
- This creates clean baseline points for audits

### 2. Immediate Investigation
- If variance detected, investigate immediately
- Document findings and create correction if needed

### 3. Access Control
- Only give export permission to trusted staff
- Monitor who accesses the report (audit logs)

### 4. Record Keeping
- Export and save reports for compliance
- Keep records for tax/audit purposes

### 5. Reconciliation
- Use this report during month-end closing
- Verify inventory before financial statements

## Common Use Cases

### 1. Month-End Verification
"I need to verify inventory before closing the month."

→ Generate report for all key products, check reconciliation status

### 2. Audit Trail
"Auditor needs to see proof of inventory movements."

→ Export report to Excel, provide as supporting document

### 3. Discrepancy Investigation
"System shows 100 units but we only have 95."

→ Generate report, review each transaction to find missing items

### 4. Theft Detection
"Inventory keeps disappearing without sales."

→ Compare calculated vs system inventory regularly

### 5. Transfer Verification
"Did the transfer from Main Warehouse arrive?"

→ Check transaction list for "Transfer In" entry

## Who Can Access?

| Role | View Report | Export |
|------|-------------|--------|
| Super Admin | ✅ Yes | ✅ Yes |
| Branch Admin | ✅ Yes | ✅ Yes |
| Accounting Staff | ✅ Yes | ✅ Yes |
| Branch Manager | ✅ Yes | ❌ No |
| Regular Staff | ❌ No | ❌ No |
| Cashier | ❌ No | ❌ No |

## API Access

For developers or integrations:

```bash
GET /api/reports/inventory-ledger?productId=1&locationId=1&variationId=1
```

**Parameters:**
- `productId` (required)
- `locationId` (required)
- `variationId` (required)
- `startDate` (optional)
- `endDate` (optional)

**Response:** JSON with header, transactions, and summary

## Support

For technical issues or questions:
1. Check this guide first
2. Review full documentation: `INVENTORY-LEDGER-IMPLEMENTATION.md`
3. Contact system administrator
4. Contact development team

## Quick Tips

💡 **Tip 1:** Use product search instead of scrolling through dropdown

💡 **Tip 2:** Export to Excel for detailed analysis in spreadsheet

💡 **Tip 3:** Print report immediately after physical count for records

💡 **Tip 4:** Check reconciliation status before month-end closing

💡 **Tip 5:** Generate reports for fast-moving items weekly

## Example Report Interpretation

```
Starting Balance: 50 units (from last correction on Jan 1)

Transactions:
Jan 5: Stock Received +100 = Balance: 150
Jan 7: Stock Sold -25 = Balance: 125
Jan 10: Transfer Out -20 = Balance: 105
Jan 12: Sales Return +5 = Balance: 110

Calculated Final Balance: 110 units
Current System Inventory: 110 units
Variance: 0
Status: ✅ MATCHED
```

This shows perfect inventory accuracy! All transactions accounted for.

## Next Steps

1. Try generating your first report
2. Compare calculated vs actual inventory
3. Create inventory corrections if needed
4. Schedule regular reconciliations

---

**Last Updated:** January 14, 2025

**Version:** 1.0
