const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPermissions() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: 12 },
      select: {
        id: true,
        username: true,
        permissions: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    console.log('\n=== User Permissions Check ===')
    console.log('User:', user.username)
    console.log('\nDirect Permissions:', user.permissions)
    console.log('\nRoles:', user.roles.map(r => r.role.name).join(', '))

    // Check for receipt permissions
    const hasReceiptView = user.permissions.includes('purchase_receipt.view')
    const hasReceiptCreate = user.permissions.includes('purchase_receipt.create')
    const hasReceiptApprove = user.permissions.includes('purchase_receipt.approve')

    console.log('\n=== Receipt Permissions ===')
    console.log('purchase_receipt.view:', hasReceiptView ? '✓ YES' : '✗ NO')
    console.log('purchase_receipt.create:', hasReceiptCreate ? '✓ YES' : '✗ NO')
    console.log('purchase_receipt.approve:', hasReceiptApprove ? '✓ YES' : '✗ NO')

    // Show all role permissions
    console.log('\n=== Role Permissions ===')
    user.roles.forEach(r => {
      console.log(`\n${r.role.name}:`)
      r.role.permissions.forEach(p => {
        console.log(`  - ${p.permission.name}`)
      })
    })
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

checkPermissions()
