import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📢 Adding more sample announcements...')

  try {
    // Get the first business and user
    const business = await prisma.business.findFirst()
    const user = await prisma.user.findFirst({
      where: { businessId: business.id }
    })

    if (!business || !user) {
      console.error('❌ No business or user found.')
      return
    }

    // Create additional announcements
    const newAnnouncements = [
      {
        businessId: business.id,
        createdById: user.id,
        title: 'Security Notice',
        message: 'Inactivity timeout is now active. You will be logged out after period of inactivity for your security.',
        type: 'system',
        priority: 'warning',
        isActive: true,
        displayOrder: 2,
        icon: '🔒',
        startDate: null,
        endDate: null,
      },
      {
        businessId: business.id,
        createdById: user.id,
        title: 'Daily Reminder',
        message: 'Remember to perform Z-reading at end of shift and count your cash drawer.',
        type: 'business_reminder',
        priority: 'info',
        isActive: true,
        displayOrder: 3,
        icon: '💰',
        startDate: null,
        endDate: null,
      },
      {
        businessId: business.id,
        createdById: user.id,
        title: 'System Update',
        message: 'New transfer approval workflow with SOD (Separation of Duties) is now available!',
        type: 'system',
        priority: 'success',
        isActive: true,
        displayOrder: 4,
        icon: '✨',
        startDate: null,
        endDate: null,
      },
    ]

    for (const announcement of newAnnouncements) {
      await prisma.announcement.create({ data: announcement })
      console.log(`  ✅ Created: ${announcement.title}`)
    }

    // Get all active announcements
    const allAnnouncements = await prisma.announcement.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        priority: true,
        icon: true,
        displayOrder: true,
      }
    })

    console.log(`\n📋 All active announcements (${allAnnouncements.length}):\n`)
    allAnnouncements.forEach((a, index) => {
      console.log(`  ${index + 1}. ${a.icon || '📢'} [${a.priority.toUpperCase()}] ${a.title}`)
      console.log(`     "${a.message}"`)
      console.log('')
    })

    console.log('✅ Successfully added announcements!')
    console.log('\n📺 The ticker should now show all announcements scrolling in the header.')
    console.log('💡 Refresh your browser to see the changes.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
