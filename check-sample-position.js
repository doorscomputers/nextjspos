// Check where Sample Items appear in the sorted product list
const { PrismaClient } = require('@prisma/client')

async function checkSamplePosition() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T!@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres'
      }
    },
    log: ['error']
  })

  try {
    console.log('🔍 Checking position of Sample Items in API response...\n')

    // Get products in the EXACT order the API returns them
    const products = await prisma.product.findMany({
      where: {
        businessId: 1,
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 1000 // API limit
    })

    console.log(`📦 Total products returned (limit 1000): ${products.length}\n`)

    // Find Sample Items in the results
    products.forEach((product, index) => {
      if (product.name?.toLowerCase().includes('sample item')) {
        const position = index + 1
        console.log(`${position <= 731 ? '✅' : '❌'} Position ${position}: ${product.name} (ID: ${product.id})`)
        console.log(`   Created: ${product.createdAt}`)
        console.log(`   ${position <= 731 ? 'INCLUDED in first 731' : 'EXCLUDED from first 731'}`)
        console.log('')
      }
    })

    // Check if any Sample Items are beyond position 731
    const sampleItems = products.filter(p => p.name?.toLowerCase().includes('sample item'))
    console.log(`\n📊 Summary:`)
    console.log(`   Total Sample Items found in first 1000: ${sampleItems.length}`)

    const within731 = sampleItems.filter((p, index) => {
      const position = products.indexOf(p) + 1
      return position <= 731
    })

    console.log(`   Sample Items within first 731: ${within731.length}`)
    console.log(`   Sample Items beyond position 731: ${sampleItems.length - within731.length}`)

    // Check ALL Sample Items positions
    console.log('\n🔍 Checking ALL active Sample Items in database...\n')

    const allSampleItems = await prisma.product.findMany({
      where: {
        businessId: 1,
        deletedAt: null,
        isActive: true,
        name: {
          contains: 'Sample Item',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        sku: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`Found ${allSampleItems.length} total Sample Items:\n`)

    allSampleItems.forEach(item => {
      const position = products.findIndex(p => p.id === item.id) + 1
      if (position === 0) {
        console.log(`❌ ${item.name} (ID: ${item.id}) - NOT in first 1000 results!`)
      } else {
        console.log(`${position <= 731 ? '✅' : '⚠️ '} ${item.name} (ID: ${item.id}) - Position ${position} ${position > 731 ? '(beyond 731!)' : ''}`)
      }
    })

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkSamplePosition()
