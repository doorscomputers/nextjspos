const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixDuplicates() {
  try {
    // Find duplicate customer names within each business
    const duplicates = await prisma.$queryRaw`
      SELECT business_id, name, COUNT(*) as count
      FROM customers
      WHERE deleted_at IS NULL
      GROUP BY business_id, name
      HAVING COUNT(*) > 1
    `

    console.log(`Found ${duplicates.length} duplicate customer names`)

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
          createdAt: true,
          sales: {
            select: { id: true }
          },
          quotations: {
            select: { id: true }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      })

      console.log(`\nProcessing Business ${dup.business_id} - Customer "${dup.name}":`)

      // Keep the oldest one (first created)
      const keepCustomer = customers[0]
      const deleteCustomers = customers.slice(1)

      console.log(`  Keeping: ID ${keepCustomer.id} (${keepCustomer.sales.length} sales, ${keepCustomer.quotations.length} quotations)`)

      for (const delCustomer of deleteCustomers) {
        console.log(`  Deleting duplicate: ID ${delCustomer.id} (${delCustomer.sales.length} sales, ${delCustomer.quotations.length} quotations)`)

        // Check if this duplicate has any transactions
        if (delCustomer.sales.length > 0 || delCustomer.quotations.length > 0) {
          console.log(`    WARNING: This duplicate has transactions! Updating references to point to ID ${keepCustomer.id}...`)

          // Update sales to point to the kept customer
          if (delCustomer.sales.length > 0) {
            await prisma.sale.updateMany({
              where: { customerId: delCustomer.id },
              data: { customerId: keepCustomer.id }
            })
            console.log(`    Updated ${delCustomer.sales.length} sales`)
          }

          // Update quotations to point to the kept customer
          if (delCustomer.quotations.length > 0) {
            await prisma.quotation.updateMany({
              where: { customerId: delCustomer.id },
              data: { customerId: keepCustomer.id }
            })
            console.log(`    Updated ${delCustomer.quotations.length} quotations`)
          }
        }

        // Soft delete the duplicate
        await prisma.customer.update({
          where: { id: delCustomer.id },
          data: { deletedAt: new Date() }
        })
        console.log(`    Soft deleted duplicate ID ${delCustomer.id}`)
      }
    }

    console.log('\n✅ All duplicates processed!')
    console.log('You can now run: npx prisma db push --accept-data-loss')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixDuplicates()
