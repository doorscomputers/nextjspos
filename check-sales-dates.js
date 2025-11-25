const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkSalesDates() {
  try {
    // Get sales from last 2 days
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const sales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: twoDaysAgo
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        createdAt: true,
        status: true
      },
      orderBy: {
        saleDate: 'desc'
      },
      take: 20
    })

    console.log('\n=== Recent Sales (Last 2 Days) ===')
    console.log('Server Time Now:', new Date().toISOString(), '(', new Date().toString(), ')')
    console.log('\nSales:')
    sales.forEach(sale => {
      console.log(`  ID: ${sale.id}`)
      console.log(`  Invoice: ${sale.invoiceNumber}`)
      console.log(`  Status: ${sale.status}`)
      console.log(`  saleDate (ISO): ${sale.saleDate.toISOString()}`)
      console.log(`  saleDate (Local): ${sale.saleDate.toString()}`)
      console.log(`  createdAt (ISO): ${sale.createdAt.toISOString()}`)
      console.log(`  createdAt (Local): ${sale.createdAt.toString()}`)
      console.log('  ---')
    })

    // Test today's range
    console.log('\n=== Testing Today Range (PH Timezone) ===')

    const getManilaDate = () => {
      const manilaDateString = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
      return new Date(manilaDateString)
    }

    const createStartOfDayPH = (year, month, day) => {
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      const isoString = `${year}-${monthStr}-${dayStr}T00:00:00+08:00`
      return new Date(isoString)
    }

    const createEndOfDayPH = (year, month, day) => {
      const monthStr = String(month + 1).padStart(2, '0')
      const dayStr = String(day).padStart(2, '0')
      const isoString = `${year}-${monthStr}-${dayStr}T23:59:59.999+08:00`
      return new Date(isoString)
    }

    const now = getManilaDate()
    const year = now.getFullYear()
    const month = now.getMonth()
    const day = now.getDate()

    const startOfDay = createStartOfDayPH(year, month, day)
    const endOfDay = createEndOfDayPH(year, month, day)

    console.log('Manila Now:', now)
    console.log('Start of Day PH:', startOfDay.toISOString(), '(', startOfDay.toString(), ')')
    console.log('End of Day PH:', endOfDay.toISOString(), '(', endOfDay.toString(), ')')

    const todaySales = await prisma.sale.findMany({
      where: {
        saleDate: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: ['completed', 'pending']
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        status: true
      },
      orderBy: {
        saleDate: 'desc'
      }
    })

    console.log(`\nFound ${todaySales.length} sales for today using PH timezone range`)
    todaySales.forEach(sale => {
      console.log(`  ${sale.invoiceNumber}: ${sale.saleDate.toISOString()} (${sale.saleDate.toString()}) - ${sale.status}`)
    })

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSalesDates()
