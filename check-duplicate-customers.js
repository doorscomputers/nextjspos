const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkDuplicates() {
  try {
    // Find duplicate customer names within each business
    const duplicates = await prisma.$queryRaw`
      SELECT business_id, name, COUNT(*) as count
      FROM customers
      WHERE deleted_at IS NULL
      GROUP BY business_id, name
      HAVING COUNT(*) > 1
    `

    console.log('Duplicate customer names found:')
    console.log(duplicates)

    if (duplicates.length === 0) {
      console.log('No duplicates found!')
      return
    }

    // Show details of each duplicate
    for (const dup of duplicates) {
      const customers = await prisma.customer.findMany({
        where: {
          businessId: dup.business_id,
          name: dup.name,
          deletedAt: null
        },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      })

      console.log(`\nBusiness ${dup.business_id} - Customer "${dup.name}":`)
      customers.forEach((c, i) => {
        console.log(`  ${i === 0 ? 'KEEP' : 'DELETE'}: ID ${c.id}, created ${c.createdAt}, email: ${c.email || 'N/A'}, mobile: ${c.mobile || 'N/A'}`)
      })
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDuplicates()
