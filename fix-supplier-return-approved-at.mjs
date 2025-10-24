import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixSupplierReturnApprovedAt() {
  console.log('================================================================================')
  console.log('FIX: Set approvedAt timestamp for approved supplier returns')
  console.log('================================================================================')
  console.log()

  try {
    // Find all approved supplier returns with NULL approvedAt
    const approvedReturns = await prisma.supplierReturn.findMany({
      where: {
        status: 'approved',
        approvedAt: null
      },
      include: {
        supplier: true
      }
    })

    console.log(`Found ${approvedReturns.length} approved supplier return(s) with NULL approvedAt`)
    console.log()

    if (approvedReturns.length === 0) {
      console.log('✅ No supplier returns need fixing!')
      return
    }

    let fixed = 0

    for (const sr of approvedReturns) {
      // Use returnDate as approvedAt (or current date if returnDate is null)
      const approvedAt = sr.returnDate || new Date()

      console.log(`Fixing: ${sr.returnNumber} - ${sr.supplier.name}`)
      console.log(`  Setting approvedAt: ${approvedAt}`)

      await prisma.supplierReturn.update({
        where: { id: sr.id },
        data: {
          approvedAt,
          // approvedBy: we don't know who approved it, leave as null
        }
      })

      console.log(`  ✅ Fixed!`)
      fixed++
    }

    console.log()
    console.log('=' .repeat(80))
    console.log('SUCCESS')
    console.log('=' .repeat(80))
    console.log(`Total supplier returns fixed: ${fixed}`)
    console.log()
    console.log('✅ All approved supplier returns now have approvedAt timestamps')
    console.log('✅ Stock history queries will now include these returns')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixSupplierReturnApprovedAt()
  .catch(console.error)
