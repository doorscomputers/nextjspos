import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearSessions() {
  try {
    // Delete all sessions from database
    const result = await prisma.session.deleteMany({})
    console.log(`Deleted ${result.count} sessions from database`)

    console.log('\n=== Next Steps ===')
    console.log('1. Clear your browser cookies for localhost:3000')
    console.log('   - In Chrome: Press F12 -> Application tab -> Cookies -> localhost:3000 -> Delete all')
    console.log('   - Or use Incognito/Private browsing mode')
    console.log('2. Go to http://localhost:3000/login')
    console.log('3. Log in with: superadmin / password')
    console.log('4. Try adding opening stock again')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearSessions()
