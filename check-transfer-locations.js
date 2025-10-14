const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkTransferLocations() {
  try {
    // Get all locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: 1 },
      select: { id: true, name: true }
    })

    console.log('=== Business Locations ===')
    locations.forEach(l => console.log(`ID: ${l.id}, Name: ${l.name}`))
    console.log('')

    // Get the transfer
    const transfer = await prisma.stockTransfer.findFirst({
      where: { transferNumber: 'TR-202510-0001' },
      select: {
        id: true,
        transferNumber: true,
        fromLocationId: true,
        toLocationId: true
      }
    })

    if (transfer) {
      console.log('=== Transfer Details ===')
      console.log(`Transfer: ${transfer.transferNumber}`)
      console.log(`From Location ID: ${transfer.fromLocationId}`)
      console.log(`To Location ID: ${transfer.toLocationId}`)

      const fromLoc = locations.find(l => l.id === transfer.fromLocationId)
      const toLoc = locations.find(l => l.id === transfer.toLocationId)

      console.log(`From Location Name: ${fromLoc ? fromLoc.name : 'NOT FOUND'}`)
      console.log(`To Location Name: ${toLoc ? toLoc.name : 'NOT FOUND'}`)
    } else {
      console.log('Transfer not found')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkTransferLocations()
