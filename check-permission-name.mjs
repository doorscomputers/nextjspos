import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkPermission() {
  try {
    const permissions = await prisma.permission.findMany({
      where: {
        name: {
          contains: 'transfer'
        }
      }
    })
    
    console.log('\n📋 Transfer-related permissions:')
    permissions.forEach(p => {
      console.log(`  - ${p.id}: ${p.name}`)
    })
    
    console.log('\n✅ Now checking if "Price Manager" role has the complete permission...')
    
    const role = await prisma.role.findFirst({
      where: { name: 'Price Manager' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })
    
    if (role) {
      console.log(`\n📋 Permissions for "${role.name}" role:`)
      role.permissions.forEach(rp => {
        const isTransferPerm = rp.permission.name.includes('transfer')
        console.log(`  ${isTransferPerm ? '🚚' : '  '} ${rp.permission.name}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPermission()

