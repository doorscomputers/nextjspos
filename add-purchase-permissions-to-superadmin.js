const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function addPurchasePermissions() {
  try {
    console.log('=== Adding Purchase Permissions to Superadmin ===\n')

    // Find superadmin user
    const user = await prisma.user.findFirst({
      where: { username: 'superadmin' },
    })

    if (!user) {
      console.log('❌ Superadmin user not found!')
      return
    }

    console.log(`✓ Found superadmin user (ID: ${user.id})`)

    // All purchase-related permissions
    const purchasePermissions = [
      'purchase.view',
      'purchase.create',
      'purchase.update',
      'purchase.delete',
      'purchase.approve',
      'purchase.receive',
      'purchase.receipt.create',
      'purchase.receipt.approve',
      'purchase.receipt.view',
      'purchase.view_cost',
      'purchase_return.view',
      'purchase_return.create',
      'purchase_return.update',
      'purchase_return.delete',
      'purchase_return.approve',
      'purchase_amendment.view',
      'purchase_amendment.create',
      'purchase_amendment.approve',
      'purchase_amendment.reject',
    ]

    console.log(`\nAdding ${purchasePermissions.length} purchase permissions...\n`)

    let added = 0
    let skipped = 0

    for (const permName of purchasePermissions) {
      // Find or create permission
      let permission = await prisma.permission.findUnique({
        where: { name: permName },
      })

      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            name: permName,
            guardName: 'web',
          },
        })
        console.log(`  ✓ Created permission: ${permName}`)
      }

      // Check if user already has this permission
      const existing = await prisma.userPermission.findUnique({
        where: {
          userId_permissionId: {
            userId: user.id,
            permissionId: permission.id,
          },
        },
      })

      if (existing) {
        console.log(`  ⊘ Already has: ${permName}`)
        skipped++
      } else {
        // Add permission to user
        await prisma.userPermission.create({
          data: {
            userId: user.id,
            permissionId: permission.id,
          },
        })
        console.log(`  ✓ Added: ${permName}`)
        added++
      }
    }

    console.log(`\n=== Summary ===`)
    console.log(`Added: ${added} permissions`)
    console.log(`Skipped: ${skipped} permissions (already existed)`)
    console.log(`\n✅ Superadmin now has all purchase permissions!`)

    // Verify
    const userWithPerms = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    const purchasePerms = userWithPerms.permissions
      .filter(p => p.permission.name.startsWith('purchase'))
      .map(p => p.permission.name)

    console.log(`\nVerification: Superadmin has ${purchasePerms.length} purchase permissions`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addPurchasePermissions()
