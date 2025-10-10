# Physical Inventory Count Feature

## Overview

The Physical Inventory Count feature allows inventory managers to efficiently perform physical stock counts and reconcile them with system records. This feature enables bulk inventory corrections through Excel export/import, making it fast and accurate even when deployed online.

## 🎯 Purpose

- **Efficient Physical Counts**: Export current inventory to Excel for easy manual counting
- **Bulk Updates**: Import filled Excel files to create inventory corrections in bulk
- **Full Audit Trail**: Every change is logged with complete audit history
- **Fast Processing**: Optimized for quick uploads and processing, even online
- **Accuracy**: Validates data and creates inventory corrections for approval workflow

## 🔑 Key Features

### 1. Excel Export
- Download inventory template by location/branch
- Sorted alphabetically by product name
- Includes: Product Name, Variation, SKU, Current Stock, Physical Count (blank)
- Clean, easy-to-read format for manual data entry

### 2. Excel Import
- Upload filled Excel file with physical counts
- Automatic validation of data
- Creates inventory corrections only for items with differences
- Skips items with no changes (empty or matching counts)
- Bulk processing with transaction safety

### 3. Audit Trail
- Full audit log for every import
- Tracks: user, timestamp, IP address, file name
- Records system count, physical count, and difference
- Links to created inventory corrections

### 4. Integration with Inventory Corrections
- Imports create pending inventory corrections
- Follows existing approval workflow
- Approved corrections update stock and create stock transactions
- Complete history preserved

## 📋 Workflow

### Step 1: Export Template
1. Navigate to **Physical Inventory** page
2. Select a location/branch
3. Click **Download Template**
4. Excel file downloads with current inventory

**Excel Columns:**
- `Product ID` - Internal ID (hidden or read-only)
- `Variation ID` - Internal ID (hidden or read-only)
- `Product Name` - Name of the product
- `Variation` - Product variation (e.g., Size, Color)
- `SKU` - Stock Keeping Unit
- `Current Stock` - System inventory count
- `Physical Count` - **Fill this column manually**

### Step 2: Perform Physical Count
1. Open downloaded Excel file
2. Physically count inventory for each item
3. Enter actual counted quantity in **Physical Count** column
4. Leave blank if item not counted or matches system count
5. Save the Excel file

### Step 3: Import Filled Template
1. Return to **Physical Inventory** page
2. Select the same location used for export
3. Click **Choose File** and select filled Excel
4. Click **Import and Create Corrections**
5. Review import results

### Step 4: Review & Approve
1. View created corrections in import results
2. Navigate to **Inventory Corrections** page
3. Review each correction
4. Approve corrections to update stock levels
5. Stock updates automatically with full audit trail

## 🔐 Permissions

### PHYSICAL_INVENTORY_EXPORT
- **Who has it**: Branch Admin, Branch Manager, Super Admin
- **Purpose**: Export inventory template
- **Allows**: Download current inventory by location

### PHYSICAL_INVENTORY_IMPORT
- **Who has it**: Branch Admin, Branch Manager, Super Admin
- **Purpose**: Import physical counts and create corrections
- **Allows**: Upload Excel and create bulk inventory corrections

## 📊 Import Results

After importing, you'll see:

### Summary
- **Total Rows Processed**: Number of rows in Excel file
- **Corrections Created**: Items with differences imported
- **Skipped**: Items with no change or empty physical count
- **Errors**: Validation errors (if any)

### Corrections Table
- Correction ID
- System Count
- Physical Count
- Difference (+/- indicator)
- Status (pending/approved/rejected)

### Next Steps
- Link to view all corrections
- Corrections awaiting approval

## 🛡️ Security & Validation

### Data Validation
- ✅ Validates Product ID and Variation ID exist
- ✅ Verifies products belong to selected location
- ✅ Checks user has access to location
- ✅ Ensures business ID matches
- ✅ Validates Excel file format

### Security Features
- Multi-tenant isolation enforced
- Location-based access control
- Permission checks on export and import
- Complete audit trail with IP tracking
- Transaction safety for bulk operations

### Error Handling
- Validates each row individually
- Continues processing valid rows
- Reports errors for invalid rows
- Rollback on critical failures

## 🚀 API Endpoints

### Export Template
```
GET /api/physical-inventory/export?locationId={id}

Headers:
  - Authentication required (NextAuth session)

Query Parameters:
  - locationId: number (required) - Location/branch ID

Response:
  - Success: Excel file download
  - Error: JSON with error message

Permission Required: PHYSICAL_INVENTORY_EXPORT
```

### Import Physical Count
```
POST /api/physical-inventory/import

Headers:
  - Authentication required (NextAuth session)

Body (multipart/form-data):
  - file: File (required) - Excel file (.xlsx or .xls)
  - locationId: string (required) - Location/branch ID
  - reason: string (optional) - Reason for count (default: "Physical inventory count")

Response:
  {
    "message": "Physical inventory imported successfully",
    "summary": {
      "totalRows": 100,
      "correctionsCreated": 25,
      "skipped": 75,
      "errors": []
    },
    "corrections": [
      {
        "id": 1,
        "productId": 5,
        "variationId": 12,
        "systemCount": 100,
        "physicalCount": 95,
        "difference": -5,
        "status": "pending"
      }
    ]
  }

Permission Required: PHYSICAL_INVENTORY_IMPORT
```

## 📈 Benefits

### 1. **Speed & Efficiency**
- Export thousands of items in seconds
- Import and process bulk corrections quickly
- Optimized for online deployment with minimal bandwidth

### 2. **Accuracy**
- Reduces manual data entry errors
- Validates data before creating corrections
- Clear difference indicators

### 3. **Audit Compliance**
- Complete audit trail for all changes
- Tracks who, what, when, where
- Meets accounting and regulatory requirements

### 4. **Workflow Integration**
- Seamlessly integrates with existing inventory corrections
- Uses established approval process
- Maintains stock transaction history

### 5. **User-Friendly**
- Familiar Excel interface
- Simple 4-step process
- Clear instructions and feedback

## 🔧 Technical Implementation

### Database Models Used
- `VariationLocationDetails` - Current stock levels
- `InventoryCorrection` - Pending corrections
- `Product` & `ProductVariation` - Product data
- `BusinessLocation` - Location data
- `AuditLog` - Audit trail

### Libraries
- `xlsx` - Excel file generation and parsing
- `NextAuth` - Authentication
- `Prisma` - Database ORM

### File Structure
```
src/
├── app/
│   ├── api/
│   │   └── physical-inventory/
│   │       ├── export/route.ts    # Export API
│   │       └── import/route.ts    # Import API
│   └── dashboard/
│       └── physical-inventory/
│           └── page.tsx            # UI Page
├── lib/
│   ├── rbac.ts                     # Permissions
│   ├── auditLog.ts                 # Audit logging
│   └── exportUtils.ts              # Excel utilities
└── components/
    └── Sidebar.tsx                  # Navigation
```

## 📝 Best Practices

### For Inventory Managers

1. **Export Fresh Data**
   - Always export immediately before physical count
   - Use the most current data

2. **Count Accurately**
   - Take time to count carefully
   - Double-check high-value items
   - Leave blank if unsure (don't guess)

3. **Import Promptly**
   - Upload filled Excel as soon as counting is complete
   - Don't delay - stock may change

4. **Review Before Approval**
   - Check large differences carefully
   - Investigate unexpected variances
   - Add remarks explaining discrepancies

### For Developers

1. **Performance**
   - Process imports in database transactions
   - Use bulk operations where possible
   - Limit Excel file size (recommend < 10,000 rows)

2. **Error Handling**
   - Validate thoroughly before processing
   - Provide clear error messages
   - Log errors for debugging

3. **Security**
   - Always check permissions
   - Enforce multi-tenant isolation
   - Validate file types

## ⚠️ Important Notes

### Data Consistency
- Physical count overwrites system count after approval
- No partial imports - all or nothing per row
- Stock transactions created maintain history

### File Format
- Only `.xlsx` and `.xls` files supported
- First sheet is used if multiple sheets exist
- Column headers must match exactly (case-sensitive)

### Permissions
- Users need location access to export/import for that location
- Branch Managers have limited location access
- Branch Admins have all location access

### Performance Considerations
- Large files (>5,000 items) may take longer to process
- Consider splitting very large inventories by location
- Import processes items sequentially for data integrity

## 🐛 Troubleshooting

### Issue: Export returns empty file
**Solution**: No products exist at selected location. Add products to location first.

### Issue: Import fails with "Location not found"
**Solution**: Ensure you select the same location for import as you used for export.

### Issue: Import skips all items
**Solution**: Physical Count column is empty or matches system count. Fill in actual counts.

### Issue: Permission denied
**Solution**: Contact admin to grant PHYSICAL_INVENTORY_EXPORT or PHYSICAL_INVENTORY_IMPORT permission.

### Issue: Validation errors
**Solution**: Check that Product IDs and Variation IDs haven't been modified in Excel file.

## 🔄 Future Enhancements

Potential improvements:
- [ ] Support for CSV format
- [ ] Scheduled physical counts (recurring exports)
- [ ] Mobile app for barcode scanning during counts
- [ ] Variance reports and analytics
- [ ] Batch approval of corrections
- [ ] Photo upload for discrepancy proof
- [ ] Integration with cycle counting

## 📞 Support

For issues or questions:
- Check audit logs for detailed error information
- Review inventory corrections for status updates
- Contact system administrator for permission issues
- Refer to this guide for workflow clarification

---

**Feature Status**: ✅ Production Ready

**Last Updated**: 2025-10-06

**Version**: 1.0.0
