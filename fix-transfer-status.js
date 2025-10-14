const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixTransferStatus() {
  try {
    // Get transfer with items
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: 1 },
      include: { items: true }
    })

    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }

    console.log('Current Status:', transfer.status)
    console.log('Items:')
    transfer.items.forEach((item, index) => {
      console.log(`  Item ${index + 1} verified:`, item.verified)
    })

    const allVerified = transfer.items.every(item => item.verified)
    console.log('All items verified:', allVerified)

    if (allVerified && transfer.status === 'verifying') {
      console.log('\n🔧 Updating transfer status to "verified"...')

      const updated = await prisma.stockTransfer.update({
        where: { id: 1 },
        data: {
          status: 'verified',
          verifiedBy: transfer.arrivedBy,
          verifiedAt: new Date()
        }
      })

      console.log('✅ Transfer status updated to:', updated.status)
      console.log('✅ Verified by user ID:', updated.verifiedBy)
      console.log('✅ Verified at:', updated.verifiedAt)
      console.log('\n📋 Next step: Refresh the page to see "Complete Transfer" button')
    } else if (transfer.status === 'verified') {
      console.log('✅ Transfer already has "verified" status - no update needed')
    } else {
      console.log('⚠️ Cannot update - not all items verified or unexpected status')
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

fixTransferStatus()
