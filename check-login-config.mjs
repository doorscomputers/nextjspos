import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkConfig() {
  try {
    const config = await prisma.scheduleLoginConfiguration.findFirst({
      where: { businessId: 1 }
    })

    if (!config) {
      console.log('❌ No schedule login configuration found!')
      return
    }

    console.log('⚙️  Schedule Login Configuration:\n')
    console.log('Enforce Schedule Login:', config.enforceScheduleLogin ? '✅ Enabled' : '❌ Disabled')
    console.log('Early Clock-In Grace:', config.earlyClockInGraceMinutes, 'minutes')
    console.log('Late Clock-Out Grace:', config.lateClockOutGraceMinutes, 'minutes')
    console.log('Exempt Roles:', config.exemptRoles)
    console.log('\n📊 What this means:')
    console.log(`- Can login ${config.earlyClockInGraceMinutes} minutes BEFORE shift starts`)
    console.log(`- Can login ${config.lateClockOutGraceMinutes} minutes AFTER shift ends`)
    console.log('\n💡 Example with 7:00 PM end time:')
    console.log(`- Schedule ends: 7:00 PM`)
    console.log(`- Grace period: ${config.lateClockOutGraceMinutes} minutes`)
    console.log(`- Can login until: ${calculateEndTimeWithGrace('19:00', config.lateClockOutGraceMinutes)}`)

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

checkConfig()
