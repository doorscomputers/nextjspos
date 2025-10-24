import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📅 Removing date restrictions from announcements...')

  try {
    // Update all announcements to have no date restrictions
    const result = await prisma.announcement.updateMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      data: {
        startDate: null,
        endDate: null,
      }
    })

    console.log(`✅ Updated ${result.count} announcement(s)`)

    // Show current announcements
    const announcements = await prisma.announcement.findMany({
      where: { deletedAt: null, isActive: true },
      select: {
        id: true,
        title: true,
        message: true,
        startDate: true,
        endDate: true,
        isActive: true,
      }
    })

    console.log(`\n📋 Active announcements (no date restrictions):\n`)
    announcements.forEach(a => {
      console.log(`  ✅ ID ${a.id}: ${a.title}`)
      console.log(`     "${a.message}"`)
      console.log(`     Start: ${a.startDate || 'No restriction'}`)
      console.log(`     End: ${a.endDate || 'No restriction'}`)
      console.log('')
    })

    console.log('✅ All active announcements should now be visible!')
    console.log('\n💡 Refresh your browser (Ctrl+F5) to see the announcement ticker.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
