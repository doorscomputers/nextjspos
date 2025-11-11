/**
 * Set BIR Default Values
 * Sets temporary MIN, Serial Number and Operated By for existing businesses
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setBIRDefaults() {
  try {
    console.log('🔧 Setting BIR default values for businesses...')

    // Update all businesses with default BIR values
    const result = await prisma.business.updateMany({
      data: {
        birMinNumber: 'xxxxxxxxxxxxx', // Temporary placeholder
        birSerialNumber: 'xxxxxxxxxxxxx', // Temporary placeholder
        operatedBy: 'Charlie Hiadan', // Business owner name
        birPermitNumber: null, // To be filled in later
        businessAddress: null, // To be filled in later (will fall back to location address)
      },
    })

    console.log(`✅ Updated ${result.count} business(es) with BIR defaults`)
    console.log(`   - MIN: xxxxxxxxxxxxx`)
    console.log(`   - Serial Number: xxxxxxxxxxxxx`)
    console.log(`   - Operated By: Charlie Hiadan`)

    // Show current businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        birMinNumber: true,
        birSerialNumber: true,
        operatedBy: true,
      },
    })

    console.log('\n📋 Current Businesses:')
    businesses.forEach((business) => {
      console.log(`   ${business.id}. ${business.name}`)
      console.log(`      MIN: ${business.birMinNumber}`)
      console.log(`      S/N: ${business.birSerialNumber}`)
      console.log(`      Operated By: ${business.operatedBy}`)
    })

    console.log('\n✅ BIR defaults set successfully!')
    console.log('\n💡 Note: These are temporary placeholder values.')
    console.log('   Update them in Business Settings with actual BIR-registered values.')
  } catch (error) {
    console.error('❌ Error setting BIR defaults:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

setBIRDefaults()
  .then(() => {
    console.log('\n🎉 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error)
    process.exit(1)
  })
