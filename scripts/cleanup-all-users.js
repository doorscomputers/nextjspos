const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Cleaning up all demo users...')

  // Delete ALL users except superadmin and admin
  const deleted = await prisma.user.deleteMany({
    where: {
      username: {
        notIn: ['superadmin', 'admin']
      }
    }
  })

  console.log(`✅ Deleted ${deleted.count} users`)
  console.log('✅ Database ready for fresh seed')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
