/**
 * Database Migration Script: Fix isDefault Role Values
 *
 * Purpose:
 * - Set isDefault = true ONLY for "Super Admin" role (protected, cannot be edited)
 * - Set isDefault = false for all other roles (can be edited/customized)
 *
 * This ensures only Super Admin is protected from editing/deletion.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Starting role isDefault migration...\n')

  try {
    // Get all roles
    const allRoles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        isDefault: true,
        businessId: true,
      },
    })

    console.log(`📊 Found ${allRoles.length} roles in database\n`)

    // Separate roles
    const superAdminRoles = allRoles.filter(r => r.name === 'Super Admin')
    const otherRoles = allRoles.filter(r => r.name !== 'Super Admin')

    // Update Super Admin roles to isDefault = true
    if (superAdminRoles.length > 0) {
      console.log(`✅ Setting isDefault = true for ${superAdminRoles.length} Super Admin role(s)...`)

      for (const role of superAdminRoles) {
        await prisma.role.update({
          where: { id: role.id },
          data: { isDefault: true },
        })
        console.log(`   ✓ Updated: "${role.name}" (ID: ${role.id}, Business: ${role.businessId})`)
      }
      console.log()
    } else {
      console.log('⚠️  No Super Admin roles found!\n')
    }

    // Update all other roles to isDefault = false
    if (otherRoles.length > 0) {
      console.log(`✅ Setting isDefault = false for ${otherRoles.length} other role(s)...`)

      for (const role of otherRoles) {
        await prisma.role.update({
          where: { id: role.id },
          data: { isDefault: false },
        })
        console.log(`   ✓ Updated: "${role.name}" (ID: ${role.id}, Business: ${role.businessId})`)
      }
      console.log()
    }

    // Verify the changes
    const updatedRoles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        isDefault: true,
        businessId: true,
      },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    })

    console.log('📋 Final Role Status:')
    console.log('━'.repeat(70))
    console.log('Name'.padEnd(30) + 'Type'.padEnd(15) + 'Business ID')
    console.log('━'.repeat(70))

    updatedRoles.forEach(role => {
      const type = role.isDefault ? '🔒 System' : '✏️  Custom'
      console.log(
        role.name.padEnd(30) +
        type.padEnd(15) +
        role.businessId
      )
    })
    console.log('━'.repeat(70))

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📝 Summary:')
    console.log(`   • Super Admin roles (protected): ${updatedRoles.filter(r => r.isDefault).length}`)
    console.log(`   • Other roles (editable): ${updatedRoles.filter(r => !r.isDefault).length}`)
    console.log('\n🎉 Super Admin will now automatically have ALL permissions!')
    console.log('🎉 Other roles can now be edited in the Roles & Permissions page!')

  } catch (error) {
    console.error('❌ Error during migration:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
