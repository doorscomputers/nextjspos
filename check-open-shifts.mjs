import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkOpenShifts() {
  console.log("🔍 Checking Open Shifts...\n")

  try {
    const openShifts = await prisma.cashierShift.findMany({
      where: {
        status: "open",
      }
    })

    console.log(`📊 Found ${openShifts.length} open shift(s)\n`)

    if (openShifts.length === 0) {
      console.log("❌ NO OPEN SHIFTS FOUND")
      console.log("\n💡 To use X Reading, you need to:")
      console.log("   1. Go to: http://localhost:3000/dashboard/shifts/begin")
      console.log("   2. Start a new shift with beginning cash")
      console.log("   3. Then you can generate X Reading\n")
    } else {
      openShifts.forEach((shift, i) => {
        console.log(`Shift ${i + 1}:`)
        console.log(`   Shift Number: ${shift.shiftNumber}`)
        console.log(`   User ID: ${shift.userId}`)
        console.log(`   Location ID: ${shift.locationId}`)
        console.log(`   Opened At: ${new Date(shift.openedAt).toLocaleString()}`)
        console.log(`   Beginning Cash: ₱${parseFloat(shift.beginningCash.toString()).toFixed(2)}`)
        console.log(`   X Reading Count: ${shift.xReadingCount}`)
        console.log("")
      })
      console.log("✅ You have open shift(s) - X Reading should work\n")
    }

    // Check user locations
    console.log("=" .repeat(80))
    console.log("\n🗺️  User Location Assignments:\n")
    const userLocations = await prisma.userLocation.findMany()
    console.log(`Found ${userLocations.length} assignments\n`)
    if (userLocations.length === 0) {
      console.log("⚠️  WARNING: No user location assignments!")
      console.log("   This will cause X Reading to fail\n")
    }

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkOpenShifts()
