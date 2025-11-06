import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkReturnApprovalPermission() {
  console.log('🔍 Checking Supplier Return Approval Setup...\n')

  // Get user (assuming Jheiron Terre Terre / @Jheiron)
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'Jheiron' },
        { username: '@Jheiron' },
        { username: 'superadmin' },
      ]
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      },
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (!user) {
    console.log('❌ User not found')
    return
  }

  console.log(`✅ Found user: ${user.username} (${user.firstName} ${user.lastName})`)
  console.log(`   Business ID: ${user.businessId}\n`)

  // Check for PURCHASE_RETURN_APPROVE permission
  const permissionName = 'purchase_return.approve'

  // Check direct permissions
  const hasDirectPermission = user.permissions.some(
    up => up.permission.name === permissionName
  )

  // Check role permissions
  const rolePermissions = user.roles.flatMap(ur =>
    ur.role.permissions.map(rp => rp.permission.name)
  )
  const hasRolePermission = rolePermissions.includes(permissionName)

  console.log('📋 Permission Check: purchase_return.approve')
  console.log(`   Direct Permission: ${hasDirectPermission ? '✅ YES' : '❌ NO'}`)
  console.log(`   Role Permission: ${hasRolePermission ? '✅ YES' : '❌ NO'}`)
  console.log(`   Can Approve Returns: ${hasDirectPermission || hasRolePermission ? '✅ YES' : '❌ NO'}\n`)

  // Check pending supplier returns
  const pendingReturns = await prisma.supplierReturn.findMany({
    where: {
      businessId: user.businessId,
      status: 'pending'
    },
    include: {
      supplier: true,
      items: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5
  })

  // Get locations separately
  const locationIds = [...new Set(pendingReturns.map(r => r.locationId))]
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: locationIds } }
  })
  const locationMap = new Map(locations.map(l => [l.id, l]))

  // Get products separately
  const productIds = [...new Set(pendingReturns.flatMap(r => r.items.map(i => i.productId)))]
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } }
  })
  const productMap = new Map(products.map(p => [p.id, p]))

  // Get variations separately
  const variationIds = [...new Set(pendingReturns.flatMap(r => r.items.map(i => i.productVariationId)))]
  const variations = await prisma.productVariation.findMany({
    where: { id: { in: variationIds } }
  })
  const variationMap = new Map(variations.map(v => [v.id, v]))

  console.log(`📦 Pending Supplier Returns: ${pendingReturns.length}`)

  if (pendingReturns.length > 0) {
    console.log('\n🔄 Awaiting Approval:\n')
    for (const ret of pendingReturns) {
      const totalQty = ret.items.reduce((sum, item) => sum + Number(item.quantity), 0)
      const location = locationMap.get(ret.locationId)
      console.log(`   • ${ret.returnNumber}`)
      console.log(`     Supplier: ${ret.supplier.name}`)
      console.log(`     Location: ${location?.name || 'Unknown'}`)
      console.log(`     Items: ${ret.items.length} (${totalQty} units)`)
      console.log(`     Amount: ₱${Number(ret.totalAmount).toFixed(2)}`)
      console.log(`     Created: ${new Date(ret.createdAt).toLocaleString()}`)
      console.log(`     Reason: ${ret.returnReason}`)
      console.log(`     URL: /dashboard/supplier-returns/${ret.id}\n`)
    }

    console.log('⚠️  IMPORTANT: These returns are PENDING - inventory is NOT deducted yet!')
    console.log('   You must APPROVE each return to:')
    console.log('   1. Deduct inventory from stock')
    console.log('   2. Reduce accounts payable')
    console.log('   3. Update serial numbers (if tracked)\n')
  }

  // Show one example product to verify inventory
  if (pendingReturns.length > 0 && pendingReturns[0].items.length > 0) {
    const firstReturn = pendingReturns[0]
    const firstItem = firstReturn.items[0]
    const productId = firstItem.productId
    const variationId = firstItem.productVariationId
    const locationId = firstReturn.locationId

    const stockRecord = await prisma.productStock.findFirst({
      where: {
        productId,
        productVariationId: variationId,
        locationId
      }
    })

    if (stockRecord) {
      const product = productMap.get(productId)
      const variation = variationMap.get(variationId)
      const location = locationMap.get(locationId)

      console.log('📊 Current Stock Example:')
      console.log(`   Product: ${product?.name || 'Unknown'}`)
      if (variation) {
        console.log(`   Variation: ${variation.name}`)
      }
      console.log(`   Location: ${location?.name || 'Unknown'}`)
      console.log(`   Current Quantity: ${stockRecord.quantity}`)
      console.log(`   Pending Return: -${firstItem.quantity}`)
      console.log(`   After Approval: ${Number(stockRecord.quantity) - Number(firstItem.quantity)}`)
      console.log(`\n   ⚠️  Stock will only change AFTER you approve the return!`)
    }
  }

  await prisma.$disconnect()
}

checkReturnApprovalPermission()
  .catch(console.error)
