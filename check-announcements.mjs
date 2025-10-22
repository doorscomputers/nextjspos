import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAnnouncements() {
  try {
    const announcements = await prisma.announcement.findMany({
      include: {
        createdBy: {
          select: {
            username: true,
          },
        },
      },
    })

    console.log(`\n📢 Total announcements in database: ${announcements.length}\n`)

    if (announcements.length === 0) {
      console.log('❌ No announcements found!')
      console.log('   This is why the ticker is not showing for any users.')
      console.log('   You need to:')
      console.log('   1. Log out and log back in to refresh your JWT token')
      console.log('   2. Create some announcements from the Announcements page')
      console.log('   3. The ticker will then appear for all users\n')
    } else {
      announcements.forEach((a, idx) => {
        console.log(`${idx + 1}. ID: ${a.id}`)
        console.log(`   Title: ${a.title}`)
        console.log(`   Message: ${a.message}`)
        console.log(`   Active: ${a.isActive}`)
        console.log(`   Type: ${a.type}`)
        console.log(`   Priority: ${a.priority}`)
        console.log(`   Created by: ${a.createdBy?.username || 'Unknown'}`)
        console.log(`   Business ID: ${a.businessId}`)
        console.log(`   Start Date: ${a.startDate || 'None'}`)
        console.log(`   End Date: ${a.endDate || 'None'}`)
        console.log(`   Target Roles: ${a.targetRoles || 'All'}`)
        console.log(`   Target Locations: ${a.targetLocations || 'All'}`)
        console.log('')
      })
    }
  } catch (error) {
    console.error('Error checking announcements:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAnnouncements()
