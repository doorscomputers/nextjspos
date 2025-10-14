const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkWorkflowParticipants() {
  try {
    // Get the transfer with all participant info
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: 1 },
      select: {
        id: true,
        transferNumber: true,
        status: true,
        createdBy: true,
        checkedBy: true,
        sentBy: true,
        arrivedBy: true,
        verifiedBy: true,
        completedBy: true
      }
    })

    if (!transfer) {
      console.log('❌ Transfer not found')
      return
    }

    console.log('📋 Transfer Workflow Participants')
    console.log('═════════════════════════════════════════\n')
    console.log('Transfer:', transfer.transferNumber)
    console.log('Status:', transfer.status)
    console.log('')

    // Get user details for each participant
    const userIds = [
      transfer.createdBy,
      transfer.checkedBy,
      transfer.sentBy,
      transfer.arrivedBy,
      transfer.verifiedBy,
      transfer.completedBy
    ].filter(id => id !== null)

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    })

    const userMap = new Map(users.map(u => [u.id, u.username]))

    console.log('👥 Participants:')
    console.log('─────────────────────────────────────────')
    console.log('1. Created By      :', transfer.createdBy, '-', userMap.get(transfer.createdBy) || 'Unknown')
    console.log('2. Checked By      :', transfer.checkedBy, '-', userMap.get(transfer.checkedBy) || 'Unknown')
    console.log('3. Sent By         :', transfer.sentBy, '-', userMap.get(transfer.sentBy) || 'Unknown')
    console.log('4. Arrived By      :', transfer.arrivedBy, '-', userMap.get(transfer.arrivedBy) || 'Unknown')
    console.log('5. Verified By     :', transfer.verifiedBy, '-', userMap.get(transfer.verifiedBy) || 'Unknown')
    console.log('6. Completed By    :', transfer.completedBy || 'NOT YET COMPLETED')
    console.log('')

    // Get current user (mainmgr / Main Store Transfer Verifier)
    const currentUser = await prisma.user.findUnique({
      where: { username: 'mainmgr' },
      select: { id: true, username: true }
    })

    console.log('🔍 Current User Analysis:')
    console.log('─────────────────────────────────────────')
    console.log('Current User ID    :', currentUser.id, '-', currentUser.username)
    console.log('')
    console.log('Can Complete Transfer?')
    console.log('  • Is Creator?       :', transfer.createdBy === currentUser.id ? '❌ YES (blocked)' : '✅ NO')
    console.log('  • Is Sender?        :', transfer.sentBy === currentUser.id ? '❌ YES (blocked)' : '✅ NO')
    console.log('  • Is Verifier?      :', transfer.verifiedBy === currentUser.id ? '❌ YES (blocked)' : '✅ NO')
    console.log('')

    // Check frontend code for separation of duties
    console.log('📖 Frontend Code (page.tsx lines 431-439):')
    console.log('─────────────────────────────────────────')
    console.log('// Verified → Complete')
    console.log('if (status === "verified" && can(PERMISSIONS.STOCK_TRANSFER_COMPLETE)) {')
    console.log('  actions.push({')
    console.log('    label: "Complete Transfer",')
    console.log('    icon: CheckCircleIcon,')
    console.log('    onClick: handleComplete,')
    console.log('    variant: "default" as const')
    console.log('  })')
    console.log('}')
    console.log('')
    console.log('⚠️ NOTE: Frontend does NOT check separation of duties for Complete action!')
    console.log('         It only checks status and permission.')
    console.log('')

    // Check API endpoint for separation of duties
    console.log('🔧 Checking API Endpoint...')
    console.log('')

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkWorkflowParticipants()
