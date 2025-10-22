import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkNotificationsTable() {
  try {
    console.log('Checking notifications table...')

    // Try to count notifications
    const count = await prisma.notification.count()
    console.log('✅ Notifications table exists!')
    console.log(`   Found ${count} notifications in the database`)

    // Try to find one notification
    const sample = await prisma.notification.findFirst()
    if (sample) {
      console.log('   Sample notification:', sample)
    }

  } catch (error) {
    console.error('❌ Error accessing notifications table:')
    console.error(error.message)

    if (error.code === 'P2021') {
      console.log('\n⚠️  The notifications table does not exist in the database!')
      console.log('   Solution: Run `npx prisma db push` to create the missing table')
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkNotificationsTable()
