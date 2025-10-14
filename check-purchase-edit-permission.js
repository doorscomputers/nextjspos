const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPermission() {
  try {
    const user = await prisma.user.findFirst({
      where: { username: 'superadmin' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!user) {
      console.log('User not found!')
      return
    }

    console.log('=== Superadmin Purchase-Related Permissions ===')
    const purchasePerms = user.permissions
      .filter(p => p.permission.name.startsWith('purchase'))
      .map(p => p.permission.name)

    console.log(purchasePerms)

    const hasEdit = purchasePerms.includes('purchase.edit')
    console.log(`\nHas purchase.edit: ${hasEdit ? 'YES ✓' : 'NO ✗'}`)

    if (!hasEdit) {
      console.log('\n⚠️ ISSUE FOUND: Superadmin does NOT have purchase.edit permission!')
      console.log('This is why the Close PO button is not visible.')
      console.log('\nTo fix, we need to add purchase.edit to superadmin permissions.')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPermission()
