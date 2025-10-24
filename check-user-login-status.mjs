import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      where: {
        username: 'EricsonChanTransferReceiverTugue'
      },
      select: {
        id: true,
        username: true,
        email: true,
        allowLogin: true,
      }
    })

    if (!user) {
      console.log('❌ User not found!')
      return
    }

    console.log('👤 User Information:')
    console.log('ID:', user.id)
    console.log('Username:', user.username)
    console.log('Email:', user.email)
    console.log('Allow Login:', user.allowLogin ? '✅ YES' : '❌ NO')

    // Check schedules
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isActive: true
      },
      orderBy: {
        dayOfWeek: 'asc'
      }
    })

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const today = new Date()
    const todayDay = today.getDay()

    console.log('\n📅 Active Schedules:')
    if (schedules.length === 0) {
      console.log('❌ NO ACTIVE SCHEDULES FOUND!')
    } else {
      schedules.forEach(s => {
        const isTodaySchedule = s.dayOfWeek === todayDay
        console.log(
          `${isTodaySchedule ? '👉' : '  '} ${dayNames[s.dayOfWeek]}: ${s.startTime} - ${s.endTime} (ID: ${s.id})`
        )
      })
    }

    console.log('\n🗓️  Today is:', dayNames[todayDay], `(${todayDay})`)
    const hasTodaySchedule = schedules.some(s => s.dayOfWeek === todayDay)
    console.log('Can login today:', hasTodaySchedule ? '✅ YES' : '❌ NO')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUser()
