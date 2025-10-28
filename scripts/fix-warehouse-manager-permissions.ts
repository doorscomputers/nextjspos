import { prisma } from '../src/lib/prisma'

async function fixWarehouseManagerPermissions() {
  try {
    console.log('\n🔧 Fixing Warehouse Manager Role Permissions...\n')

    // Permissions that should be REMOVED from Warehouse Manager
    const permissionsToRemove = [
      // Sales report permissions (warehouse manager should NOT see sales)
      'sales_report.per_cashier',
      'sales_report.per_item',
      'sales_report.journal',
      'sales_report.discount_analysis',
      'report.sales_by_hour',
      'report.void_refund_analysis',

      // Financial reports (warehouse manager should NOT see financial data)
      'report.profit_loss',
      'report.profitability',
      'report.unpaid_invoices',
      'report.customer_payments',
      'report.cash_in_out',

      // Audit trail (warehouse manager should NOT see audit logs)
      'audit_log.view',

      // Other sales-related permissions
      'customer_return.view',
      'expense.view',
      'bank.view',
      'customer.view',

      // Purchase financial permissions (can view purchases but not financial aspects)
      'accounts_payable.view',
      'accounts_payable.create',
      'accounts_payable.update',
      'accounts_payable.delete',
      'payment.view',
      'payment.create',
      'payment.approve',
      'payment.update',
      'payment.delete',
      'purchase.approve',
      'purchase.delete',
      'purchase_amendment.approve',
      'purchase_amendment.create',
      'purchase_amendment.reject',
      'purchase_amendment.view',

      // Other permissions that don't belong
      'physical_inventory.import', // Too dangerous
      'role.view',
      'supplier.create',
      'supplier.update',
      'product.create',
      'product.update',
      'product.category.create',
      'product.category.update',
      'product.brand.create',
      'product.brand.update',
      'product.unit.create',
      'product.unit.update',
      'product.price.bulk_edit',
      'product.price.edit',
      'product.price.export',
      'product.cost_audit.view',
      'product.price_comparison.view',
      'pricing.settings.view',
      'product.access_default_selling_price',
      'access_all_locations',
      'purchase.create',
      'purchase.update',
      'purchase.view_cost',
      'report.purchase_sell',
      'supplier_return.approve',
      'stock_transfer.cancel',
      'stock_transfer.approve',
      'warranty_claim.view',
      'technician.view',
      'attendance.report',
      'qc_inspection.view',
      'qc_inspection.conduct',
    ]

    // Find Warehouse Manager role
    const warehouseManagerRole = await prisma.role.findFirst({
      where: {
        name: 'Warehouse Manager',
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!warehouseManagerRole) {
      console.log('❌ Warehouse Manager role not found')
      return
    }

    console.log(`Found role: ${warehouseManagerRole.name}`)
    console.log(`Current permissions: ${warehouseManagerRole.permissions.length}\n`)

    // Find permission IDs to remove
    const permissionsToRemoveIds: number[] = []
    warehouseManagerRole.permissions.forEach((rp) => {
      if (permissionsToRemove.includes(rp.permission.name)) {
        permissionsToRemoveIds.push(rp.permission.id)
        console.log(`🗑️  Will remove: ${rp.permission.name}`)
      }
    })

    if (permissionsToRemoveIds.length === 0) {
      console.log('\n✅ No permissions to remove - role is already correct!')
      return
    }

    console.log(`\n📊 Removing ${permissionsToRemoveIds.length} permissions from Warehouse Manager role...`)

    // Remove the permissions
    const deleteResult = await prisma.rolePermission.deleteMany({
      where: {
        roleId: warehouseManagerRole.id,
        permissionId: {
          in: permissionsToRemoveIds,
        },
      },
    })

    console.log(`\n✅ Successfully removed ${deleteResult.count} permissions!`)

    // Verify the result
    const updatedRole = await prisma.role.findFirst({
      where: {
        id: warehouseManagerRole.id,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    console.log(`\n📋 Updated role permissions: ${updatedRole?.permissions.length}`)
    console.log('\n✅ Warehouse Manager permissions fixed successfully!')
    console.log('\n📝 Warehouse Manager should now ONLY see:')
    console.log('   - Inventory Reports (Stock Alert, Historical Inventory, Inventory Ledger)')
    console.log('   - Transfer Reports (Transfers Report, Transfer Trends)')
    console.log('   - Purchase Reports (view only, no financial data)')
    console.log('\n❌ Warehouse Manager should NOT see:')
    console.log('   - Any Sales Reports')
    console.log('   - Financial/Profitability Reports')
    console.log('   - Customer Payments')
    console.log('   - Audit Trail')

  } catch (error) {
    console.error('❌ Error fixing permissions:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixWarehouseManagerPermissions()
