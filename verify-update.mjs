import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verify() {
  const dummy = await prisma.productVariation.count({ where: { name: 'DUMMY' } })
  const def = await prisma.productVariation.count({ where: { name: 'Default' } })
  console.log('DUMMY variations:', dummy)
  console.log('Default variations:', def)
  await prisma.$disconnect()
}

verify()
