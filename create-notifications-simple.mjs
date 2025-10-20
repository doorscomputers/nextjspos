import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createNotificationsTable() {
  try {
    console.log('Creating notifications table...')

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          business_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          action_url VARCHAR(500),
          related_type VARCHAR(50),
          related_id INTEGER,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          read_at TIMESTAMP,
          priority VARCHAR(20) NOT NULL DEFAULT 'normal',
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMP,

          CONSTRAINT fk_notification_user
              FOREIGN KEY (user_id)
              REFERENCES users (id)
              ON DELETE CASCADE
      )
    `)

    console.log('✓ Table created')

    // Create indexes
    console.log('Creating indexes...')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id)`)
    console.log('✓ Index: business_id')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`)
    console.log('✓ Index: user_id, is_read')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`)
    console.log('✓ Index: type')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`)
    console.log('✓ Index: created_at')

    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at)`)
    console.log('✓ Index: expires_at')

    console.log('\n✅ Notifications table and indexes created successfully!')

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

createNotificationsTable()
