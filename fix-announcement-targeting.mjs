import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing announcement targeting...')

  try {
    // Get all announcements
    const announcements = await prisma.announcement.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        priority: true,
        isActive: true,
        targetRoles: true,
        targetLocations: true,
        startDate: true,
        endDate: true,
      }
    })

    console.log(`\n📋 Found ${announcements.length} announcements\n`)

    for (const announcement of announcements) {
      console.log(`Announcement ID ${announcement.id}: ${announcement.title}`)
      console.log(`  - Active: ${announcement.isActive}`)
      console.log(`  - Target Roles: ${announcement.targetRoles || 'None (shows to all)'}`)
      console.log(`  - Target Locations: ${announcement.targetLocations || 'None (shows to all)'}`)
      console.log(`  - Start Date: ${announcement.startDate || 'No restriction'}`)
      console.log(`  - End Date: ${announcement.endDate || 'No restriction'}`)

      // Check if targeting is restrictive
      const hasTargeting = announcement.targetRoles || announcement.targetLocations

      if (hasTargeting) {
        console.log(`  ⚠️  This announcement has targeting restrictions!`)

        // Remove targeting to show to everyone
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: {
            targetRoles: null,
            targetLocations: null,
          }
        })

        console.log(`  ✅ Removed targeting - now shows to all users`)
      } else {
        console.log(`  ✅ No targeting restrictions - visible to all`)
      }

      console.log('')
    }

    console.log('\n📊 Summary:')
    const activeAnnouncements = announcements.filter(a => a.isActive).length
    console.log(`  - Total announcements: ${announcements.length}`)
    console.log(`  - Active announcements: ${activeAnnouncements}`)
    console.log(`\n✅ All announcements should now be visible in the ticker!`)
    console.log(`\n💡 Refresh your browser to see the changes.`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
