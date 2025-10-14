const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing duplicate users...')

  // Delete problematic demo users
  await prisma.user.deleteMany({
    where: {
      username: {
        in: ['branchadmin', 'branchmanager', 'accountant', 'warehousemanager', 'staff', 'cashier']
      }
    }
  })

  console.log('✅ Duplicate users deleted')
  console.log('✅ Ready to re-seed')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
