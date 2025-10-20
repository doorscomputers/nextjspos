import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBusiness() {
  try {
    const business = await prisma.business.findFirst()
    console.log('Business:', business)

    const locations = await prisma.businessLocation.findMany({
      where: { businessId: business?.id },
      select: { id: true, name: true }
    })
    console.log('Locations:', locations)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkBusiness()
