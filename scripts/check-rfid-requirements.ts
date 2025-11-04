import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRfidRequirements() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('🔐 RFID VALIDATION REQUIREMENTS CHECK')
  console.log('═══════════════════════════════════════════════════════════\n')

  try {
    // Admin roles that are EXEMPT from RFID scanning
    const ADMIN_ROLES = ['Super Admin', 'System Administrator', 'All Branch Admin']

    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              select: { name: true }
            }
          }
        },
        userLocations: {
          include: {
            location: {
              select: {
                name: true,
                locationCode: true
              }
            }
          }
        }
      },
      orderBy: { username: 'asc' }
    })

    console.log('📊 Total Users:', users.length)
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('✅ ADMIN USERS (RFID scanning NOT required)')
    console.log('═══════════════════════════════════════════════════════════\n')

    const adminUsers = users.filter(u => {
      const roleNames = u.roles.map(r => r.role.name)
      return roleNames.some(role => ADMIN_ROLES.includes(role))
    })

    if (adminUsers.length === 0) {
      console.log('   No admin users found.')
    } else {
      adminUsers.forEach(user => {
        const roleNames = user.roles.map(r => r.role.name).join(', ')
        console.log(`   👤 ${user.username}`)
        console.log(`      Name: ${user.firstName} ${user.lastName || ''}`.trim())
        console.log(`      Roles: ${roleNames}`)
        console.log(`      ℹ️  Can login WITHOUT scanning RFID card\n`)
      })
    }

    console.log('═══════════════════════════════════════════════════════════')
    console.log('⚠️  NON-ADMIN USERS (RFID scanning REQUIRED)')
    console.log('═══════════════════════════════════════════════════════════\n')

    const nonAdminUsers = users.filter(u => {
      const roleNames = u.roles.map(r => r.role.name)
      return !roleNames.some(role => ADMIN_ROLES.includes(role))
    })

    if (nonAdminUsers.length === 0) {
      console.log('   No non-admin users found.')
    } else {
      nonAdminUsers.forEach(user => {
        const roleNames = user.roles.map(r => r.role.name).join(', ')
        const locations = user.userLocations.map(ul => ul.location.name).join(', ')
        const locationCodes = user.userLocations
          .filter(ul => ul.location.locationCode)
          .map(ul => `${ul.location.name}: ${ul.location.locationCode}`)
          .join(', ')

        console.log(`   👤 ${user.username}`)
        console.log(`      Name: ${user.firstName} ${user.lastName || ''}`.trim())
        console.log(`      Roles: ${roleNames}`)
        console.log(`      Assigned Locations: ${locations || 'NONE'}`)

        if (locationCodes) {
          console.log(`      📱 RFID Codes: ${locationCodes}`)
        } else {
          console.log(`      ⚠️  NO RFID CODES configured for assigned locations!`)
        }

        console.log(`      🔒 MUST scan RFID card to login\n`)
      })
    }

    // Check locations without RFID codes
    console.log('═══════════════════════════════════════════════════════════')
    console.log('📍 LOCATION RFID CODE STATUS')
    console.log('═══════════════════════════════════════════════════════════\n')

    const locations = await prisma.businessLocation.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' }
    })

    locations.forEach(loc => {
      if (loc.locationCode) {
        console.log(`   ✅ ${loc.name}`)
        console.log(`      RFID Code: ${loc.locationCode}`)
        console.log(`      Status: ${loc.isActive ? 'Active' : 'Inactive'}\n`)
      } else {
        console.log(`   ❌ ${loc.name}`)
        console.log(`      ⚠️  NO RFID CODE CONFIGURED`)
        console.log(`      Users cannot login at this location without RFID!\n`)
      }
    })

    console.log('═══════════════════════════════════════════════════════════')
    console.log('📝 SUMMARY & RECOMMENDATIONS')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log(`   Admin Users (can skip RFID): ${adminUsers.length}`)
    console.log(`   Non-Admin Users (need RFID): ${nonAdminUsers.length}`)
    console.log(`   Locations with RFID codes: ${locations.filter(l => l.locationCode).length}/${locations.length}`)

    const usersAtLocationsWithoutRfid = nonAdminUsers.filter(u => {
      return u.userLocations.some(ul => !ul.location.locationCode)
    })

    if (usersAtLocationsWithoutRfid.length > 0) {
      console.log('\n   ⚠️  WARNING: Some non-admin users are assigned to locations without RFID codes!')
      console.log('   These users will NOT be able to login until RFID codes are configured.')
      usersAtLocationsWithoutRfid.forEach(u => {
        console.log(`      - ${u.username}`)
      })
    }

    const locationsWithoutRfid = locations.filter(l => !l.locationCode)
    if (locationsWithoutRfid.length > 0) {
      console.log('\n   📌 ACTION REQUIRED: Configure RFID codes for these locations:')
      locationsWithoutRfid.forEach(l => {
        console.log(`      - ${l.name}`)
        console.log(`        Go to: Settings → Business Locations → Edit "${l.name}" → Set Location Code`)
      })
    }

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('🧪 HOW TO TEST RFID VALIDATION')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log('   1. Admin accounts (can skip RFID):')
    if (adminUsers.length > 0) {
      console.log(`      Login as: ${adminUsers[0].username}`)
      console.log('      → Leave RFID field blank')
      console.log('      → Should login successfully ✅\n')
    }

    console.log('   2. Non-admin accounts (must scan RFID):')
    if (nonAdminUsers.length > 0) {
      const nonAdminWithRfid = nonAdminUsers.find(u =>
        u.userLocations.some(ul => ul.location.locationCode)
      )

      if (nonAdminWithRfid) {
        const locationWithCode = nonAdminWithRfid.userLocations.find(ul => ul.location.locationCode)
        console.log(`      a) Login as: ${nonAdminWithRfid.username}`)
        console.log('         → Leave RFID field blank')
        console.log('         → Should BLOCK with error: "Location verification required" ❌\n')

        if (locationWithCode) {
          console.log(`      b) Login as: ${nonAdminWithRfid.username}`)
          console.log(`         → Scan RFID: ${locationWithCode.location.locationCode}`)
          console.log('         → Should login successfully ✅\n')
        }
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n')

  } catch (error: any) {
    console.error('❌ ERROR:', error.message)
    console.error('Stack trace:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkRfidRequirements()
