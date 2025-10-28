import { prisma } from '../src/lib/prisma'

async function checkWarehouseManagerPermissions() {
  try {
    // Find the warehouse manager user
    const user = await prisma.user.findFirst({
      where: {
        username: 'Jheirone',
      },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!user) {
      console.log('User not found')
      return
    }

    console.log('\n=== USER INFO ===')
    console.log('Username:', user.username)
    console.log('Name:', `${user.firstName} ${user.surname}`)
    console.log('\n=== ROLES ===')
    user.roles.forEach((ur) => {
      console.log(`- ${ur.role.name} (${ur.role.description})`)
    })

    console.log('\n=== PERMISSIONS FROM ROLES ===')
    const rolePermissions = new Set<string>()
    user.roles.forEach((ur) => {
      console.log(`\nRole: ${ur.role.name}`)
      ur.role.permissions.forEach((rp) => {
        console.log(`  - ${rp.permission.name}`)
        rolePermissions.add(rp.permission.name)
      })
    })

    console.log('\n=== DIRECT PERMISSIONS ===')
    const directPermissions = new Set<string>()
    user.permissions.forEach((up) => {
      console.log(`- ${up.permission.name}`)
      directPermissions.add(up.permission.name)
    })

    console.log('\n=== ALL PERMISSIONS (Combined) ===')
    const allPermissions = new Set([...rolePermissions, ...directPermissions])
    console.log(`Total: ${allPermissions.size} permissions`)

    // Check for sales report permissions
    console.log('\n=== SALES REPORT PERMISSIONS ===')
    const salesReportPerms = Array.from(allPermissions).filter(
      (p) => p.includes('sales_report') || p.includes('report.sales')
    )
    if (salesReportPerms.length > 0) {
      console.log('❌ FOUND SALES REPORT PERMISSIONS (Should not have):')
      salesReportPerms.forEach((p) => console.log(`  - ${p}`))
    } else {
      console.log('✅ No sales report permissions found (Correct)')
    }

    // Check for financial report permissions
    console.log('\n=== FINANCIAL REPORT PERMISSIONS ===')
    const financialReportPerms = Array.from(allPermissions).filter(
      (p) =>
        p.includes('profitability') ||
        p.includes('profit_loss') ||
        p.includes('report.customer_payments') ||
        p.includes('report.unpaid_invoices')
    )
    if (financialReportPerms.length > 0) {
      console.log('❌ FOUND FINANCIAL REPORT PERMISSIONS (Should not have):')
      financialReportPerms.forEach((p) => console.log(`  - ${p}`))
    } else {
      console.log('✅ No financial report permissions found (Correct)')
    }

    // Check for audit trail permission
    console.log('\n=== AUDIT TRAIL PERMISSION ===')
    const auditPerms = Array.from(allPermissions).filter((p) => p.includes('audit_log'))
    if (auditPerms.length > 0) {
      console.log('❌ FOUND AUDIT TRAIL PERMISSIONS (Should not have):')
      auditPerms.forEach((p) => console.log(`  - ${p}`))
    } else {
      console.log('✅ No audit trail permissions found (Correct)')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkWarehouseManagerPermissions()
