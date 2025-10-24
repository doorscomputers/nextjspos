import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateGracePeriod() {
  try {
    // You can change these values:
    const earlyGrace = 15  // minutes before shift start
    const lateGrace = 15   // minutes after shift end

    const config = await prisma.scheduleLoginConfiguration.updateMany({
      where: { businessId: 1 },
      data: {
        earlyClockInGraceMinutes: earlyGrace,
        lateClockOutGraceMinutes: lateGrace,
      }
    })

    console.log('✅ Grace period updated successfully!')
    console.log('\nNew Configuration:')
    console.log('- Early Clock-In Grace:', earlyGrace, 'minutes')
    console.log('- Late Clock-Out Grace:', lateGrace, 'minutes')
    console.log('\n💡 Example with 7:00 PM end time:')
    console.log('- Schedule ends: 7:00 PM')
    console.log('- Grace period:', lateGrace, 'minutes')
    console.log('- Login cutoff:', calculateEndTimeWithGrace('19:00', lateGrace))

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function calculateEndTimeWithGrace(endTime, graceMinutes) {
  const [hours, minutes] = endTime.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  date.setMinutes(date.getMinutes() + graceMinutes)

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

updateGracePeriod()
