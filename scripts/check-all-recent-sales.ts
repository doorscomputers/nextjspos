import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL && process.env.StiDATABASE_URL) {
  process.env.DATABASE_URL = process.env.StiDATABASE_URL
}

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function check() {
  console.log('=== CHECKING ALL RECENT SALES AT TUGUEGARAO (Last 3 days) ===\n')

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // All sales at Tuguegarao in last 3 days
  const allSales = await prisma.sale.findMany({
    where: {
      locationId: 4, // Tuguegarao
      createdAt: { gte: threeDaysAgo }
    },
    include: {
      items: true,
      creator: { select: { username: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  console.log(`Found ${allSales.length} total sales at Tuguegarao in last 3 days\n`)

  // Group by status
  const byStatus = allSales.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('Sales by status:')
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })

  // Show last 20 sales with details
  console.log('\nLast 20 sales:')
  allSales.slice(0, 20).forEach(s => {
    const itemList = s.items.map(i => `${i.quantity}x@${i.unitPrice}`).join(', ')
    console.log(`  ${s.invoiceNumber} | ${s.status} | ${s.totalAmount} | ${s.creator?.username} | ${s.createdAt.toISOString().substring(0, 19)} | Items: ${itemList}`)
  })

  // Check for sales with O156IPC specifically
  console.log('\n=== SALES CONTAINING O156IPC (PRODUCT 607) ===')
  const o156Sales = allSales.filter(s => s.items.some(i => i.productId === 607))
  console.log(`Found ${o156Sales.length} sales with O156IPC`)
  o156Sales.forEach(s => {
    console.log(`\n  Invoice: ${s.invoiceNumber}`)
    console.log(`    Status: ${s.status}`)
    console.log(`    Total: ${s.totalAmount}`)
    console.log(`    Cashier: ${s.creator?.username}`)
    console.log(`    Date: ${s.createdAt}`)
    console.log(`    Deleted: ${s.deletedAt || 'No'}`)
    s.items.filter(i => i.productId === 607).forEach(i => {
      console.log(`    O156IPC Item: qty=${i.quantity} @ ${i.unitPrice}`)
    })
  })

  // Check idempotency keys for sales endpoint specifically
  console.log('\n=== IDEMPOTENCY KEYS FOR SALES (Last 3 days) ===')
  const salesKeys = await prisma.$queryRaw`
    SELECT id, key, status, endpoint, created_at, response_status
    FROM idempotency_keys
    WHERE endpoint LIKE '%sales%'
    AND created_at > NOW() - INTERVAL '3 days'
    ORDER BY created_at DESC
    LIMIT 30
  ` as any[]

  console.log(`Found ${salesKeys.length} idempotency keys for sales endpoint`)
  const keysByStatus = salesKeys.reduce((acc: any, k: any) => {
    acc[k.status] = (acc[k.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  console.log('Keys by status:')
  Object.entries(keysByStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`)
  })

  console.log('\n=== COMPLETE ===')
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
