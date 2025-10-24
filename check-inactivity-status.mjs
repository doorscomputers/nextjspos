import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking Inactivity Timeout Status...\n')

  try {
    // Get inactivity settings
    const settings = await prisma.inactivitySettings.findFirst()

    if (!settings) {
      console.log('❌ No inactivity settings found in database!')
      console.log('💡 Run: node run-create-inactivity-table.mjs')
      return
    }

    console.log('📊 Current Inactivity Settings:')
    console.log('━'.repeat(50))
    console.log(`Enabled: ${settings.enabled ? '✅ YES' : '❌ NO'}`)
    console.log(`Super Admin Timeout: ${settings.superAdminTimeout} minutes`)
    console.log(`Admin Timeout: ${settings.adminTimeout} minutes`)
    console.log(`Manager Timeout: ${settings.managerTimeout} minutes`)
    console.log(`Cashier Timeout: ${settings.cashierTimeout} minutes`)
    console.log(`Default Timeout: ${settings.defaultTimeout} minutes`)
    console.log(`Warning Time: ${settings.warningTime} minutes`)
    console.log(`Warning Message: ${settings.warningMessage || '(default)'}`)
    console.log('━'.repeat(50))

    if (!settings.enabled) {
      console.log('\n⚠️  INACTIVITY TIMEOUT IS DISABLED!')
      console.log('To enable it:')
      console.log('  1. Go to Settings > Inactivity Timeout')
      console.log('  2. Toggle the switch to ON (green)')
      console.log('  3. Click Save Settings')
    } else {
      console.log('\n✅ Inactivity timeout is ENABLED and active!')
      console.log('\n💡 How it works:')
      console.log(`  - Super Admin: Logout after ${settings.superAdminTimeout} min of inactivity`)
      console.log(`  - Admin: Logout after ${settings.adminTimeout} min of inactivity`)
      console.log(`  - Manager: Logout after ${settings.managerTimeout} min of inactivity`)
      console.log(`  - Cashier: Logout after ${settings.cashierTimeout} min of inactivity`)
      console.log(`  - Warning: Shows ${settings.warningTime} min before logout`)
    }

    // Check announcements
    console.log('\n\n📢 Checking Announcements...')
    console.log('━'.repeat(50))

    const announcements = await prisma.announcement.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    if (announcements.length === 0) {
      console.log('❌ No active announcements found!')
      console.log('💡 Run: node add-more-announcements.mjs')
    } else {
      console.log(`✅ Found ${announcements.length} active announcements:\n`)
      announcements.forEach((a, index) => {
        const icon = a.icon || '📢'
        const priority = a.priority.toUpperCase()
        console.log(`  ${index + 1}. ${icon} [${priority}] ${a.title}`)
        console.log(`     "${a.message}"`)
      })

      console.log('\n✅ Announcements should be visible in the header ticker!')
      console.log('💡 If not visible, try:')
      console.log('  1. Hard refresh the browser (Ctrl+Shift+R)')
      console.log('  2. Clear browser cache')
      console.log('  3. Check browser console for errors')
    }

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
