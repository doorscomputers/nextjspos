import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📢 Creating sample announcements...')

  try {
    // Check if announcements already exist
    const existingCount = await prisma.announcement.count()

    if (existingCount > 0) {
      console.log(`✅ Found ${existingCount} existing announcements`)

      // Show existing announcements
      const announcements = await prisma.announcement.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          message: true,
          type: true,
          priority: true,
          isActive: true,
        }
      })

      console.log('\n📋 Current announcements:')
      announcements.forEach(a => {
        console.log(`  - [${a.isActive ? 'ACTIVE' : 'INACTIVE'}] ${a.title}: ${a.message}`)
      })

      return
    }

    // Get the first business and user
    const business = await prisma.business.findFirst()
    const user = await prisma.user.findFirst({
      where: { businessId: business.id }
    })

    if (!business || !user) {
      console.error('❌ No business or user found. Please seed the database first.')
      return
    }

    console.log(`📍 Creating announcements for business: ${business.name}`)

    // Create sample announcements
    const announcements = [
      {
        businessId: business.id,
        createdById: user.id,
        title: 'Welcome to UltimatePOS',
        message: 'Your multi-tenant POS system is now active! Explore all features from the sidebar.',
        type: 'system',
        priority: 'info',
        isActive: true,
        displayOrder: 1,
        icon: '🎉'
      },
      {
        businessId: business.id,
        createdById: user.id,
        title: 'Security Update',
        message: 'Inactivity timeout has been enabled for enhanced security. Users will be logged out after period of inactivity.',
        type: 'system',
        priority: 'warning',
        isActive: true,
        displayOrder: 2,
        icon: '🔒'
      },
      {
        businessId: business.id,
        createdById: user.id,
        title: 'Daily Reminder',
        message: 'Don\'t forget to perform end-of-day cash count and Z-reading before closing.',
        type: 'business_reminder',
        priority: 'info',
        isActive: true,
        displayOrder: 3,
        icon: '💰'
      },
      {
        businessId: business.id,
        createdById: user.id,
        title: 'New Feature',
        message: 'Transfer approvals now support Separation of Duties (SOD) rules for enhanced control.',
        type: 'system',
        priority: 'success',
        isActive: true,
        displayOrder: 4,
        icon: '✨'
      },
    ]

    for (const announcement of announcements) {
      await prisma.announcement.create({ data: announcement })
      console.log(`  ✅ Created: ${announcement.title}`)
    }

    console.log(`\n✅ Successfully created ${announcements.length} sample announcements!`)
    console.log('\n📺 The announcement ticker should now display in the header.')

    // Verify they're visible
    const active = await prisma.announcement.count({
      where: {
        isActive: true,
        deletedAt: null
      }
    })
    console.log(`\n📊 Active announcements: ${active}`)

  } catch (error) {
    console.error('❌ Error creating announcements:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
