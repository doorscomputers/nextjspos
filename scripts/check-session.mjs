import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkSession() {
  try {
    // Get the most recent session for superadmin
    const user = await prisma.user.findUnique({
      where: { username: 'superadmin' },
      include: {
        sessions: {
          orderBy: { expires: 'desc' },
          take: 1
        }
      }
    })

    if (!user) {
      console.log('Super Admin user not found')
      return
    }

    console.log('\n=== Super Admin Session Info ===')
    console.log('User ID:', user.id)
    console.log('Username:', user.username)

    if (user.sessions.length > 0) {
      const session = user.sessions[0]
      console.log('\nMost Recent Session:')
      console.log('Session Token:', session.sessionToken.substring(0, 20) + '...')
      console.log('Expires:', session.expires)
      console.log('Is Expired:', new Date() > new Date(session.expires))
    } else {
      console.log('\nNo active sessions found')
    }

    console.log('\n=== Solution ===')
    console.log('You need to log out and log back in to refresh your session with the updated permissions.')
    console.log('\n1. Go to http://localhost:3000')
    console.log('2. Click your profile icon and log out')
    console.log('3. Log back in with username: superadmin, password: password')
    console.log('4. Try adding opening stock again')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkSession()
