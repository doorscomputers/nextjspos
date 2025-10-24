import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestAttendance() {
  try {
    console.log('🔄 Creating test attendance records...\n')

    // Get business ID
    const business = await prisma.business.findFirst()
    if (!business) {
      console.log('❌ No business found! Please run seed first.')
      return
    }

    // Get users with schedules
    const users = await prisma.user.findMany({
      where: {
        businessId: business.id,
        employeeSchedules: {
          some: {}
        }
      },
      include: {
        employeeSchedules: {
          where: {
            deletedAt: null,
            isActive: true
          },
          include: {
            location: true
          }
        }
      },
      take: 5 // Get first 5 users with schedules
    })

    if (users.length === 0) {
      console.log('❌ No users with schedules found!')
      console.log('💡 Please create employee schedules first using the Schedules page.')
      return
    }

    console.log(`✅ Found ${users.length} users with schedules\n`)

    // Get dates for the last 7 days
    const dates = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date)
    }

    let createdCount = 0

    // Create attendance records for each user
    for (const user of users) {
      console.log(`📝 Creating attendance for: ${user.firstName || user.username}`)

      for (const date of dates) {
        const dayOfWeek = date.getDay()

        // Find schedule for this day
        const schedule = user.employeeSchedules.find(s => s.dayOfWeek === dayOfWeek)

        if (!schedule) {
          console.log(`   ⏭️  Skipping ${date.toLocaleDateString()} (${getDayName(dayOfWeek)}) - No schedule`)
          continue
        }

        // Check if attendance already exists
        const existingAttendance = await prisma.attendance.findFirst({
          where: {
            userId: user.id,
            date: {
              gte: new Date(date.setHours(0, 0, 0, 0)),
              lt: new Date(date.setHours(23, 59, 59, 999))
            }
          }
        })

        if (existingAttendance) {
          console.log(`   ⏭️  Skipping ${date.toLocaleDateString()} - Already exists`)
          continue
        }

        // Create random clock in/out times based on schedule
        const [startHour, startMin] = schedule.startTime.split(':').map(Number)
        const [endHour, endMin] = schedule.endTime.split(':').map(Number)

        // Random variation: -5 to +15 minutes
        const clockInVariation = Math.floor(Math.random() * 20) - 5
        const clockOutVariation = Math.floor(Math.random() * 20) - 5

        const clockIn = new Date(date)
        clockIn.setHours(startHour, startMin + clockInVariation, 0, 0)

        const clockOut = new Date(date)
        clockOut.setHours(endHour, endMin + clockOutVariation, 0, 0)

        // Calculate hours worked
        const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)

        // Determine status
        let status = 'on_time'
        if (clockInVariation > 5) {
          status = 'late'
        } else if (clockInVariation < -2) {
          status = 'early'
        }

        // Random chance for different scenarios
        const rand = Math.random()
        let actualClockOut = clockOut
        let isOvertime = false

        if (rand < 0.1) {
          // 10% chance: still clocked in (no clock out)
          actualClockOut = null
          status = 'on_time'
        } else if (rand < 0.2) {
          // 10% chance: overtime
          actualClockOut.setHours(actualClockOut.getHours() + 2)
          isOvertime = true
        }

        const totalHours = actualClockOut
          ? (actualClockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
          : null

        // Create attendance record
        await prisma.attendance.create({
          data: {
            businessId: business.id,
            userId: user.id,
            locationId: schedule.locationId,
            date: new Date(date.setHours(0, 0, 0, 0)),
            clockIn: clockIn,
            clockOut: actualClockOut,
            scheduledStart: schedule.startTime,
            scheduledEnd: schedule.endTime,
            status: status,
            totalHoursWorked: totalHours ? totalHours.toFixed(2) : null,
            isOvertime: isOvertime,
            overtimeApproved: isOvertime ? Math.random() > 0.5 : null,
            xReadingPrinted: actualClockOut ? Math.random() > 0.5 : false,
            cashCountSubmitted: actualClockOut ? Math.random() > 0.7 : false,
          }
        })

        createdCount++
        console.log(`   ✅ ${date.toLocaleDateString()} (${getDayName(dayOfWeek)}) - ${status} - ${totalHours ? totalHours.toFixed(2) + 'hrs' : 'In Progress'}`)
      }

      console.log('')
    }

    console.log(`\n🎉 Created ${createdCount} attendance records successfully!\n`)
    console.log('📊 Summary:')

    // Get summary stats
    const totalRecords = await prisma.attendance.count()
    const clockedIn = await prisma.attendance.count({ where: { clockOut: null } })
    const lateRecords = await prisma.attendance.count({ where: { status: 'late' } })
    const overtimeRecords = await prisma.attendance.count({ where: { isOvertime: true } })

    console.log(`   Total Records: ${totalRecords}`)
    console.log(`   Currently Clocked In: ${clockedIn}`)
    console.log(`   Late Arrivals: ${lateRecords}`)
    console.log(`   Overtime Records: ${overtimeRecords}`)

    console.log('\n✅ You can now view these records in the Attendance page!')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

function getDayName(dayNumber) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[dayNumber]
}

createTestAttendance()
