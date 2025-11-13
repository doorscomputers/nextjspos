/**
 * Cleanup script to remove old invoice sequence records
 * Run this after migration to ensure clean state
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('🧹 Cleaning up old invoice sequence records...')

  try {
    // Delete all existing invoice sequences (they'll be regenerated)
    const deleted = await prisma.$executeRaw`DELETE FROM invoice_sequences`

    console.log(`✅ Deleted ${deleted} old sequence records`)
    console.log('✅ Invoice sequences table is now clean')
    console.log('   New sequences will start from 0001 for each location/day')

  } catch (error: any) {
    console.error('❌ Cleanup failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

cleanup()
