import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  const announcements = await prisma.announcement.findMany({
    where: {
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      message: true,
      targetRoles: true,
      targetLocations: true,
      priority: true,
      type: true,
      startDate: true,
      endDate: true,
      displayOrder: true
    },
    orderBy: { displayOrder: 'asc' }
  })

  console.log('📢 Active Announcements:')
  console.log('=' .repeat(70))

  if (announcements.length === 0) {
    console.log('No active announcements found.')
  } else {
    announcements.forEach((a, idx) => {
      console.log(`\n${idx + 1}. ${a.title}`)
      console.log(`   Message: ${a.message}`)
      console.log(`   Type: ${a.type} | Priority: ${a.priority}`)
      console.log(`   Target Roles: ${a.targetRoles || 'ALL (no restriction)'}`)
      console.log(`   Target Locations: ${a.targetLocations || 'ALL (no restriction)'}`)
      console.log(`   Start: ${a.startDate || 'No start date'}`)
      console.log(`   End: ${a.endDate || 'No end date'}`)
    })
  }

  console.log('\n' + '=' .repeat(70))

  await prisma.$disconnect()
}

check()
