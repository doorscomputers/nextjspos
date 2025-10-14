const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('=== Reorganizing Warehouse Locations ===\n')

  // Step 1: Rename "Warehouse" (ID: 2) to "Future Location"
  console.log('Step 1: Renaming "Warehouse" (ID: 2) to "Future Location"...')
  const updatedWarehouse = await prisma.businessLocation.update({
    where: { id: 2 },
    data: { name: 'Future Location' }
  })
  console.log(`✓ Renamed to: "${updatedWarehouse.name}"\n`)

  // Step 2: Find Jheirone's current assignment
  console.log('Step 2: Finding Jheirone\'s current location assignment...')
  const jheirone = await prisma.user.findFirst({
    where: { username: 'Jheirone' }
  })

  if (!jheirone) {
    console.log('✗ User Jheirone not found!')
    return
  }

  const currentAssignment = await prisma.userLocation.findUnique({
    where: {
      userId_locationId: {
        userId: jheirone.id,
        locationId: 2
      }
    }
  })

  if (currentAssignment) {
    console.log(`✓ Found assignment: Jheirone -> Location ID 2\n`)

    // Step 3: Delete old assignment and create new one
    console.log('Step 3: Reassigning Jheirone to "Main Warehouse" (ID: 100)...')

    // Delete old assignment
    await prisma.userLocation.delete({
      where: {
        userId_locationId: {
          userId: jheirone.id,
          locationId: 2
        }
      }
    })

    // Create new assignment
    await prisma.userLocation.create({
      data: {
        userId: jheirone.id,
        locationId: 100
      }
    })
    console.log('✓ Jheirone reassigned to "Main Warehouse"\n')
  } else {
    console.log('⚠ Jheirone is not assigned to Location ID 2, checking if already assigned to Main Warehouse...\n')

    const existingMainAssignment = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: {
          userId: jheirone.id,
          locationId: 100
        }
      }
    })

    if (!existingMainAssignment) {
      console.log('Creating new assignment to Main Warehouse...')
      await prisma.userLocation.create({
        data: {
          userId: jheirone.id,
          locationId: 100
        }
      })
      console.log('✓ Jheirone assigned to "Main Warehouse"\n')
    } else {
      console.log('✓ Jheirone already assigned to "Main Warehouse"\n')
    }
  }

  // Verification
  console.log('=== Verification ===\n')

  const futureLocation = await prisma.businessLocation.findUnique({
    where: { id: 2 }
  })
  console.log(`Location ID 2: "${futureLocation?.name}"`)

  const mainWarehouse = await prisma.businessLocation.findUnique({
    where: { id: 100 }
  })
  console.log(`Location ID 100: "${mainWarehouse?.name}"`)

  const jheironeAssignments = await prisma.userLocation.findMany({
    where: { userId: jheirone.id },
    include: {
      location: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  console.log(`\nJheirone's assignments:`)
  jheironeAssignments.forEach(a => {
    console.log(`  - ${a.location.name} (ID: ${a.location.id})`)
  })

  console.log('\n✅ All changes completed successfully!')
  console.log('\nNext steps:')
  console.log('1. Refresh the transfer page - "From Location" should now show "Main Warehouse"')
  console.log('2. "Future Location" will still appear in dropdowns but you can hide it in reports')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
