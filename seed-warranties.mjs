import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedWarranties() {
  try {
    console.log('🌱 Seeding warranty templates...')

    // Get all businesses
    const businesses = await prisma.business.findMany()

    if (businesses.length === 0) {
      console.log('⚠️  No businesses found. Please run the main seed first.')
      return
    }

    const warrantyTemplates = [
      {
        name: '7 Days Replacement',
        description: 'Standard 7-day replacement warranty for retail items',
        duration: 7,
        durationType: 'days',
      },
      {
        name: '1 Month Warranty',
        description: 'Basic 1-month warranty for standard products',
        duration: 1,
        durationType: 'months',
      },
      {
        name: '3 Months Warranty',
        description: 'Extended 3-month warranty for quality products',
        duration: 3,
        durationType: 'months',
      },
      {
        name: '6 Months Warranty',
        description: 'Standard 6-month warranty for electronics',
        duration: 6,
        durationType: 'months',
      },
      {
        name: '1 Year Warranty',
        description: 'Industry standard 1-year warranty',
        duration: 12,
        durationType: 'months',
      },
      {
        name: '2 Years Extended',
        description: 'Extended 2-year warranty for premium products',
        duration: 24,
        durationType: 'months',
      },
      {
        name: '3 Years Premium',
        description: 'Premium 3-year warranty for high-end electronics',
        duration: 36,
        durationType: 'months',
      },
    ]

    for (const business of businesses) {
      console.log(`\n📋 Creating warranties for business: ${business.name}`)

      for (const template of warrantyTemplates) {
        // Check if warranty already exists
        const existing = await prisma.warranty.findFirst({
          where: {
            businessId: business.id,
            name: template.name,
            deletedAt: null,
          },
        })

        if (existing) {
          console.log(`   ⏭️  Skipping "${template.name}" (already exists)`)
          continue
        }

        const warranty = await prisma.warranty.create({
          data: {
            businessId: business.id,
            ...template,
          },
        })

        console.log(`   ✅ Created: ${warranty.name} (${warranty.duration} ${warranty.durationType})`)
      }
    }

    console.log('\n✅ Warranty seeding completed successfully!')
  } catch (error) {
    console.error('❌ Error seeding warranties:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedWarranties()
