import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...')

    const sql = fs.readFileSync('create-notifications-table.sql', 'utf-8')

    // Split by semicolons to execute statements separately
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX') || statement.includes('COMMENT ON')) {
        await prisma.$executeRawUnsafe(statement)
        console.log('✓ Executed:', statement.substring(0, 50) + '...')
      }
    }

    console.log('\n✅ Notifications table created successfully!')

  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('✓ Table already exists, skipping...')
    } else {
      console.error('❌ Error:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

createNotificationsTable()
