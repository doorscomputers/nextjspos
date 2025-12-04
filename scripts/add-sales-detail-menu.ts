/**
 * Script to add Sales Detail menu permission and assign to Sales Cashier role
 * Run with: DATABASE_URL="your-connection-string" npx tsx scripts/add-sales-detail-menu.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding Sales Detail menu permission...')

  // Step 1: Find or create the parent "Cashier Reports" menu
  let cashierReportsMenu = await prisma.menuPermission.findFirst({
    where: { key: 'cashier_reports' }
  })

  if (!cashierReportsMenu) {
    console.log('Creating Cashier Reports parent menu...')
    cashierReportsMenu = await prisma.menuPermission.create({
      data: {
        key: 'cashier_reports',
        name: 'Cashier Reports',
        href: null,
        icon: 'BarChart3',
        order: 20,
        parentId: null
      }
    })
  }

  // Step 2: Create or update the Sales Detail menu
  let salesDetailMenu = await prisma.menuPermission.findFirst({
    where: { key: 'cashier_sales_detail' }
  })

  if (salesDetailMenu) {
    console.log('Sales Detail menu already exists, updating...')
    salesDetailMenu = await prisma.menuPermission.update({
      where: { id: salesDetailMenu.id },
      data: {
        name: 'Sales Detail (Print)',
        href: '/dashboard/reports/sales-detail',
        icon: 'FileText',
        order: 2,
        parentId: cashierReportsMenu.id
      }
    })
  } else {
    console.log('Creating Sales Detail menu...')
    salesDetailMenu = await prisma.menuPermission.create({
      data: {
        key: 'cashier_sales_detail',
        name: 'Sales Detail (Print)',
        href: '/dashboard/reports/sales-detail',
        icon: 'FileText',
        order: 2,
        parentId: cashierReportsMenu.id
      }
    })
  }

  console.log(`Sales Detail menu ID: ${salesDetailMenu.id}`)

  // Step 3: Find the Sales Cashier role
  const salesCashierRole = await prisma.role.findFirst({
    where: {
      name: {
        contains: 'Sales Cashier',
        mode: 'insensitive'
      }
    }
  })

  if (!salesCashierRole) {
    console.log('Sales Cashier role not found. Searching for Cashier role...')
    const cashierRole = await prisma.role.findFirst({
      where: {
        name: {
          contains: 'Cashier',
          mode: 'insensitive'
        }
      }
    })

    if (cashierRole) {
      console.log(`Found Cashier role: ${cashierRole.name} (ID: ${cashierRole.id})`)
      await assignMenuToRole(cashierRole.id, salesDetailMenu.id, cashierReportsMenu.id)
    } else {
      console.log('No Cashier role found.')
    }
  } else {
    console.log(`Found Sales Cashier role: ${salesCashierRole.name} (ID: ${salesCashierRole.id})`)
    await assignMenuToRole(salesCashierRole.id, salesDetailMenu.id, cashierReportsMenu.id)
  }

  // Also assign to any role that has "Cashier" in the name
  const allCashierRoles = await prisma.role.findMany({
    where: {
      name: {
        contains: 'Cashier',
        mode: 'insensitive'
      }
    }
  })

  for (const role of allCashierRoles) {
    console.log(`Assigning to role: ${role.name} (ID: ${role.id})`)
    await assignMenuToRole(role.id, salesDetailMenu.id, cashierReportsMenu.id)
  }

  console.log('\nDone! Sales Detail menu has been added and assigned to Cashier roles.')
}

async function assignMenuToRole(roleId: number, menuId: number, parentMenuId: number) {
  // First ensure parent menu is assigned
  const existingParent = await prisma.roleMenuPermission.findFirst({
    where: {
      roleId,
      menuPermissionId: parentMenuId
    }
  })

  if (!existingParent) {
    await prisma.roleMenuPermission.create({
      data: {
        roleId,
        menuPermissionId: parentMenuId
      }
    })
    console.log(`  - Assigned parent menu to role ${roleId}`)
  }

  // Then assign the child menu
  const existing = await prisma.roleMenuPermission.findFirst({
    where: {
      roleId,
      menuPermissionId: menuId
    }
  })

  if (!existing) {
    await prisma.roleMenuPermission.create({
      data: {
        roleId,
        menuPermissionId: menuId
      }
    })
    console.log(`  - Assigned Sales Detail menu to role ${roleId}`)
  } else {
    console.log(`  - Sales Detail menu already assigned to role ${roleId}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
