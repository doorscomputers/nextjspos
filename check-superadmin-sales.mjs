import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSuperAdminSales() {
  try {
    // Check if Super Admin role has sell.view permission
    const role = await prisma.role.findFirst({
      where: {
        name: {
          contains: 'Super Admin',
          mode: 'insensitive',
        },
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    if (!role) {
      console.log('❌ Super Admin role not found!')
      return
    }

    console.log(`✅ Found role: ${role.name} (ID: ${role.id})`)

    const hasSellView = role.permissions.some(rp => rp.permission.name === 'sell.view')
    console.log(`   Has sell.view permission: ${hasSellView ? '✅ YES' : '❌ NO'}`)

    if (!hasSellView) {
      console.log('\n⚠️  Super Admin is missing sell.view permission!')
      console.log('   This is why the sales by location chart is not loading.')
    }

    // Check how many sales exist in the database
    const salesCount = await prisma.sale.count({
      where: {
        deletedAt: null,
      },
    })

    console.log(`\n📊 Total sales in database: ${salesCount}`)

    if (salesCount === 0) {
      console.log('   ⚠️  No sales data found - this is why the chart is empty!')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSuperAdminSales()
