/**
 * Deep Diagnostic: Check Tuguegarao Sales and Readings
 * Investigates why sales exist but aren't showing up
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function deepCheckTuguegarao() {
  console.log(`\n🔬 DEEP DIAGNOSTIC: Tuguegarao Sales Investigation\n`)

  // Step 1: Find ALL locations with "Tuguegarao" in the name
  console.log(`📍 Step 1: Finding all Tuguegarao locations...\n`)

  const tuguegaraoLocations = await prisma.businessLocation.findMany({
    where: {
      name: {
        contains: 'Tuguegarao',
        mode: 'insensitive'
      }
    },
    include: {
      business: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  console.log(`Found ${tuguegaraoLocations.length} location(s):`)
  tuguegaraoLocations.forEach(loc => {
    console.log(`   - ID: ${loc.id}, Name: "${loc.name}", Business ID: ${loc.businessId}, Active: ${loc.isActive}, Deleted: ${loc.deletedAt ? 'Yes' : 'No'}`)
  })

  // Step 2: Check shifts for ALL Tuguegarao locations
  console.log(`\n📋 Step 2: Checking shifts for Tuguegarao...\n`)

  for (const location of tuguegaraoLocations) {
    const shifts = await prisma.cashierShift.findMany({
      where: {
        locationId: location.id
      },
      select: {
        id: true,
        shiftNumber: true,
        openedAt: true,
        closedAt: true,
        status: true,
        runningGrossSales: true,
        runningNetSales: true,
        runningTransactions: true,
      },
      orderBy: {
        openedAt: 'desc'
      },
      take: 5
    })

    console.log(`Location: ${location.name} (ID: ${location.id})`)
    if (shifts.length === 0) {
      console.log(`   ❌ No shifts found`)
    } else {
      console.log(`   ✅ Found ${shifts.length} shift(s):`)
      shifts.forEach(shift => {
        console.log(`      - Shift: ${shift.shiftNumber}`)
        console.log(`        Status: ${shift.status}`)
        console.log(`        Opened: ${shift.openedAt}`)
        console.log(`        Gross Sales: ₱${parseFloat(shift.runningGrossSales.toString()).toFixed(2)}`)
        console.log(`        Transactions: ${shift.runningTransactions}`)
        console.log('')
      })
    }
  }

  // Step 3: Check X/Z readings
  console.log(`\n📊 Step 3: Checking X/Z readings for Tuguegarao...\n`)

  for (const location of tuguegaraoLocations) {
    const readings = await prisma.cashierShiftReading.findMany({
      where: {
        locationId: location.id
      },
      select: {
        id: true,
        type: true,
        readingNumber: true,
        readingTime: true,
        grossSales: true,
        netSales: true,
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
      take: 10
    })

    console.log(`Location: ${location.name} (ID: ${location.id})`)
    if (readings.length === 0) {
      console.log(`   ❌ No readings found`)
    } else {
      console.log(`   ✅ Found ${readings.length} reading(s):`)
      readings.forEach(reading => {
        console.log(`      - ${reading.type} Reading #${reading.readingNumber}`)
        console.log(`        Shift: ${reading.shift?.shiftNumber}`)
        console.log(`        Time: ${reading.readingTime}`)
        console.log(`        Gross Sales: ₱${reading.grossSales.toFixed(2)}`)
        console.log(`        Transactions: ${reading.transactionCount}`)
        console.log('')
      })
    }
  }

  // Step 4: Check sales for ALL Tuguegarao locations (including all business IDs)
  console.log(`\n💰 Step 4: Checking sales records...\n`)

  for (const location of tuguegaraoLocations) {
    // Check total sales count
    const totalSales = await prisma.sale.count({
      where: {
        locationId: location.id
      }
    })

    console.log(`Location: ${location.name} (ID: ${location.id})`)
    console.log(`   Total sales (all statuses): ${totalSales}`)

    if (totalSales > 0) {
      // Get sales by status
      const salesByStatus = await prisma.sale.groupBy({
        by: ['status'],
        where: {
          locationId: location.id
        },
        _count: true,
        _sum: {
          totalAmount: true
        }
      })

      console.log(`   Sales breakdown by status:`)
      salesByStatus.forEach(group => {
        console.log(`      - ${group.status}: ${group._count} sales, ₱${parseFloat(group._sum.totalAmount?.toString() || '0').toFixed(2)}`)
      })

      // Get recent sales
      const recentSales = await prisma.sale.findMany({
        where: {
          locationId: location.id
        },
        select: {
          id: true,
          invoiceNumber: true,
          saleDate: true,
          totalAmount: true,
          status: true,
          businessId: true,
        },
        orderBy: {
          saleDate: 'desc'
        },
        take: 5
      })

      console.log(`   Recent sales:`)
      recentSales.forEach(sale => {
        console.log(`      - Invoice: ${sale.invoiceNumber}`)
        console.log(`        Date: ${sale.saleDate}`)
        console.log(`        Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}`)
        console.log(`        Status: ${sale.status}`)
        console.log(`        Business ID: ${sale.businessId}`)
        console.log('')
      })
    }
  }

  // Step 5: Check if there are sales with NULL or different locationId
  console.log(`\n🔍 Step 5: Checking for orphaned sales (locationId issues)...\n`)

  const orphanedSales = await prisma.sale.findMany({
    where: {
      OR: [
        { locationId: null },
        {
          location: null
        }
      ]
    },
    select: {
      id: true,
      invoiceNumber: true,
      saleDate: true,
      totalAmount: true,
      locationId: true,
      businessId: true
    },
    take: 10
  })

  if (orphanedSales.length > 0) {
    console.log(`⚠️  Found ${orphanedSales.length} sales with location issues:`)
    orphanedSales.forEach(sale => {
      console.log(`   - Invoice: ${sale.invoiceNumber}, Location ID: ${sale.locationId}, Business ID: ${sale.businessId}`)
    })
  } else {
    console.log(`✅ No orphaned sales found`)
  }

  console.log(`\n✨ Deep Diagnostic Complete!\n`)
}

deepCheckTuguegarao()
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
