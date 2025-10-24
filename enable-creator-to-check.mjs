import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Enabling "Allow Creator to Check" for all businesses...')

  try {
    // Update all businesses to allow creator to check
    const result = await prisma.businessSODSettings.updateMany({
      data: {
        allowCreatorToCheck: true
      }
    })

    console.log(`✅ Updated ${result.count} business(es)`)

    // Verify the changes
    const settings = await prisma.businessSODSettings.findMany({
      select: {
        businessId: true,
        enforceTransferSOD: true,
        allowCreatorToCheck: true,
        allowCreatorToSend: true,
        allowCheckerToSend: true
      }
    })

    console.log('\n📊 Current SOD Settings for all businesses:')
    settings.forEach(s => {
      console.log(`\nBusiness ID: ${s.businessId}`)
      console.log(`  - Enforce Transfer SOD: ${s.enforceTransferSOD}`)
      console.log(`  - Allow Creator to Check: ${s.allowCreatorToCheck} ✅`)
      console.log(`  - Allow Creator to Send: ${s.allowCreatorToSend}`)
      console.log(`  - Allow Checker to Send: ${s.allowCheckerToSend}`)
    })

    console.log('\n✨ Done! Now refresh your transfer page (TR-202510-0004)')
    console.log('   You should see the "Approve" button!')
  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
