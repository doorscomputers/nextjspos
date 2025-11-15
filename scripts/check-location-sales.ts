/**
 * Diagnostic Script: Check Location Sales Data
 *
 * This script checks why a location might show zero sales on the dashboard
 *
 * Usage: npx tsx scripts/check-location-sales.ts <locationName>
 * Example: npx tsx scripts/check-location-sales.ts Tuguegarao
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkLocationSales(locationName: string) {
  console.log(`\n🔍 Checking sales data for location: ${locationName}\n`)

  // Step 1: Find the location
  const location = await prisma.businessLocation.findFirst({
    where: {
      name: {
        contains: locationName,
        mode: 'insensitive'
      }
    },
    include: {
      business: {
        select: {
          name: true
        }
      }
    }
  })

  if (!location) {
    console.error(`❌ Location "${locationName}" not found!`)
    console.log('\n📋 Available locations:')
    const allLocations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        deletedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    allLocations.forEach(loc => {
      console.log(`   - ${loc.name} (ID: ${loc.id}, Active: ${loc.isActive}, Deleted: ${loc.deletedAt ? 'Yes' : 'No'})`)
    })
    process.exit(1)
  }

  console.log(`✅ Location Found:`)
  console.log(`   - ID: ${location.id}`)
  console.log(`   - Name: ${location.name}`)
  console.log(`   - Business: ${location.business?.name}`)
  console.log(`   - Active: ${location.isActive ? 'Yes ✓' : 'No ✗'}`)
  console.log(`   - Deleted: ${location.deletedAt ? 'Yes ✗' : 'No ✓'}`)

  // Check if location is active
  if (!location.isActive) {
    console.log(`\n⚠️  WARNING: Location is INACTIVE!`)
    console.log(`   The dashboard only shows sales from ACTIVE locations.`)
    console.log(`   To fix: Set isActive = true in the business_locations table`)
  }

  if (location.deletedAt) {
    console.log(`\n⚠️  WARNING: Location is marked as DELETED!`)
    console.log(`   The dashboard excludes deleted locations.`)
  }

  // Step 2: Check today's sales
  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  console.log(`\n📅 Checking sales for TODAY (${startOfDay.toDateString()})...\n`)

  const todaySales = await prisma.sale.findMany({
    where: {
      locationId: location.id,
      saleDate: {
        gte: startOfDay
      }
    },
    select: {
      id: true,
      invoiceNumber: true,
      saleDate: true,
      totalAmount: true,
      status: true,
      customer: {
        select: {
          name: true
        }
      }
    },
    orderBy: {
      saleDate: 'desc'
    }
  })

  if (todaySales.length === 0) {
    console.log(`❌ NO SALES TODAY for ${location.name}`)
    console.log(`   This is why it shows zero on the dashboard!`)
  } else {
    console.log(`✅ Found ${todaySales.length} sale(s) today:`)

    let totalCompleted = 0
    let totalCancelled = 0
    let totalDraft = 0
    let totalOther = 0
    let amountCompleted = 0

    todaySales.forEach(sale => {
      const amount = parseFloat(sale.totalAmount.toString())
      console.log(`   - Invoice: ${sale.invoiceNumber}`)
      console.log(`     Status: ${sale.status}`)
      console.log(`     Amount: ₱${amount.toFixed(2)}`)
      console.log(`     Time: ${new Date(sale.saleDate).toLocaleTimeString()}`)
      console.log(`     Customer: ${sale.customer?.name || 'Walk-in'}`)
      console.log('')

      if (sale.status === 'completed' || sale.status === 'partial') {
        totalCompleted++
        amountCompleted += amount
      } else if (sale.status === 'cancelled') {
        totalCancelled++
      } else if (sale.status === 'draft') {
        totalDraft++
      } else {
        totalOther++
      }
    })

    console.log(`\n📊 Sales Breakdown:`)
    console.log(`   - Completed/Partial: ${totalCompleted} (₱${amountCompleted.toFixed(2)})`)
    console.log(`   - Cancelled: ${totalCancelled} (excluded from dashboard)`)
    console.log(`   - Draft: ${totalDraft} (excluded from dashboard)`)
    console.log(`   - Other: ${totalOther}`)

    if (totalCompleted === 0) {
      console.log(`\n⚠️  WARNING: No completed sales found!`)
      console.log(`   The dashboard only counts sales with status 'completed' or 'partial'`)
      console.log(`   Status 'cancelled' and 'draft' are excluded`)
    }
  }

  // Step 3: Check all-time sales
  console.log(`\n📈 Checking ALL-TIME sales for ${location.name}...\n`)

  const allTimeSales = await prisma.sale.aggregate({
    where: {
      locationId: location.id,
      status: { notIn: ['cancelled', 'draft'] }
    },
    _count: true,
    _sum: {
      totalAmount: true
    }
  })

  console.log(`   Total Sales (all time): ${allTimeSales._count}`)
  console.log(`   Total Amount (all time): ₱${parseFloat(allTimeSales._sum.totalAmount?.toString() || '0').toFixed(2)}`)

  // Step 4: Check recent sales (last 7 days)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentSales = await prisma.sale.findMany({
    where: {
      locationId: location.id,
      saleDate: {
        gte: sevenDaysAgo
      },
      status: { notIn: ['cancelled', 'draft'] }
    },
    select: {
      saleDate: true,
      totalAmount: true
    },
    orderBy: {
      saleDate: 'desc'
    }
  })

  if (recentSales.length > 0) {
    console.log(`\n📅 Recent Sales (Last 7 Days): ${recentSales.length} sale(s)`)
    const salesByDate = new Map<string, number>()
    recentSales.forEach(sale => {
      const dateKey = new Date(sale.saleDate).toDateString()
      const amount = parseFloat(sale.totalAmount.toString())
      salesByDate.set(dateKey, (salesByDate.get(dateKey) || 0) + amount)
    })

    Array.from(salesByDate.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .forEach(([date, amount]) => {
        console.log(`   ${date}: ₱${amount.toFixed(2)}`)
      })
  } else {
    console.log(`\n❌ No sales in the last 7 days`)
  }

  console.log(`\n✨ Diagnosis Complete!\n`)
}

// Get location name from command line argument
const locationName = process.argv[2]

if (!locationName) {
  console.error('❌ Please provide a location name')
  console.error('Usage: npx tsx scripts/check-location-sales.ts <locationName>')
  console.error('Example: npx tsx scripts/check-location-sales.ts Tuguegarao')
  process.exit(1)
}

// Run the check
checkLocationSales(locationName)
  .catch(error => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
