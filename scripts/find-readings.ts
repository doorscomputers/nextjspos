/**
 * Find all X/Z readings and which locations they belong to
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function findAllReadings() {
  console.log(`\n🔍 Finding ALL X/Z Readings in the system...\n`)

  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    select: {
      id: true,
      name: true,
      isActive: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  console.log(`📍 Found ${locations.length} location(s) in the system:\n`)

  for (const location of locations) {
    const readingCount = await prisma.cashierShiftReading.count({
      where: {
        locationId: location.id
      }
    })

    const shiftCount = await prisma.cashierShift.count({
      where: {
        locationId: location.id
      }
    })

    const salesCount = await prisma.sale.count({
      where: {
        locationId: location.id
      }
    })

    console.log(`📍 ${location.name} (ID: ${location.id}, Active: ${location.isActive})`)
    console.log(`   - Shifts: ${shiftCount}`)
    console.log(`   - Readings: ${readingCount}`)
    console.log(`   - Sales: ${salesCount}`)

    if (readingCount > 0) {
      const recentReadings = await prisma.cashierShiftReading.findMany({
        where: {
          locationId: location.id
        },
        select: {
          type: true,
          readingNumber: true,
          readingTime: true,
          grossSales: true,
          transactionCount: true,
          shift: {
            select: {
              shiftNumber: true
            }
          }
        },
        orderBy: {
          readingTime: 'desc'
        },
        take: 3
      })

      console.log(`   Recent readings:`)
      recentReadings.forEach(reading => {
        console.log(`      ${reading.type}-${reading.readingNumber}: ${reading.shift?.shiftNumber} @ ${reading.readingTime.toLocaleString()}, ₱${reading.grossSales.toFixed(2)}`)
      })
    }
    console.log('')
  }

  // Also check for readings with no location match
  console.log(`\n🔍 Checking for readings without location matches...\n`)

  const allReadings = await prisma.cashierShiftReading.findMany({
    select: {
      id: true,
      locationId: true,
      type: true,
      readingNumber: true,
      grossSales: true,
    },
    take: 50,
    orderBy: {
      readingTime: 'desc'
    }
  })

  const locationIds = new Set(locations.map(l => l.id))
  const orphanedReadings = allReadings.filter(r => !locationIds.has(r.locationId))

  if (orphanedReadings.length > 0) {
    console.log(`⚠️  Found ${orphanedReadings.length} readings with non-existent location IDs:`)
    orphanedReadings.forEach(r => {
      console.log(`   Reading ID: ${r.id}, Type: ${r.type}, Location ID: ${r.locationId} (NOT FOUND)`)
    })
  } else {
    console.log(`✅ All readings have valid location references`)
  }

  console.log(`\n✨ Done!\n`)
}

findAllReadings()
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
