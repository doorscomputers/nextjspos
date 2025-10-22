import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAnnouncementDate() {
  try {
    // Update the announcement to have no end date
    const updated = await prisma.announcement.update({
      where: { id: 1 },
      data: {
        startDate: null, // No start restriction
        endDate: null,   // No end restriction - will show continuously
      },
    })

    console.log('✅ Announcement updated successfully!')
    console.log('   ID:', updated.id)
    console.log('   Title:', updated.title)
    console.log('   Message:', updated.message)
    console.log('   Start Date:', updated.startDate || 'None (always active)')
    console.log('   End Date:', updated.endDate || 'None (never expires)')
    console.log('\n🎉 The ticker should now show for all users!')
    console.log('   Refresh the browser to see the scrolling announcement.\n')
  } catch (error) {
    console.error('❌ Error updating announcement:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAnnouncementDate()
